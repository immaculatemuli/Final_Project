import React, { useState, useEffect } from 'react';
import { User, signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { CodeInput } from './CodeInput';
import ReviewPanel from './ReviewPanel';
import { Star, Share2, Clock, AlertTriangle, Code, XCircle } from 'lucide-react';

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
}

export const HomePage: React.FC<HomePageProps> = ({ user }) => {
  const [code, setCode] = useState('');
  const [analysis, setAnalysis] = useState<AppAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisHistory, setAnalysisHistory] = useState<AppAnalysis[]>([]);
  const [githubRepoUrl, setGithubRepoUrl] = useState('');
  const [analysisMode, setAnalysisMode] = useState<'code' | 'github'>('code');
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string | null>(null);

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
          linesOfCode: 0, duplicateLines: 0, testCoverage: 0
        },
        recommendations: server.recommendations || [],
        codeSmells: server.codeSmells || 0,
        technicalDebt: server.technicalDebt || 'n/a',
        repository: server.repository || null
      };

      setAnalysis(newAnalysis);
      setAnalysisHistory(prev => [newAnalysis, ...prev.slice(0, 9)]);

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

      // Use production cloud function URL in production, otherwise prefer local emulator
      const prodUrl = 'https://us-central1-project-70cbf.cloudfunctions.net/analyzeCode';
      const devProxyUrl = '/api/analyzeCode';
      const emulatorHttp127 = 'http://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode';
      const emulatorHttpLocal = 'http://localhost:5001/project-70cbf/us-central1/analyzeCode';
      const emulatorHttps127 = 'https://127.0.0.1:5001/project-70cbf/us-central1/analyzeCode';

      // Try the proxy/emulator first in development for better local DX
      const tryUrls = process.env.NODE_ENV === 'production'
        ? [prodUrl]
        : [devProxyUrl, emulatorHttp127, emulatorHttpLocal, emulatorHttps127, prodUrl];

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

      // Store the analysisId from backend
      if (data.analysisId) {
        setCurrentAnalysisId(data.analysisId);
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
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const items: AppAnalysis[] = [];
      snap.docs.forEach((d) => {
        const data = d.data() as Record<string, unknown>;
        // Backend saves analysis under 'analysis' field, not 'result'
        if (data?.analysis) items.push(data.analysis as AppAnalysis);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex flex-col">
      <header className="bg-black/30 backdrop-blur-md border-b border-white/10 py-4 px-8 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Star className="w-8 h-8 text-blue-400" />
          <span className="text-2xl font-bold text-white">AI Code Review</span>
        </div>
        <button
          onClick={handleSignOut}
          className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition"
        >
          Sign Out
        </button>
      </header>
      <main className="flex-1 flex flex-col md:flex-row gap-8 p-8">
        <section className="flex-1 bg-white/10 backdrop-blur-md rounded-xl shadow p-6 flex flex-col">
          <div className="mb-4 flex space-x-2">
            <button
              onClick={() => setAnalysisMode('code')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                analysisMode === 'code'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Code Snippet
            </button>
            <button
              onClick={() => setAnalysisMode('github')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                analysisMode === 'github'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              GitHub Repository
            </button>
          </div>

          {analysisMode === 'code' ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-4">Paste Your Code</h2>
              <CodeInput
                onAnalyze={analyzeCode}
                isAnalyzing={isAnalyzing}
                code={code}
                setCode={setCode}
              />
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
                  className="px-4 py-3 bg-gray-800 text-white border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isAnalyzing}
                />
                <button
                  onClick={() => analyzeGithubRepo(githubRepoUrl)}
                  disabled={isAnalyzing || !githubRepoUrl}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium"
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
              <h3 className="text-lg font-semibold text-gray-200 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Recent Analyses
              </h3>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {analysisHistory.slice(0, 10).map((a, i) => (
                  <div
                    key={i}
                    className="bg-gray-900/70 rounded-lg p-4 hover:bg-gray-900/90 transition cursor-pointer border border-gray-700 hover:border-blue-500"
                    onClick={() => setAnalysis(a)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          a.overallScore >= 80 ? 'bg-green-600 text-white' :
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
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
        <section className="flex-1 bg-white/10 backdrop-blur-md rounded-xl shadow p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Review Analysis</h2>
          <ReviewPanel
            analysis={analysis}
            isAnalyzing={isAnalyzing}
            onAutoFix={() => {}}
            sessionId={`session-${Date.now()}`}
            onRateIssue={handleRateIssue}
            onFlagIssue={handleFlagIssue}
            currentUserEmail={user.email || undefined}
            analysisId={currentAnalysisId}
          />
        </section>
      </main>
    </div>
  );
};