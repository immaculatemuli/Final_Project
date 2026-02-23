import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, limit, startAfter, getDocs, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';

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

const pill = (text: string, color: string) => (
  <span className={`px-2 py-0.5 rounded-full text-xs ${color}`}>{text}</span>
);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-white text-2xl font-bold">Analysis History</h1>
          <button
            onClick={() => onNavigate('home')}
            className="text-sm text-blue-300 hover:text-blue-200 hover:underline bg-transparent border-none cursor-pointer"
          >
            Back to Home
          </button>
        </div>

        {loading ? (
          <div className="text-gray-300 flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : items.length === 0 ? (
          <div className="text-gray-300 text-center py-10 bg-white/5 rounded-xl">No analyses yet. Start by analyzing some code!</div>
        ) : (
          <div className="space-y-4 pb-10">
            {items.map((doc) => {
              const a = doc.result;
              return (
                <div key={doc.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-5 hover:bg-white/15 transition-all">
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-3 gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${a.score >= 80 ? 'bg-green-600 text-white' :
                        a.score >= 60 ? 'bg-yellow-600 text-white' :
                          'bg-red-600 text-white'
                        }`}>
                        {a.score}%
                      </span>
                      <span className="text-white font-semibold text-lg">{a.language.toUpperCase()}</span>
                      <span className="text-gray-400 text-sm">· LOC {a.metrics.linesOfCode}</span>
                      <span className="text-gray-500 text-xs hidden md:inline">· {doc.id}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onRestore(a)}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
                      >
                        Restore & View
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {pill(`${a.summary.totalIssues} issues`, 'bg-gray-800 text-gray-200')}
                    {a.summary.criticalIssues > 0 && pill(`${a.summary.criticalIssues} critical`, 'bg-red-900/50 text-red-200 border border-red-700/50')}
                    {a.summary.highIssues > 0 && pill(`${a.summary.highIssues} high`, 'bg-orange-900/50 text-orange-200 border border-orange-700/50')}
                    {a.summary.mediumIssues > 0 && pill(`${a.summary.mediumIssues} med`, 'bg-yellow-900/50 text-yellow-200 border border-yellow-700/50')}
                    {a.summary.lowIssues > 0 && pill(`${a.summary.lowIssues} low`, 'bg-blue-900/50 text-blue-200 border border-blue-700/50')}
                  </div>

                  {(a as any).codeSnippet && (
                    <div className="mb-3 bg-black/30 rounded p-2">
                      <code className="text-xs text-gray-400 font-mono line-clamp-2">
                        {(a as any).codeSnippet}
                      </code>
                    </div>
                  )}

                  {a.recommendations && a.recommendations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <p className="text-xs text-gray-400 mb-1 font-medium">Top Recommendations:</p>
                      <ul className="list-disc list-inside text-gray-300 text-sm space-y-1">
                        {a.recommendations.slice(0, 2).map((r, i) => (
                          <li key={i} className="line-clamp-1">{r}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

            {hasMore && (
              <div className="flex justify-center mt-8">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all border border-white/20 disabled:opacity-50"
                >
                  {loadingMore ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                      Loading...
                    </div>
                  ) : 'Load More Results'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
