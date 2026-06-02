import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Camera, Loader2, ShieldAlert, UploadCloud, Trash2, Send } from 'lucide-react';
import { ShiftType, UserProfile } from '../../types';
import { cn } from '../../lib/utils';
import { SHIFT_TIMES } from '../../mockData';
import { LogFormData } from '../../hooks/useLogForm';

interface LogFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: LogFormData;
  setFormData: React.Dispatch<React.SetStateAction<LogFormData>>;
  editingLogId: string | null;
  loading: boolean;
  isScanning: boolean;
  isG081Uploading: boolean;
  onScan: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onG081Upload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  scanInputRef: React.RefObject<HTMLInputElement | null>;
  g081InputRef: React.RefObject<HTMLInputElement | null>;
  personnelRoster: UserProfile[];
}

export const LogFormModal: React.FC<LogFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingLogId,
  loading,
  isScanning,
  isG081Uploading,
  onScan,
  onG081Upload,
  scanInputRef,
  g081InputRef,
  personnelRoster,
}) => {
  const [personnelInputFocused, setPersonnelInputFocused] = React.useState(false);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={editingLogId ? 'Edit Maintenance Entry' : 'New Maintenance Entry'}
          tabIndex={-1}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stealth/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white max-w-2xl w-full max-h-[90vh] rounded-none shadow-2xl flex flex-col border border-outline"
          >
            <div className="p-8 border-b border-outline flex justify-between items-center bg-putty/30 shrink-0">
              <h3 className="font-black text-2xl tracking-tighter uppercase">
                {editingLogId ? 'Edit Maintenance Entry' : 'New Maintenance Entry'}
              </h3>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  ref={scanInputRef}
                  onChange={onScan}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                />
                <button
                  type="button"
                  onClick={() => scanInputRef.current?.click()}
                  className="sleek-button bg-primary !text-white flex items-center gap-2 py-2"
                  disabled={isScanning}
                >
                  {isScanning ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Scan Form</span>
                </button>
                <button onClick={onClose} className="p-2 hover:bg-putty transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 custom-scrollbar">
              <form onSubmit={onSubmit} className="p-10 space-y-8">
                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Tail Number</label>
                    <input
                      required
                      className="sleek-input w-full"
                      placeholder="AF-00-0000"
                      value={formData.tail_number}
                      onChange={(e) => setFormData({ ...formData, tail_number: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">JCN (Job Control Number)</label>
                    <input
                      className="sleek-input w-full"
                      placeholder="E.G. 231450012"
                      value={formData.jcn}
                      onChange={(e) => setFormData({ ...formData, jcn: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2 relative">
                  <label className="tech-label !text-[9px]">
                    Additional Personnel (Comma Separated)
                  </label>
                  <input
                    className="sleek-input w-full"
                    placeholder="E.G. Smith J, Doe A"
                    value={formData.personnelInput}
                    onFocus={() => setPersonnelInputFocused(true)}
                    onBlur={() => setTimeout(() => setPersonnelInputFocused(false), 200)}
                    onChange={(e) => setFormData({ ...formData, personnelInput: e.target.value })}
                  />
                  {personnelInputFocused &&
                    formData.personnelInput.split(',').pop()?.trim() &&
                    personnelRoster.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-1 bg-white border border-outline shadow-xl z-50 max-h-48 overflow-y-auto">
                        {(() => {
                          const parts = formData.personnelInput.split(',');
                          const currentTerm = parts[parts.length - 1].trim().toLowerCase();
                          if (currentTerm.length < 1) return null;

                          const matches = personnelRoster.filter(
                            (p) =>
                              p.name.toLowerCase().includes(currentTerm) &&
                              !parts.some((existing) => existing.trim() === p.name)
                          );
                          if (matches.length === 0)
                            return (
                              <div className="p-3 text-xs text-slate-500 italic">No matches...</div>
                            );

                          return matches.map((p) => (
                            <button
                              key={p.uid}
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                const newParts = [...parts];
                                newParts.pop();
                                newParts.push(` ${p.name}`);
                                setFormData({
                                  ...formData,
                                  personnelInput: newParts.join(', ') + ', ',
                                });
                                setPersonnelInputFocused(false);
                              }}
                              className="w-full text-left p-3 hover:bg-putty border-b border-slate-100 last:border-0 flex justify-between items-center"
                            >
                              <span className="font-bold text-sm text-slate-800">{p.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono tracking-widest">
                                {p.man_number}
                              </span>
                            </button>
                          ));
                        })()}
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-8">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Priority Status</label>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, isRedBall: !formData.isRedBall })}
                      className={cn(
                        'sleek-input w-full flex items-center justify-center gap-3 transition-colors',
                        formData.isRedBall
                          ? 'bg-safety-orange text-white border-safety-orange font-black'
                          : 'bg-putty/30 text-on-surface-variant'
                      )}
                    >
                      <ShieldAlert className="w-4 h-4" />{' '}
                      {formData.isRedBall ? 'RED BALL' : 'NORMAL'}
                    </button>
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Shift Assignment</label>
                    <select
                      className="sleek-input w-full"
                      value={formData.shift}
                      onChange={(e) =>
                        setFormData({ ...formData, shift: e.target.value as ShiftType })
                      }
                    >
                      {Object.entries(SHIFT_TIMES).map(([shift, time]) => (
                        <option key={shift} value={shift}>
                          {shift} ({time})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Discrepancy Report</label>
                    <textarea
                      required
                      rows={3}
                      className="sleek-input w-full resize-none serif-header"
                      placeholder="Describe the malfunction or inspection requirement..."
                      value={formData.discrepancy}
                      onChange={(e) => setFormData({ ...formData, discrepancy: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="tech-label !text-[9px]">Repair Action Taken</label>
                    <textarea
                      required
                      rows={3}
                      className="sleek-input w-full resize-none"
                      placeholder="Describe the corrective action or turnover status..."
                      value={formData.repair}
                      onChange={(e) => setFormData({ ...formData, repair: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="tech-label !text-[9px]">Document Number (Optional)</label>
                  <input
                    className="sleek-input w-full data-mono"
                    placeholder="E.G. 92144A001"
                    value={formData.doc_number}
                    onChange={(e) => setFormData({ ...formData, doc_number: e.target.value })}
                  />
                </div>

                <div className="space-y-4">
                  <label className="tech-label !text-[9px]">G081 Screen Proof (Optional)</label>
                  <input
                    type="file"
                    ref={g081InputRef}
                    onChange={onG081Upload}
                    className="hidden"
                    accept="image/*"
                    capture="environment"
                  />
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => g081InputRef.current?.click()}
                      className="sleek-button bg-surface border border-outline hover:bg-slate-50 flex items-center justify-center gap-3 px-6 py-3 flex-1 text-slate-700"
                      disabled={isG081Uploading}
                    >
                      {isG081Uploading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span className="font-black text-[10px] tracking-widest uppercase">
                        {editingLogId ? 'Update G081 Proof' : 'Upload G081 Proof'}
                      </span>
                    </button>
                    {formData.g081Photo && (
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, g081Photo: '' })}
                        className="p-3 text-safety-orange hover:bg-safety-orange/10 rounded-none border border-safety-orange/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {formData.g081Photo && (
                    <div className="mt-2 relative group overflow-hidden border border-outline bg-putty/20 p-2">
                      <img
                        src={formData.g081Photo}
                        alt="G081 Proof"
                        className="max-h-40 w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <span className="tech-label !text-white !opacity-100">Image Loaded</span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="sleek-button w-full flex items-center justify-center gap-4 py-4 text-base"
                >
                  {loading ? 'Transmitting Data...' : 'Submit Operational Entry'}{' '}
                  <Send className="w-5 h-5" />
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
