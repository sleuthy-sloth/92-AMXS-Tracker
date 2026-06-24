import { useState, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { TrainingRecord } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { parseTrainingReport } from '../services/ocrService';

export interface UseTrainingUploadReturn {
  isUploading: boolean;
  setIsUploading: (value: boolean) => void;
  uploadProgress: number;
  handleFileUpload: (files: FileList) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useTrainingUpload(): UseTrainingUploadReturn {
  const { profile, isDemoMode } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (files: FileList) => {
    if (!profile || isDemoMode) {
      alert('File upload is disabled in demo mode.');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    const fileArray = Array.from(files);
    let processed = 0;

    try {
      for (const file of fileArray) {
        // Convert file to base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Parse the training report
        const records = await parseTrainingReport(base64, file.type);

        for (const record of records) {
          const newTraining: Omit<TrainingRecord, 'id'> = {
            course_name: record.course_name,
            course_code: record.course_code || '',
            personnel_name: profile.name,
            man_number: record.man_number || profile.man_number,
            amuId: profile.amuId,
            shopId: profile.shopId,
            due_date: record.due_date,
            status: 'current',
            certificateUrl: base64,
            isDemo: false,
            createdAt: serverTimestamp(),
            createdBy: profile.uid,
          };

          await addDoc(collection(db, 'trainings'), newTraining);
        }

        processed++;
        setUploadProgress(Math.round((processed / fileArray.length) * 100));
      }

      alert(`Successfully processed ${processed} training certificate(s).`);
    } catch (error) {
      console.error('Error uploading training certificates:', error);
      handleFirestoreError(error, OperationType.CREATE, 'trainings');
      alert('Failed to process some certificates. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return {
    isUploading,
    setIsUploading,
    uploadProgress,
    handleFileUpload,
    fileInputRef,
  };
}
