import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../lib/store';
import type { PublicRecording } from '../types';

type TabFilter = 'all' | 'downloaded' | 'favorites';

export function Library() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabFilter>('all');
  const [recordings, setRecordings] = useState<PublicRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }

    const fetchRecordings = async () => {
      try {
        const response = await api.getRecordingsFeed(20);
        setRecordings(response.recordings);
      } catch (err) {
        console.error('Failed to fetch recordings:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecordings();
  }, [isAuthenticated, navigate]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const storageUsed = 2.4;
  const storageTotal = 5;
  const storagePercent = (storageUsed / storageTotal) * 100;

  const tabs: { key: TabFilter; label: string }[] = [
    { key: 'all', label: 'ALL' },
    { key: 'downloaded', label: 'DOWNLOADED' },
    { key: 'favorites', label: 'FAVORITES' },
  ];

  return (
    <div className="min-h-screen bg-pod-bg">
      <div className="px-6 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white tracking-tight">LIBRARY</h1>
          <button className="w-10 h-10 flex items-center justify-center border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* Storage */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] font-semibold tracking-[2px] text-pod-text-secondary">STORAGE</p>
            <p className="text-pod-red text-xs font-mono font-bold">{storageUsed} GB / {storageTotal} GB</p>
          </div>
          <div className="w-full h-2 rounded-full border border-pod-border overflow-hidden">
            <div className="h-full bg-pod-red rounded-full transition-all" style={{ width: `${storagePercent}%` }} />
          </div>
        </section>

        {/* Tabs */}
        <div className="flex border border-pod-border rounded-lg overflow-hidden">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-xs font-semibold tracking-wider text-center transition-colors ${
                activeTab === tab.key ? 'bg-pod-red text-white' : 'text-white hover:bg-pod-elevated'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Downloads Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-semibold tracking-[3px] text-pod-text-secondary">DOWNLOADS</p>
            <span className="text-pod-red text-xs font-mono">{recordings.length} podcasts</span>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin w-6 h-6 border-2 border-pod-red border-t-transparent rounded-full" />
            </div>
          ) : recordings.length === 0 ? (
            <div className="text-center py-12 border border-pod-border rounded-xl">
              <p className="text-pod-text-secondary">Henuz indirilen podcast yok</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recordings.map((rec) => (
                <button
                  key={rec.id}
                  onClick={() => navigate(`/listen/${rec.shareSlug}`)}
                  className="w-full flex items-center gap-4 p-4 border border-pod-border rounded-xl hover:bg-pod-elevated transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-pod-red rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-white truncate">{rec.title}</h3>
                    <p className="text-xs text-pod-text-secondary mt-0.5">
                      {formatDuration(rec.durationSeconds)} · {rec.playCount} plays
                    </p>
                  </div>
                  <button className="text-pod-text-secondary hover:text-white transition-colors p-1">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                    </svg>
                  </button>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button className="flex-1 h-12 flex items-center justify-center gap-2 border border-pod-border rounded-lg hover:bg-pod-elevated transition-colors">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span className="text-xs font-semibold text-white tracking-wider">CLEAR CACHE</span>
          </button>
          <button className="flex-1 h-12 flex items-center justify-center gap-2 border border-pod-red rounded-lg hover:bg-pod-red/10 transition-colors">
            <svg className="w-4 h-4 text-pod-red" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.707l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.414V13a1 1 0 102 0V9.414l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-semibold text-pod-red tracking-wider">AUTO: ON</span>
          </button>
        </div>
      </div>
    </div>
  );
}
