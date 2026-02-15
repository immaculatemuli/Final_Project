import React, { useState } from 'react';
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
  Lightbulb
} from 'lucide-react';

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
  onAutoFix: () => void;
  sessionId: string;
  onRateIssue?: (index: number, rating: 1 | -1) => void;
  onFlagIssue?: (index: number) => void;
  currentUserEmail?: string;
  analysisId?: string | null;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({ analysis, isAnalyzing, onRateIssue, onFlagIssue, currentUserEmail, analysisId }) => {
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

  // Open modal - show AI-generated content
  const openSendModal = () => {
    // No need to check analysis here - button is only visible when analysis exists
    if (!analysis) return; // Safety check

    // Generate a comprehensive summary with AI recommendations
    const summary = `
=== CODE REVIEW SUMMARY ===

Language: ${analysis.language}
Overall Score: ${analysis.overallScore}%

=== ISSUES BREAKDOWN ===
Total Issues: ${analysis.summary.totalIssues}
- Critical: ${analysis.summary.criticalIssues}
- High: ${analysis.summary.highIssues}
- Medium: ${analysis.summary.mediumIssues}
- Low: ${analysis.summary.lowIssues}

=== QUALITY METRICS ===
- Complexity: ${analysis.metrics.complexity}%
- Maintainability: ${analysis.metrics.maintainability}%
- Security: ${analysis.metrics.security}%
- Performance: ${analysis.metrics.performance}%
- Documentation: ${analysis.metrics.documentation}%
- Readability: ${analysis.metrics.readability}%

=== AI RECOMMENDATIONS ===
${analysis.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

=== TECHNICAL DEBT ===
${analysis.technicalDebt}
    `.trim();

    setRecommendationToSend(summary);
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
          <div className="text-right">
            <div className={`text-4xl font-bold ${getScoreColor(analysis.overallScore)}`}>
              {analysis.overallScore}%
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Overall Score</div>
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
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Maintainability</span>
                <Target className="w-4 h-4 text-gray-500" />
              </div>
              <div className={`text-xl font-bold ${getScoreColor(analysis.metrics.maintainability)}`}>
                {analysis.metrics.maintainability}%
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
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getSeverityIcon(issue.severity)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-gray-900 dark:text-white">
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
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-medium"
              onClick={openSendModal}
              // disabled={!analysis}
              title={!analysis ? "Please analyze code first" : "Send AI-generated recommendations"}
            >
              Send Recommendation via Email
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
          <div className="mt-4">
            <button
              onClick={async () => {
                const lines = [
                  `Language: ${analysis.language}`,
                  `Score: ${analysis.overallScore}%`,
                  `Total Issues: ${analysis.summary.totalIssues}`,
                  '',
                  'Recommendations:',
                  ...analysis.recommendations.map((r, i) => `${i+1}. ${r}`)
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
              className="px-3 py-1 text-xs bg-gray-700 text-white rounded hover:bg-gray-800"
            >
              Download text summary
            </button>
          </div>
        </div>
      )}

      {/* Send Recommendation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 w-full max-w-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              onClick={closeSendModal}
              aria-label="Close"
            >
              <XCircle className="w-6 h-6" />
            </button>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Send AI-Generated Recommendations</h4>

            {/* Preview of content to be sent */}
            <div className="mb-4 bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
              <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                <Info className="w-4 h-4 mr-2" />
                Preview of Email Content
              </h5>
              <div className="bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                <pre className="text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                  {recommendationToSend}
                </pre>
              </div>
            </div>

            <form className="space-y-4"
              onSubmit={async e => {
                e.preventDefault();
                setSending(true);
                setSendError(null);
                setSendSuccess(null);
                try {
                  // Use the local function endpoint
                  const functionsUrl = process.env.NODE_ENV === 'production'
                    ? 'https://us-central1-project-70cbf.cloudfunctions.net/sendAnalysisReport'
                    : 'http://127.0.0.1:5001/project-70cbf/us-central1/sendAnalysisReport';

                  const response = await fetch(functionsUrl, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                      email: recipientEmail,
                      name: recipientName,
                      subject: `Code Review Results for ${recipientName}`,
                      content: recommendationToSend
                    }),
                  });

                  const data = await response.json();

                  if (!response.ok) {
                    const msg = data && data.error ? data.error : 'Failed to send email';
                    throw new Error(msg);
                  }

                  setSendSuccess('AI-generated recommendations sent successfully!');
                  setTimeout(() => {
                    setSending(false);
                    closeSendModal();
                  }, 1500);
                } catch (err: unknown) {
                  const errorMessage = err instanceof Error ? err.message : 'Failed to send email';
                  setSendError(errorMessage);
                  setSending(false);
                }
              }}>
              <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-md">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  The AI-generated summary and recommendations shown above will be sent to the recipient.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Name</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={recipientName}
                  onChange={e => setRecipientName(e.target.value)}
                  placeholder="Developer Name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Recipient Email</label>
                <input
                  type="email"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  value={recipientEmail}
                  onChange={e => setRecipientEmail(e.target.value)}
                  placeholder="developer@example.com"
                  required
                />
              </div>
              {sendError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-sm p-3 rounded">
                  {sendError}
                </div>
              )}
              {sendSuccess && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 text-sm p-3 rounded">
                  {sendSuccess}
                </div>
              )}
              <button
                type="submit"
                className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-medium disabled:opacity-60"
                disabled={sending}
              >
                {sending ? 'Sending AI Recommendations...' : 'Send AI Recommendations'}
              </button>
            </form>
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