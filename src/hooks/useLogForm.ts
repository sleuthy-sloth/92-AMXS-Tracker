import { useState } from 'react';
import { MaintenanceLog, ShiftType } from '../types';

export interface LogFormData {
  tail_number: string;
  jcn: string;
  discrepancy: string;
  repair: string;
  doc_number: string;
  personnelInput: string;
  isRedBall: boolean;
  shift: ShiftType;
  g081Photo: string;
}

const initialFormData: LogFormData = {
  tail_number: '',
  jcn: '',
  discrepancy: '',
  repair: '',
  doc_number: '',
  personnelInput: '',
  isRedBall: false,
  shift: 'Days',
  g081Photo: '',
};

export interface UseLogFormReturn {
  formData: LogFormData;
  setFormData: React.Dispatch<React.SetStateAction<LogFormData>>;
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
  editingLogId: string | null;
  setEditingLogId: (id: string | null) => void;
  originalLogState: MaintenanceLog | null;
  setOriginalLogState: (log: MaintenanceLog | null) => void;
  loading: boolean;
  setLoading: (value: boolean) => void;
  resetForm: () => void;
}

export function useLogForm(): UseLogFormReturn {
  const [formData, setFormData] = useState<LogFormData>(initialFormData);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [originalLogState, setOriginalLogState] = useState<MaintenanceLog | null>(null);
  const [loading, setLoading] = useState(false);

  const resetForm = () => {
    setFormData(initialFormData);
    setEditingLogId(null);
    setOriginalLogState(null);
  };

  return {
    formData,
    setFormData,
    isModalOpen,
    setIsModalOpen,
    editingLogId,
    setEditingLogId,
    originalLogState,
    setOriginalLogState,
    loading,
    setLoading,
    resetForm,
  };
}
