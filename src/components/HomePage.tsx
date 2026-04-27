import React, { useState, useEffect, useRef } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, Timestamp, serverTimestamp, query, where, orderBy, onSnapshot, doc, setDoc, updateDoc, arrayUnion, limit } from 'firebase/firestore';
import { CodeInput } from './CodeInput';
import ReviewPanel from './ReviewPanel';
import { Cpu, History, Bookmark, Copy, ArrowLeftRight, LogOut, MessageSquare, X, Send } from 'lucide-react';
import { DiffViewer } from './DiffViewer';
import ChatPanel from './ChatPanel';
import { analyzeCodeWithAI, fixCodeWithAI, chatWithAI } from '../services/aiAnalysis';
import type { ChatMessage } from '../services/aiAnalysis';



/* ── SECTION: TYPES & INTERFACES ─────────────────── */
interface Issue {
  id?: string;
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
  onNavigate?: (view: 'home' | 'history' | 'snippets') => void;
  restoredAnalysis?: AppAnalysis | null;
  clearRestoredAnalysis?: () => void;
}

function sanitize<T>(obj: T): T | null {
  if (!obj) return null;
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Fetch error:', err);
    throw new Error(`Connection to analysis server failed (${msg}). If you are running locally, ensure 'npm run dev' is active and you have an internet connection.`);
  }
}

function toUserFriendlyAIError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/quota|rate limit|429|insufficient_quota/i.test(message)) {
    return 'AI quota/rate limit reached. Wait for reset or upgrade your provider billing, then try again.';
  }
  return message;
}

