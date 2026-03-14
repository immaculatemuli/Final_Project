import React, { useState, useEffect, useRef } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, Timestamp, serverTimestamp, query, where, orderBy, onSnapshot, doc, setDoc, limit } from 'firebase/firestore';
import { CodeInput } from './CodeInput';
import ReviewPanel from './ReviewPanel';
import { Cpu, History, Bookmark, Copy, ArrowLeftRight, LogOut, User as UserIcon, MessageSquare, X } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import ChatPanel from './ChatPanel';
import { analyzeCodeWithAI, fixCodeWithAI, chatWithAI } from '../services/aiAnalysis';
import type { ChatMessage } from '../services/aiAnalysis';

interface HomePageProps { user: User; }

interface Issue {
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  message: string;
  line?: number;
  column?: number;
  code?: string;
  suggestion?: string;
  fixedCode?: string;
  confidence: number;
  impact: string;
  effort: string;
  references?: string[];
}

interface AppAnalysis {
  language: string;
  overallScore: number;
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
    complexity: number;
    maintainability: number;
    readability: number;
    performance: number;
    security: number;
    documentation: number;
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    linesOfCode: number;
    duplicateLines: number;
    testCoverage: number;
  };
  recommendations: string[];
  codeSmells: number;
  technicalDebt: string;
  repository?: Record<string, unknown>;
  timestamp?: string;
  // Optional snippet of the analyzed code for history/restore
  codeSnippet?: string;
}


interface HomePageProps {
  user: User;
  onNavigate?: (view: 'home' | 'history') => void;
  restoredAnalysis?: AppAnalysis | null;
  clearRestoredAnalysis?: () => void;
}

// ... existing interfaces ...

