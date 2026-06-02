import React, { useState, useRef, useCallback } from 'react';
import { X, FileUp, FileSpreadsheet, Upload } from 'lucide-react';
import { motion } from 'motion/react';
import { serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import { useAuth } from '../../contexts/AuthContextInstance';
import { cn } from '../../lib/utils';
import { formatSize } from './formatSize';

type DocType = 'iso' | 'qrl';

interface UploadSectionProps {
  docType: DocType;
  onClose: () => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ docType, onClose }) => {
  const { profile, isDemoMode } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isExcel = (f: File) =>
    f.name.endsWith('.xlsx') || f.name.endsWith('.xls') || f.name.endsWith('.csv');

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && isExcel(f)) {
      setFile(f);
      setError(null);
    } else {
      setError('Only .xlsx, .xls, or .csv files accepted');
    }
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      if (isExcel(f)) {
        setFile(f);
        setError(null);
      } else {
        setError('Only .xlsx, .xls, or .csv files accepted');
      }
    }
  };

  const handleUpload = async () => {
    if (!file || !profile || isDemoMode) return;
    if (profile.amuId === 'ALL' || profile.shopId === 'ALL') {
      setError('Please select a specific AMU and Shop in the sidebar before uploading.');
      return;
    }

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `reference-docs/${timestamp}-${safeName}`;
      const storageRefPath = storageRef(storage, path);

      const uploadTask = uploadBytesResumable(storageRefPath, file);

      await new Promise<void>((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
          },
          (err) => reject(err),
          () => resolve()
        );
      });

      const downloadUrl = await getDownloadURL(storageRefPath);

      await addDoc(collection(db, 'reference_docs'), {
        name: file.name,
        type: docType,
        storagePath: path,
        downloadUrl,
        size: file.size,
        mimeType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: description.trim() || '',
        uploadedBy: profile.name,
        uploadedByUid: profile.uid,
        shopId: profile.shopId,
        amuId: profile.amuId,
        uploadedAt: serverTimestamp(),
        isDemo: false,
      });

      setFile(null);
      setDescription('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Upload ${docType === 'iso' ? 'ISO Checklist' : 'QRL'}`}
      tabIndex={-1}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white max-w-lg w-full border border-outline shadow-2xl flex flex-col"
      >
        <div className="p-8 border-b border-outline bg-putty/30 flex justify-between items-center shrink-0">
          <h3 className="font-black text-2xl tracking-tighter uppercase flex items-center gap-3">
            <FileUp className="w-6 h-6" />
            Upload {docType === 'iso' ? 'ISO Checklist' : 'QRL'}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close upload dialog"
            className="p-2 hover:bg-slate-100 transition-colors text-slate-900"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          {/* Drop zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed p-10 text-center cursor-pointer transition-colors',
              file
                ? 'border-primary bg-primary/5'
                : 'border-slate-200 hover:border-primary/50 hover:bg-slate-50'
            )}
            role="button"
            tabIndex={0}
            aria-label="Drop Excel file here or click to browse"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
              aria-label="Select file to upload"
            />
            {file ? (
              <div className="flex flex-col items-center gap-3">
                <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                <p className="font-black text-sm uppercase tracking-tight">{file.name}</p>
                <p className="tech-label text-xs text-slate-400">{formatSize(file.size)}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="text-safety-orange text-[10px] font-black uppercase tracking-widest hover:underline"
                  aria-label="Remove selected file"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Upload className="w-10 h-10 text-slate-300" />
                <p className="font-black text-sm uppercase tracking-tight text-slate-500">
                  Drop an Excel file here
                </p>
                <p className="tech-label text-xs text-slate-400">or click to browse</p>
                <span className="px-3 py-1 bg-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                  .xlsx • .xls • .csv
                </span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label htmlFor="doc-description" className="tech-label">
              Description (optional)
            </label>
            <input
              id="doc-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="sleek-input w-full"
              placeholder="e.g. FY26 ISO Checklist v3 — Avionics"
              disabled={uploading}
            />
          </div>

          {/* Progress bar */}
          {uploading && (
            <div
              className="space-y-2"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                <span className="text-primary">Uploading...</span>
                <span className="text-slate-400">{progress}%</span>
              </div>
              <div className="h-2 bg-slate-100 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="p-3 bg-safety-orange/10 border border-safety-orange/20 text-safety-orange text-[11px] font-bold uppercase tracking-wider"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={uploading}
              className="flex-1 py-4 border-2 border-slate-200 font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-colors disabled:opacity-30"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={!file || uploading || isDemoMode}
              aria-label="Upload file"
              className="flex-1 py-4 bg-primary text-white font-black text-[10px] uppercase tracking-[0.2em] hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20 disabled:opacity-30"
            >
              {uploading ? `Uploading ${progress}%...` : 'Upload'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
