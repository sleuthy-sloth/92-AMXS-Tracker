import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  FileText,
  FileSpreadsheet,
  Download,
  Trash2,
  Eye,
  Loader2,
  Upload,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  serverTimestamp,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  deleteDoc,
  doc,
  QueryConstraint,
} from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType, storage } from '../firebase';
import { writeAuditLog } from '../lib/auditLog';
import type { ReferenceDoc } from '../types';
import { useAuth } from '../contexts/AuthContextInstance';
import { cn, tsToDate } from '../lib/utils';
import { format } from 'date-fns';
import { ViewerModal } from '../components/reference-docs/ViewerModal';
import { UploadSection } from '../components/reference-docs/UploadSection';
import { formatSize } from '../components/reference-docs/formatSize';

type DocType = 'iso' | 'qrl';

const DOC_TABS: { key: DocType; label: string; description: string }[] = [
  { key: 'iso', label: 'ISO Checklists', description: 'Isochronal inspection checklist logs' },
  { key: 'qrl', label: 'QRL', description: 'Quick Reference List — commonly ordered parts' },
];

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

  const handleDeleteDocument = async (docId: string, storagePath: string) => {
    if (!docId) return;
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    try {
      try {
        await deleteObject(storageRef(storage, storagePath));
      } catch {
        // File may not exist in storage anymore — still delete the record
      }
      await deleteDoc(doc(db, 'reference_docs', docId));
      await writeAuditLog('reference_docs', docId, 'delete', {
        summary: 'Reference document deleted',
      });
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
            aria-label="Search reference documents"
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
        <div
          className="visible-grid bg-surface overflow-hidden"
          role="table"
          aria-label="Document list"
        >
          <table className="w-full text-left border-collapse" role="none">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-on-surface-variant tracking-[0.2em] uppercase font-mono border-b border-outline">
                <th className="px-8 py-5" role="columnheader">
                  Document
                </th>
                <th className="px-8 py-5 hidden md:table-cell" role="columnheader">
                  Uploaded By
                </th>
                <th className="px-8 py-5 hidden lg:table-cell" role="columnheader">
                  Size
                </th>
                <th className="px-8 py-5 text-right" role="columnheader">
                  Actions
                </th>
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
                          aria-label={`View ${docItem.name}`}
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
                        aria-label={`Download ${docItem.name}`}
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      {(canManage || !isDemoMode) && (
                        <button
                          onClick={() => {
                            if (docItem.id && docItem.storagePath) {
                              handleDeleteDocument(docItem.id, docItem.storagePath);
                            }
                          }}
                          className="p-2 border border-transparent hover:border-outline text-slate-400 hover:text-safety-orange transition-all"
                          title={canManage ? 'Delete' : 'Delete (NCOIC/Leadership only)'}
                          aria-label={`Delete ${docItem.name}`}
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
