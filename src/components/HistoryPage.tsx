import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';

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
  };
  createdAt?: unknown;
}

const pill = (text: string, color: string) => (
  <span className={`px-2 py-0.5 rounded-full text-xs ${color}`}>{text}</span>
);

const HistoryPage: React.FC<{ user: User }> = ({ user }) => {
  const [items, setItems] = useState<AnalysisDoc[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const subscribe = (useOrder: boolean) => {
      const baseCol = collection(db, 'analyses');
      const baseWhere = where('uid', '==', user.uid);
      const qry = useOrder ? query(baseCol, baseWhere, orderBy('createdAt', 'desc')) : query(baseCol, baseWhere);
      unsubscribe = onSnapshot(qry, (snap) => {
        const docs: AnalysisDoc[] = [];
        snap.forEach(d => {
          const data = d.data() as { result?: AnalysisDoc['result']; createdAt?: unknown };
          if (data && data.result) {
            docs.push({ id: d.id, result: data.result, createdAt: (data as { createdAt?: unknown }).createdAt });
          }
        });
        setItems(docs);
        setLoading(false);
      }, () => {
        // Fallback without orderBy (avoids composite index requirement)
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-white text-2xl font-bold">Analysis History</h1>
          <a href="/" className="text-sm text-blue-300 hover:underline">Back to Home</a>
        </div>

        {loading ? (
          <div className="text-gray-300">Loading…</div>
        ) : items.length === 0 ? (
          <div className="text-gray-300">No analyses yet.</div>
        ) : (
          <div className="space-y-3">
            {items.map((doc) => {
              const a = doc.result;
              return (
                <div key={doc.id} className="bg-white/10 backdrop-blur-md border border-white/20 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-white font-semibold">
                      {a.language.toUpperCase()} · Score {a.score}% · LOC {a.metrics.linesOfCode}
                    </div>
                    <div className="text-sm text-gray-300">
                      {pill(`${a.summary.totalIssues} issues`, 'bg-gray-800 text-gray-200')}
                      <span className="mx-1"></span>
                      {pill(`${a.summary.criticalIssues} critical`, 'bg-red-600/30 text-red-300')}
                      <span className="mx-1"></span>
                      {pill(`${a.summary.highIssues} high`, 'bg-orange-600/30 text-orange-300')}
                      <span className="mx-1"></span>
                      {pill(`${a.summary.mediumIssues} med`, 'bg-yellow-600/30 text-yellow-200')}
                      <span className="mx-1"></span>
                      {pill(`${a.summary.lowIssues} low`, 'bg-blue-600/30 text-blue-300')}
                    </div>
                  </div>
                  {a.recommendations && a.recommendations.length > 0 && (
                    <ul className="list-disc list-inside text-gray-200 text-sm">
                      {a.recommendations.slice(0, 3).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPage;