export const HomePage: React.FC<HomePageProps> = ({ user, onNavigate, restoredAnalysis, clearRestoredAnalysis }) => {
  const [code, setCode] = useState('');
  const [analysis, setAnalysis] = useState<AppAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [wasAutoFixed, setWasAutoFixed] = useState(false);
  const [preFixScore, setPreFixScore] = useState<number | null>(null);
  const [autoFixMessage, setAutoFixMessage] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AppAnalysis[]>([]);
  const [collabSessionId, setCollabSessionId] = useState<string | null>(null);
  const [joinSessionInput, setJoinSessionInput] = useState('');
  const [targetLine, setTargetLine] = useState<number | null>(null);
  const [originalCode, setOriginalCode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'diff'>('editor');
  const isRemoteUpdate = useRef(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatting, setIsChatting] = useState(false);


  // Handle restored analysis from history
  useEffect(() => {
    if (restoredAnalysis) {
      setAnalysis(restoredAnalysis);
      if (restoredAnalysis.codeSnippet) {
        setCode(restoredAnalysis.codeSnippet);
      }
      // Clear the restored analysis prop so it doesn't re-trigger
      if (clearRestoredAnalysis) {
        clearRestoredAnalysis();
      }
    }
  }, [restoredAnalysis, clearRestoredAnalysis]);

  // Strip undefined values so Firestore doesn't reject the document
  const sanitize = (obj: unknown): unknown => JSON.parse(JSON.stringify(obj));

  // Save an analysis to Firestore history — separate from AI call so errors don't hide each other
  const saveToHistory = async (analysis: AppAnalysis, codeSnippet: string) => {
    try {
      // Use Timestamp.fromDate(new Date()) so the timestamp is immediately available
      // in snapshot listeners (serverTimestamp() has a pending-null state that breaks ordering)
      await addDoc(collection(db, 'analyses'), {
        uid: user.uid,
        analysis: sanitize(analysis),
        codeSnippet,
        createdAt: Timestamp.fromDate(new Date()),
      });
    } catch (err) {
      console.error('Failed to save analysis to history:', err);
    }
  };

  // Prefer serverless analysis for accuracy; fallback to local analyzer
  const analyzeCode = async (codeContent: string) => {
    setIsAnalyzing(true);
    // Fresh manual analysis — reset auto-fix comparison state
    setWasAutoFixed(false);
    setPreFixScore(null);
    try {
      const result = await analyzeCodeWithAI(codeContent);
      const newAnalysis: AppAnalysis = { ...result };

      setAnalysis(newAnalysis);
      setAnalysisHistory(prev => [newAnalysis, ...prev.slice(0, 9)]);
      void saveToHistory(newAnalysis, codeContent);

      if (collabSessionId) {
        const sessionRef = doc(db, 'collabSessions', collabSessionId);
        await setDoc(sessionRef, { code: codeContent, analysis: sanitize(newAnalysis), updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('AI analysis failed:', err);
      alert(`Analysis failed: ${err.message}`);
      setAnalysis(null);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Load user analysis history from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'analyses'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: AppAnalysis[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        // Backend saves analysis under 'analysis' field, not 'result'
        if (data?.analysis) {
          const baseAnalysis = data.analysis as AppAnalysis;
          const codeSnippet = (data as any).codeSnippet as string | undefined;
          items.push({
            ...baseAnalysis,
            codeSnippet,
          });
        }
      });
      setAnalysisHistory(items);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  // Removed unused export/share/email functions

  const handleRateIssue = async (index: number, rating: 1 | -1) => {
    try {
      await addDoc(collection(db, 'feedback'), {
        uid: user.uid,
        email: user.email,
        index,
        rating,
        analysisTimestamp: analysis?.timestamp || new Date().toISOString(),
        feedbackCreatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to rate issue:', error);
    }
  };


  const handleChat = async (userMessage: string) => {
    if (!userMessage.trim() || isChatting) return;
    const userMsg: ChatMessage = { role: 'user', content: userMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setIsChatting(true);
    try {
      const reply = await chatWithAI(code, analysis as any, chatMessages, userMessage);
      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I hit an error: ${msg}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  // Apply AI fix to the editor, then automatically re-analyze the fixed code
  const handleAutoFix = async () => {
    if (!analysis) { alert('Please analyze some code first.'); return; }
    if (!code.trim()) { alert('No code in the editor to fix.'); return; }

    try {
      setIsFixing(true);
      setAutoFixMessage(null);
      setWasAutoFixed(false);
      setPreFixScore(analysis.overallScore);
      setOriginalCode(code);

      // 1. Fix the code via AI
      const fixedCode = await fixCodeWithAI(code, analysis.issues, analysis.language);

      setCode(fixedCode);
      setIsFixing(false);
      setViewMode('diff');

      // 2. Re-analyze the fixed code so the score reflects the actual fixed state
      setAutoFixMessage('✨ Code fixed! Re-analyzing to verify improvements...');
      setIsAnalyzing(true);
      try {
        const reResult = await analyzeCodeWithAI(fixedCode);
        const reAnalysis: AppAnalysis = { ...reResult };
        setAnalysis(reAnalysis);
        setAnalysisHistory(prev => [reAnalysis, ...prev.slice(0, 9)]);
        // Only mark as auto-fixed after the score is confirmed accurate
        setWasAutoFixed(true);
        setAutoFixMessage('✓ Code auto-fixed and re-analyzed successfully!');
        setTimeout(() => setAutoFixMessage(null), 5000);
      } catch (analyzeErr) {
        console.warn('Re-analysis after fix failed:', analyzeErr);
        // Don't mark wasAutoFixed — score would not reflect fixed code
        setAutoFixMessage('⚠ Code fixed but re-analysis failed. Click Analyze to update the score.');
        setTimeout(() => setAutoFixMessage(null), 7000);
      } finally {
        setIsAnalyzing(false);
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      alert(`Auto Fix failed: ${msg}`);
    } finally {
      setIsFixing(false);
    }
  };

  const handleSaveSnippet = async () => {
    if (!code || !analysis) return;
    try {
      await addDoc(collection(db, 'bookmarks'), {
        uid: user.uid,
        code,
        analysis,
        createdAt: serverTimestamp(),
      });
      setAutoFixMessage('⭐ Snippet saved to your library!');
      setTimeout(() => setAutoFixMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save snippet:', error);
      alert('Failed to save snippet.');
    }
  };

  // Start a new collaborative session
  const handleStartCollabSession = async () => {
    const id = Math.random().toString(36).slice(2, 10);
    const sessionRef = doc(db, 'collabSessions', id);
    await setDoc(sessionRef, {
      code,
      analysis: analysis || null,
      ownerUid: user.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setCollabSessionId(id);
    setJoinSessionInput(id);
  };

  // Join an existing collaborative session by ID
  const handleJoinSession = (id: string) => {
    if (!id) return;
    setCollabSessionId(id.trim());
  };

  // Sync incoming collaborative session updates (code + analysis) to local state
  useEffect(() => {
    if (!collabSessionId) return;
    const sessionRef = doc(db, 'collabSessions', collabSessionId);
    const unsub = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as any;

      isRemoteUpdate.current = true;

      if (typeof data.code === 'string') {
        setCode(data.code);
      }
      if (data.analysis) {
        setAnalysis(data.analysis as AppAnalysis);
      }
      if (typeof data.originalCode === 'string') {
        setOriginalCode(data.originalCode);
      }
      if (typeof data.viewMode === 'string') {
        setViewMode(data.viewMode as 'editor' | 'diff');
      }
      if (typeof data.wasAutoFixed === 'boolean') {
        setWasAutoFixed(data.wasAutoFixed);
      }

      // Reset the flag after state updates have been queued
      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 100);
    });
    return () => unsub();
  }, [collabSessionId]);

  // Push local state changes to the collaborative session document
  useEffect(() => {
    if (!collabSessionId) return;
    if (isRemoteUpdate.current) return;

    const sync = async () => {
      const sessionRef = doc(db, 'collabSessions', collabSessionId);
      await setDoc(
        sessionRef,
        {
          code,
          originalCode,
          viewMode,
          wasAutoFixed,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    };

    // Only sync if there is something to sync
    if (code !== undefined) {
      void sync();
    }
  }, [code, originalCode, viewMode, wasAutoFixed, collabSessionId]);

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#040d1a', color: '#f1f5f9' }}>

      {/* Auto-fix banner */}
      {autoFixMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {autoFixMessage}
        </div>
      )}

      {/* ── Header / Nav ─────────────────────────────── */}
      <header className="nav-bar sticky top-0 z-40 px-6 py-3 flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-extrabold text-aurora hidden sm:block">Intellicode</span>
        </div>

        {/* Nav pills */}
        <nav className="flex items-center gap-1">
          {[
            { label: 'History', view: 'history' as const, icon: History },
            { label: 'Snippets', view: 'snippets' as const, icon: Bookmark },
          ].map(({ label, view, icon: Icon }) => (
            <button
              key={view}
              onClick={() => onNavigate?.(view as any)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: 'transparent',
                color: '#94a3b8',
              }}
              onMouseOver={(e) => (e.currentTarget.style.color = '#f1f5f9')}
              onMouseOut={(e) => (e.currentTarget.style.color = '#94a3b8')}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </nav>

        {/* User info + sign out */}
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

      {/* ── Main content ─────────────────────────────── */}
      <main className="flex-1 flex flex-col md:flex-row gap-5 p-5 lg:p-6">

        {/* ── Left: Code Editor panel ─────────────────── */}
        <section className="flex-1 glass rounded-2xl flex flex-col overflow-hidden"
          style={{ minHeight: 0, border: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Panel header */}
          <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>

            {/* View mode toggle (only when auto-fixed) */}
            {originalCode && wasAutoFixed && (
              <div className="ml-auto flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                <button
                  onClick={() => setViewMode('editor')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={viewMode === 'editor'
                    ? { background: 'rgba(6,182,212,0.2)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }
                    : { color: '#64748b' }
                  }
                >
                  Editor
                </button>
                <button
                  onClick={() => setViewMode('diff')}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all"
                  style={viewMode === 'diff'
                    ? { background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                    : { color: '#64748b' }
                  }
                >
                  <ArrowLeftRight className="w-3 h-3" /> Diff
                </button>
              </div>
            )}

            {/* Collab session */}
            <div className="ml-auto flex items-center gap-2">
              {collabSessionId ? (
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-slate-400 font-mono">{collabSessionId}</span>
                  <button
                    onClick={() => { navigator.clipboard.writeText(collabSessionId); }}
                    className="p-1 text-slate-500 hover:text-slate-300 transition-colors"
                    title="Copy session ID"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleStartCollabSession}
                    className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    + Session
                  </button>
                  <input
                    type="text"
                    value={joinSessionInput}
                    onChange={(e) => setJoinSessionInput(e.target.value)}
                    placeholder="Session ID"
                    className="text-xs px-2 py-1 rounded-lg w-28"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', outline: 'none' }}
                  />
                  <button
                    onClick={() => handleJoinSession(joinSessionInput)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold text-slate-400 hover:text-white transition-all"
                    style={{ background: 'rgba(255,255,255,0.05)' }}
                  >
                    Join
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Editor / Diff viewer */}
          <div className="flex-1 overflow-auto p-4">
            {viewMode === 'editor' ? (
              <CodeInput
                onAnalyze={analyzeCode}
                isAnalyzing={isAnalyzing}
                code={code}
                setCode={setCode}
                targetLine={targetLine}
                onLineNavigated={() => setTargetLine(null)}
                issues={analysis?.issues ?? []}
                onFolderFileSelect={(name, content, result) => {
                  const a: AppAnalysis = { ...result };
                  setCode(content);
                  setAnalysis(a);
                  setAnalysisHistory(prev => [a, ...prev.slice(0, 9)]);
                  void saveToHistory(a, content);
                }}
              />
            ) : (
              <DiffViewer original={originalCode || ''} modified={code} />
            )}
          </div>
        </section>

        {/* ── Right: Analysis panel ────────────────────── */}
        <section className="w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col gap-3">
          <ReviewPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            isFixing={isFixing}
            onAutoFix={handleAutoFix}
            sessionId={collabSessionId || currentAnalysisId || ''}
            onRateIssue={handleRateIssue}
            wasAutoFixed={wasAutoFixed}
            preFixScore={preFixScore}
            onIssueClick={(line) => setTargetLine(line)}
            onSaveSnippet={handleSaveSnippet}
          />
        </section>
      </main>

      {/* ── Floating Chat Widget ──────────────────────── */}

      {/* Chat panel */}
      {isChatOpen && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[360px] shadow-2xl"
          style={{ filter: 'drop-shadow(0 24px 48px rgba(0,0,0,0.6))' }}
        >
          <ChatPanel
            messages={chatMessages}
            isChatting={isChatting}
            hasCode={!!code.trim()}
            onSend={handleChat}
          />
        </div>
      )}

      {/* Chat toggle button */}
      <button
        onClick={() => setIsChatOpen(prev => !prev)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all duration-200 hover:scale-110 active:scale-95"
        style={{
          background: isChatOpen
            ? 'rgba(30,30,50,0.95)'
            : 'linear-gradient(135deg, #ec4899, #f97316)',
          border: isChatOpen ? '1px solid rgba(255,255,255,0.12)' : 'none',
          boxShadow: isChatOpen
            ? '0 8px 32px rgba(0,0,0,0.5)'
            : '0 8px 32px rgba(236,72,153,0.4)',
        }}
        title={isChatOpen ? 'Close chat' : 'AI Code Chat'}
      >
        {isChatOpen
          ? <X className="w-5 h-5 text-white" />
          : <MessageSquare className="w-5 h-5 text-white" />
        }
      </button>

    </div>
  );
};
