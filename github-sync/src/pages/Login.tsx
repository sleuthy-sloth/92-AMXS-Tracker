import React, { useState } from 'react';
import { 
  Terminal, 
  ShieldCheck, 
  ShieldAlert, 
  Lock, 
  Mail, 
  ChevronLeft,
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export const Login: React.FC = () => {
  const { signIn, signInEmail, signUpEmail, resetPassword, bypassLogin } = useAuth();
  const [isEmailMode, setIsEmailMode] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      if (isResetMode) {
        await resetPassword(email);
        setMessage('Password reset email sent. Please check your inbox.');
        setIsResetMode(false);
      } else if (isSignUp) {
        await signUpEmail(email, password);
      } else {
        await signInEmail(email, password);
      }
    } catch (err: any) {
      let msg = err.message || 'Authentication failed';
      if (err.code === 'auth/invalid-credential') msg = 'Invalid credentials provided.';
      if (err.code === 'auth/user-not-found') msg = 'User account not found.';
      if (err.code === 'auth/wrong-password') msg = 'Incorrect password.';
      if (err.code === 'auth/email-already-in-use') msg = 'This email is already registered.';
      setError(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full text-center space-y-12">
        <div className="flex flex-col items-center gap-6">
          <div className="w-24 h-24 bg-sidebar border border-white/10 flex items-center justify-center shadow-2xl">
            <Terminal className="text-white w-12 h-12" />
          </div>
          <div>
            <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">92ND AMXS</h1>
            <p className="serif-header text-lg mt-2 text-slate-600">Logistics Control & Training Oversight</p>
          </div>
        </div>
        
        <div className="visible-grid bg-surface p-10 space-y-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 -mr-16 -mt-16 rotate-45 pointer-events-none"></div>
          
          <p className="serif-header text-sm leading-relaxed text-slate-600">
            Access to the 92nd AMXS Maintenance & Training system is restricted to authorized personnel only. All activity is logged and monitored.
          </p>

          {!isEmailMode ? (
            <div className="space-y-6">
              <button 
                onClick={signIn}
                className="sleek-button w-full py-4 text-sm flex items-center justify-center gap-3"
              >
                <ShieldCheck className="w-5 h-5" />
                Authenticate with Google
              </button>
              
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-outline"></div></div>
                <div className="relative flex justify-center"><span className="bg-surface px-4 tech-label text-[8px]">Developer / Admin Access</span></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => bypassLogin('leadership')}
                  className="bg-white text-slate-900 border-2 border-slate-200 px-5 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-slate-50 active:scale-95 flex flex-col items-center gap-2"
                >
                  <ShieldAlert className="w-5 h-5 text-safety-orange" />
                  <span>Demo Sandbox</span>
                </button>
                <button 
                  onClick={() => setIsEmailMode(true)}
                  className="bg-primary text-white border-2 border-primary px-5 py-4 font-black text-[10px] uppercase tracking-[0.2em] transition-all hover:bg-primary/90 active:scale-95 flex flex-col items-center gap-2 shadow-lg"
                >
                  <Lock className="w-5 h-5 text-white" />
                  <span>Master Login</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="space-y-6 text-left">
              <div className="flex justify-between items-center mb-2">
                <h3 className="tech-label text-primary">
                  {isResetMode ? 'Password Recovery' : isSignUp ? 'New Account Registration' : 'System Credential Login'}
                </h3>
                <button 
                  type="button"
                  onClick={() => {
                    setIsEmailMode(false);
                    setIsResetMode(false);
                  }}
                  className="text-[10px] uppercase font-bold tracking-widest text-slate-400 hover:text-slate-600 flex items-center gap-1"
                >
                  <ChevronLeft className="w-3 h-3" /> Back
                </button>
              </div>

              <div className="space-y-2">
                <label className="tech-label">System Email / Username</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                  <input 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="sleek-input pl-12 w-full" 
                    placeholder="admin or user@email.com" 
                  />
                </div>
              </div>

              {!isResetMode && (
                <div className="space-y-2">
                  <label className="tech-label">Access Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
                    <input 
                      type="password" 
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="sleek-input pl-12 w-full" 
                      placeholder="••••••••" 
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="p-4 bg-safety-orange/10 border border-safety-orange/20 flex items-center gap-3 text-safety-orange text-[10px] font-black uppercase tracking-tight">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {message && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3 text-emerald-600 text-[10px] font-black uppercase tracking-tight">
                  <Info className="w-4 h-4 flex-shrink-0" />
                  {message}
                </div>
              )}

              <button type="submit" className="sleek-button w-full py-4 text-xs font-black">
                {isResetMode ? 'Send Recovery Email' : isSignUp ? 'Initialize Access' : 'Authenticate Credentials'}
              </button>

              <div className="pt-4 border-t border-outline flex flex-col gap-4">
                {!isResetMode && (
                  <button 
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-[11px] font-black uppercase tracking-widest text-primary hover:underline"
                  >
                    {isSignUp ? 'Already have an account? Sign In' : 'New Personnel? Register for Access'}
                  </button>
                )}
                <button 
                  type="button"
                  onClick={() => setIsResetMode(!isResetMode)}
                  className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600"
                >
                  {isResetMode ? 'Back to Sign In' : 'Forgot Access Password?'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
