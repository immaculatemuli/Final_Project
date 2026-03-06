import React, { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from 'firebase/auth';
import {
  Bookmark,
  Trash2,
  Calendar,
  Zap,
  Search,
  Code2,
  History,
  Cpu,
  LogOut,
  User as UserIcon,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { auth } from '../firebase';
import { signOut } from 'firebase/auth';

interface Snippet {
  id: string;
  code: string;
  analysis: any;
  createdAt: any;
}

interface SnippetsPageProps {
  user: User;
  onNavigate: (page: 'home' | 'history' | 'snippets') => void;
  onRestoreSnippet: (code: string, analysis: any) => void;
}

export const SnippetsPage: React.FC<SnippetsPageProps> = ({ user, onNavigate, onRestoreSnippet }) => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(
      collection(db, 'bookmarks'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Snippet[];
      setSnippets(docs);
      setLoading(false);
    });

    return () => unsub();
  }, [user.uid]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this snippet?')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'bookmarks', id));
    } finally {
      setDeletingId(null);
    }
  };

  const handleSignOut = async () => {
    try { await signOut(auth); } catch {}
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#facc15';
    return '#f87171';
  };

  const filteredSnippets = snippets.filter(s => {
    const lang = (s.analysis?.language || '').toLowerCase();
    const code = (s.code || '').toLowerCase();
    const term = searchTerm.toLowerCase();
    return lang.includes(term) || code.includes(term);
  });

  const formatDate = (ts: any) => {
    try {
      const d = ts?.toDate ? ts.toDate() : new Date(ts);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#040d1a', color: '#f1f5f9' }}>

      {/* ── Header ──────────────────────────────────────── */}
      <header className="nav-bar sticky top-0 z-40 px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-extrabold text-aurora hidden sm:block">Intellicode</span>
        </div>

        {/* Nav */}
        <nav className="flex items-center gap-1">
          {[
            { label: 'Editor', view: 'home' as const, icon: Code2 },
            { label: 'History', view: 'history' as const, icon: History },
            { label: 'Snippets', view: 'snippets' as const, icon: Bookmark },
          ].map(({ label, view, icon: Icon }) => (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: view === 'snippets' ? 'rgba(255,255,255,0.07)' : 'transparent',
                color: view === 'snippets' ? '#f1f5f9' : '#94a3b8',
              }}
              onMouseOver={(e) => { if (view !== 'snippets') e.currentTarget.style.color = '#f1f5f9'; }}
              onMouseOut={(e) => { if (view !== 'snippets') e.currentTarget.style.color = '#94a3b8'; }}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* User + sign out */}
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img src={user.photoURL} alt={user.displayName || 'User'}
              className="w-7 h-7 rounded-full ring-2 ring-cyan-500/40" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <UserIcon className="w-3.5 h-3.5 text-white" />
            </div>
          )}
          <span className="hidden md:block text-sm text-slate-400 truncate max-w-[140px]">
            {user.displayName || user.email}
          </span>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Page body ────────────────────────────────────── */}
      <main className="flex-1 p-5 lg:p-6 max-w-7xl mx-auto w-full">

        {/* Page title + search */}
        <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Bookmark className="w-5 h-5 text-cyan-400" />
              Snippet Library
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">Your saved code analyses — click any card to restore</p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search by language or code…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl outline-none w-64"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: '#f1f5f9',
              }}
            />
          </div>
        </div>

        {/* Count badge */}
        {!loading && (
          <p className="text-xs text-slate-600 mb-4">
            {filteredSnippets.length} {filteredSnippets.length === 1 ? 'snippet' : 'snippets'}
            {searchTerm ? ` matching "${searchTerm}"` : ' saved'}
          </p>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="relative w-10 h-10">
              <div className="absolute inset-0 rounded-full" style={{ border: '2px solid rgba(6,182,212,0.15)' }} />
              <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#06b6d4' }} />
            </div>
            <p className="text-sm text-slate-500">Loading your snippets…</p>
          </div>
        )}

        {/* Empty state */}
        {!loading && filteredSnippets.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 glass rounded-2xl"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
              <Bookmark className="w-7 h-7 text-cyan-400" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              {searchTerm ? 'No results found' : 'No snippets yet'}
            </h3>
            <p className="text-sm text-slate-500 text-center max-w-xs">
              {searchTerm
                ? `Nothing matched "${searchTerm}". Try a different search.`
                : 'Analyze some code and click "Save" to store snippets here.'}
            </p>
            {!searchTerm && (
              <button
                onClick={() => onNavigate('home')}
                className="mt-5 btn-glow px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
              >
                Go to Editor
              </button>
            )}
          </div>
        )}

        {/* Grid */}
        {!loading && filteredSnippets.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSnippets.map((s) => {
              const score = s.analysis?.overallScore ?? s.analysis?.score ?? 0;
              const language = s.analysis?.language || 'Unknown';
              const totalIssues = s.analysis?.summary?.totalIssues ?? 0;
              const criticalIssues = s.analysis?.summary?.criticalIssues ?? 0;

              return (
                <div
                  key={s.id}
                  onClick={() => onRestoreSnippet(s.code, s.analysis)}
                  className="group glass-hover glass rounded-2xl p-5 cursor-pointer relative overflow-hidden flex flex-col gap-4"
                  style={{ border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  {/* Top accent line on hover */}
                  <div className="absolute top-0 left-0 right-0 h-px transition-opacity opacity-0 group-hover:opacity-100"
                    style={{ background: 'linear-gradient(90deg, transparent, #06b6d4, transparent)' }} />

                  {/* Header row */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider"
                        style={{ background: 'rgba(6,182,212,0.12)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.2)' }}>
                        {language}
                      </span>
                      {criticalIssues > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                          style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
                          {criticalIssues} critical
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => handleDelete(s.id, e)}
                      disabled={deletingId === s.id}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-red-400 hover:bg-red-400/10 transition-all opacity-0 group-hover:opacity-100"
                      title="Delete snippet"
                    >
                      {deletingId === s.id
                        ? <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin block" />
                        : <Trash2 className="w-4 h-4" />
                      }
                    </button>
                  </div>

                  {/* Score + code preview */}
                  <div className="flex items-start gap-3">
                    {/* Score ring */}
                    <div className="relative flex-shrink-0 w-12 h-12">
                      <svg width="48" height="48" viewBox="0 0 48 48">
                        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4" stroke="#27272a" />
                        <circle cx="24" cy="24" r="20" fill="none" strokeWidth="4"
                          stroke={getScoreColor(score)}
                          strokeLinecap="round"
                          strokeDasharray={125.7}
                          strokeDashoffset={125.7 - (score / 100) * 125.7}
                          transform="rotate(-90 24 24)"
                          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-[11px] font-bold leading-none" style={{ color: getScoreColor(score) }}>{score}</span>
                      </div>
                    </div>

                    {/* Code preview */}
                    <pre className="flex-1 text-xs font-mono text-slate-400 rounded-xl px-3 py-2.5 overflow-hidden leading-relaxed"
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        display: '-webkit-box',
                        WebkitLineClamp: 4,
                        WebkitBoxOrient: 'vertical' as any,
                        overflow: 'hidden',
                        maxHeight: '80px',
                      }}>
                      {s.code}
                    </pre>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-3 mt-auto"
                    style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                      {totalIssues === 0
                        ? <><CheckCircle className="w-3.5 h-3.5 text-green-400" /><span className="text-green-400">Clean</span></>
                        : <><AlertTriangle className="w-3.5 h-3.5 text-amber-400" />{totalIssues} issue{totalIssues !== 1 ? 's' : ''}</>
                      }
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-slate-600">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(s.createdAt)}
                    </span>
                  </div>

                  {/* Restore hint */}
                  <div className="absolute bottom-3 right-4 text-[10px] text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                    Click to restore →
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};
