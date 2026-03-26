import React, { useState, useRef, useEffect } from 'react';
import { FileText, Play, Loader2, Folder } from 'lucide-react';
import { detectLanguage } from '../services/aiAnalysis';
import RepoExplorer from './RepoExplorer';

// Minimal issue shape needed for highlighting
interface IssueMarker {
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
  message: string;
  suggestion?: string;
  fixedCode?: string;
}

interface CodeInputProps {
  onAnalyze: (code: string, fileName?: string) => void;
  /** Pass a pre-computed analysis result (from bulk scan) to the parent */
  onResultSelected: (code: string, fileName: string, result: any) => void;
  isAnalyzing: boolean;
  code: string;
  setCode: (code: string) => void;
  targetLine?: number | null;
  onLineNavigated?: () => void;
  issues?: IssueMarker[];
}

interface TooltipInfo {
  issues: IssueMarker[];
  x: number;
  y: number;
}

const SEVERITY_COLORS: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  critical: { dot: 'bg-red-500',    bg: 'rgba(239,68,68,0.12)',   border: '#ef4444', text: 'text-red-400'   },
  high:     { dot: 'bg-orange-500', bg: 'rgba(249,115,22,0.12)',  border: '#f97316', text: 'text-orange-400' },
  medium:   { dot: 'bg-yellow-400', bg: 'rgba(234,179,8,0.12)',   border: '#eab308', text: 'text-yellow-400' },
  low:      { dot: 'bg-blue-400',   bg: 'rgba(96,165,250,0.12)',  border: '#60a5fa', text: 'text-blue-400'   },
};

function worstSeverity(issues: IssueMarker[]): string {
  const order = OrderSeverity;
  for (const s of order) {
    if (issues.some(i => i.severity === s)) return s;
  }
  return 'low';
}

const OrderSeverity = ['critical', 'high', 'medium', 'low'];

