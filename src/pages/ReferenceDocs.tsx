import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plus,
  X,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  Eye,
  Loader2,
  Upload,
  Search,
  Sparkles,
  FileUp,
  Pencil,
  Save,
  CheckCircle2,
} from 'lucide-react';
import {
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  QueryConstraint,
} from 'firebase/firestore';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { db, storage, handleFirestoreError, OperationType } from '../firebase';
import type { ReferenceDoc } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { cn, tsToDate } from '../lib/utils';
import { format } from 'date-fns';

type DocType = 'iso' | 'qrl';

const DOC_TABS: { key: DocType; label: string; description: string }[] = [
  {
    key: 'iso',
    label: 'ISO Checklists',
    description: 'Isochronal inspection checklist logs',
  },
  {
    key: 'qrl',
    label: 'QRL',
    description: 'Quick Reference List — commonly ordered parts',
  },
];

/** Format bytes to a human-readable string */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Parse a sheet range into a display label */
function formatSheetRange(range: string | undefined): string {
  if (!range) return '';
  // e.g. "A1:Z100" — keep as-is, it's readable
  return range;
}

// ─── Viewer Modal ───────────────────────────────────────────────────────────

interface ViewerModalProps {
  doc: ReferenceDoc;
  onClose: () => void;
}

