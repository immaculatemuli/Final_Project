import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  Shield,
  Zap,
  Code,
  FileText,
  TrendingUp,
  Clock,
  Target,
  Filter,
  ChevronDown,
  ChevronRight,
  Copy,
  ExternalLink,
  Lightbulb,
  Bookmark,
  Mail,
  Download,
  Eye,
  Send,
  RefreshCw,
} from 'lucide-react';
import {
  generateHTMLEmail,
  downloadEmailHTML,
  sendAnalysisEmail,
  isEmailConfigured,
} from '../services/emailService';

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

interface Metrics {
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
}

interface Analysis {
  language: string;
  overallScore: number;
  issues: Issue[];
  metrics: Metrics;
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
  recommendations: string[];
  codeSmells: number;
  technicalDebt: string;
}

interface ReviewPanelProps {
  analysis: Analysis | null;
  isAnalyzing: boolean;
  isFixing?: boolean;
  onAutoFix: () => void;
  sessionId: string;
  onRateIssue?: (index: number, rating: 1 | -1) => void;
  onFlagIssue?: (index: number) => void;
  wasAutoFixed?: boolean;
  onIssueClick?: (line: number) => void;
  onSaveSnippet?: () => void;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({
  analysis,
  isAnalyzing,
  isFixing = false,
  onAutoFix,
  onRateIssue,
  onFlagIssue,
  wasAutoFixed = false,
  onIssueClick,
  onSaveSnippet
}) => {

  const [selectedSeverity, setSelectedSeverity] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedIssues, setExpandedIssues] = useState<Set<number>>(new Set());
  const [showMetrics, setShowMetrics] = useState(true);
  const [copiedCode, setCopiedCode] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recommendationToSend, setRecommendationToSend] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [iframeKey, setIframeKey] = useState(0);
  const [displayedScore, setDisplayedScore] = useState(0);
  const emailConfigured = isEmailConfigured();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Animate score when it changes
  React.useEffect(() => {
    if (!analysis) return;
    const target = analysis.overallScore;
    const duration = 1000;
    const frameDuration = 1000 / 60;
    const totalFrames = Math.round(duration / frameDuration);
    let frame = 0;

    const timer = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      setDisplayedScore(Math.round(target * progress));
      if (frame === totalFrames) clearInterval(timer);
    }, frameDuration);

    return () => clearInterval(timer);
  }, [analysis?.overallScore]);

  // Build email data object from current analysis
  const buildEmailData = (name: string) => {
    if (!analysis) return null;
    return {
      recipientName: name || 'Developer',
      recipientEmail,
      language: analysis.language,
      score: analysis.overallScore,
      totalIssues: analysis.summary.totalIssues,
      criticalIssues: analysis.summary.criticalIssues,
      highIssues: analysis.summary.highIssues,
      mediumIssues: analysis.summary.mediumIssues,
      lowIssues: analysis.summary.lowIssues,
      issues: (analysis.issues ?? []).map(i => ({
        severity: i.severity as 'critical' | 'high' | 'medium' | 'low',
        category: i.category,
        message: i.message,
        line: i.line,
        suggestion: i.suggestion,
      })),
      recommendations: analysis.recommendations,
      technicalDebt: analysis.technicalDebt,
      metrics: {
        complexity: analysis.metrics.complexity,
        maintainability: analysis.metrics.maintainability,
        security: analysis.metrics.security,
        performance: analysis.metrics.performance,
        documentation: analysis.metrics.documentation,
        readability: analysis.metrics.readability,
      },
    };
  };

  // Regenerate HTML preview when recipient name changes
  useEffect(() => {
    if (!isModalOpen || !analysis) return;
    const data = buildEmailData(recipientName);
    if (data) {
      setPreviewHtml(generateHTMLEmail(data));
      setIframeKey(k => k + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipientName, isModalOpen]);

  const openSendModal = () => {
    if (!analysis) return;
    const summary = [
      `Language: ${analysis.language}`,
      `Score: ${analysis.overallScore}%`,
      `Total Issues: ${analysis.summary.totalIssues}`,
      '',
      'Recommendations:',
      ...analysis.recommendations.map((r, i) => `${i + 1}. ${r}`),
    ].join('\n');
    setRecommendationToSend(summary);

    const data = buildEmailData('Developer');
    if (data) setPreviewHtml(generateHTMLEmail(data));
    setIframeKey(k => k + 1);
    setIsModalOpen(true);
  };

  const closeSendModal = () => {
    setIsModalOpen(false);
    setRecipientName('');
    setRecipientEmail('');
    setRecommendationToSend('');
    setSending(false);
    setSendError(null);
    setSendSuccess(null);
    setPreviewHtml('');
  };

  /* ── Loading state ──────────────────────────────── */
  if (isAnalyzing) {
    return (
      <div className="glass rounded-2xl p-8 h-full" style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: '400px' }}>
        <div className="flex flex-col items-center justify-center h-64 space-y-6">
          <div className="relative">
            <div className="w-16 h-16 rounded-full" style={{ border: '2px solid rgba(6,182,212,0.15)' }} />
            <div className="absolute inset-0 w-16 h-16 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#06b6d4' }} />
            <div className="absolute inset-2 w-12 h-12 rounded-full animate-spin" style={{ border: '2px solid transparent', borderTopColor: '#8b5cf6', animationDirection: 'reverse', animationDuration: '1.2s' }} />
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-base font-bold text-white">Analyzing Your Code</h3>
            <p className="text-sm text-slate-500">AI is scanning for issues, vulnerabilities and opportunities...</p>
          </div>
          <div className="w-48 space-y-2">
            {['Security scan', 'Performance check', 'Quality analysis'].map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#06b6d4', animationDelay: `${i * 0.3}s` }} />
                <span className="text-xs text-slate-500">{step}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Empty state ────────────────────────────────── */
  if (!analysis) {
    return (
      <div className="glass rounded-2xl p-8" style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: '400px' }}>
        <div className="flex flex-col items-center justify-center h-64 space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)' }}>
            <Code className="w-8 h-8 text-cyan-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">Ready to Analyze</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              Paste your code in the editor and click <strong className="text-cyan-400">Analyze</strong> to get AI-powered insights.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { label: 'Security', color: '#06b6d4' },
              { label: 'Performance', color: '#8b5cf6' },
              { label: 'Quality', color: '#ec4899' },
            ].map((item) => (
              <div key={item.label} className="text-center px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: item.color }} />
                <span className="text-xs text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Helpers ────────────────────────────────────── */
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-4 h-4 text-red-400" />;
      case 'high': return <AlertTriangle className="w-4 h-4 text-orange-400" />;
      case 'medium': return <Info className="w-4 h-4 text-yellow-400" />;
      case 'low': return <CheckCircle className="w-4 h-4 text-green-400" />;
      default: return <Info className="w-4 h-4 text-slate-400" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'security': return <Shield className="w-3 h-3" />;
      case 'performance': return <Zap className="w-3 h-3" />;
      case 'maintainability': return <Target className="w-3 h-3" />;
      case 'documentation': return <FileText className="w-3 h-3" />;
      default: return <Code className="w-3 h-3" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#4ade80';
    if (score >= 60) return '#facc15';
    return '#f87171';
  };

  const getIssueBorderColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'rgba(239,68,68,0.3)';
      case 'high': return 'rgba(249,115,22,0.25)';
      case 'medium': return 'rgba(234,179,8,0.2)';
      default: return 'rgba(34,197,94,0.15)';
    }
  };

  const filteredIssues = analysis.issues.filter(issue => {
    const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
    const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
    return severityMatch && categoryMatch;
  });

  const toggleIssueExpansion = (index: number) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(index)) newExpanded.delete(index);
    else newExpanded.add(index);
    setExpandedIssues(newExpanded);
  };

  const copyToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCode(index);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const categories = ['all', ...new Set(analysis.issues.map(issue => issue.category))];
  const severities = ['all', 'critical', 'high', 'medium', 'low'];
  const hasAutoFix = analysis.issues.some(issue => issue.fixedCode && issue.fixedCode.trim().length > 0);

  // SVG ring math
  const RING_R = 30;
  const RING_CIRC = 2 * Math.PI * RING_R; // ≈ 188.5

  /* ── Main render ────────────────────────────────── */
  return (
    <>
    <div className="glass rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: '400px' }}>

      {/* ── Header ──────────────────────────────────── */}
      <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>

        {/* Title + meta */}
        <div className="min-w-0">
          <h2 className="text-base font-bold text-white">Analysis Results</h2>
          <p className="text-xs text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
            <span className="flex items-center gap-1"><Code className="w-3.5 h-3.5" />{analysis.language}</span>
            <span>·</span>
            <span>{analysis.summary.totalIssues} issues</span>
            <span>·</span>
            <span>{analysis.metrics.linesOfCode} LOC</span>
          </p>
        </div>

        {/* Score ring + actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* SVG ring */}
          <div className="relative flex items-center justify-center w-[84px] h-[84px]">
            <svg width="84" height="84" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r={RING_R} fill="none" strokeWidth="5" stroke="#27272a" />
              <circle
                cx="36" cy="36" r={RING_R} fill="none" strokeWidth="5"
                stroke={getScoreColor(analysis.overallScore)}
                strokeLinecap="round"
                strokeDasharray={RING_CIRC}
                strokeDashoffset={RING_CIRC - (displayedScore / 100) * RING_CIRC}
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.4,0,0.2,1)' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-bold leading-none" style={{ color: getScoreColor(analysis.overallScore) }}>{displayedScore}</span>
              <span className="text-[10px] text-slate-500 leading-none mt-0.5">/ 100</span>
            </div>
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-1.5">
            {wasAutoFixed && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                style={{ background: 'rgba(16,185,129,0.15)', color: '#4ade80', border: '1px solid rgba(16,185,129,0.3)' }}>
                <CheckCircle className="w-3 h-3" /> Auto-Fixed
              </span>
            )}
            <div className="flex gap-1.5">
              {analysis.issues.length > 0 && (
                <button
                  onClick={onAutoFix}
                  disabled={isFixing}
                  className="btn-glow flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-wait"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
                >
                  {isFixing
                    ? <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Fixing…</>
                    : <><Zap className="w-3.5 h-3.5" />{hasAutoFix ? 'Fix Issues' : 'Auto Fix'}</>
                  }
                </button>
              )}
              {onSaveSnippet && (
                <button
                  onClick={onSaveSnippet}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                  style={{ background: 'rgba(255,255,255,0.04)', color: '#94a3b8', border: '1px solid rgba(255,255,255,0.07)' }}
                >
                  <Bookmark className="w-3.5 h-3.5" /> Save
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Scrollable body ─────────────────────────── */}
      <div className="flex-1 overflow-y-auto">

        {/* Quick stats bar */}
        <div className="grid grid-cols-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          {[
            { label: 'Critical', value: analysis.summary.criticalIssues, color: '#f87171', sev: 'critical' },
            { label: 'High', value: analysis.summary.highIssues, color: '#fb923c', sev: 'high' },
            { label: 'Medium', value: analysis.summary.mediumIssues, color: '#facc15', sev: 'medium' },
            { label: 'Low', value: analysis.summary.lowIssues, color: '#4ade80', sev: 'low' },
            { label: 'Smells', value: analysis.codeSmells, color: '#a78bfa', sev: null },
          ].map((s, i) => (
            <button
              key={s.label}
              onClick={() => s.sev && setSelectedSeverity(s.sev)}
              className="py-3.5 text-center transition-colors hover:bg-white/5 rounded"
              style={{
                background: 'rgba(0,0,0,0.18)',
                borderRight: i < 4 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                cursor: s.sev ? 'pointer' : 'default',
              }}
            >
              <div className="text-lg font-bold" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Metrics */}
        <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            className="w-full flex items-center justify-between mb-3"
            onClick={() => setShowMetrics(v => !v)}
          >
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Quality Metrics</span>
            <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${showMetrics ? '' : '-rotate-90'}`} />
          </button>

          {showMetrics && (
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { label: 'Complexity', value: analysis.metrics.complexity, icon: TrendingUp, color: '#06b6d4' },
                { label: 'Maintainability', value: analysis.metrics.maintainability, icon: Target, color: '#8b5cf6' },
                { label: 'Security', value: analysis.metrics.security, icon: Shield, color: '#ec4899' },
                { label: 'Performance', value: analysis.metrics.performance, icon: Zap, color: '#f59e0b' },
                { label: 'Documentation', value: analysis.metrics.documentation, icon: FileText, color: '#4ade80' },
                { label: 'Readability', value: analysis.metrics.readability, icon: Clock, color: '#a78bfa' },
              ].map((m) => {
                const Icon = m.icon;
                return (
                  <div key={m.label} className="rounded-xl p-3.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', borderLeft: `3px solid ${m.color}30` }}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: m.color }} />
                        <span className="text-xs text-slate-300">{m.label}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: m.color }}>{m.value}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${m.value}%`, background: `linear-gradient(90deg, ${m.color}60, ${m.color})` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="px-5 py-3 flex items-center gap-2 flex-wrap"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.12)' }}>
          <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}
          >
            {severities.map(s => (
              <option key={s} value={s} style={{ background: '#0f172a' }}>
                {s === 'all' ? 'All severities' : s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-xs rounded-lg px-2.5 py-1.5 outline-none"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}
          >
            {categories.map(c => (
              <option key={c} value={c} style={{ background: '#0f172a' }}>
                {c === 'all' ? 'All categories' : c.charAt(0).toUpperCase() + c.slice(1)}
              </option>
            ))}
          </select>
          <span className="text-xs text-slate-500 ml-auto">{filteredIssues.length} / {analysis.issues.length} issues</span>
          <button
            onClick={() => { setSelectedSeverity('all'); setSelectedCategory('all'); }}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            Reset
          </button>
        </div>

        {/* Issues list */}
        <div className="p-4 space-y-2.5">
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}>
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <p className="text-sm font-medium text-white">
                {selectedSeverity === 'all' && selectedCategory === 'all' ? 'No Issues Found!' : 'No matches'}
              </p>
              <p className="text-xs text-slate-600">
                {selectedSeverity === 'all' && selectedCategory === 'all'
                  ? 'Your code looks great!'
                  : 'Try adjusting your filters.'}
              </p>
            </div>
          ) : (
            filteredIssues.map((issue, index) => (
              <div
                key={index}
                className="rounded-xl overflow-hidden transition-all duration-200"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${getIssueBorderColor(issue.severity)}` }}
              >
                {/* Issue row */}
                <div
                  className="flex items-start gap-3 p-3.5 cursor-pointer group"
                  onClick={() => { toggleIssueExpansion(index); issue.line && onIssueClick?.(issue.line); }}
                >
                  <div className="flex-shrink-0 mt-0.5">{getSeverityIcon(issue.severity)}</div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1.5">
                      <span className={`badge-${issue.severity} tag text-xs py-0.5 px-2`}>{issue.severity}</span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        {getCategoryIcon(issue.category)}{issue.category}
                      </span>
                      {issue.line && (
                        <span className="text-xs text-slate-500 font-mono ml-auto">Line {issue.line}</span>
                      )}
                    </div>
                    <p className="text-sm text-slate-200 leading-relaxed group-hover:text-white transition-colors">{issue.message}</p>
                    {issue.code && (
                      <div className="mt-2 rounded-lg px-3 py-2 font-mono text-xs text-slate-400 overflow-x-auto"
                        style={{ background: 'rgba(0,0,0,0.35)' }}>
                        {issue.code}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                      <span>Confidence: {issue.confidence}%</span>
                      <span>Impact: {issue.impact}</span>
                      <span>Effort: {issue.effort}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-slate-600 group-hover:text-slate-400 transition-colors mt-0.5">
                    {expandedIssues.has(index) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                {/* Expanded details */}
                {expandedIssues.has(index) && (
                  <div className="px-4 pb-4 pt-2 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>

                    {issue.suggestion && (
                      <div className="rounded-lg p-3.5"
                        style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)' }}>
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-amber-400" />
                          <span className="text-xs font-semibold text-amber-400 uppercase tracking-wide">Suggestion</span>
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed">{issue.suggestion}</p>
                      </div>
                    )}

                    {issue.fixedCode && (
                      <div className="rounded-lg overflow-hidden"
                        style={{ border: '1px solid rgba(74,222,128,0.2)' }}>
                        <div className="flex items-center justify-between px-3.5 py-2.5"
                          style={{ background: 'rgba(74,222,128,0.07)' }}>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                            <span className="text-xs font-semibold text-green-400 uppercase tracking-wide">Suggested Fix</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(issue.fixedCode!, index)}
                            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            {copiedCode === index ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                        <pre className="px-3.5 py-3 text-xs text-green-300 overflow-x-auto font-mono leading-relaxed"
                          style={{ background: 'rgba(0,0,0,0.3)' }}>
                          <code>{issue.fixedCode}</code>
                        </pre>
                      </div>
                    )}

                    {/* Issue actions */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={() => onRateIssue?.(index, 1)}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{ background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' }}
                      >Helpful</button>
                      <button
                        onClick={() => onRateIssue?.(index, -1)}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{ background: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)' }}
                      >Not helpful</button>
                      <button
                        onClick={() => onFlagIssue?.(index)}
                        className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
                        style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}
                      >Flag</button>
                      {issue.references && issue.references.length > 0 && (
                        <a
                          href={issue.references[0]}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1.5 text-xs text-cyan-500 hover:text-cyan-400 transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />Docs
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Recommendations */}
        {analysis.recommendations && analysis.recommendations.length > 0 && (
          <div className="mx-4 mb-4 rounded-xl p-4"
            style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400 flex items-center gap-1.5">
                <Lightbulb className="w-4 h-4" /> Recommendations
              </span>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const lines = [
                      `Language: ${analysis.language}`,
                      `Score: ${analysis.overallScore}%`,
                      `Total Issues: ${analysis.summary.totalIssues}`,
                      '',
                      'Recommendations:',
                      ...analysis.recommendations.map((r, i) => `${i + 1}. ${r}`),
                    ].join('\n');
                    try { await navigator.clipboard.writeText(lines); } catch {}
                  }}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />Copy
                </button>
                <button
                  onClick={openSendModal}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
                  style={{ background: 'linear-gradient(135deg, #1d4ed8, #7c3aed)' }}
                >
                  <Mail className="w-3.5 h-3.5" />Email Report
                </button>
              </div>
            </div>
            <ul className="space-y-2.5">
              {analysis.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white"
                    style={{ background: 'rgba(6,182,212,0.3)' }}>{i + 1}</span>
                  <span className="text-sm text-slate-300 leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Technical Debt */}
        {analysis.technicalDebt && (
          <div className="mx-4 mb-4 rounded-xl p-4"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Technical Debt
            </h3>
            <p className="text-sm text-slate-300 leading-relaxed">{analysis.technicalDebt}</p>
          </div>
        )}

      </div>{/* end scrollable body */}

    </div>{/* end glass panel */}

    {/* ── Email Modal — rendered outside glass to escape backdrop-filter stacking context ── */}
    {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            style={{ maxHeight: '92vh', background: '#0f172a', border: '1px solid #1e293b' }}>

            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#1d4ed8 0%,#7c3aed 100%)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base leading-tight">Send Code Analysis Report</h4>
                  <p className="text-blue-200 text-xs mt-0.5">Beautifully formatted HTML email</p>
                </div>
              </div>
              <button onClick={closeSendModal}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
                <XCircle className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 min-h-0">

              {/* Recipient fields */}
              <div className="px-6 pt-5 pb-4" style={{ borderBottom: '1px solid #1e293b' }}>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Recipient Details</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Full Name</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ background: '#1e293b', border: '1px solid #334155' }}
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="e.g. Jane Doe"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1.5">Email Address</label>
                    <input
                      type="email"
                      className="w-full px-3 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ background: '#1e293b', border: '1px solid #334155' }}
                      value={recipientEmail}
                      onChange={e => setRecipientEmail(e.target.value)}
                      placeholder="developer@example.com"
                    />
                  </div>
                </div>
              </div>

              {/* Email preview */}
              <div className="px-6 pt-4 pb-4" style={{ borderBottom: '1px solid #1e293b' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <Eye className="w-3.5 h-3.5" /> Email Preview
                  </p>
                  <button
                    className="text-xs text-slate-400 hover:text-blue-400 flex items-center gap-1 transition-colors"
                    onClick={() => {
                      const d = buildEmailData(recipientName || 'Developer');
                      if (d) { setPreviewHtml(generateHTMLEmail(d)); setIframeKey(k => k + 1); }
                    }}
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #334155', height: '380px' }}>
                  <iframe
                    key={iframeKey}
                    ref={iframeRef}
                    srcDoc={previewHtml}
                    title="Email Preview"
                    sandbox="allow-same-origin"
                    style={{ width: '100%', height: '100%', border: 'none', background: '#0f172a' }}
                  />
                </div>
                <p className="text-xs text-slate-600 mt-2">
                  Preview updates when you change the recipient name above.
                </p>
              </div>

              {/* Status / EmailJS notice */}
              {!emailConfigured && (
                <div className="mx-6 mt-4 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: '#1e2940', border: '1px solid #2d4a7a' }}>
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-blue-300 mb-0.5">Production: EmailJS not configured</p>
                    <p className="text-xs text-slate-400">
                      Add <code className="text-blue-300 bg-black/30 px-1 rounded">VITE_EMAILJS_*</code> keys to <code className="text-blue-300 bg-black/30 px-1 rounded">.env.local</code> for production sending.
                      Or use <strong className="text-white">Download HTML</strong> to save and send manually.
                    </p>
                  </div>
                </div>
              )}

              {sendError && (
                <div className="mx-6 mt-4 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: '#2d1a1a', border: '1px solid #7f1d1d' }}>
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{sendError}</p>
                </div>
              )}

              {sendSuccess && (
                <div className="mx-6 mt-4 rounded-xl px-4 py-3 flex items-start gap-3"
                  style={{ background: '#0d2818', border: '1px solid #14532d' }}>
                  <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-green-300">{sendSuccess}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="px-6 py-5 flex items-center gap-3">
                <button
                  onClick={() => {
                    const d = buildEmailData(recipientName || 'Developer');
                    if (d) {
                      const html = generateHTMLEmail(d);
                      downloadEmailHTML(html, recipientName || 'report');
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
                  style={{ background: '#1e293b', border: '1px solid #334155' }}
                >
                  <Download className="w-4 h-4" />
                  Download HTML
                </button>

                <button
                  disabled={sending || !recipientEmail || !recipientName}
                  onClick={async () => {
                    if (!recipientEmail || !recipientName) return;
                    setSending(true);
                    setSendError(null);
                    setSendSuccess(null);
                    try {
                      const d = buildEmailData(recipientName);
                      if (!d) throw new Error('No analysis data');
                      const html = generateHTMLEmail(d);

                      if (emailConfigured) {
                        await sendAnalysisEmail(d, html);
                        setSendSuccess(`Report sent successfully to ${recipientEmail}!`);
                        setTimeout(closeSendModal, 2500);
                      } else {
                        downloadEmailHTML(html, recipientName);
                        const plain = recommendationToSend;
                        const mailto = `mailto:${recipientEmail}?subject=${encodeURIComponent(`${analysis?.language || 'Code'} Analysis — Score: ${analysis?.overallScore}/100`)}&body=${encodeURIComponent(plain.slice(0, 1800))}`;
                        window.open(mailto, '_blank');
                        setSendSuccess('HTML report downloaded and your mail client opened. Attach the file to your email!');
                        setTimeout(closeSendModal, 3500);
                      }
                    } catch (err: unknown) {
                      setSendError(err instanceof Error ? err.message : 'Failed to send email');
                    } finally {
                      setSending(false);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)' }}
                >
                  {sending ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Sending…
                    </>
                  ) : emailConfigured ? (
                    <>
                      <Send className="w-4 h-4" />
                      Send Email
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Download &amp; Open Mail Client
                    </>
                  )}
                </button>
              </div>

            </div>{/* end scrollable body */}
          </div>
        </div>
      )}

    </>
  );
};

export default ReviewPanel;
