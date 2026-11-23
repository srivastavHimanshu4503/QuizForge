import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  Fingerprint,
  KeyRound,
  Laptop,
  Smartphone,
  Trash2,
  Edit2,
  Check,
  Plus,
  Loader2,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { PasskeyDto } from '@quiz-forge/shared';
import {
  isPasskeySupported,
  getRegisteredPasskeys,
  registerPasskey,
  renamePasskey,
  deletePasskey,
} from '../../utils/passkey';

interface PasskeyManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PasskeyManagementModal: React.FC<PasskeyManagementModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [passkeys, setPasskeys] = useState<PasskeyDto[]>([]);
  const [rpId, setRpId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // Deleting state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchPasskeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getRegisteredPasskeys();
      setPasskeys(data.credentials);
      setRpId(data.rpId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load passkeys.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccess(null);
      setNewNickname('');
      setEditingId(null);
      fetchPasskeys();
    }
  }, [isOpen, fetchPasskeys]);

  if (!isOpen) return null;

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsRegistering(true);

    try {
      const created = await registerPasskey(newNickname.trim() || undefined);
      setSuccess(`Passkey "${created.name || 'Passkey'}" registered successfully!`);
      setNewNickname('');
      await fetchPasskeys();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to register passkey.';
      if (!msg.toLowerCase().includes('cancelled') && !msg.toLowerCase().includes('timed out')) {
        setError(msg);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleStartEdit = (pk: PasskeyDto) => {
    setEditingId(pk.id);
    setEditName(pk.name || '');
  };

  const handleSaveEdit = async (id: string) => {
    if (!editName.trim()) return;
    setIsSavingName(true);
    setError(null);
    try {
      await renamePasskey(id, editName.trim());
      setPasskeys((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: editName.trim() } : p))
      );
      setEditingId(null);
      setSuccess('Passkey renamed successfully.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rename passkey.';
      setError(msg);
    } finally {
      setIsSavingName(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove the passkey "${name}"? You will not be able to use it to log in.`)) {
      return;
    }
    setDeletingId(id);
    setError(null);
    try {
      await deletePasskey(id);
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      setSuccess(`Passkey "${name}" was removed.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete passkey.';
      setError(msg);
    } finally {
      setDeletingId(null);
    }
  };

  const getDeviceIcon = (transports?: string[]) => {
    if (!transports || transports.length === 0) {
      return <Fingerprint className="w-5 h-5 text-[#38BDF8]" />;
    }
    if (transports.includes('internal')) {
      return <Laptop className="w-5 h-5 text-indigo-400" />;
    }
    if (transports.includes('usb') || transports.includes('nfc')) {
      return <KeyRound className="w-5 h-5 text-amber-400" />;
    }
    if (transports.includes('hybrid') || transports.includes('ble')) {
      return <Smartphone className="w-5 h-5 text-emerald-400" />;
    }
    return <Fingerprint className="w-5 h-5 text-[#38BDF8]" />;
  };

  const supported = isPasskeySupported();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#151C2C] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-[#1935CA] dark:text-[#38BDF8] flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Biometric Passkeys & FIDO2 Vault
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Passwordless authentication with Touch ID, Windows Hello, or YubiKeys
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-lg transition"
            aria-label="Close passkey settings modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Messages */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 flex items-start gap-2.5 text-rose-700 dark:text-rose-400 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-start gap-2.5 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{success}</span>
            </div>
          )}

          {!supported && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300 text-xs leading-relaxed">
              <strong>Notice:</strong> Your current browser or environment does not support WebAuthn / Passkeys. Please use a modern browser such as Chrome, Edge, Safari, or Firefox on a secure origin (HTTPS or localhost).
            </div>
          )}

          {/* Register New Passkey Section */}
          {supported && (
            <div className="p-4 rounded-xl bg-[#EEF2FF] dark:bg-slate-800/60 border border-[#1935CA]/20 dark:border-slate-700">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1935CA] dark:text-[#38BDF8] mb-2 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Register New Passkey
              </h3>
              <form onSubmit={handleRegister} className="flex gap-2.5 items-center">
                <input
                  type="text"
                  placeholder="Device nickname (e.g. MacBook Pro, Work PC)"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="flex-1 px-3.5 py-2 rounded-lg bg-white dark:bg-[#151C2C] text-slate-800 dark:text-white placeholder-slate-400 text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1935CA]"
                  disabled={isRegistering}
                />
                <button
                  type="submit"
                  disabled={isRegistering}
                  className="px-4 py-2 rounded-lg bg-[#1935CA] hover:bg-[#142BA3] text-white text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shrink-0"
                >
                  {isRegistering ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Registering...</span>
                    </>
                  ) : (
                    <>
                      <Fingerprint className="w-3.5 h-3.5" />
                      <span>Add Passkey</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* List of Registered Passkeys */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Registered Passkeys ({passkeys.length})
              </h3>
              {rpId && (
                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                  RP: {rpId}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-[#1935CA] dark:text-[#38BDF8]" />
                <span className="text-xs">Loading passkeys...</span>
              </div>
            ) : passkeys.length === 0 ? (
              <div className="py-8 px-4 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <Fingerprint className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                  No passkeys registered yet
                </p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                  Add a passkey to sign into your QuizForge account without typing your password.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {passkeys.map((pk) => {
                  const isEditing = editingId === pk.id;
                  const isDeleting = deletingId === pk.id;

                  return (
                    <div
                      key={pk.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3 transition hover:border-slate-300 dark:hover:border-slate-600"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-700/60 border border-slate-200/60 dark:border-slate-600 shadow-sm shrink-0">
                          {getDeviceIcon(pk.transports)}
                        </div>
                        <div className="min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="px-2 py-1 text-xs rounded border border-[#1935CA] dark:border-[#38BDF8] bg-white dark:bg-slate-900 text-slate-800 dark:text-white outline-none"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(pk.id)}
                                disabled={isSavingName}
                                className="p-1 rounded bg-[#1935CA] text-white hover:bg-[#142BA3]"
                                title="Save"
                              >
                                {isSavingName ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Check className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                                title="Cancel"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                {pk.name || 'Unnamed Passkey'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(pk)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                title="Rename passkey"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-400">
                            <span>
                              Created {new Date(pk.registeredAt).toLocaleDateString()}
                            </span>
                            {pk.lastUsedAt && (
                              <>
                                <span>•</span>
                                <span>
                                  Used {new Date(pk.lastUsedAt).toLocaleDateString()}
                                </span>
                              </>
                            )}
                            {pk.deviceType && (
                              <>
                                <span>•</span>
                                <span className="capitalize font-mono px-1 py-0.2 rounded bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300">
                                  {pk.deviceType === 'multiDevice' ? 'Synced (Cloud)' : 'Single Device'}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDelete(pk.id, pk.name || 'Passkey')}
                        disabled={isDeleting}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition shrink-0"
                        title="Delete passkey"
                      >
                        {isDeleting ? (
                          <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
