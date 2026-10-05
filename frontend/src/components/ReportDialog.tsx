import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Modal, Button } from './UI';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { toast } from './Toast';
import type { ReportReason, ReportTargetType } from '../types';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Taciz' },
  { value: 'hate', label: 'Nefret soylemi' },
  { value: 'sexual', label: 'Cinsel icerik' },
  { value: 'other', label: 'Diger' },
];

interface ReportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: ReportTargetType;
  targetId: string;
  targetLabel?: string;
}

export function ReportDialog({ isOpen, onClose, targetType, targetId, targetLabel }: ReportDialogProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('spam');
      setNote('');
      setError('');
      setSubmitting(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.createReport({
        targetType,
        targetId,
        reason,
        note: note.trim() || undefined,
      });
      toast.success('Bildirim alindi');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bildirim gonderilemedi');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bildir">
      {targetLabel && (
        <p className="text-sm text-pod-text-secondary mb-4">{targetLabel}</p>
      )}
      {!isAuthenticated ? (
        <div className="space-y-4">
          <p className="text-sm text-white">Bildirmek icin giris yapman gerekiyor.</p>
          <Link
            to="/login"
            className="inline-flex min-h-11 items-center justify-center px-4 rounded-lg bg-pod-red text-white text-sm font-semibold"
          >
            Giris yap
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="report-reason" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Sebep
            </label>
            <select
              id="report-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value as ReportReason)}
              className="input w-full min-h-11"
            >
              {REASONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor="report-note" className="text-[10px] font-semibold tracking-widest text-pod-text-secondary uppercase">
              Not (istege bagli)
            </label>
            <textarea
              id="report-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              rows={3}
              className="input w-full resize-none"
              placeholder="Kisa bir aciklama"
            />
          </div>
          {error && <p className="text-pod-red text-sm">{error}</p>}
          <div className="flex gap-3">
            <Button type="button" variant="secondary" className="flex-1 min-h-11" onClick={onClose}>
              Iptal
            </Button>
            <Button type="submit" className="flex-1 min-h-11" isLoading={submitting}>
              Gonder
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
