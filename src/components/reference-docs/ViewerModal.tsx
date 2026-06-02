import React, { useState, useEffect } from 'react';
import { X, FileText, FileSpreadsheet, Download, Loader2, Pencil, Save } from 'lucide-react';
import { motion } from 'motion/react';
import * as XLSX from 'xlsx';
import { serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase';
import type { ReferenceDoc } from '../../types';
import { useAuth } from '../../contexts/AuthContextInstance';
import { cn, tsToDate } from '../../lib/utils';
import { format } from 'date-fns';
import { formatSize } from './formatSize';

interface ViewerModalProps {
  doc: ReferenceDoc;
  onClose: () => void;
}

export const ViewerModal: React.FC<ViewerModalProps> = ({ doc, onClose }) => {
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

        const response = await fetch(doc.downloadUrl);
        if (!response.ok) throw new Error(`Failed to fetch file (HTTP ${response.status})`);
        const buffer = await response.arrayBuffer();

        const workbook = XLSX.read(buffer, { type: 'array' });

        const parsed = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const ref = sheet['!ref'];
          const range = ref ? XLSX.utils.decode_range(ref) : null;
          const rows = range ? range.e.r - range.s.r + 1 : 0;
          const cols = range ? range.e.c - range.s.c + 1 : 0;

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

  const toggleEditMode = () => {
    if (isEditing) {
      setIsEditing(false);
      return;
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!profile || isDemoMode || !sheets.length) return;

    setSaving(true);
    try {
      const newWorkbook = XLSX.utils.book_new();

      for (let i = 0; i < sheets.length; i++) {
        const sheetName = sheets[i].name;
        const tableEl = document.getElementById(`sheet-${sheetName}`) as HTMLTableElement | null;
        if (!tableEl) continue;

        const worksheet = XLSX.utils.table_to_sheet(tableEl, { raw: true });
        XLSX.utils.book_append_sheet(newWorkbook, worksheet, sheetName);
      }

      const wbout = XLSX.write(newWorkbook, {
        type: 'array',
        bookType: 'xlsx',
      });

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

      const safeName = newName.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `reference-docs/${timestamp}-${safeName}`;
      const storageRefPath = storageRef(storage, path);

      await uploadBytesResumable(storageRefPath, file);

      const downloadUrl = await getDownloadURL(storageRefPath);

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
      role="dialog"
      aria-modal="true"
      aria-label={`Viewing ${doc.name}`}
      tabIndex={-1}
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
                {doc.uploadedAt && format(tsToDate(doc.uploadedAt), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-4">
            {!isEditing ? (
              <button
                onClick={toggleEditMode}
                aria-label="Edit document"
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
                  aria-label="Save completed document"
                  className="p-2 bg-emerald-600 text-white hover:bg-emerald-700 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-600/20 disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  {saving ? 'Saving...' : 'Save Completed'}
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  disabled={saving}
                  aria-label="Cancel editing"
                  className="p-2 border border-outline text-slate-500 hover:text-safety-orange transition-all text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
                >
                  Cancel Edit
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Close viewer"
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
                aria-label={`View sheet ${s.name}`}
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
            aria-label={`Download ${doc.name}`}
            className="sleek-button bg-sidebar !text-white flex items-center gap-2 py-2 text-[10px]"
          >
            <Download className="w-3.5 h-3.5" /> Download Original
          </a>
        </div>
      </motion.div>
    </div>
  );
};
