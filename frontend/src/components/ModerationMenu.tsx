import { useState } from 'react';
import { Modal } from './UI';
import { api } from '../lib/api';
import { toast } from './Toast';
import type { ReportReason } from '../types';

const REASONS: { id: ReportReason; label: string }[] = [
  { id: 'spam', label: 'Spam' },
  { id: 'harassment', label: 'Taciz' },
  { id: 'hate', label: 'Nefret söylemi' },
  { id: 'sexual', label: 'Cinsel içerik' },
  { id: 'other', label: 'Diğer' },
];

type Step = 'actions' | 'report-user' | 'report-message';

interface ModerationMenuProps {
  username: string;
  userId: string;
  messageId?: string;
  onBlocked?: (userId: string) => void;
}

export function ModerationMenu({ username, userId, messageId, onBlocked }: ModerationMenuProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('actions');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const close = () => {
    setOpen(false);
    setStep('actions');
    setNote('');
  };

  const submitReport = async (targetType: 'user' | 'message', targetId: string, reason: ReportReason) => {
    setBusy(true);
    try {
      await api.reportContent({
        targetType,
        targetId,
        reason,
        note: note.trim() || undefined,
      });
      toast.success('Şikayet iletildi');
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Şikayet gönderilemedi');
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    setBusy(true);
    try {
      await api.blockUser(userId);
      onBlocked?.(userId);
      toast.success(`@${username} engellendi`);
      close();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Engellenemedi');
    } finally {
      setBusy(false);
    }
  };

  const actionClass =
    'min-h-11 w-full rounded-lg border border-pod-border px-3 text-left text-sm font-medium text-white hover:bg-pod-active disabled:opacity-50';

  return (
    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
      <button
        type="button"
        aria-label={`@${username} için işlemler`}
        className="flex min-h-11 min-w-11 items-center justify-center text-pod-text-secondary hover:text-white"
        onClick={() => setOpen(true)}
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0zm6 0a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </button>
      <Modal isOpen={open} onClose={close} title={step === 'actions' ? `@${username}` : 'Şikayet'}>
        {step === 'actions' ? (
          <div className="flex flex-col gap-2">
            {messageId && (
              <button type="button" className={actionClass} onClick={() => setStep('report-message')}>
                Mesajı bildir
              </button>
            )}
            <button type="button" className={actionClass} onClick={() => setStep('report-user')}>
              Kullanıcıyı bildir
            </button>
            <button type="button" className={`${actionClass} text-pod-red`} onClick={() => void block()} disabled={busy}>
              Engelle
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <label className="text-xs text-pod-text-secondary" htmlFor={`report-note-${userId}`}>
              Not (isteğe bağlı)
            </label>
            <textarea
              id={`report-note-${userId}`}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={500}
              rows={2}
              className="w-full rounded-lg border border-pod-border bg-pod-bg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-pod-red"
            />
            {REASONS.map((reason) => (
              <button
                key={reason.id}
                type="button"
                disabled={busy}
                className={actionClass}
                onClick={() => {
                  const targetId = step === 'report-message' ? messageId : userId;
                  if (!targetId) return;
                  void submitReport(step === 'report-message' ? 'message' : 'user', targetId, reason.id);
                }}
              >
                {reason.label}
              </button>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