// Simple hash function for code fingerprinting (Table 5.8: codeHash)
function generateCodeHash(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    const char = code.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

/* ── SECTION: MAIN COMPONENT ──────────────────────── */
export const HomePage: React.FC<HomePageProps> = ({ user, onNavigate, restoredAnalysis, clearRestoredAnalysis }) => {
  /* ── 1. Component States ──────────────────────── */
  const [code, setCode] = useState('');
  const [analysis, setAnalysis] = useState<AppAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [, setAnalysisHistory] = useState<AppAnalysis[]>([]);
  const [wasAutoFixed, setWasAutoFixed] = useState(false);
  const [preFixScore, setPreFixScore] = useState<number | null>(null);
  const [autoFixMessage, setAutoFixMessage] = useState<string | null>(null);
  // Analysis history is managed but not rendered in this component directly (used for history view in parent)
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
  const [commentInput, setCommentInput] = useState('');
  const [collabComments, setCollabComments] = useState<Array<{ uid: string; displayName: string; text: string; createdAt: string }>>([]);
  const [collabOwnerUid, setCollabOwnerUid] = useState<string | null>(null);
  const [sessionKicked, setSessionKicked] = useState(false);
  // Keep setter for existing session lifecycle calls.
  const [, setCollabConnected] = useState(false);
  const [participants, setParticipants] = useState<Array<{ uid: string; displayName: string; photoURL: string; role: 'host' | 'participant' }>>([]);
  const [inputMethod, setInputMethod] = useState<'paste' | 'upload' | 'folder' | 'github'>('paste');
  const [linkCopied, setLinkCopied] = useState(false);
  const [selectedSeverity, setSelectedSeverity] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showMetrics, setShowMetrics] = useState(true);
  const [expandedIssueIds, setExpandedIssueIds] = useState<number[]>([]);
  const [githubUrl, setGithubUrl] = useState('');
  const [githubFilter, setGithubFilter] = useState('');

  // Refs for sync listener to avoid dependency loops
  const codeRef = useRef(code);
  const analysisRef = useRef(analysis);
  const chatMessagesRef = useRef(chatMessages);
  const viewModeRef = useRef(viewMode);
  const originalCodeRef = useRef(originalCode);
  const wasAutoFixedRef = useRef(wasAutoFixed);

  useEffect(() => { codeRef.current = code; }, [code]);
  useEffect(() => { analysisRef.current = analysis; }, [analysis]);
  useEffect(() => { chatMessagesRef.current = chatMessages; }, [chatMessages]);
  useEffect(() => { viewModeRef.current = viewMode; }, [viewMode]);
  useEffect(() => { originalCodeRef.current = originalCode; }, [originalCode]);
  useEffect(() => { wasAutoFixedRef.current = wasAutoFixed; }, [wasAutoFixed]);
  const [avatarError, setAvatarError] = useState(false);




  // Auto-join session from URL param (e.g. ?session=abc123)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionParam = params.get('session');
    if (sessionParam) {
      const sessionId = sessionParam.trim();
      setCollabSessionId(sessionId);
      updateDoc(doc(db, 'collabSessions', sessionId), {
        participants: arrayUnion(user.uid),
      }).catch(() => { });
      window.history.replaceState({}, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  /* ── 2. Firebase Database Handlers ───────────────── */
  // Save an analysis to Firestore history
  const saveToHistory = async (analysis: AppAnalysis, codeSnippet: string): Promise<string | null> => {
    try {
      // 1. Create a CodeSubmission record first (Table 5.8/FK from Table 5.2)
      const subRef = await addDoc(collection(db, 'codeSubmissions'), {
        userId: user.uid,
        codeContent: codeSnippet, // Table schema field
        language: analysis.language,
        inputMethod: inputMethod, // e.g. paste, upload, github
        filename: inputMethod === 'upload' ? 'uploaded_file' : null,
        codeHash: generateCodeHash(codeSnippet),
        submittedAt: serverTimestamp(),
      });

      // 2. Extract errors and warnings based on severity
      const errors = analysis.issues.filter(i => i.severity === 'critical' || i.severity === 'high');
      const warnings = analysis.issues.filter(i => i.severity === 'medium' || i.severity === 'low');

      // 3. Create the Analysis record
      const docRef = await addDoc(collection(db, 'analyses'), {
        submissionId: subRef.id, // FK
        userId: user.uid, // FK
        overallScore: analysis.overallScore,
        errors: sanitize(errors),
        warnings: sanitize(warnings),
        recommendations: sanitize(analysis.recommendations),
        autoFixes: null,
        analysedAt: serverTimestamp(),
        // Keep these for UI fallback during transition
        analysis: sanitize(analysis),
        language: analysis.language,
        metrics: sanitize(analysis.metrics),
        technicalDebt: analysis.technicalDebt,
        // Legacy fields for backward compatibility
        uid: user.uid,
        createdAt: serverTimestamp(),
      });
      setCurrentAnalysisId(docRef.id);
      return docRef.id;
    } catch (err) {
      console.error('Failed to save analysis to history:', err);
      return null;
    }
  };

  /* ── 3. AI Analysis & Logic ─────────────────────── */
  // Prefer serverless analysis for accuracy
  const analyzeCode = async (codeContent: string) => {
    setIsAnalyzing(true);
    // Fresh manual analysis — reset auto-fix comparison state
    setWasAutoFixed(false);
    setPreFixScore(null);
    try {
      const result = await analyzeCodeWithAI(codeContent);
      const newAnalysis: AppAnalysis = { ...result };

      setAnalysis(newAnalysis);
      // History state is kept for reference but not displayed in this view
      void saveToHistory(newAnalysis, codeContent);

      if (collabSessionId) {
        const sessionRef = doc(db, 'collabSessions', collabSessionId);
        await setDoc(sessionRef, { code: codeContent, analysis: sanitize(newAnalysis), updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('AI analysis failed:', err);
      const friendly = toUserFriendlyAIError(err);
      setAutoFixMessage(`Analysis failed: ${friendly}`);
      setTimeout(() => setAutoFixMessage(null), 7000);
      setAnalysis(null);

      // Sync the error state to participants so they aren't stuck loading
      if (collabSessionId) {
        const sessionRef = doc(db, 'collabSessions', collabSessionId);
        void setDoc(sessionRef, { isAnalyzing: false, updatedAt: serverTimestamp() }, { merge: true });
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Initial setup: load history
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, 'analyses'),
      where('userId', '==', user.uid),
      orderBy('analysedAt', 'desc'),
      limit(10)
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: AppAnalysis[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as any;
        // Reconstruct AppAnalysis from flattened schema if needed, or use the legacy 'analysis' field
        if (data?.analysis) {
          items.push({ ...data.analysis, codeSnippet: data.codeSnippet });
        } else if (data?.errors) {
          items.push({
            language: data.language || 'unknown',
            overallScore: data.overallScore || 0,
            issues: [...(data.errors || []), ...(data.warnings || [])],
            recommendations: data.recommendations || [],
            summary: {
              totalIssues: (data.errors?.length || 0) + (data.warnings?.length || 0),
              criticalIssues: data.errors?.filter((i: any) => i.severity === 'critical').length || 0,
              highIssues: data.errors?.filter((i: any) => i.severity === 'high').length || 0,
              mediumIssues: data.warnings?.filter((i: any) => i.severity === 'medium').length || 0,
              lowIssues: data.warnings?.filter((i: any) => i.severity === 'low').length || 0,
            } as any,
            metrics: data.metrics || {},
            technicalDebt: data.technicalDebt || 'unknown',
          } as any);
        }
      });
      // setAnalysisHistory(items);
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

  const handleRateIssue = async (issueIndex: number, rating: 1 | -1) => {
    try {
      // Restructured to match Table 5.5: Feedback Collection
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        analysisId: currentAnalysisId,
        issueId: analysis?.issues[issueIndex]?.id || null,
        rating: rating, // metadata
        createdAt: serverTimestamp(),
        // Legacy fields
        uid: user.uid,
        issueIndex,
      });
    } catch (error) {
      console.error('Failed to rate issue:', error);
    }
  };


  /* ── 4. Chat & AI Assistant ──────────────────────── */
  const handleChat = async (userMessage: string) => {
    if (!userMessage.trim() || isChatting) return;
    const userMsg: ChatMessage = { role: 'user', content: userMessage };
    setChatMessages(prev => [...prev, userMsg]);
    setIsChatting(true);

    try {
      // 1. Save user message to chat collection (Table 5.4)
      await addDoc(collection(db, 'chat'), {
        userId: user.uid,
        sender: 'user',
        content: userMessage,
        endpoint: '/api/chat',
        createdAt: serverTimestamp(),
      });

      const reply = await chatWithAI(code, analysis as any, chatMessages, userMessage);

      // 2. Save assistant reply to chat collection (Table 5.4)
      await addDoc(collection(db, 'chat'), {
        userId: user.uid,
        sender: 'assistant',
        content: reply,
        endpoint: '/api/chat',
        createdAt: serverTimestamp(),
      });

      setChatMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Sorry, I hit an error: ${msg}` }]);
    } finally {
      setIsChatting(false);
    }
  };

  /* ── 5. Auto-Fix Feature ────────────────────────── */
  // Apply AI fix to the editor
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
      setWasAutoFixed(true);

      if (collabSessionId) {
        const sessionRef = doc(db, 'collabSessions', collabSessionId);
        void setDoc(sessionRef, {
          originalCode: code,
          code: fixedCode,
          viewMode: 'diff',
          wasAutoFixed: true,
          preFixScore: analysis.overallScore,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }

      // 2. We trigger re-analysis automatically so the side panel updates
      setAutoFixMessage('✨ Code fixed! Re-analyzing to verify improvements...');
      setIsAnalyzing(true);
      try {
        const reResult = await analyzeCodeWithAI(fixedCode);
        const reAnalysis: AppAnalysis = { ...reResult };
        setAnalysis(reAnalysis);
        setAnalysisHistory(prev => [reAnalysis, ...prev.slice(0, 9)]);
        setWasAutoFixed(true);
        setAutoFixMessage('✓ Code auto-fixed and re-analyzed successfully!');
        setTimeout(() => setAutoFixMessage(null), 5000);
      } catch (analyzeErr) {
        console.warn('Re-analysis after fix failed:', analyzeErr);
        setAutoFixMessage('⚠ Code fixed but re-analysis failed.');
        setTimeout(() => setAutoFixMessage(null), 7000);
      } finally {
        setIsAnalyzing(false);
      }

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('Auto-fix failed:', err);
      const friendly = toUserFriendlyAIError(err);
      setAutoFixMessage(`Auto-fix failed: ${friendly}`);
      setTimeout(() => setAutoFixMessage(null), 8000);
    } finally {
      setIsFixing(false);
    }
  };



  const handleSaveSnippet = async () => {
    if (!code || !analysis) return;
    try {
      // Bookmarks Collection
      await addDoc(collection(db, 'bookmarks'), {
        userId: user.uid,
        title: `${analysis.language} Snippet - ${new Date().toLocaleDateString()}`,
        codeContent: code,
        language: analysis.language,
        createdAt: serverTimestamp(),
        // Legacy fields for UI compatibility
        uid: user.uid,
        code,
        analysis,
      });
      setAutoFixMessage('⭐ Snippet saved to your library!');
      setTimeout(() => setAutoFixMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save snippet:', error);
      alert('Failed to save snippet.');
    }
  };

  /* ── 6. Real-time Collaboration ──────────────────── */
  // Start a new collaborative session
  const handleStartCollabSession = async () => {
    // 1. Create a CodeSubmission record for this session
    let subId = '';
    try {
      const subRef = await addDoc(collection(db, 'codeSubmissions'), {
        userId: user.uid,
        codeContent: code,
        language: analysis?.language || 'unknown',
        inputMethod: inputMethod,
        filename: null,
        codeHash: generateCodeHash(code),
        submittedAt: serverTimestamp(),
      });
      subId = subRef.id;
    } catch (e) { console.warn('Failed to create submission for session', e); }

    const id = Math.random().toString(36).slice(2, 10);
    const sessionRef = doc(db, 'collabSessions', id);
    await setDoc(sessionRef, {
      hostUserId: user.uid, // Table 5.3
      submissionId: subId, // Table 5.3
      participants: [user.uid], // Table 5.3
      comments: [], // Table 5.3
      status: 'active', // Table 5.3
      createdAt: serverTimestamp(), // Table 5.3

      // Legacy fields for UI/Logic sync
      code,
      analysis: sanitize(analysis),
      ownerUid: user.uid,
      inputMethod,
      isAnalyzing,
      isFixing,
      participantsInfo: {
        [user.uid]: {
          displayName: user.displayName || 'Anonymous',
          photoURL: user.photoURL || '',
          role: 'host'
        }
      },
      analysisId: currentAnalysisId,
      updatedAt: serverTimestamp(),
    });
    setCollabSessionId(id);
    setCollabOwnerUid(user.uid);
    setJoinSessionInput(id);
  };

  // Extract session ID from either a raw ID or a full invite URL
  const extractSessionId = (input: string): string => {
    const trimmed = input.trim();
    try {
      const url = new URL(trimmed);
      return url.searchParams.get('session') || trimmed;
    } catch {
      return trimmed;
    }
  };

  // Join an existing collaborative session by ID or invite URL
  const handleJoinSession = (input: string) => {
    if (!input) return;
    const sessionId = extractSessionId(input);
    if (!sessionId) return;
    setCollabConnected(false);
    setCollabSessionId(sessionId);

    // Update participants info
    const sessionRef = doc(db, 'collabSessions', sessionId);
    updateDoc(sessionRef, {
      participants: arrayUnion(user.uid),
      [`participantsInfo.${user.uid}`]: {
        displayName: user.displayName || 'Anonymous',
        photoURL: user.photoURL || '',
        role: 'participant'
      }
    }).catch(() => { });
  };

  const handleLeaveSession = () => {
    setCollabSessionId(null);
    setCollabConnected(false);
    setCollabComments([]);
    setChatMessages([]);
  };

  const handleSaveReport = async (type: 'html' | 'email' | 'pdf' | 'csv', recipientEmail?: string, status: 'downloaded' | 'sent' | 'failed' = 'downloaded') => {
    try {
      // Reports Collection
      await addDoc(collection(db, 'reports'), {
        userId: user.uid,
        analysisId: currentAnalysisId,
        format: type,
        emailSentTo: recipientEmail ?? null,
        fileURL: null, // Populated if uploaded to storage
        status,
        createdAt: serverTimestamp(),
        // Legacy fields
        uid: user.uid,
        type,
      });
    } catch (err) {
      console.error('Failed to save report record:', err);
    }
  };

  const handleAddComment = async () => {
    if (!commentInput.trim() || !collabSessionId) return;
    const comment = {
      uid: user.uid,
      displayName: user.displayName || user.email || 'Anonymous',
      text: commentInput.trim(),
      createdAt: new Date().toISOString(),
    };
    setCommentInput('');
    try {
      await updateDoc(doc(db, 'collabSessions', collabSessionId), {
        comments: arrayUnion(comment),
      });
    } catch (err) {
      console.error('Failed to add comment:', err);
    }
  };

  const handleEndSession = async () => {
    if (!collabSessionId) return;
    try {
      await updateDoc(doc(db, 'collabSessions', collabSessionId), { status: 'closed' });
    } catch (err) {
      console.error('Failed to end session:', err);
    }
    setCollabSessionId(null);
    setCollabOwnerUid(null);
    setCollabComments([]);
    setCollabConnected(false);
    setJoinSessionInput('');
  };

  // Sync incoming collaborative session updates to local state
  useEffect(() => {
    if (!collabSessionId) return;
    const sessionRef = doc(db, 'collabSessions', collabSessionId);

    const unsub = onSnapshot(sessionRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data() as Record<string, unknown>;

      // Connection active
      isRemoteUpdate.current = true;

      // Use refs for comparison to avoid re-subscribing on every local change
      if (typeof data.code === 'string' && data.code !== codeRef.current) {
        setCode(data.code);
      }
      if (data.analysis && JSON.stringify(data.analysis) !== JSON.stringify(analysisRef.current)) {
        setAnalysis(data.analysis as AppAnalysis);
      }
      if (typeof data.originalCode === 'string' && data.originalCode !== originalCodeRef.current) {
        setOriginalCode(data.originalCode);
      }
      if (typeof data.viewMode === 'string' && data.viewMode !== viewModeRef.current) {
        setViewMode(data.viewMode as 'editor' | 'diff');
      }
      if (typeof data.wasAutoFixed === 'boolean' && data.wasAutoFixed !== wasAutoFixedRef.current) {
        setWasAutoFixed(data.wasAutoFixed);
      }
      if (typeof data.inputMethod === 'string' && data.inputMethod !== inputMethod) {
        setInputMethod(data.inputMethod as 'paste' | 'upload' | 'folder' | 'github');
      }
      if (typeof data.isAnalyzing === 'boolean' && data.isAnalyzing !== isAnalyzing) {
        setIsAnalyzing(data.isAnalyzing);
      }
      if (typeof data.isFixing === 'boolean' && data.isFixing !== isFixing) {
        setIsFixing(data.isFixing);
      }
      if (typeof data.selectedSeverity === 'string' && data.selectedSeverity !== selectedSeverity) {
        setSelectedSeverity(data.selectedSeverity);
      }
      if (typeof data.selectedCategory === 'string' && data.selectedCategory !== selectedCategory) {
        setSelectedCategory(data.selectedCategory);
      }
      if (typeof data.showMetrics === 'boolean' && data.showMetrics !== showMetrics) {
        setShowMetrics(data.showMetrics);
      }
      if (Array.isArray(data.expandedIssueIds) && JSON.stringify(data.expandedIssueIds) !== JSON.stringify(expandedIssueIds)) {
        setExpandedIssueIds(data.expandedIssueIds);
      }
      if (typeof data.targetLine === 'number' && data.targetLine !== targetLine) {
        setTargetLine(data.targetLine);
      }
      if (typeof data.githubUrl === 'string' && data.githubUrl !== githubUrl) {
        setGithubUrl(data.githubUrl);
      }
      if (typeof data.githubFilter === 'string' && data.githubFilter !== githubFilter) {
        setGithubFilter(data.githubFilter);
      }
      if ((typeof data.preFixScore === 'number' || data.preFixScore === null) && data.preFixScore !== preFixScore) {
        setPreFixScore(data.preFixScore);
      }
      if (Array.isArray(data.chatMessages) && JSON.stringify(data.chatMessages) !== JSON.stringify(chatMessagesRef.current)) {
        setChatMessages(data.chatMessages);
      }
      if (Array.isArray(data.comments)) {
        setCollabComments(data.comments);
      }
      if (typeof data.hostUserId === 'string') {
        setCollabOwnerUid(data.hostUserId);
      } else if (typeof data.ownerUid === 'string') {
        setCollabOwnerUid(data.ownerUid);
      }
      if (data.participantsInfo) {
        const pInfo = data.participantsInfo as Record<string, { displayName: string, photoURL: string, role: string }>;
        const list: Array<{ uid: string; displayName: string; photoURL: string; role: 'host' | 'participant' }> = Object.entries(pInfo).map(([uid, info]) => ({
          uid,
          displayName: info.displayName,
          photoURL: info.photoURL,
          role: info.role === 'host' ? 'host' : 'participant',
        }));
        setParticipants(list);
      }

      if (data.status === 'closed' && data.ownerUid !== user.uid) {
        isRemoteUpdate.current = false;
        setCollabSessionId(null);
        setCollabOwnerUid(null);
        setCollabComments([]);
        // Connection closed
        setJoinSessionInput('');
        setSessionKicked(true);
        setTimeout(() => setSessionKicked(false), 4000);
        return;
      }

      setTimeout(() => {
        isRemoteUpdate.current = false;
      }, 100);
    });
    return () => unsub();
  }, [collabSessionId, user.uid]); // Minimal dependencies to prevent re-subscribing loops

  // Push local state changes to the collaborative session document (debounced)
  useEffect(() => {
    if (!collabSessionId || isRemoteUpdate.current) return;

    const timeout = setTimeout(async () => {
      try {
        const sessionRef = doc(db, 'collabSessions', collabSessionId);
        await setDoc(
          sessionRef,
          {
            code,
            originalCode,
            viewMode,
            wasAutoFixed,
            preFixScore,
            chatMessages,
            inputMethod,
            isAnalyzing,
            isFixing,
            selectedSeverity,
            selectedCategory,
            showMetrics,
            expandedIssueIds,
            targetLine,
            githubUrl,
            githubFilter,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      } catch (err) {
        console.error('Failed to sync session state:', err);
      }
    }, 1500); // 1500ms debounce to save on writes while keeping it "real-time"

    return () => clearTimeout(timeout);
  }, [code, originalCode, viewMode, wasAutoFixed, preFixScore, chatMessages, collabSessionId]);

  /* ── SECTION: RENDER UI ─────────────────────────── */
  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#040d1a', color: '#f1f5f9' }}>

      {/* Session ended banner */}
      {sessionKicked && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 8px 32px rgba(220,38,38,0.3)' }}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          The host ended this session.
        </div>
      )}

      {/* Auto-fix banner */}
      {autoFixMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white text-sm font-semibold flex items-center gap-3"
          style={{ background: 'linear-gradient(135deg, #059669, #10b981)', boxShadow: '0 8px 32px rgba(16,185,129,0.3)' }}>
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          {autoFixMessage}
        </div>
      )}

      {/* ── PART 1: TOP NAVIGATION ─────────────────── */}
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
              onClick={() => onNavigate?.(view)}
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
          {user.photoURL && !avatarError ? (
            <img
              src={user.photoURL}
              alt={user.displayName || 'User'}
              className="w-7 h-7 rounded-full ring-2 ring-cyan-500/40"
              onError={() => setAvatarError(true)}
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
              <span className="text-xs font-bold text-white leading-none">
                {(user.displayName || user.email || '?')[0].toUpperCase()}
              </span>
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
      {/* ── PART 2: MAIN DASHBOARD ─────────────────── */}
      <main className="flex-1 flex flex-col md:flex-row gap-5 p-5 lg:p-6">

        {/* ── LEFT SIDE: CODE EDITOR PANEL ─────────── */}
        <section className="flex-1 glass rounded-2xl flex flex-col overflow-hidden"
          style={{ minHeight: 0, border: '1px solid rgba(255,255,255,0.07)' }}>

          {/* Panel header */}
          <div className="px-5 py-3 border-b flex items-center gap-3 flex-wrap"
            style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>

            {/* Left side: View modes */}
            <div className="flex items-center gap-2">
              {originalCode && wasAutoFixed && (
                <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <button
                    onClick={() => setViewMode('editor')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all relative z-10 cursor-pointer"
                    style={viewMode === 'editor'
                      ? { background: 'rgba(6,182,212,0.2)', color: '#06b6d4', border: '1px solid rgba(6,182,212,0.3)' }
                      : { color: '#64748b' }
                    }
                  >
                    Editor
                  </button>
                  <button
                    onClick={() => setViewMode('diff')}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all relative z-10 cursor-pointer"
                    style={viewMode === 'diff'
                      ? { background: 'rgba(16,185,129,0.2)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }
                      : { color: '#64748b' }
                    }
                  >
                    <ArrowLeftRight className="w-3 h-3" /> Diff
                  </button>
                </div>
              )}
            </div>

            {/* Right side: Collab session */}
            <div className="ml-auto flex items-center gap-3">
              {collabSessionId ? (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Live</span>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?session=${collabSessionId}`);
                      setLinkCopied(true);
                      setTimeout(() => setLinkCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs transition-all duration-200"
                    style={{
                      background: linkCopied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                      color: linkCopied ? '#4ade80' : '#94a3b8',
                      border: `1px solid ${linkCopied ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.1)'}`
                    }}
                    title="Copy invite link"
                  >
                    <Copy className="w-3 h-3" />
                    {linkCopied ? 'Copied Link!' : 'Invite'}
                  </button>

                  {/* Participant list */}
                  <div className="flex items-center -space-x-2 ml-2">
                    {participants.map((p) => (
                      <div
                        key={p.uid}
                        className="w-6 h-6 rounded-full border-2 border-[#0f172a] overflow-hidden bg-slate-800 flex items-center justify-center relative group"
                        title={`${p.displayName} (${p.role})`}
                      >
                        {p.photoURL ? (
                          <img src={p.photoURL} alt={p.displayName} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400">{p.displayName[0]}</span>
                        )}
                        {p.role === 'host' && (
                          <div className="absolute -top-1 -right-1 bg-amber-400 w-2 h-2 rounded-full border border-[#0f172a]" />
                        )}
                      </div>
                    ))}
                  </div>

                  {collabOwnerUid === user.uid ? (
                    <button
                      onClick={handleEndSession}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-400 hover:text-red-300 transition-colors uppercase tracking-wider"
                      style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                    >
                      End Session
                    </button>
                  ) : (
                    <button
                      onClick={handleLeaveSession}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      Leave
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 relative z-10">
                  <button
                    onClick={handleStartCollabSession}
                    disabled={isAnalyzing}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    + Session
                  </button>
                  <div className="flex items-center bg-white/5 border border-white/10 rounded-lg overflow-hidden h-[30px]">
                    <input
                      type="text"
                      value={joinSessionInput}
                      onChange={(e) => setJoinSessionInput(e.target.value)}
                      placeholder="Session ID…"
                      className="text-[11px] px-2 w-24 bg-transparent border-none text-slate-200 outline-none"
                    />
                    <button
                      onClick={() => handleJoinSession(joinSessionInput)}
                      className="px-3 h-full text-[11px] font-bold bg-white/5 border-l border-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
                    >
                      Join
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Collab comments */}
          {collabSessionId && (
            <div className="border-b flex flex-col gap-2 px-4 py-3" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
              {collabComments.length > 0 && (
                <div className="flex flex-col gap-1 max-h-28 overflow-y-auto">
                  {collabComments.map((c, i) => (
                    <div key={i} className="flex gap-2 text-xs">
                      <span className="text-slate-500 flex-shrink-0">{c.displayName.split(' ')[0]}:</span>
                      <span className="text-slate-300">{c.text}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={commentInput}
                  onChange={e => setCommentInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddComment()}
                  placeholder="Add a comment…"
                  className="flex-1 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#f1f5f9', outline: 'none' }}
                />
                <button
                  onClick={handleAddComment}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white transition-colors"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
                {collabOwnerUid === user.uid && (
                  <button
                    onClick={handleEndSession}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                    style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}
                  >
                    End
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Editor / Diff viewer */}
          <div className="flex-1 overflow-auto p-4">
            {/* CodeInput is ALWAYS mounted — hidden in diff mode so its internal
                state (GitHub tab, repo tree, inputMethod) survives view switches */}
            <div style={{ display: viewMode === 'editor' ? 'block' : 'none' }}>
              <CodeInput
                onAnalyze={analyzeCode}
                isAnalyzing={isAnalyzing}
                code={code}
                setCode={setCode}
                inputMethod={inputMethod}
                setInputMethod={setInputMethod}
                targetLine={targetLine}
                setTargetLine={setTargetLine}
                githubUrl={githubUrl}
                setGithubUrl={setGithubUrl}
                githubFilter={githubFilter}
                setGithubFilter={setGithubFilter}
                onLineNavigated={() => setTargetLine(null)}
                issues={analysis?.issues ?? []}
                onFolderFileSelect={(_name, content, result) => {
                  const a: AppAnalysis = { ...result };
                  setCode(content);
                  setAnalysis(a);
                  setAnalysisHistory(prev => [a, ...prev.slice(0, 9)]);
                  void saveToHistory(a, content);
                }}
              />
            </div>
            {viewMode === 'diff' && (
              <DiffViewer
                original={originalCode || ''}
                modified={code}
                onClose={() => setViewMode('editor')}
              />
            )}
          </div>
        </section>

        {/* ── RIGHT SIDE: ANALYSIS RESULTS PANEL ────── */}
        <section className="w-full md:w-[420px] lg:w-[460px] flex-shrink-0 flex flex-col gap-3">
          <ReviewPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            isFixing={isFixing}
            onAutoFix={handleAutoFix}
            sessionId={collabSessionId || currentAnalysisId || ''}
            onRateIssue={handleRateIssue}
            onSaveReport={handleSaveReport}
            wasAutoFixed={wasAutoFixed}
            preFixScore={preFixScore}
            onIssueClick={(line) => setTargetLine(line)}
            onSaveSnippet={handleSaveSnippet}
            selectedSeverity={selectedSeverity}
            setSelectedSeverity={setSelectedSeverity}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            showMetrics={showMetrics}
            setShowMetrics={setShowMetrics}
            expandedIssueIds={expandedIssueIds}
            setExpandedIssueIds={setExpandedIssueIds}
          />
        </section>
      </main>

      {/* ── PART 3: AI CHAT WIDGET ─────────────────── */}
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
