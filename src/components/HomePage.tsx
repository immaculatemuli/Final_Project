import React, { useState, useEffect, useRef } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot, doc, setDoc, limit } from 'firebase/firestore';
import { CodeInput } from './CodeInput';
import ReviewPanel from './ReviewPanel';
import { Star, Share2, Clock, AlertTriangle, Code, XCircle, Copy, ArrowLeftRight } from 'lucide-react';
import { DiffViewer } from './DiffViewer';

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
  const [autoFixMessage, setAutoFixMessage] = useState<string | null>(null);
  const [analysisHistory, setAnalysisHistory] = useState<AppAnalysis[]>([]);
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'code' | 'github'>('code');
  const [collabSessionId, setCollabSessionId] = useState<string | null>(null);
  const [joinSessionInput, setJoinSessionInput] = useState('');
  const [targetLine, setTargetLine] = useState<number | null>(null);
  const [originalCode, setOriginalCode] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'editor' | 'diff'>('editor');
  const isRemoteUpdate = useRef(false);
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

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

  // Language detection helper
  const detectLanguage = (codeContent: string) => {
    if (/\bclass\s+\w+\s*\{/.test(codeContent) || /console\./.test(codeContent)) return 'javascript';
    if (/\b(def|import)\b/.test(codeContent) && /:\n/.test(codeContent) || /print\(/.test(codeContent)) return 'python';
    if (/\b(public|private|protected)\b/.test(codeContent) && /class\s+\w+/.test(codeContent)) return 'java';
    return 'unknown';
  };

  // Analyze GitHub Repository
  const analyzeGithubRepo = async (repoUrl: string) => {
    setIsAnalyzing(true);

    try {
      // Validate URL
      const trimmedUrl = repoUrl.trim();
      if (!trimmedUrl.startsWith('http')) {
        throw new Error('Invalid repository URL. Must start with http:// or https://');
      }

      // Use production cloud function URL in production, otherwise prefer local emulator
      const prodUrl = 'https://us-central1-project-70cbf.cloudfunctions.net/analyzeGithubRepo';
      const devProxyUrl = '/api/analyzeGithubRepo';
      const emulatorHttp127 = 'http://127.0.0.1:5001/project-70cbf/us-central1/analyzeGithubRepo';
      const emulatorHttpLocal = 'http://localhost:5001/project-70cbf/us-central1/analyzeGithubRepo';
      const emulatorHttps127 = 'https://127.0.0.1:5001/project-70cbf/us-central1/analyzeGithubRepo';

      // Try the proxy/emulator first in development for better local DX
      const tryUrls = process.env.NODE_ENV === 'production'
        ? [prodUrl]
        : [devProxyUrl, emulatorHttp127, emulatorHttpLocal, emulatorHttps127, prodUrl];

      let resp: Response | null = null;
      let lastError: unknown = null;
      const payload = { repoUrl: trimmedUrl, uid: user.uid };
      console.debug('analyzeGithubRepo will try URLs:', tryUrls);

      for (const url of tryUrls) {
        try {
          resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

          // If we get a network-level failure resp may still be undefined
          if (!resp) continue;

          // If endpoint exists but returned non-2xx, surface server message
          if (!resp.ok) {
            const errorData = await resp.json().catch(() => ({}));
            const msg = (errorData && (errorData.error || errorData.message)) || `Request to ${url} failed with status ${resp.status}`;
            throw new Error(msg);
          }

          // success
          break;
        } catch (err) {
          lastError = err;
          console.warn(`Request to ${url} failed:`, err);
          // try the next URL in tryUrls
          resp = null;
          continue;
        }
      }

      if (!resp) {
        const err = lastError instanceof Error ? lastError : new Error(String(lastError));
        throw new Error(`Failed to contact analysis service: ${err.message}. Run the functions emulator or check network/proxy settings.`);
      }

      const data = await resp.json().catch((e) => {
        throw new Error(`Failed to parse JSON from analysis service at ${resp!.url}: ${String(e)}`);
      });
      const server = data.analysis || data;

      const codeSnippetFromServer: string | undefined =
        (server.sourceCode as string | undefined) ||
        (server.repository && (server.repository.analyzedFileContent as string | undefined));

      const newAnalysis: AppAnalysis = {
        language: server.language || 'unknown',
        overallScore: server.overallScore ?? 75,
        issues: server.issues || [],
        summary: server.summary || {
          totalIssues: 0, criticalIssues: 0, highIssues: 0, mediumIssues: 0, lowIssues: 0,
          securityIssues: 0, performanceIssues: 0, qualityIssues: 0
        },
        metrics: server.metrics || {
          complexity: 1, maintainability: 75, readability: 75, performance: 75, security: 75,
          documentation: 25, cyclomaticComplexity: 1, cognitiveComplexity: 1,
          linesOfCode: codeSnippetFromServer ? codeSnippetFromServer.split('\n').length : 0,
          duplicateLines: 0,
          testCoverage: 0
        },
        recommendations: server.recommendations || [],
        codeSmells: server.codeSmells || 0,
        technicalDebt: server.technicalDebt || 'n/a',
        repository: server.repository || null,
        codeSnippet: codeSnippetFromServer
      };

      setAnalysis(newAnalysis);
      setAnalysisHistory(prev => [newAnalysis, ...prev.slice(0, 9)]);

      // Populate the editor with the imported GitHub file so it can be edited directly
      if (codeSnippetFromServer) {
        setCode(codeSnippetFromServer);
      }

      // If in a collaborative session, sync GitHub-imported code and analysis
      if (collabSessionId) {
        const sessionRef = doc(db, 'collabSessions', collabSessionId);
        await setDoc(
          sessionRef,
          {
            code: codeSnippetFromServer || '',
            analysis: newAnalysis,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }

      // Store the analysisId from backend
      if (data.analysisId) {
        setCurrentAnalysisId(data.analysisId);
      }

    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('GitHub analysis failed:', err);
      alert(err.message || 'Failed to analyze GitHub repository');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Prefer serverless analysis for accuracy; fallback to local analyzer
  const analyzeCode = async (codeContent: string) => {
    setIsAnalyzing(true);

    try {
      const language = detectLanguage(codeContent);

      // Check payload size limit (60KB)
      const maxSize = 60 * 1024; // 60KB
      if (codeContent.length > maxSize) {
        const sizeKb = (codeContent.length / 1024).toFixed(1);
        const maxKb = (maxSize / 1024).toFixed(0);
        console.warn(`Code truncated from ${sizeKb}KB to ${maxKb}KB to respect backend limit`);
        alert(`⚠️ Code exceeds maximum size (${sizeKb}KB > ${maxKb}KB). Analysis will use first ${maxKb}KB of code only.\n\nTip: Upload fewer files or smaller files for better results.`);
      }

      // Use production cloud function URL in production
      const prodUrl = 'https://us-central1-project-70cbf.cloudfunctions.net/analyzeCode';

      // In development, try the most likely URLs first
      const tryUrls = process.env.NODE_ENV === 'production'
        ? [prodUrl]
        : ['http://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode', 'http://localhost:5001/project-70cbf/us-central1/analyzeCode', '/api/analyzeCode', prodUrl];

      let resp: Response | null = null;
      let lastError: unknown = null;
      const codeToAnalyze = codeContent.length > maxSize ? codeContent.substring(0, maxSize) : codeContent;
      const payload = { code: codeToAnalyze, language, uid: user.uid };
      console.debug('analyzeCode will try URLs:', tryUrls);

      for (const url of tryUrls) {
        try {
          resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-user-id': user.uid },
            body: JSON.stringify(payload),
          });

          if (!resp) continue;

          if (!resp.ok) {
            const errorData = await resp.json().catch(() => ({}));
            const msg = (errorData && (errorData.error || errorData.message)) || `Request to ${url} failed with status ${resp.status}`;
            throw new Error(msg);
          }

          // success
          break;
        } catch (err) {
          lastError = err;
          console.warn(`Request to ${url} failed:`, err);
          resp = null;
          continue;
        }
      }

      if (!resp) {
        const err = lastError instanceof Error ? lastError : new Error(String(lastError));
        throw new Error(`Failed to contact analysis service: ${err.message}. Run the functions emulator or check network/proxy settings.`);
      }

      const data = await resp.json().catch((e) => {
        throw new Error(`Failed to parse JSON from analysis service at ${resp!.url}: ${String(e)}`);
      });
      const server = data.analysis || data;
      const newAnalysis: AppAnalysis = {
        language: server.language || language,
        overallScore: server.overallScore ?? 75,
        issues: server.issues || [],
        summary: server.summary || {
          totalIssues: 0, criticalIssues: 0, highIssues: 0, mediumIssues: 0, lowIssues: 0,
          securityIssues: 0, performanceIssues: 0, qualityIssues: 0
        },
        metrics: server.metrics || {
          complexity: 1, maintainability: 75, readability: 75, performance: 75, security: 75,
          documentation: 25, cyclomaticComplexity: 1, cognitiveComplexity: 1,
          linesOfCode: codeContent.split('\n').length, duplicateLines: 0, testCoverage: 0
        },
        recommendations: server.recommendations || [],
        codeSmells: server.codeSmells || 0,
        technicalDebt: server.technicalDebt || 'n/a'
      };

      setAnalysis(newAnalysis);
      setAnalysisHistory(prev => [newAnalysis, ...prev.slice(0, 9)]); // Keep last 10 analyses

      if (data.analysisId) {
        setCurrentAnalysisId(data.analysisId);
      }

      // If in a collaborative session, sync latest code + analysis to Firestore
      if (collabSessionId) {
        const sessionRef = doc(db, 'collabSessions', collabSessionId);
        await setDoc(
          sessionRef,
          {
            code: codeContent,
            analysis: newAnalysis,
            updatedAt: serverTimestamp(),
          },
          { merge: true },
        );
      }



    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error(String(error));
      console.error('AI analysis failed:', err);
      alert(`Analysis failed: ${err.message || 'Unable to analyze code. Please check if OpenAI API key is configured in functions/.env file.'}`);
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

  const handleFlagIssue = async (index: number) => {
    try {
      await addDoc(collection(db, 'flags'), {
        uid: user.uid,
        email: user.email,
        index,
        analysisTimestamp: analysis?.timestamp || new Date().toISOString(),
        flagCreatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Failed to flag issue:', error);
    }
  };

  // Apply AI fix to the editor, then automatically re-analyze the fixed code
  const handleAutoFix = async () => {
    if (!analysis) {
      alert('Please analyze some code first.');
      return;
    }
    if (!code.trim()) {
      alert('No code in the editor to fix.');
      return;
    }

    try {
      setIsFixing(true);
      setAutoFixMessage(null);
      setWasAutoFixed(false);
      setOriginalCode(code); // Capture original before fix

      // Build the list of URLs to try (same pattern as analyzeCode)
      const prodUrl = 'https://us-central1-project-70cbf.cloudfunctions.net/fixCode';
      const devProxyUrl = '/api/fixCode';
      const emulatorUrl = 'http://127.0.0.1:5001/project-70cbf/us-central1/fixCode';
      const emulatorLocalUrl = 'http://localhost:5001/project-70cbf/us-central1/fixCode';

      const tryUrls = process.env.NODE_ENV === 'production'
        ? [prodUrl]
        : [emulatorUrl, emulatorLocalUrl, devProxyUrl, prodUrl];

      let resp: Response | null = null;
      let lastError: unknown = null;
      const payload = {
        code,
        issues: analysis.issues,
        language: analysis.language,
        uid: user?.uid,
      };

      for (const url of tryUrls) {
        try {
          resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!resp.ok) {
            const errData = await resp.json().catch(() => ({}));
            throw new Error((errData && (errData.error || errData.message)) || `HTTP ${resp.status}`);
          }
          break;
        } catch (err) {
          lastError = err;
          resp = null;
        }
      }

      if (!resp) {
        const msg = lastError instanceof Error ? lastError.message : String(lastError);
        throw new Error(`Failed to reach fix service: ${msg}`);
      }

      const data = await resp.json();

      if (!data.fixedCode) {
        throw new Error('The fix service did not return fixed code.');
      }

      // 1. Update the editor with the fully fixed code
      const fixedCode = data.fixedCode;
      setCode(fixedCode);
      setIsFixing(false);
      setWasAutoFixed(true);
      setViewMode('diff'); // Switch to diff view automatically

      // 2. Automatically re-analyze the fixed code
      setAutoFixMessage('✨ Code fixed! Re-analyzing to verify improvements...');
      setIsAnalyzing(true);

      try {
        const language = analysis.language;
        const analyzeUrls = process.env.NODE_ENV === 'production'
          ? ['https://us-central1-project-70cbf.cloudfunctions.net/analyzeCode']
          : [
            'http://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode',
            'http://localhost:5001/project-70cbf/us-central1/analyzeCode',
            '/api/analyzeCode',
            'https://us-central1-project-70cbf.cloudfunctions.net/analyzeCode'
          ];

        let analyzeResp: Response | null = null;
        for (const url of analyzeUrls) {
          try {
            analyzeResp = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-user-id': user.uid },
              body: JSON.stringify({ code: fixedCode, language, uid: user.uid }),
            });
            if (!analyzeResp.ok) {
              const errData = await analyzeResp.json().catch(() => ({}));
              throw new Error((errData && (errData.error || errData.message)) || `HTTP ${analyzeResp.status}`);
            }
            break;
          } catch (err) {
            analyzeResp = null;
          }
        }

        if (analyzeResp) {
          const analyzeData = await analyzeResp.json();
          const server = analyzeData.analysis || analyzeData;
          const newAnalysis: AppAnalysis = {
            language: server.language || language,
            overallScore: server.overallScore ?? 75,
            issues: server.issues || [],
            summary: server.summary || {
              totalIssues: 0, criticalIssues: 0, highIssues: 0, mediumIssues: 0, lowIssues: 0,
              securityIssues: 0, performanceIssues: 0, qualityIssues: 0
            },
            metrics: server.metrics || {
              complexity: 1, maintainability: 75, readability: 75, performance: 75, security: 75,
              documentation: 25, cyclomaticComplexity: 1, cognitiveComplexity: 1,
              linesOfCode: fixedCode.split('\n').length, duplicateLines: 0, testCoverage: 0
            },
            recommendations: server.recommendations || [],
            codeSmells: server.codeSmells || 0,
            technicalDebt: server.technicalDebt || 'n/a',
          };
          setAnalysis(newAnalysis);
          setAnalysisHistory(prev => [newAnalysis, ...prev.slice(0, 9)]);

        }

        setWasAutoFixed(true);
        setAutoFixMessage('✓ Code auto-fixed and re-analyzed successfully!');
        setTimeout(() => setAutoFixMessage(null), 5000);
      } catch (analyzeErr) {
        console.warn('Re-analysis after fix failed:', analyzeErr);
        setAutoFixMessage('✓ Code fixed! Click Analyze to see updated results.');
        setTimeout(() => setAutoFixMessage(null), 6000);
      } finally {
        setIsAnalyzing(false);
      }

    } catch (error) {
      console.error('Auto fix error:', error);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Auto-fix success banner */}
      {autoFixMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl text-white text-sm font-medium flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 animate-pulse">
          <span>{autoFixMessage}</span>
        </div>
      )}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 py-4 px-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Star className="w-6 h-6 text-white" />
          </div>
          <span className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Intellicode</span>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-2 rounded-lg font-medium transition-all transform hover:scale-105 shadow-md"
        >
          Sign Out
        </button>
      </header>
      <main className="flex-1 flex flex-col md:flex-row gap-8 p-8">
        <section className="flex-1 bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl shadow-lg p-6 flex flex-col">
          <div className="mb-4 flex flex-col space-y-3">
            <div className="flex space-x-2">
              <button
                onClick={() => setAnalysisMode('code')}
                className={`px-4 py-2 rounded-lg font-medium transition ${analysisMode === 'code'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700 border border-slate-600/50'
                  }`}
              >
                Code Snippet
              </button>
              <button
                onClick={() => setAnalysisMode('github')}
                className={`px-4 py-2 rounded-lg font-medium transition ${analysisMode === 'github'
                  ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-md'
                  : 'bg-slate-700/50 text-gray-300 hover:bg-slate-700 border border-slate-600/50'
                  }`}
              >
                GitHub Repository
              </button>
            </div>

            {/* Collaborative session controls */}
            <div className="mt-1 bg-slate-900/40 border border-slate-700/70 rounded-lg p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div className="text-xs text-gray-300">
                {collabSessionId ? (
                  <>
                    Collaborative session ID:&nbsp;
                    <span className="font-mono bg-slate-800 px-2 py-0.5 rounded border border-slate-600 select-all">
                      {collabSessionId}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(collabSessionId);
                        alert('Session ID copied!');
                      }}
                      className="ml-2 text-xs bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-white"
                      title="Copy Session ID"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  'Start or join a collaborative review session to share code and analysis in real time.'
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartCollabSession}
                  className="px-3 py-1 text-xs rounded-md bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                >
                  Start Session
                </button>
                <input
                  type="text"
                  value={joinSessionInput}
                  onChange={(e) => setJoinSessionInput(e.target.value)}
                  placeholder="Session ID"
                  className="px-2 py-1 text-xs bg-slate-900 border border-slate-600 rounded-md text-gray-100 placeholder-gray-500"
                />
                <button
                  onClick={() => handleJoinSession(joinSessionInput)}
                  className="px-3 py-1 text-xs rounded-md bg-slate-700 hover:bg-slate-600 text-white font-medium"
                >
                  Join
                </button>
              </div>
            </div>
          </div>

          {analysisMode === 'code' ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">
                  {viewMode === 'editor' ? 'Paste Your Code' : 'Review Transformation'}
                </h2>
                {originalCode && wasAutoFixed && (
                  <div className="flex bg-slate-700/50 rounded-lg p-1 border border-white/10">
                    <button
                      onClick={() => setViewMode('editor')}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'editor' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                      View Editor
                    </button>
                    <button
                      onClick={() => setViewMode('diff')}
                      className={`px-3 py-1 text-xs rounded-md transition-all ${viewMode === 'diff' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}
                    >
                      <ArrowLeftRight className="w-3 h-3 inline mr-1" />
                      View Diff
                    </button>
                  </div>
                )}
              </div>

              {viewMode === 'editor' ? (
                <CodeInput
                  onAnalyze={analyzeCode}
                  isAnalyzing={isAnalyzing}
                  code={code}
                  setCode={setCode}
                  targetLine={targetLine}
                  onLineNavigated={() => setTargetLine(null)}
                />
              ) : (
                <DiffViewer original={originalCode || ''} modified={code} />
              )}
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-white mb-4">Analyze GitHub Repository</h2>
              <div className="flex flex-col space-y-4">
                <input
                  type="text"
                  value={githubRepoUrl}
                  onChange={(e) => setGithubRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repository"
                  className="px-4 py-3 bg-slate-700/50 text-white border border-white/10 rounded-lg placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  disabled={isAnalyzing}
                />
                <button
                  onClick={() => analyzeGithubRepo(githubRepoUrl)}
                  disabled={isAnalyzing || !githubRepoUrl}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-6 py-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-md transform hover:scale-105"
                >
                  {isAnalyzing ? 'Analyzing Repository...' : 'Analyze Repository'}
                </button>
                <p className="text-gray-400 text-sm">
                  Enter a public GitHub repository URL. The system will analyze code files from the repository root.
                </p>
              </div>
            </>
          )}
          {analysisHistory.length > 0 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-200 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Recent Analyses
                </h3>
                {onNavigate && (
                  <button
                    onClick={() => onNavigate('history')}
                    className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                  >
                    View Full History
                  </button>
                )}
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {analysisHistory.slice(0, 10).map((a, i) => (
                  <div
                    key={i}
                    className="bg-slate-800/30 rounded-lg p-4 hover:bg-slate-800/60 transition cursor-pointer border border-white/10 hover:border-blue-500/50"
                    onClick={() => {
                      setAnalysis(a);
                      if (a.codeSnippet) {
                        setCode(a.codeSnippet);
                      }
                    }}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${a.overallScore >= 80 ? 'bg-green-600 text-white' :
                          a.overallScore >= 60 ? 'bg-yellow-600 text-white' :
                            'bg-red-600 text-white'
                          }`}>
                          {a.overallScore}%
                        </span>
                        <span className="text-gray-300 font-medium">{a.language}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <div className="flex space-x-3">
                        <span className="flex items-center">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          {a.summary.totalIssues} issues
                        </span>
                        <span className="flex items-center">
                          <Code className="w-3 h-3 mr-1" />
                          {a.metrics.linesOfCode} lines
                        </span>
                      </div>
                      {a.repository && (
                        <span className="text-blue-400 text-xs flex items-center">
                          <Share2 className="w-3 h-3 mr-1" />
                          GitHub
                        </span>
                      )}
                    </div>

                    {a.summary.criticalIssues > 0 && (
                      <div className="mt-2 text-xs text-red-400 flex items-center">
                        <XCircle className="w-3 h-3 mr-1" />
                        {a.summary.criticalIssues} critical issues
                      </div>
                    )}

                    {a.codeSnippet && (
                      <div className="mt-2 text-xs text-gray-400 font-mono line-clamp-2">
                        {a.codeSnippet}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="flex-1 bg-slate-800/50 backdrop-blur border border-white/10 rounded-2xl shadow-lg p-6">
          <div className="lg:col-span-1">
            <ReviewPanel
              analysis={analysis}
              isAnalyzing={isAnalyzing}
              isFixing={isFixing}
              onAutoFix={handleAutoFix}
              sessionId={collabSessionId || currentAnalysisId || ''}
              onRateIssue={handleRateIssue}
              onFlagIssue={handleFlagIssue}
              wasAutoFixed={wasAutoFixed}
              onIssueClick={(line) => setTargetLine(line)}
              onSaveSnippet={handleSaveSnippet}
            />
          </div>
        </section>
      </main>
    </div>
  );
};