const ViewerModal: React.FC<ViewerModalProps> = ({ doc, onClose }) => {
  const { profile, isDemoMode } = useAuth();
  const [sheets, setSheets] = useState<
    { name: string; html: string; rows: number; cols: number }[]
  >([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkbook() {
      try {
        setLoading(true);
        setError(null);

        // Fetch the file from the download URL
        const response = await fetch(doc.downloadUrl);
        if (!response.ok) throw new Error(`Failed to fetch file (HTTP ${response.status})`);
        const buffer = await response.arrayBuffer();

        // Read with SheetJS
        const workbook = XLSX.read(buffer, { type: 'array' });

        const parsed = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const ref = sheet['!ref'];
          const range = ref ? XLSX.utils.decode_range(ref) : null;
          const rows = range ? range.e.r - range.s.r + 1 : 0;
          const cols = range ? range.e.c - range.s.c + 1 : 0;

          // Convert to HTML table — editable only when toggled
          const html = XLSX.utils.sheet_to_html(sheet, {
            id: `sheet-${name}`,
            editable: false,
          });

          return { name, html, rows, cols };
        });

        if (!cancelled) {
          setSheets(parsed);
          setActiveSheet(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load spreadsheet');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadWorkbook();
    return () => {
      cancelled = true;
    };
  }, [doc.downloadUrl]);

  // Toggle edit mode: re-render the active sheet with/without contenteditable
  const toggleEditMode = () => {
    if (isEditing) {
      // Switching OUT of edit mode — re-render without editable
      setIsEditing(false);
      return;
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!profile || isDemoMode || !sheets.length) return;

    setSaving(true);
    try {
      // 1. Read each sheet's table from the DOM and build a new workbook
      const newWorkbook = XLSX.utils.book_new();

      for (let i = 0; i < sheets.length; i++) {
        const sheetName = sheets[i].name;
        const tableEl = document.getElementById(`sheet-${sheetName}`) as HTMLTableElement | null;
        if (!tableEl) continue;

        // Parse the HTML table back into a worksheet
        const worksheet = XLSX.utils.table_to_sheet(tableEl, { raw: true });

        // If original sheet had column widths, preserve them
        // Append the sheet
        XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);
      }

      // 2. Write as .xlsx buffer
      const wbout = XLSX.write(newWorkbook, {
        type: 'array',
        bookType: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // 3. Create a File from the buffer
      const timestamp = Date.now();
      const dateStr = new Date().toISOString().slice(0, 10);
      const baseName = doc.name.replace(/\.(xlsx|xls|csv)$/i, '');
      const newName = `${baseName}_completed_${dateStr}.xlsx`;
      const blob = new Blob([wbout], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const file = new File([blob], newName, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      // 4. Upload to Firebase Storage
      const safeName = newName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `reference-docs/${timestamp}-${safeName}`;
      const storageRefPath = storageRef(storage, path);

      await uploadBytesResumable(storageRefPath, file);

      const downloadUrl = await getDownloadURL(storageRefPath);

      // 5. Create new Firestore record (doesn't overwrite the template)
      await addDoc(collection(db, 'reference_docs'), {
        name: newName,
        type: doc.type,
        storagePath: path,
        downloadUrl,
        size: wbout.byteLength,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        description: `Completed: ${doc.name} — edited in-browser by ${profile.name}`,
        uploadedBy: profile.name,
        uploadedByUid: profile.uid,
        shopId: profile.shopId,
        amuId: profile.amuId,
        uploadedAt: serverTimestamp(),
        isDemo: false,
      });

      setIsEditing(false);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-stealth/95 backdrop-blur-xl"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white max-w-6xl w-full max-h-[90vh] flex flex-col border border-outline shadow-2xl"
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-outline bg-putty/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4 min-w-0">
            <div className="p-3 bg-white border border-outline shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="font-black text-xl tracking-tighter uppercase truncate">{doc.name}</h3>
              <p className="tech-label text-xs mt-1 text-slate-500">
                Uploaded by {doc.uploadedBy} •{' '}
                {format(tsToDate(doc.uploadedAt), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {!isEditing ? (
              <button
                onClick={toggleEditMode}
                className="p-2 border border-outline text-slate-500 hover:text-primary hover:border-primary transition-all hover:bg-primary/5 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
            ) : (
              <>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5" />
                  Editing
                </span>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Completed'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  className="p-2 border border-outline text-slate-500 hover:text-safety-orange transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                >
                  Cancel Edit
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 transition-colors text-slate-900"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Sheet tabs */}
        {sheets.length > 1 && (
          <div className="flex gap-1 px-8 pt-4 border-b border-outline overflow-x-auto">
            {sheets.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveSheet(i)}
                className={cn(
                  'px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all border-b-2 shrink-0',
                  i === activeSheet
                    ? 'text-primary border-primary'
                    : 'text-slate-400 border-transparent hover:text-slate-700 hover:border-slate-300'
                )}
              >
                {s.name}
                <span className="ml-2 text-[8px] text-slate-400 font-normal">
                  {s.rows}r × {s.cols}c
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-8 custom-scrollbar">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="tech-label text-sm text-slate-400">Loading spreadsheet...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <FileText className="w-12 h-12 text-safety-orange/50" />
              <p className="tech-label text-sm text-safety-orange">{error}</p>
              <a
                href={doc.downloadUrl}
                download={doc.name}
                className="sleek-button flex items-center gap-2 mt-4"
              >
                <Download className="w-4 h-4" /> Download to Open Locally
              </a>
            </div>
          )}

          {!loading && !error && sheets.length > 0 && (
            <div
              className="xlsx-viewer"
              contentEditable={isEditing}
              suppressContentEditableWarning
              style={
                isEditing ? { outline: '2px solid #f59e0b', outlineOffset: '-2px' } : undefined
              }
              dangerouslySetInnerHTML={{ __html: sheets[activeSheet]?.html || '' }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-8 py-4 border-t border-outline bg-slate-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-[10px] text-slate-400 font-medium">
              {sheets.length > 0
                ? `${sheets[activeSheet]?.rows} rows × ${sheets[activeSheet]?.cols} columns`
                : `${formatSize(doc.size)}`}
            </span>
            {isEditing && (
              <span className="text-[10px] text-amber-600 font-black uppercase tracking-widest flex items-center gap-1.5">
                <Pencil className="w-3 h-3" />
                Click any cell to edit — save as a new completed checklist
              </span>
            )}
          </div>
          <a
            href={doc.downloadUrl}
            download={doc.name}
            className="sleek-button bg-sidebar !text-white flex items-center gap-2 py-2 text-[10px]"
          >
            <Download className="w-3.5 h-3.5" /> Download Original
          </a>
        </div>
      </motion.div>
    </div>
  );
};

// ─── Upload Section ─────────────────────────────────────────────────────────

interface UploadSectionProps {
  docType: DocType;
  onClose: () => void;
}

const UploadSection: React.FC<UploadSectionProps> = ({ docType, onClose }) => {
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
      // Generate a unique storage path
      const timestamp = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `reference-docs/${timestamp}-${safeName}`;
      const storageRefPath = storageRef(storage, path);

      // Upload with progress tracking
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

      // Get the download URL
      const downloadUrl = await getDownloadURL(storageRefPath);

      // Create Firestore record
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

      // Reset and close
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
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileSelect}
              className="hidden"
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
            <label className="tech-label">Description (optional)</label>
            <input
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
            <div className="space-y-2">
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
            <div className="p-3 bg-safety-orange/10 border border-safety-orange/20 text-safety-orange text-[11px] font-bold uppercase tracking-wider">
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

// ─── Main Page ──────────────────────────────────────────────────────────────

export const ReferenceDocs: React.FC = () => {
  const { profile, isDemoMode } = useAuth();
  const [activeType, setActiveType] = useState<DocType>('iso');
  const [firestoreDocs, setFirestoreDocs] = useState<ReferenceDoc[]>([]);
  const [demoDocs, setDemoDocs] = useState<ReferenceDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [viewerDoc, setViewerDoc] = useState<ReferenceDoc | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Subscribe to Firestore
  useEffect(() => {
    if (!profile || isDemoMode) {
      setLoading(false);
      return;
    }

    const constraints: QueryConstraint[] = [
      where('type', '==', activeType),
      orderBy('uploadedAt', 'desc'),
    ];

    const q = query(collection(db, 'reference_docs'), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setFirestoreDocs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }) as ReferenceDoc));
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, 'reference_docs');
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [profile, isDemoMode, activeType]);

  // Seed mock data in demo mode
  const seedMockData = () => {
    const mockDocs: ReferenceDoc[] = Array.from({ length: 3 }).map((_, i) => ({
      id: `mock-${Date.now()}-${i}`,
      name:
        activeType === 'iso'
          ? `ISO_Checklist_${['Phase_1', 'Phase_2', 'Phase_3'][i]}.xlsx`
          : `QRL_${['Avionics_Parts', 'Hardware_List', 'Consumables'][i]}.xlsx`,
      type: activeType,
      storagePath: 'mock',
      downloadUrl: '',
      size: Math.floor(Math.random() * 50000) + 10000,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      description:
        activeType === 'iso'
          ? `ISO ${['Phase 1', 'Phase 2', 'Phase 3'][i]} checklist — ${['preliminary', 'intermediate', 'final'][i]} inspection`
          : `${['Avionics parts', 'Hardware/HEX stock', 'Consumables'][i]} quick reference`,
      uploadedBy: profile?.name || 'Demo User',
      uploadedByUid: 'demo',
      shopId: profile?.shopId || 'AVIONICS',
      amuId: profile?.amuId || 'BLACK',
      uploadedAt: serverTimestamp(),
      isDemo: true,
    }));
    setDemoDocs((prev) => [...mockDocs, ...prev]);
  };

  const docs = useMemo(() => {
    if (!profile) return [];
    if (isDemoMode) return demoDocs;
    return firestoreDocs;
  }, [isDemoMode, profile, firestoreDocs, demoDocs]);

  const filteredDocs = useMemo(
    () =>
      docs.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (d.description && d.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
          d.uploadedBy.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [docs, searchQuery]
  );

  const handleDelete = async (docId: string, storagePath: string) => {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      // Delete from Storage
      try {
        await deleteObject(storageRef(storage, storagePath));
      } catch {
        // File may not exist in storage anymore — still delete the record
      }
      // Delete from Firestore
      await deleteDoc(doc(db, 'reference_docs', docId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `reference_docs/${docId}`);
    }
  };

  const canManage = profile?.role === 'ncoic' || profile?.role === 'leadership';

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tighter uppercase text-slate-900">
            Reference Docs
          </h2>
          <p className="serif-header text-lg mt-1 text-slate-600">
            {activeType === 'iso'
              ? 'Isochronal inspection checklists — digitized'
              : 'Quick Reference List — commonly ordered parts'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isDemoMode && (
            <button
              onClick={seedMockData}
              className="sleek-button bg-surface border-primary text-primary hover:bg-primary/5 flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> Seed Mocks
            </button>
          )}
          <button
            onClick={() => setShowUpload(true)}
            className="sleek-button flex items-center gap-2"
          >
            <Plus className="w-5 h-5" /> Upload
          </button>
        </div>
      </div>

      {/* Sub-tabs: ISO | QRL */}
      <div className="flex gap-1 border-b border-outline">
        {DOC_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveType(tab.key)}
            className={cn(
              'flex items-center gap-2 px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all border-b-2',
              activeType === tab.key
                ? 'text-primary border-primary'
                : 'text-slate-500 border-transparent hover:text-slate-900 hover:border-slate-300'
            )}
          >
            <FileText className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="visible-grid bg-surface p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant z-10" />
          <input
            type="text"
            placeholder="Search by filename, description, or uploader..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sleek-input pl-10 w-full !border-none !bg-transparent"
          />
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white border border-outline border-dashed">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="tech-label">Loading documents...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center gap-4 bg-white border border-outline border-dashed">
          <FileSpreadsheet className="w-12 h-12 text-slate-200" />
          <p className="tech-label opacity-40">
            No {activeType === 'iso' ? 'ISO checklists' : 'QRL documents'} uploaded yet
          </p>
          <button
            onClick={() => setShowUpload(true)}
            className="sleek-button flex items-center gap-2 mt-2"
          >
            <Upload className="w-4 h-4" /> Upload First File
          </button>
        </div>
      ) : (
        <div className="visible-grid bg-surface overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono border-b border-outline">
                <th className="px-8 py-5">Document</th>
                <th className="px-8 py-5 hidden md:table-cell">Uploaded By</th>
                <th className="px-8 py-5 hidden lg:table-cell">Size</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline">
              {filteredDocs.map((docItem, idx) => (
                <motion.tr
                  key={docItem.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="hover:bg-slate-50/50 group"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-slate-100 border border-outline shrink-0">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm tracking-tight uppercase text-slate-900 truncate max-w-xs">
                          {docItem.name}
                        </p>
                        {docItem.description && (
                          <p className="serif-header text-[10px] text-slate-400 mt-1 max-w-sm line-clamp-1">
                            {docItem.description}
                          </p>
                        )}
                        <p className="tech-label text-[9px] text-slate-300 mt-1.5">
                          {docItem.uploadedAt &&
                            format(tsToDate(docItem.uploadedAt), 'MMM dd, yyyy HH:mm')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 hidden md:table-cell">
                    <span className="tech-label text-xs text-slate-600 uppercase font-bold">
                      {docItem.uploadedBy}
                    </span>
                  </td>
                  <td className="px-8 py-5 hidden lg:table-cell">
                    <span className="font-mono text-[11px] text-slate-400">
                      {formatSize(docItem.size)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex justify-end gap-2">
                      {docItem.downloadUrl ? (
                        <button
                          onClick={() => setViewerDoc(docItem)}
                          className="p-2 border border-transparent hover:border-outline text-slate-400 hover:text-primary transition-all"
                          title="View Document"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="p-2 text-slate-200" title="No preview (demo data)">
                          <Eye className="w-4 h-4" />
                        </span>
                      )}
                      <a
                        href={docItem.downloadUrl || '#'}
                        download={docItem.name}
                        className={cn(
                          'p-2 border border-transparent hover:border-outline transition-all',
                          docItem.downloadUrl
                            ? 'text-slate-400 hover:text-emerald-600'
                            : 'text-slate-200 pointer-events-none'
                        )}
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {(canManage || !isDemoMode) && (
                        <button
                          onClick={() => {
                            if (docItem.id && docItem.storagePath) {
                              handleDelete(docItem.id, docItem.storagePath);
                            }
                          }}
                          className="p-2 border border-transparent hover:border-outline text-slate-400 hover:text-safety-orange transition-all"
                          title={canManage ? 'Delete' : 'Delete (NCOIC/Leadership only)'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {showUpload && <UploadSection docType={activeType} onClose={() => setShowUpload(false)} />}
      </AnimatePresence>

      {/* Viewer Modal */}
      <AnimatePresence>
        {viewerDoc && <ViewerModal doc={viewerDoc} onClose={() => setViewerDoc(null)} />}
      </AnimatePresence>
    </div>
  );
};
