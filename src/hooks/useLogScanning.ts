import { useState, useRef } from 'react';
import { serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { MaintenanceLog, ShiftType } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { scanMaintenanceForm, scanLogBook } from '../services/ocrService';
import { LogFormData } from './useLogForm';

export interface UseLogScanningReturn {
  isScanning: boolean;
  setIsScanning: (value: boolean) => void;
  isG081Uploading: boolean;
  setIsG081Uploading: (value: boolean) => void;
  scanInputRef: React.RefObject<HTMLInputElement | null>;
  g081InputRef: React.RefObject<HTMLInputElement | null>;
  bulkScanInputRef: React.RefObject<HTMLInputElement | null>;
  handleScan: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleScanLogbook: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleG081Upload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function useLogScanning(
  setFormData: React.Dispatch<React.SetStateAction<LogFormData>>,
  demoSeededLogs: MaintenanceLog[],
  setDemoSeededLogs: React.Dispatch<React.SetStateAction<MaintenanceLog[]>>
): UseLogScanningReturn {
  const { profile, isDemoMode } = useAuth();
  const [isScanning, setIsScanning] = useState(false);
  const [isG081Uploading, setIsG081Uploading] = useState(false);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const g081InputRef = useRef<HTMLInputElement>(null);
  const bulkScanInputRef = useRef<HTMLInputElement>(null);

  const handleScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const result = await scanMaintenanceForm(base64);
      if (result) {
        setFormData((prev) => ({
          ...prev,
          tail_number: result.tail_number || prev.tail_number,
          discrepancy: result.discrepancy || prev.discrepancy,
          repair: result.repair || prev.repair,
          jcn: result.jcn || prev.jcn,
          doc_number: result.doc_number || prev.doc_number,
        }));
      }
    } catch (error) {
      console.error('Scanning failed:', error);
      alert('Failed to parse form. Please try a clearer picture.');
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleScanLogbook = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      alert('Please select a specific AMU and Shop before bulk scanning logbooks.');
      return;
    }

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      const results = await scanLogBook(base64);
      if (results && results.length > 0) {
        if (
          !window.confirm(
            `Found ${results.length} maintenance entries. Import them all into ${profile.amuId} AMU - ${profile.shopId} Shop?`
          )
        ) {
          return;
        }

        const batch = results.map((result) => ({
          tail_number: result.tail_number || 'UNKNOWN',
          jcn: result.jcn || '',
          discrepancy: result.discrepancy,
          repair: result.repair,
          shopId: profile.shopId,
          amuId: profile.amuId,
          technician_name: profile.name,
          man_number: profile.man_number,
          shift: 'Days' as ShiftType,
          timestamp: serverTimestamp(),
          isDemo: isDemoMode,
          isRedBall: false,
        }));

        if (isDemoMode) {
          const mockEntries = batch.map(
            (b, i) =>
              ({
                id: `bulk-mock-${Date.now()}-${i}`,
                ...b,
              }) as MaintenanceLog
          );
          setDemoSeededLogs((prev) => [...mockEntries, ...prev]);
          alert(`Successfully imported ${results.length} entries.`);
        } else {
          const settled = await Promise.allSettled(
            batch.map((entry) => addDoc(collection(db, 'logs'), entry))
          );
          const succeeded = settled.filter((s) => s.status === 'fulfilled').length;
          const failed = settled.length - succeeded;
          if (failed > 0) {
            settled.forEach((s, i) => {
              if (s.status === 'rejected') {
                console.error(`Bulk import entry ${i} failed:`, s.reason);
              }
            });
            alert(
              `Imported ${succeeded} of ${settled.length} entries. ${failed} failed — see console for details.`
            );
          } else {
            alert(`Successfully imported ${succeeded} entries.`);
          }
        }
      } else {
        alert(
          'No clear maintenance entries found in the image. Please try a clearer picture of the logbook.'
        );
      }
    } catch (error) {
      console.error('Bulk scanning failed:', error);
      handleFirestoreError(error, OperationType.CREATE, 'logs/bulk');
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleG081Upload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsG081Uploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setFormData((prev) => ({ ...prev, g081Photo: reader.result as string }));
      setIsG081Uploading(false);
    };
    reader.readAsDataURL(file);
  };

  return {
    isScanning,
    setIsScanning,
    isG081Uploading,
    setIsG081Uploading,
    scanInputRef,
    g081InputRef,
    bulkScanInputRef,
    handleScan,
    handleScanLogbook,
    handleG081Upload,
  };
}
