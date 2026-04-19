import { useState } from 'react';
import { api } from '../lib/api';
import type { Recording } from '../types';

interface ShareModalProps {
  recording: Recording;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (recording: Recording) => void;
}

export function ShareModal({ recording, isOpen, onClose, onUpdate }: ShareModalProps) {
  const [title, setTitle] = useState(recording.title || '');
  const [description, setDescription] = useState(recording.description || '');
  const [isPublic, setIsPublic] = useState(recording.isPublic || false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = recording.shareSlug
    ? `${window.location.origin}/listen/${recording.shareSlug}`
    : null;

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await api.updateRecording(recording.id, {
        title: title || undefined,
        description: description || undefined,
        isPublic,
      });
      onUpdate(updated);
      if (!isPublic) {
        onClose();
      }
    } catch (error) {
      console.error('Failed to update recording:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (shareUrl) {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const embedCode = shareUrl
    ? `<iframe src="${shareUrl}?embed=1" width="100%" height="180" frameborder="0" allow="autoplay"></iframe>`
    : '';

  const handleCopyEmbed = async () => {
    await navigator.clipboard.writeText(embedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-pod-elevated border border-pod-border rounded-xl w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-pod-border">
          <h2 className="text-lg font-semibold text-white">Share Recording</h2>
          <button
            onClick={onClose}
            className="p-2 text-pod-text-secondary hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Recording title"
              className="w-full px-3 py-2 bg-pod-bg border border-pod-border rounded-lg text-white focus:ring-2 focus:ring-pod-red focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description..."
              rows={3}
              className="w-full px-3 py-2 bg-pod-bg border border-pod-border rounded-lg text-white focus:ring-2 focus:ring-pod-red focus:border-transparent resize-none"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Make Public</p>
              <p className="text-sm text-pod-text-secondary">Anyone with the link can listen</p>
            </div>
            <button
              onClick={() => setIsPublic(!isPublic)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                isPublic ? 'bg-pod-red' : 'bg-pod-active'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  isPublic ? 'translate-x-6' : ''
                }`}
              />
            </button>
          </div>

          {isPublic && shareUrl && (
            <>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Share Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 px-3 py-2 bg-pod-bg border border-pod-border rounded-lg text-sm text-white"
                  />
                  <button
                    onClick={handleCopy}
                    className="px-4 py-2 bg-pod-red hover:bg-red-600 rounded-lg transition-colors text-white"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Embed Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={embedCode}
                    readOnly
                    className="flex-1 px-3 py-2 bg-pod-bg border border-pod-border rounded-lg text-sm font-mono text-white"
                  />
                  <button
                    onClick={handleCopyEmbed}
                    className="px-4 py-2 bg-pod-active hover:bg-pod-border rounded-lg transition-colors text-white"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t border-pod-border">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-pod-active hover:bg-pod-border rounded-lg transition-colors text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex-1 px-4 py-2 bg-pod-red hover:bg-red-600 disabled:opacity-50 rounded-lg transition-colors text-white"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
