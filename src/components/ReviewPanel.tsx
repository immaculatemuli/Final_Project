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

    // Generate HTML preview with placeholder name
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

  if (isAnalyzing) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Analyzing Your Code
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we perform a comprehensive analysis...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
        <div className="text-center py-12">
          <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Ready to Analyze
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Upload your code or paste it in the editor to get started with AI-powered analysis
          </p>
        </div>
      </div>
    );
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'high': return <AlertTriangle className="w-5 h-5 text-orange-500" />;
      case 'medium': return <Info className="w-5 h-5 text-yellow-500" />;
      case 'low': return <CheckCircle className="w-5 h-5 text-blue-500" />;
      default: return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800';
      default: return 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-gray-900/20 dark:border-gray-800';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category.toLowerCase()) {
      case 'security': return <Shield className="w-4 h-4" />;
      case 'performance': return <Zap className="w-4 h-4" />;
      case 'maintainability': return <Target className="w-4 h-4" />;
      case 'documentation': return <FileText className="w-4 h-4" />;
      default: return <Code className="w-4 h-4" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 dark:text-green-400';
    if (score >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const filteredIssues = analysis.issues.filter(issue => {
    const severityMatch = selectedSeverity === 'all' || issue.severity === selectedSeverity;
    const categoryMatch = selectedCategory === 'all' || issue.category === selectedCategory;
    return severityMatch && categoryMatch;
  });

  const toggleIssueExpansion = (index: number) => {
    const newExpanded = new Set(expandedIssues);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      {/* Header with Overall Score */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800 dark:to-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Code Review Results
            </h2>
            <p className="text-gray-600 dark:text-gray-400 flex items-center space-x-4">
              <span className="flex items-center">
                <Code className="w-4 h-4 mr-1" />
                {analysis.language}
              </span>
              <span>•</span>
              <span className="flex items-center">
                <AlertTriangle className="w-4 h-4 mr-1" />
                {analysis.summary.totalIssues} issues
              </span>
              <span>•</span>
              <span className="flex items-center">
                <FileText className="w-4 h-4 mr-1" />
                {analysis.metrics.linesOfCode} lines
              </span>
            </p>
          </div>
          <div className="text-right space-y-2">
            <div>
              <div className={`text-4xl font-bold transition-all duration-500 ${getScoreColor(analysis.overallScore)}`}>
                {displayedScore}%
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Overall Score</div>
            </div>

            {wasAutoFixed && (
              <div className="flex justify-end">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Auto-Fixed &amp; Re-analyzed
                </span>
              </div>
            )}
            <div className="flex gap-2 justify-end">
              {analysis.issues.length > 0 && (
                <button
                  onClick={onAutoFix}
                  disabled={isFixing}
                  className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md text-white shadow-lg transform transition-all ${isFixing ? 'bg-gray-400 cursor-wait' :
                    hasAutoFix
                      ? 'bg-green-600 hover:bg-green-700 hover:scale-105'
                      : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
                    }`}
                  title={hasAutoFix ? "Apply suggested fixes" : "Attempt to fix issues automatically"}
                >
                  {isFixing ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Fixing...
                    </>
                  ) : (
                    <>
                      {hasAutoFix ? <CheckCircle className="w-4 h-4 mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
                      {hasAutoFix ? "Fix Issues" : "Auto Fix"}
                    </>
                  )}
                </button>
              )}
              {onSaveSnippet && (
                <button
                  onClick={onSaveSnippet}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 shadow-sm transition-all hover:scale-105"
                  title="Save this snippet and analysis to your library"
                >
                  <Bookmark className="w-4 h-4 mr-2" />
                  Save to Library
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="p-6 bg-gray-50 dark:bg-gray-700/50">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {analysis.summary.criticalIssues}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Critical</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
              {analysis.summary.highIssues}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">High</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {analysis.summary.mediumIssues}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Medium</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {analysis.summary.lowIssues}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Low</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {analysis.codeSmells}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">Code Smells</div>
          </div>
        </div>
      </div>

      {/* Metrics Section */}
      {showMetrics && (
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Quality Metrics
            </h3>
            <button
              onClick={() => setShowMetrics(!showMetrics)}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Complexity</span>
                <TrendingUp className="w-4 h-4 text-gray-500" />
              </div>
              <div className={`text-xl font-bold ${getScoreColor(analysis.metrics.complexity)}`}>
                {analysis.metrics.complexity}%
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full transition-all duration-1000 ${analysis.metrics.complexity >= 80 ? 'bg-green-500' : analysis.metrics.complexity >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${analysis.metrics.complexity}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Maintainability</span>
                <Target className="w-4 h-4 text-gray-500" />
              </div>
              <div className={`text-xl font-bold ${getScoreColor(analysis.metrics.maintainability)}`}>
                {analysis.metrics.maintainability}%
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full transition-all duration-1000 ${analysis.metrics.maintainability >= 80 ? 'bg-green-500' : analysis.metrics.maintainability >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${analysis.metrics.maintainability}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Security</span>
                <Shield className="w-4 h-4 text-gray-500" />
              </div>
              <div className={`text-xl font-bold ${getScoreColor(analysis.metrics.security)}`}>
                {analysis.metrics.security}%
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1.5 mt-2">
                <div
                  className={`h-1.5 rounded-full transition-all duration-1000 ${analysis.metrics.security >= 80 ? 'bg-green-500' : analysis.metrics.security >= 60 ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${analysis.metrics.security}%` }}
                ></div>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Performance</span>
                <Zap className="w-4 h-4 text-gray-500" />
              </div>
              <div className={`text-xl font-bold ${getScoreColor(analysis.metrics.performance)}`}>
                {analysis.metrics.performance}%
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Documentation</span>
                <FileText className="w-4 h-4 text-gray-500" />
              </div>
              <div className={`text-xl font-bold ${getScoreColor(analysis.metrics.documentation)}`}>
                {analysis.metrics.documentation}%
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Readability</span>
                <Clock className="w-4 h-4 text-gray-500" />
              </div>
              <div className={`text-xl font-bold ${getScoreColor(analysis.metrics.readability)}`}>
                {analysis.metrics.readability}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Categories */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedSeverity('critical'); }}
            className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
          >Errors</button>
          <button
            onClick={() => { setSelectedSeverity('medium'); }}
            className="px-3 py-1 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700"
          >Warnings</button>
          <button
            onClick={() => { const el = document.getElementById('recommendations-section'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }}
            className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
          >Recommendations</button>
          <button
            onClick={() => { setSelectedSeverity('all'); setSelectedCategory('all'); }}
            className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
          >Reset</button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filters:</span>
          </div>
          <select
            value={selectedSeverity}
            onChange={(e) => setSelectedSeverity(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {severities.map(severity => (
              <option key={severity} value={severity}>
                {severity === 'all' ? 'All Severities' : severity.charAt(0).toUpperCase() + severity.slice(1)}
              </option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            {categories.map(category => (
              <option key={category} value={category}>
                {category === 'all' ? 'All Categories' : category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Showing {filteredIssues.length} of {analysis.issues.length} issues
          </div>
        </div>
      </div>

      {/* Issues List */}
      <div className="p-6">
        {filteredIssues.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              {selectedSeverity === 'all' && selectedCategory === 'all'
                ? 'No Issues Found!'
                : 'No Issues Match Your Filters'
              }
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {selectedSeverity === 'all' && selectedCategory === 'all'
                ? 'Your code looks great! No issues were detected.'
                : 'Try adjusting your filters to see more results.'
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredIssues.map((issue, index) => (
              <div
                key={index}
                className={`border rounded-lg p-4 ${getSeverityColor(issue.severity)} transition-all duration-200`}
              >
                <div
                  className="flex items-start justify-between cursor-pointer group"
                  onClick={() => issue.line && onIssueClick?.(issue.line)}
                >
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(issue.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {issue.message}
                        </h4>
                        <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(issue.severity)}`}>
                          {issue.severity}
                        </span>
                        <span className="flex items-center space-x-1 text-xs text-gray-500 dark:text-gray-400">
                          {getCategoryIcon(issue.category)}
                          <span>{issue.category}</span>
                        </span>
                      </div>

                      {issue.line && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Line {issue.line}{issue.column ? `:${issue.column}` : ''}
                        </div>
                      )}

                      {issue.code && (
                        <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded-md mb-3">
                          <pre className="text-sm text-gray-800 dark:text-gray-200 overflow-x-auto">
                            <code>{issue.code}</code>
                          </pre>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                          <span>Confidence: {issue.confidence}%</span>
                          <span>Impact: {issue.impact}</span>
                          <span>Effort: {issue.effort}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => onRateIssue && onRateIssue(index, 1)}
                            className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                            title="Mark suggestion as helpful"
                          >
                            Helpful
                          </button>
                          <button
                            onClick={() => onRateIssue && onRateIssue(index, -1)}
                            className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                            title="Not helpful"
                          >
                            Not helpful
                          </button>
                          <button
                            onClick={() => onFlagIssue && onFlagIssue(index)}
                            className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                            title="Flag suggestion"
                          >
                            Flag
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleIssueExpansion(index)}
                    className="flex-shrink-0 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    {expandedIssues.has(index) ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                </div>

                {expandedIssues.has(index) && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                    {issue.suggestion && (
                      <div className="mb-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Lightbulb className="w-4 h-4 text-yellow-500" />
                          <span className="font-medium text-gray-900 dark:text-white">Suggestion</span>
                        </div>
                        <p className="text-gray-700 dark:text-gray-300 text-sm">
                          {issue.suggestion}
                        </p>
                      </div>
                    )}

                    {issue.fixedCode && (
                      <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            <span className="font-medium text-gray-900 dark:text-white">Suggested Fix</span>
                          </div>
                          <button
                            onClick={() => copyToClipboard(issue.fixedCode!, index)}
                            className="flex items-center space-x-1 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            <span>{copiedCode === index ? 'Copied!' : 'Copy'}</span>
                          </button>
                        </div>
                        <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
                          <pre className="text-sm text-green-800 dark:text-green-200 overflow-x-auto">
                            <code>{issue.fixedCode}</code>
                          </pre>
                        </div>
                      </div>
                    )}

                    {issue.references && issue.references.length > 0 && (
                      <div>
                        <div className="flex items-center space-x-2 mb-2">
                          <ExternalLink className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-gray-900 dark:text-white">Learn More</span>
                        </div>
                        <div className="space-y-1">
                          {issue.references.map((ref, refIndex) => (
                            <a
                              key={refIndex}
                              href={ref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 dark:text-blue-400 hover:underline text-sm block"
                            >
                              {ref}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {analysis && analysis.recommendations && analysis.recommendations.length > 0 && (
        <div id="recommendations-section" className="p-6 border-t border-gray-200 dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recommendations
            </h3>
            <button
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-semibold transition-all hover:opacity-90 shadow-lg"
              style={{ background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)' }}
              onClick={openSendModal}
              title="Send AI-generated report via email"
            >
              <Mail className="w-4 h-4" />
              Email Report
            </button>
          </div>
          <ul className="space-y-2">
            {analysis.recommendations.map((recommendation, index) => (
              <li key={index} className="flex items-start space-x-2">
                <Lightbulb className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-300 text-sm">
                  {recommendation}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <button
              onClick={async () => {
                const lines = [
                  `Language: ${analysis.language}`,
                  `Score: ${analysis.overallScore}%`,
                  `Total Issues: ${analysis.summary.totalIssues}`,
                  '',
                  'Recommendations:',
                  ...analysis.recommendations.map((r, i) => `${i + 1}. ${r}`)
                ].join('\n');

                try {
                  await navigator.clipboard.writeText(lines);
                  alert('Report copied to clipboard!');
                } catch (e) {
                  console.error('Copy failed', e);
                  alert('Failed to copy report.');
                }
              }}
              className="px-3 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
            >
              Copy Report
            </button>
            <button
              onClick={async () => {
                const lines = [
                  `Language: ${analysis.language}`,
                  `Score: ${analysis.overallScore}%`,
                  `Total Issues: ${analysis.summary.totalIssues}`,
                  '',
                  'Recommendations:',
                  ...analysis.recommendations.map((r, i) => `${i + 1}. ${r}`)
                ].join('\n');
                const blob = new Blob([lines], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `code-review-summary-${Date.now()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
              }}
              className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-800 transition-colors"
            >
              Download text summary
            </button>
          </div>
        </div>
      )}

      {/* Send Recommendation Modal — professional redesign */}
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
                {/* Download always available */}
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

                {/* Send via EmailJS (or show setup required) */}
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
                        // Fallback: download + open mail client
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

      {/* Technical Debt */}
      {analysis.technicalDebt && (
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/20">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Technical Debt
          </h3>
          <p className="text-gray-700 dark:text-gray-300 text-sm">
            {analysis.technicalDebt}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewPanel;