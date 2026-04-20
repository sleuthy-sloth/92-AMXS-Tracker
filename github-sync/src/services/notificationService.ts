import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Notification } from '../types';

export const createNotification = async (notif: Omit<Notification, 'timestamp' | 'isRead'>) => {
  try {
    const newNotif = {
      ...notif,
      isRead: false,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, 'notifications'), newNotif);
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
};