export const CodeInput: React.FC<CodeInputProps> = (props) => {
  const { code, setCode, isAnalyzing, onAnalyze, onResultSelected, targetLine, onLineNavigated, issues = [] } = props;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const [inputMethod, setInputMethod] = useState<'paste' | 'project'>('paste');
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [selectedIssueLine, setSelectedIssueLine] = useState<number | null>(null);
  const [flashLine, setFlashLine] = useState<number | null>(null);

  // Build a map of line number -> issues for O(1) lookup
  const issuesByLine = React.useMemo(() => {
    const map: Record<number, IssueMarker[]> = {};
    for (const issue of issues) {
      if (issue.line && issue.line > 0) {
        (map[issue.line] ??= []).push(issue);
      }
    }
    return map;
  }, [issues]);

  // Sync gutter + overlay scroll with textarea scroll
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const scrollTop = e.currentTarget.scrollTop;
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
    if (overlayRef.current) overlayRef.current.scrollTop = scrollTop;
  };

  // Navigate to target line and flash it
  useEffect(() => {
    if (targetLine && textareaRef.current) {
      const el = textareaRef.current;
      const lines = code.split('\n');
      const lineIndex = Math.max(0, targetLine - 1);
      el.scrollTo({ top: lineIndex * LINE_H, behavior: 'smooth' });
      if (gutterRef.current) gutterRef.current.scrollTop = lineIndex * LINE_H;
      if (overlayRef.current) overlayRef.current.scrollTop = lineIndex * LINE_H;
      el.focus();
      let charPos = 0;
      for (let i = 0; i < lineIndex && i < lines.length; i++) charPos += lines[i].length + 1;
      el.setSelectionRange(charPos, charPos + (lines[lineIndex]?.length || 0));
      // Flash the line 3 times
      setFlashLine(targetLine);
      setTimeout(() => setFlashLine(null), 1500);
      setTimeout(() => onLineNavigated?.(), 500);
    }
  }, [targetLine, code, onLineNavigated]);

  const lineCount = Math.max(1, code.split('\n').length);
  const LINE_H = 20; // px — must match leading-[20px] in textarea
  const PAD_TOP = 16; // px — must match pt-4

  const sampleCode = `/**
 * Sample JavaScript function for demonstration
 */
async function fetchUserData(userId) {
  try {
    const [userResponse, postsResponse] = await Promise.all([
      fetch(\`/api/users/\${userId}\`),
      fetch(\`/api/users/\${userId}/posts\`)
    ]);
    if (!userResponse.ok || !postsResponse.ok) {
      throw new Error('Failed to fetch user data');
    }
    const userData = await userResponse.json();
    const posts = await postsResponse.json();
    return { user: userData, posts };
  } catch (error) {
    console.error('Error fetching user data:', error);
    throw error;
  }
}`;

  // Selected issue details (shown in the inline panel)
  const selectedIssues = selectedIssueLine ? (issuesByLine[selectedIssueLine] || []) : null;

  return (
    <div className="bg-gray-800 text-white rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Code Input</h2>
        <div className="flex space-x-1">
          {(['paste', 'project'] as const).map(method => (
            <button
              key={method}
              onClick={() => setInputMethod(method)}
              className={`px-3 py-1 text-xs rounded-md transition-all flex items-center gap-2 ${
                inputMethod === method 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {method === 'paste' ? (
                <><FileText className="w-3 h-3" /> Paste Code</>
              ) : (
                <><Folder className="w-3 h-3" /> Entire Project</>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── PASTE mode ── */}
      {inputMethod === 'paste' && (
        <div className="space-y-0">
          {/* Tooltip */}
          {tooltipInfo && (
            <div
              className="fixed z-50 max-w-xs bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-3 text-xs pointer-events-none"
              style={{ left: tooltipInfo.x, top: tooltipInfo.y, transform: 'translateY(-50%)' }}
            >
              {tooltipInfo.issues.map((issue, i) => {
                const colors = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low;
                return (
                  <div key={i} className={i > 0 ? 'mt-2 pt-2 border-t border-gray-700' : ''}>
                    <div className="flex items-center gap-1 mb-1">
                      <span className={`${colors.text} font-bold uppercase`}>{issue.severity}</span>
                    </div>
                    <p className="text-gray-200 leading-snug">{issue.message}</p>
                  </div>
                );
              })}
            </div>
          )}

          <div className="relative flex bg-gray-900 border border-gray-700 rounded-lg overflow-hidden h-96 group">
            <div ref={overlayRef} className="absolute pointer-events-none overflow-hidden" style={{ left: 48, right: 0, top: 0, bottom: 0 }}>
              {Object.entries(issuesByLine).map(([lineStr, lineIssues]) => {
                const lineNum = Number(lineStr);
                const colors = SEVERITY_COLORS[worstSeverity(lineIssues)];
                return <div key={lineNum} className="absolute w-full" style={{ top: (lineNum - 1) * LINE_H + PAD_TOP, height: LINE_H, backgroundColor: colors.bg, borderLeft: `2px solid ${colors.border}` }} />;
              })}
              {flashLine && (
                <div className="absolute w-full" style={{ top: (flashLine - 1) * LINE_H + PAD_TOP, height: LINE_H, animation: 'intelliFlash 1.5s ease-out forwards', pointerEvents: 'none', zIndex: 10 }} />
              )}
            </div>

            <div ref={gutterRef} className="w-12 bg-gray-900/60 border-r border-gray-700/50 overflow-hidden flex-shrink-0 select-none" style={{ paddingTop: PAD_TOP }}>
              {Array.from({ length: lineCount }, (_, i) => {
                const lineNum = i + 1;
                const lineIssues = issuesByLine[lineNum];
                const isSelected = selectedIssueLine === lineNum;
                if (!lineIssues) return <div key={lineNum} className="flex items-center justify-end pr-2 font-mono text-xs text-gray-600" style={{ height: LINE_H }}>{lineNum}</div>;
                const colors = SEVERITY_COLORS[worstSeverity(lineIssues)];
                return (
                  <div key={lineNum} className="relative flex items-center justify-end pr-2 font-mono text-xs cursor-pointer"
                    style={{ height: LINE_H, backgroundColor: isSelected ? colors.bg : 'transparent' }}
                    onClick={() => setSelectedIssueLine(isSelected ? null : lineNum)}
                    onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setTooltipInfo({ issues: lineIssues, x: r.right + 10, y: r.top + r.height / 2 }); }}
                    onMouseLeave={() => setTooltipInfo(null)}>
                    <span className={`absolute left-1.5 w-2 h-2 rounded-full ${colors.dot}`} style={{ top: '50%', transform: 'translateY(-50%)' }} />
                    <span className={`${colors.text} font-semibold`}>{lineNum}</span>
                  </div>
                );
              })}
            </div>

            <textarea ref={textareaRef} value={code} onChange={(e) => setCode(e.target.value)}
              className="flex-1 h-full bg-transparent text-white font-mono text-sm resize-none focus:outline-none leading-[20px] overflow-y-auto whitespace-pre"
              style={{ padding: `${PAD_TOP}px 16px`, caretColor: 'white' }}
              spellCheck={false} onScroll={handleScroll}
            />
          </div>

          {selectedIssues && selectedIssues.length > 0 && (
            <div className="mt-1 rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
              {selectedIssues.map((issue, i) => (
                <div key={i} className="p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`${SEVERITY_COLORS[issue.severity].dot} w-2 h-2 rounded-full inline-block`} />
                      <span className={`${SEVERITY_COLORS[issue.severity].text} font-bold uppercase tracking-wide`}>{issue.severity}</span>
                      <span className="text-gray-500">Line {selectedIssueLine}</span>
                    </div>
                    <button onClick={() => setSelectedIssueLine(null)} className="text-gray-600 hover:text-gray-400">✕</button>
                  </div>
                  <p className="text-gray-200 mb-1">{issue.message}</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-2">
            {issues.length > 0 ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                {issues.length} issues found — click a line for details
              </div>
            ) : (
              <button onClick={() => setCode(sampleCode)} className="text-sm text-blue-400 hover:text-blue-300">Load sample code</button>
            )}
            {code.trim() && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-700 text-gray-300">
                {detectLanguage(code)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── PROJECT mode ── */}
      {inputMethod === 'project' && (
        <RepoExplorer
          onAnalyze={(repoCode, fileName) => {
            setCode(repoCode);
            onAnalyze(repoCode, fileName);
          }}
          onResultSelected={onResultSelected}
          isAnalyzing={isAnalyzing}
        />
      )}

      {/* ── FOOTER (for paste mode) ── */}
      {inputMethod === 'paste' && (
        <div className="mt-6 flex items-center justify-between border-t border-gray-700 pt-6">
          <div className="text-sm text-gray-400">
            {code ? <span>{code.length.toLocaleString()} characters ready</span> : 'No code provided'}
          </div>
          <button
            onClick={() => onAnalyze(code)}
            disabled={!code || isAnalyzing}
            className="flex items-center space-x-2 px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg"
          >
            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            <span className="font-medium">{isAnalyzing ? 'Analyzing...' : 'Analyze Code'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
