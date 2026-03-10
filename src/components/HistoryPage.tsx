import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { ArrowLeft, History, Cpu } from 'lucide-react';

interface Issue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
}

interface AnalysisDoc {
  id?: string;
  result: {
    language: string;
    score: number;
    issues: Issue[];
    summary: {
      totalIssues: number;
      criticalIssues: number;
      highIssues: number;
      mediumIssues: number;
      lowIssues: number;
      securityIssues: number;
      performanceIssues: number;
      qualityIssues: number;
    };
    metrics: {
      linesOfCode: number;
    };
    recommendations: string[];
    technicalDebt: string;
    codeSnippet?: string;
  };
  createdAt?: unknown;
}

const HistoryPage: React.FC<{
  user: User;
  onNavigate: (view: 'home' | 'history') => void;
  onRestore: (analysis: any) => void;
}> = ({ user, onNavigate, onRestore }) => {
  const [items, setItems] = useState<AnalysisDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const INITIAL_LIMIT = 20;

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const subscribe = (useOrder: boolean) => {
      const baseCol = collection(db, 'analyses');
      const baseWhere = where('uid', '==', user.uid);
      const qry = useOrder
        ? query(baseCol, baseWhere, orderBy('createdAt', 'desc'), limit(INITIAL_LIMIT))
        : query(baseCol, baseWhere, limit(INITIAL_LIMIT));

      unsubscribe = onSnapshot(qry, (snap) => {
        const docs: AnalysisDoc[] = [];
        snap.forEach(d => {
          const data = d.data() as { result?: AnalysisDoc['result']; createdAt?: unknown; analysis?: AnalysisDoc['result'] };
          const result = data.analysis || data.result;
          const codeSnippet = (data as any).codeSnippet;
          if (result) {
            if (codeSnippet && !result.codeSnippet) {
              (result as any).codeSnippet = codeSnippet;
            }
            docs.push({ id: d.id, result: result, createdAt: (data as { createdAt?: unknown }).createdAt });
          }
        });

        // Always sort client-side: handles both the ordered and fallback queries,
        // and fixes the serverTimestamp() pending-state issue where new docs have null createdAt
        docs.sort((a, b) => {
          const toMs = (ts: unknown): number => {
            if (!ts) return Date.now(); // pending serverTimestamp → treat as now (most recent)
            if (typeof (ts as any).toMillis === 'function') return (ts as any).toMillis();
            if (typeof (ts as any).toDate === 'function') return (ts as any).toDate().getTime();
            return new Date(ts as string).getTime() || 0;
          };
          return toMs(b.createdAt) - toMs(a.createdAt);
        });

        setItems(docs);
        setLastDoc(snap.docs[snap.docs.length - 1] || null);
        setHasMore(snap.docs.length === INITIAL_LIMIT);
        setLoading(false);
      }, (err) => {
        console.warn("History fetch error", err);
        if (useOrder) {
          subscribe(false);
        } else {
          setLoading(false);
        }
      });
    };

    subscribe(true);
    return () => { if (unsubscribe) unsubscribe(); };
  }, [user.uid]);

  const loadMore = async () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);

    try {
      const baseCol = collection(db, 'analyses');
      const baseWhere = where('uid', '==', user.uid);
      const qry = query(baseCol, baseWhere, orderBy('createdAt', 'desc'), startAfter(lastDoc), limit(INITIAL_LIMIT));

      const snap = await getDocs(qry);
      const newDocs: AnalysisDoc[] = [];
      snap.forEach(d => {
        const data = d.data() as { result?: AnalysisDoc['result']; createdAt?: unknown; analysis?: AnalysisDoc['result'] };
        const result = data.analysis || data.result;
        const codeSnippet = (data as any).codeSnippet;
        if (result) {
          if (codeSnippet && !result.codeSnippet) {
            (result as any).codeSnippet = codeSnippet;
          }
          newDocs.push({ id: d.id, result: result, createdAt: (data as { createdAt?: unknown }).createdAt });
        }
      });

      setItems(prev => [...prev, ...newDocs]);
      setLastDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMore(snap.docs.length === INITIAL_LIMIT);
    } catch (err) {
      console.error("Load more error", err);
    } finally {
      setLoadingMore(false);
    }
  };

  const rel = (ts: any) => {
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      if (isNaN(d.getTime())) return '';
      const diff = Date.now() - d.getTime();
      if (diff < 60000) return 'just now';
      if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
      if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch { return ''; }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#facc15';
    return '#f87171';
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#040d1a', color: '#f1f5f9' }}>

      {/* ── Header ───────────────────────────────────── */}
      <header className="nav-bar sticky top-0 z-40 px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-extrabold text-aurora hidden sm:block">Intellicode</span>
        </div>

        {/* Back button */}
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
          style={{ color: '#94a3b8' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#f1f5f9')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Back to Editor</span>
        </button>
      </header>

      {/* ── Main content ─────────────────────────────── */}
      <main className="flex-1 max-w-5xl mx-auto w-full p-5 lg:p-6">

        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            Analysis History
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Your past code analyses — click Restore to reload any result</p>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(6,182,212,0.15)' }} />
              <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#06b6d4' }} />
            </div>
            <p className="text-sm text-slate-500">Loading history…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 glass rounded-2xl"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <History className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">No analyses yet</h3>
            <p className="text-sm text-slate-500 text-center max-w-xs">
              Start by analyzing some code in the editor — your results will appear here.
            </p>
            <button
              onClick={() => onNavigate('home')}
              className="mt-5 btn-glow px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
            >
              Go to Editor
            </button>
          </div>
        )}

        {/* Cards */}
        {!loading && items.length > 0 && (
          <div className="space-y-3 pb-10">
            {items.map((doc) => {
              const a = doc.result;
              const score = (a as any).overallScore ?? (a as any).score ?? 0;
              const scoreColor = getScoreColor(score);
              const CIRC = 125.7;

              return (
                <div
                  key={doc.id}
                  className="group glass-hover glass rounded-2xl p-5 relative overflow-hidden"
                  style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Top accent line on hover */}
                  <div className="absolute top-0 left-0 right-0 h-px transition-opacity opacity-0 group-hover:opacity-100"
                    style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }} />

                  {/* Main row */}
                  <div className="flex items-start gap-4">

                    {/* Score ring */}
                    <div className="relative flex-shrink-0 w-12 h-12">
                      <svg width="48" height="48" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" stroke="#27272a" />
                        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4"
                          stroke={scoreColor}
                          strokeLinecap="round"
                          strokeDasharray={CIRC}
                          strokeDashoffset={CIRC - (score / 100) * CIRC}
                          transform="rotate(-90 24 24)"
                          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[11px] font-bold leading-none" style={{ color: scoreColor }}>{score}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">

                      {/* Top meta row */}
                      <div className="flex items-center flex-wrap gap-2 mb-2">
                        {/* Language badge */}
                        <span className="px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider"
                          style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                          {a.language}
                        </span>

                        {/* Issue count pills */}
                        {a.summary.criticalIssues > 0 && (
                          <span className="badge-critical tag text-xs py-0.5 px-2">{a.summary.criticalIssues} critical</span>
                        )}
                        {a.summary.highIssues > 0 && (
                          <span className="badge-high tag text-xs py-0.5 px-2">{a.summary.highIssues} high</span>
                        )}
                        {a.summary.mediumIssues > 0 && (
                          <span className="badge-medium tag text-xs py-0.5 px-2">{a.summary.mediumIssues} med</span>
                        )}
                        {a.summary.lowIssues > 0 && (
                          <span className="badge-low tag text-xs py-0.5 px-2">{a.summary.lowIssues} low</span>
                        )}
                        {a.summary.totalIssues === 0 && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}>
                            Clean
                          </span>
                        )}

                        {/* Timestamp */}
                        <span className="text-xs text-slate-600 ml-auto">{rel(doc.createdAt)}</span>
                      </div>

                      {/* Code snippet preview */}
                      {(a as any).codeSnippet && (
                        <pre className="text-xs font-mono text-slate-400 rounded-xl px-3 py-2.5 mb-2 overflow-hidden leading-relaxed"
                          style={{
                            background: 'rgba(0,0,0,0.3)',
                            border: '1px solid rgba(255,255,255,0.05)',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical' as any,
                            overflow: 'hidden',
                            maxHeight: '50px',
                          }}>
                          {(a as any).codeSnippet}
                        </pre>
                      )}

                      {/* Top recommendation */}
                      {a.recommendations && a.recommendations.length > 0 && (
                        <p className="text-xs text-slate-500 line-clamp-1">
                          <span className="text-slate-600 font-medium">Tip: </span>
                          {a.recommendations[0]}
                        </p>
                      )}
                    </div>

                    {/* Restore button */}
                    <button
                      onClick={() => onRestore(a)}
                      className="flex-shrink-0 btn-glow px-4 py-2 rounded-xl text-xs font-semibold text-white self-start"
                      style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94a3b8',
                  }}
                  onMouseOver={(e) => { if (!loadingMore) (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
                >
                  {loadingMore ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-slate-400/30 border-t-slate-400 rounded-full animate-spin" />
                      Loading…
                    </>
                  ) : 'Load More Results'}
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default HistoryPage;
