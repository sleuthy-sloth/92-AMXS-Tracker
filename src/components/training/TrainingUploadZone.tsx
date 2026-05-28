import React from 'react';
import { motion } from 'motion/react';
import { Upload, Loader2 } from 'lucide-react';

interface TrainingUploadZoneProps {
  isUploading: boolean;
  uploadProgress: number;
  onFileSelect: (files: FileList) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const TrainingUploadZone: React.FC<TrainingUploadZoneProps> = ({
  isUploading,
  uploadProgress,
  onFileSelect,
  fileInputRef,
}) => {
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      onFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  return (
    <div className="bg-surface rounded-lg border-2 border-dashed border-outline p-8">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        onChange={(e) => e.target.files && onFileSelect(e.target.files)}
        className="hidden"
      />

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="text-center cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
      >
        {isUploading ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
            <div>
              <p className="font-bold text-slate-900 mb-2">Processing certificates...</p>
              <div className="w-full bg-slate-200 rounded-full h-2 max-w-xs mx-auto">
                <motion.div
                  className="bg-primary h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-sm text-slate-500 mt-2">{uploadProgress}% complete</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            <Upload className="w-12 h-12 text-primary mx-auto" />
            <div>
              <p className="font-bold text-slate-900 mb-2">Upload Training Certificates</p>
              <p className="text-sm text-slate-500">Drag and drop files here, or click to select</p>
              <p className="text-xs text-slate-400 mt-2">
                Supports: Images (JPG, PNG) and PDF files
              </p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};
