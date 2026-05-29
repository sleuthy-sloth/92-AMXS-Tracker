import React, { useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, UserRole, AMUType } from '../types';
import { ShopType, MOCK_LOGS, MOCK_PERSONNEL, MOCK_TRAINING } from '../mockData';
import { AuthContext } from './AuthContextInstance';

const seedDatabase = async () => {
  try {
    const usersSnap = await getDocs(collection(db, 'users'));
    if (usersSnap.empty) {
      console.log('Seeding database...');
      const batch = writeBatch(db);

      MOCK_PERSONNEL.forEach((p) => {
        batch.set(doc(db, 'users', p.uid), p);
      });

      MOCK_TRAINING.forEach((t) => {
        batch.set(doc(db, 'trainings', t.id || `mock-${Math.random()}`), t);
      });

      MOCK_LOGS.forEach((l) => {
        const logToSave = { ...l, timestamp: serverTimestamp() };
        batch.set(doc(db, 'logs', l.id || `mock-${Math.random()}`), logToSave);
      });

      await batch.commit();
      console.log('Database seeded successfully.');
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'seeding');
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  const toggleDemoMode = () => setIsDemoMode((prev) => !prev);

  const fetchProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        setProfile(null);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // SECURITY: Require email verification before granting access.
        // Unverified users are signed out and shown a message.
        if (!currentUser.emailVerified) {
          console.warn('[AMXS] Email not verified — signing out.');
          await signOut(auth);
          setUser(null);
          setProfile(null);
          setLoading(false);
          return;
        }
        await fetchProfile(currentUser.uid);
        // Seed database if admin logs in and it's empty.
        // Only in development — the super-admin is identified by the
        // SUPER_ADMIN_EMAIL environment variable.
        // SECURITY: Database seeding is restricted to development builds
        // (import.meta.env.DEV). It will NEVER run in production to prevent
        // mock data from being written to the live Firestore database.
        const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
        if (import.meta.env.DEV && superAdminEmail && currentUser.email === superAdminEmail) {
          await seedDatabase();
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  };

  const signInEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: unknown) {
      console.error('Email sign in error:', error);
      throw error;
    }
  };

  const signUpEmail = async (email: string, pass: string) => {
    try {
      if (!email.toLowerCase().endsWith('@us.af.mil')) {
        throw new Error('Registration is restricted to official @us.af.mil email addresses.');
      }
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      console.error('Email sign up error:', error);
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (error) {
      console.error('Password reset error:', error);
      throw error;
    }
  };

  const updateUserPassword = async (newPass: string) => {
    if (!auth.currentUser) throw new Error('No authenticated user');
    try {
      await updatePassword(auth.currentUser, newPass);
    } catch (error) {
      console.error('Password update error:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      const uidToClear = user?.uid;
      await signOut(auth);
      setUser(null);
      setProfile(null);
      if (uidToClear && typeof window !== 'undefined') {
        try {
          window.sessionStorage.removeItem(`amxs-ai-chat:${uidToClear}`);
        } catch {
          // sessionStorage unavailable — non-fatal
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.uid);
  };

  const bypassLogin = (role: UserRole = 'ncoic') => {
    // SECURITY: bypassLogin is a development-only convenience. In production
    // builds (import.meta.env.PROD), it is a no-op to prevent anyone from
    // bypassing Firebase Authentication.
    if (import.meta.env.PROD) {
      console.error('[AMXS] bypassLogin is disabled in production builds.');
      return;
    }

    const mockUser = {
      uid: 'mock-user-preview',
      email: 'dev.preview@us.af.mil',
      displayName: 'PREVIEW USER',
    } as User;

    const mockProfile: UserProfile = {
      uid: 'mock-user-preview',
      name: 'PREVIEW USER',
      rank: 'TSgt',
      man_number: '99999',
      shopId: 'AVIONICS',
      amuId: 'BLACK',
      role: role,
      email: 'dev.preview@us.af.mil',
      phone: '555-0123',
      status: 'active',
      isDemo: true,
    };

    setUser(mockUser);
    setProfile(mockProfile);
    setLoading(false);
    setIsDemoMode(true);
  };

  const setShop = async (shop: ShopType) => {
    if (profile) {
      const updatedProfile = { ...profile, shopId: shop };
      setProfile(updatedProfile);
      if (user && user.uid !== 'mock-user-preview') {
        try {
          await updateDoc(doc(db, 'users', user.uid), { shopId: shop });
        } catch (e) {
          console.error('Error updating shop in Firestore', e);
        }
      }
    }
  };

  const setAMU = async (amu: AMUType) => {
    if (profile) {
      const updatedProfile = { ...profile, amuId: amu };
      setProfile(updatedProfile);
      if (user && user.uid !== 'mock-user-preview') {
        try {
          await updateDoc(doc(db, 'users', user.uid), { amuId: amu });
        } catch (e) {
          console.error('Error updating AMU in Firestore', e);
        }
      }
    }
  };

  const setRole = async (role: UserRole) => {
    if (profile) {
      const updatedProfile = { ...profile, role: role };
      setProfile(updatedProfile);
      if (user && user.uid !== 'mock-user-preview') {
        try {
          await updateDoc(doc(db, 'users', user.uid), { role: role });
        } catch (e) {
          console.error('Error updating role in Firestore', e);
        }
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signInEmail,
        signUpEmail,
        resetPassword,
        updateUserPassword,
        logout,
        refreshProfile,
        bypassLogin,
        setShop,
        setAMU,
        setRole,
        isDemoMode,
        toggleDemoMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
