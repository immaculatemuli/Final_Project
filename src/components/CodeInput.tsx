import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, FileText, Play, Loader2, Folder, X, File, CheckCircle, Github } from 'lucide-react';
import { analyzeCodeWithAI, detectLanguage } from '../services/aiAnalysis';
import type { AIAnalysisResult } from '../services/aiAnalysis';
import RepoExplorer from './RepoExplorer';

/* ── SECTION: TYPES & INTERFACES ─────────────────── */
// Minimal issue shape needed for highlighting
interface IssueMarker {
  line?: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  category?: string;
  message: string;
  suggestion?: string;
  fixedCode?: string;
}

interface FolderEntry {
  name: string;
  content: string;
  size: number;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  analysis?: AIAnalysisResult;
}

interface CodeInputProps {
  onAnalyze: (code: string) => void;
  isAnalyzing: boolean;
  code: string;
  setCode: (code: string) => void;
  targetLine?: number | null;
  onLineNavigated?: () => void;
  issues?: IssueMarker[];
  onFolderFileSelect?: (name: string, content: string, analysis: AIAnalysisResult) => void;
  inputMethod: 'paste' | 'upload' | 'folder' | 'github';
  setInputMethod: (method: 'paste' | 'upload' | 'folder' | 'github') => void;
  setTargetLine: (line: number | null) => void;
  githubUrl: string;
  setGithubUrl: (url: string) => void;
  githubFilter: string;
  setGithubFilter: (f: string) => void;
}

interface UploadedFile {
  name: string;
  content: string;
  size: number;
  type: string;
}

interface TooltipInfo {
  issues: IssueMarker[];
  x: number;
  y: number;
}

const SEVERITY_COLORS: Record<string, { dot: string; bg: string; border: string; text: string }> = {
  critical: { dot: 'bg-red-500', bg: 'rgba(239,68,68,0.12)', border: '#ef4444', text: 'text-red-400' },
  high: { dot: 'bg-orange-500', bg: 'rgba(249,115,22,0.12)', border: '#f97316', text: 'text-orange-400' },
  medium: { dot: 'bg-yellow-400', bg: 'rgba(234,179,8,0.12)', border: '#eab308', text: 'text-yellow-400' },
  low: { dot: 'bg-blue-400', bg: 'rgba(96,165,250,0.12)', border: '#60a5fa', text: 'text-blue-400' },
};

function worstSeverity(issues: IssueMarker[]): string {
  const order = ['critical', 'high', 'medium', 'low'];
  for (const s of order) {
    if (issues.some(i => i.severity === s)) return s;
  }
  return 'low';
}

export const CodeInput: React.FC<CodeInputProps> = (props) => {
  const {
    code, setCode, isAnalyzing, onAnalyze, targetLine, onLineNavigated,
    issues = [], onFolderFileSelect, inputMethod, setInputMethod,
    setTargetLine, githubUrl, setGithubUrl, githubFilter, setGithubFilter
  } = props;

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [folderEntries, setFolderEntries] = useState<FolderEntry[]>([]);
  const [activeFolderIdx, setActiveFolderIdx] = useState<number | null>(null);
  const analyzeAbortRef = useRef(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [tooltipInfo, setTooltipInfo] = useState<TooltipInfo | null>(null);
  const [selectedIssueLine, setSelectedIssueLine] = useState<number | null>(null);
  const [flashLine, setFlashLine] = useState<number | null>(null);

  const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.php', '.rb', '.go', '.rs', '.html', '.css', '.scss', '.vue', '.svelte', '.json', '.xml', '.yaml', '.yml', '.md', '.txt'];

  // Build a map of line number -> issues for O(1) lookup
  const issuesByLine = React.useMemo(() => {
    const map: Record<number, IssueMarker[]> = {};
    if (!Array.isArray(issues)) return map;
    for (const issue of issues) {
      if (issue && typeof issue.line === 'number' && issue.line > 0) {
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
      const lineCount = lines.length;

      if (lineIndex < lineCount) {
        el.scrollTo({ top: lineIndex * LINE_H, behavior: 'smooth' });
        if (gutterRef.current) gutterRef.current.scrollTop = lineIndex * LINE_H;
        if (overlayRef.current) overlayRef.current.scrollTop = lineIndex * LINE_H;
        el.focus();

        let charPos = 0;
        for (let i = 0; i < lineIndex && i < lines.length; i++) charPos += (lines[i]?.length || 0) + 1;
        el.setSelectionRange(charPos, charPos + (lines[lineIndex]?.length || 0));

        setFlashLine(targetLine);
        setTimeout(() => setFlashLine(null), 1500);
        setTimeout(() => onLineNavigated?.(), 500);
      }
    }
  }, [targetLine, code, onLineNavigated]);

  const lineCount = Math.max(1, code.split('\n').length);
  const LINE_H = 20; // px — must match leading-[20px] in textarea
  const PAD_TOP = 16; // px — must match pt-4

  // File processing helpers
  const processFiles = async (files: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);
    const codeFiles = files.filter(f => {
      const name = f.name.toLowerCase();
      return codeExtensions.some(ext => name.endsWith(ext)) && f.size < 1024 * 1024;
    }).slice(0, 20);

    if (!codeFiles.length) {
      const rejected = Array.from(new Set(files.map(f => '.' + f.name.split('.').pop()?.toLowerCase()))).join(', ');
      setUploadError(`Unsupported file type${files.length > 1 ? 's' : ''}: ${rejected}. Supported: .js .ts .py .java .cpp .go .rs .php .rb and more.`);
      setIsUploading(false);
      return;
    }

    const skipped = files.length - codeFiles.length;
    if (skipped > 0) {
      const rejectedExts = Array.from(new Set(
        files.filter(f => !codeFiles.includes(f)).map(f => '.' + f.name.split('.').pop()?.toLowerCase())
      )).join(', ');
      setUploadError(`${skipped} file${skipped > 1 ? 's' : ''} skipped (unsupported type or over 1 MB): ${rejectedExts}`);
    }

    const processed: UploadedFile[] = [];
    let combined = '';
    const batchSize = 5;

    for (let i = 0; i < codeFiles.length; i += batchSize) {
      const batch = codeFiles.slice(i, i + batchSize);
      const results = await Promise.all(batch.map(f => new Promise<UploadedFile | null>(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          const content = e.target?.result as string;
          resolve(content && content.length < 100000 ? { name: f.name, content, size: f.size, type: f.type } : null);
        };
        reader.onerror = () => resolve(null);
        reader.readAsText(f);
      })));

      results.forEach(r => {
        if (r) {
          processed.push(r);
          combined += `\n\n// ==========================================\n// File: ${r.name}\n// ==========================================\n${r.content}`;
        }
      });

      setUploadProgress(Math.round(((i + batch.length) / codeFiles.length) * 100));
      await new Promise(r => setTimeout(r, 50));
    }

    setUploadedFiles(processed);
    setCode(combined.trim());
    setTimeout(() => { setIsUploading(false); setUploadProgress(0); }, 1000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(Array.from(e.target.files));
  };

  // Recursively read a FileSystemEntry into an array of File objects
  const readEntryFiles = (entry: FileSystemEntry): Promise<File[]> => {
    if (entry.isFile) {
      return new Promise(resolve => {
        (entry as FileSystemFileEntry).file(f => resolve([f]), () => resolve([]));
      });
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      return new Promise(resolve => {
        const all: File[] = [];
        const readBatch = () => {
          reader.readEntries(async (entries) => {
            if (!entries.length) { resolve(all); return; }
            for (const e of entries) {
              // Skip heavy or hidden directories
              if (e.isDirectory && (
                e.name === 'node_modules' ||
                e.name === '.git' ||
                e.name === '.next' ||
                e.name === 'dist' ||
                e.name === 'build' ||
                e.name.startsWith('.')
              )) continue;

              const files = await readEntryFiles(e);
              all.push(...files);
            }
            readBatch();
          }, () => resolve(all));
        };
        readBatch();
      });
    }
    return Promise.resolve([]);
  };

  const processFolderFiles = useCallback(async (files: File[]) => {
    analyzeAbortRef.current = true; // cancel any running analysis
    await new Promise(r => setTimeout(r, 50)); // let running loop see abort
    analyzeAbortRef.current = false;

    setIsUploading(true);
    setUploadProgress(0);
    setActiveFolderIdx(null);
    setFolderEntries([]);

    const codeFiles = files
      .filter(f => f.size < 1024 * 1024) // Still limit individual file size to 1MB
      .slice(0, 200); // Increased limit to 200 files

    if (!codeFiles.length) {
      setUploadError('No files found in this folder (or all files were over 1MB).');
      setIsUploading(false);
      return;
    }

    // Read all file contents
    const read: FolderEntry[] = [];
    for (let i = 0; i < codeFiles.length; i++) {
      const f = codeFiles[i];
      await new Promise<void>(resolve => {
        const reader = new FileReader();
        reader.onload = e => {
          const content = e.target?.result as string;
          if (content) read.push({ name: f.name, content, size: f.size, status: 'pending' });
          resolve();
        };
        reader.onerror = () => resolve();
        reader.readAsText(f);
      });
      setUploadProgress(Math.round(((i + 1) / codeFiles.length) * 50));
    }

    if (!read.length) { setIsUploading(false); return; }

    // Show all files as pending, load first into editor
    setFolderEntries(read);
    setActiveFolderIdx(0);
    setCode(read[0].content);
    setIsUploading(false);

    // Analyze each file one by one
    for (let i = 0; i < read.length; i++) {
      if (analyzeAbortRef.current) break;

      setFolderEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'analyzing' } : e));

      try {
        const result = await analyzeCodeWithAI(read[i].content);
        if (analyzeAbortRef.current) break;

        setFolderEntries(prev => prev.map((e, idx) =>
          idx === i ? { ...e, status: 'done', analysis: result } : e
        ));

        // Auto-load first completed file's analysis into ReviewPanel
        if (i === 0) {
          onFolderFileSelect?.(read[i].name, read[i].content, result);
        }
      } catch {
        setFolderEntries(prev => prev.map((e, idx) => idx === i ? { ...e, status: 'error' } : e));
      }

      // Pause between files to stay under rate limit
      if (i < read.length - 1 && !analyzeAbortRef.current) {
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onFolderFileSelect]);

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFolderFiles(Array.from(e.target.files));
  };

  const handleFolderDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const items = Array.from(e.dataTransfer.items);
    const allFiles: File[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) {
        const files = await readEntryFiles(entry);
        allFiles.push(...files);
      } else {
        const f = item.getAsFile();
        if (f) allFiles.push(f);
      }
    }
    processFolderFiles(allFiles);
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); };
  const handleDrop = (e: React.DragEvent) => { e.preventDefault(); setIsDragOver(false); processFiles(Array.from(e.dataTransfer.files)); };

  const removeFile = (idx: number) => {
    const next = uploadedFiles.filter((_, i) => i !== idx);
    setUploadedFiles(next);
    setCode(next.length ? next.map(f => `\n\n// ==========================================\n// File: ${f.name}\n// ==========================================\n${f.content}`).join('').trim() : '');
  };

  const formatFileSize = (b: number) => {
    const k = 1024, s = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + s[i];
  };

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
        <div className="flex flex-wrap gap-1">
          {(['paste', 'upload', 'folder', 'github'] as const).map(method => (
            <button
              key={method}
              onClick={() => setInputMethod(method)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${inputMethod === method ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {method === 'paste' && <FileText className="w-3 h-3 inline mr-1" />}
              {method === 'upload' && <Upload className="w-3 h-3 inline mr-1" />}
              {method === 'folder' && <Folder className="w-3 h-3 inline mr-1" />}
              {method === 'github' && <Github className="w-3 h-3 inline mr-1" />}
              {method === 'paste' ? 'Paste' : method === 'upload' ? 'Upload' : method === 'folder' ? 'Folder' : 'GitHub'}
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* PASTE mode — editor with issue highlighting                         */}
      {/* ------------------------------------------------------------------ */}
      {inputMethod === 'paste' && (
        <div className="space-y-0">
          {/* Tooltip (fixed-positioned, outside scroll containers) */}
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
                      {issue.category && <span className="text-gray-500">· {issue.category}</span>}
                    </div>
                    <p className="text-gray-200 leading-snug">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="text-gray-400 mt-1 leading-snug">
                        <span className="text-green-400 font-semibold">Fix: </span>{issue.suggestion}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Editor container */}
          <div className="relative flex bg-gray-900 border border-gray-700 rounded-lg overflow-hidden h-96 group">

            {/* Line-highlight overlay — sits between gutter and textarea */}
            <div
              ref={overlayRef}
              className="absolute pointer-events-none overflow-hidden"
              style={{ left: 48, right: 0, top: 0, bottom: 0 }}
            >
              {Object.entries(issuesByLine).map(([lineStr, lineIssues]) => {
                const lineNum = Number(lineStr);
                const worst = worstSeverity(lineIssues);
                const colors = SEVERITY_COLORS[worst];
                return (
                  <div
                    key={lineNum}
                    className="absolute w-full"
                    style={{
                      top: (lineNum - 1) * LINE_H + PAD_TOP,
                      height: LINE_H,
                      backgroundColor: colors.bg,
                      borderLeft: `2px solid ${colors.border}`,
                    }}
                  />
                );
              })}
              {/* Flash highlight for navigated line */}
              {flashLine && (
                <div
                  className="absolute w-full"
                  style={{
                    top: (flashLine - 1) * LINE_H + PAD_TOP,
                    height: LINE_H,
                    animation: 'intelliFlash 1.5s ease-out forwards',
                    pointerEvents: 'none',
                    zIndex: 10,
                  }}
                />
              )}
            </div>

            {/* Gutter with per-line issue markers */}
            <div
              ref={gutterRef}
              className="w-12 bg-gray-900/60 border-r border-gray-700/50 overflow-hidden flex-shrink-0 select-none"
              style={{ paddingTop: PAD_TOP }}
            >
              {Array.from({ length: lineCount }, (_, i) => {
                const lineNum = i + 1;
                const lineIssues = issuesByLine[lineNum];
                const isSelected = selectedIssueLine === lineNum;

                if (!lineIssues) {
                  return (
                    <div
                      key={lineNum}
                      className="flex items-center justify-end pr-2 font-mono text-xs text-gray-600"
                      style={{ height: LINE_H }}
                    >
                      {lineNum}
                    </div>
                  );
                }

                const worst = worstSeverity(lineIssues);
                const colors = SEVERITY_COLORS[worst];

                return (
                  <div
                    key={lineNum}
                    className="relative flex items-center justify-end pr-2 font-mono text-xs cursor-pointer"
                    style={{ height: LINE_H, backgroundColor: isSelected ? colors.bg : 'transparent' }}
                    onClick={() => setSelectedIssueLine(isSelected ? null : lineNum)}
                    onMouseEnter={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      setTooltipInfo({ issues: lineIssues, x: rect.right + 10, y: rect.top + rect.height / 2 });
                    }}
                    onMouseLeave={() => setTooltipInfo(null)}
                  >
                    {/* Severity dot */}
                    <span
                      className={`absolute left-1.5 w-2 h-2 rounded-full ${colors.dot} flex-shrink-0`}
                      style={{ top: '50%', transform: 'translateY(-50%)' }}
                    />
                    <span className={`${colors.text} font-semibold`}>{lineNum}</span>
                  </div>
                );
              })}
            </div>

            {/* Code textarea */}
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Paste your code here..."
              className="flex-1 h-full bg-transparent text-white font-mono text-sm resize-none focus:outline-none leading-[20px] overflow-y-auto whitespace-pre"
              style={{ padding: `${PAD_TOP}px 16px`, caretColor: 'white' }}
              spellCheck={false}
              onScroll={handleScroll}
            />
          </div>

          {/* Inline issue detail panel */}
          {selectedIssues && selectedIssues.length > 0 && (
            <div className="mt-1 rounded-lg border border-gray-700 bg-gray-900 divide-y divide-gray-800">
              {selectedIssues.map((issue, i) => {
                const colors = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low;
                return (
                  <div key={i} className="p-3 text-xs">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`${colors.dot} w-2 h-2 rounded-full inline-block`} />
                        <span className={`${colors.text} font-bold uppercase tracking-wide`}>{issue.severity}</span>
                        {issue.category && <span className="text-gray-500">{issue.category}</span>}
                        <span className="text-gray-500">Line {selectedIssueLine}</span>
                      </div>
                      <button onClick={() => setSelectedIssueLine(null)} className="text-gray-600 hover:text-gray-400">✕</button>
                    </div>
                    <p className="text-gray-200 mb-1">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="text-gray-400">
                        <span className="text-green-400 font-semibold">Suggestion: </span>{issue.suggestion}
                      </p>
                    )}
                    {issue.fixedCode && issue.fixedCode.trim() && !issue.fixedCode.includes('needs manual review') && (
                      <div className="mt-2 bg-gray-800 rounded px-2 py-1 font-mono text-green-300 break-all">
                        <span className="text-gray-500 mr-1">Fixed:</span>{issue.fixedCode}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Issue count badge + sample code link + language badge */}
          <div className="flex items-center justify-between mt-2">
            {issues.length > 0 ? (
              <div className="flex items-center gap-2 text-xs">
                {(['critical', 'high', 'medium', 'low'] as const).map(sev => {
                  const count = issues.filter(i => i.severity === sev).length;
                  if (!count) return null;
                  return (
                    <span key={sev} className={`${SEVERITY_COLORS[sev].dot} px-2 py-0.5 rounded-full text-white font-medium`}>
                      {count} {sev}
                    </span>
                  );
                })}
                <span className="text-gray-500">— click a highlighted line number for details</span>
              </div>
            ) : (
              <button onClick={() => setCode(sampleCode)} className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
                Load sample code
              </button>
            )}
            {/* Detected language badge */}
            {(() => {
              const LANG_COLORS: Record<string, string> = {
                TypeScript: '#3178c6', JavaScript: '#f0c000', Python: '#3702A5',
                Java: '#b07219', 'C#': '#178600', 'C/C++': '#6b7280',
                Go: '#00ADD8', Rust: '#c4600a', PHP: '#007d43ff', Ruby: '#701516',
              };
              const lang = code.trim() ? detectLanguage(code) : 'Unknown';
              if (lang === 'Unknown') return null;
              const bg = LANG_COLORS[lang] ?? '#475569';
              const textColor = lang === 'JavaScript' ? '#1a1a1a' : '#fff';
              return (
                <span className="text-xs font-semibold px-2 py-0.5 rounded" style={{ background: bg, color: textColor }}>
                  {lang}
                </span>
              );
            })()}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* UPLOAD mode                                                         */}
      {/* ------------------------------------------------------------------ */}
      {inputMethod === 'upload' && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}`}
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-400 mb-2">Drop code files here or click to browse</p>
            <p className="text-xs text-gray-500 mb-4">Supports JS, TS, Python, Java, C++ and more (max 1 MB per file)</p>
            <input type="file" accept={codeExtensions.join(',')} onChange={handleFileUpload} multiple className="hidden" id="file-upload" />
            <label htmlFor="file-upload" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 cursor-pointer transition-colors">
              Choose Files
            </label>
          </div>
          {uploadError && (
            <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
              <span className="flex-shrink-0 font-bold mt-0.5">✕</span>
              <span>{uploadError}</span>
              <button onClick={() => setUploadError(null)} className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100">✕</button>
            </div>
          )}
          {isUploading && (
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between mb-2 text-sm text-gray-300">
                <span>Processing files...</span><span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          {uploadedFiles.length > 0 && !isUploading && (
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between mb-3">
                <h3 className="text-sm font-medium text-white">Uploaded Files ({uploadedFiles.length})</h3>
                <button onClick={() => { setUploadedFiles([]); setCode(''); }} className="text-xs text-red-400 hover:text-red-300">Clear All</button>
              </div>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {uploadedFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-800 p-2 rounded">
                    <div className="flex items-center space-x-2">
                      <File className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-gray-300 truncate">{f.name}</span>
                      <span className="text-xs text-gray-500">({formatFileSize(f.size)})</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="text-gray-400 hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* FOLDER mode                                                         */}
      {/* ------------------------------------------------------------------ */}
      {inputMethod === 'folder' && (
        <div className="space-y-3">
          {folderEntries.length === 0 ? (
            <>
              <div
                className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors ${isDragOver ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600 hover:border-gray-500'}`}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleFolderDrop}
              >
                <Folder className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-300 font-medium mb-1">Drop a folder here</p>
                <p className="text-xs text-gray-500 mb-5">or click to browse · up to 30 files · JS, TS, Python, Java &amp; more</p>
                <input type="file" {...{ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>}
                  multiple onChange={handleFolderUpload} className="hidden" id="folder-upload" />
                <label htmlFor="folder-upload" className="inline-block px-5 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 cursor-pointer transition-colors">
                  Choose Folder
                </label>
              </div>
              {uploadError && (
                <div className="flex items-start gap-2 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5' }}>
                  <span className="flex-shrink-0 font-bold mt-0.5">✕</span>
                  <span>{uploadError}</span>
                  <button onClick={() => setUploadError(null)} className="ml-auto flex-shrink-0 opacity-60 hover:opacity-100">✕</button>
                </div>
              )}
              {isUploading && (
                <div className="bg-gray-900 rounded-lg px-4 py-3">
                  <div className="flex justify-between mb-1.5 text-xs text-gray-400">
                    <span>Reading files…</span><span>{uploadProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-1.5">
                    <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex rounded-lg overflow-hidden border border-gray-700" style={{ height: '440px' }}>

              {/* ── File sidebar ── */}
              <div className="flex-shrink-0 flex flex-col bg-gray-950 border-r border-gray-700" style={{ width: '210px' }}>

                {/* Header */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-800">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                    {folderEntries.length} files
                    {folderEntries.some(e => e.status === 'analyzing') && (
                      <span className="ml-1 text-blue-400">· analyzing…</span>
                    )}
                  </span>
                  <button onClick={() => { analyzeAbortRef.current = true; setFolderEntries([]); setActiveFolderIdx(null); setCode(''); }}
                    className="text-gray-600 hover:text-red-400 transition-colors" title="Clear">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* File list */}
                <div className="flex-1 overflow-y-auto py-1 space-y-px">
                  {folderEntries.map((f, i) => {
                    const isActive = i === activeFolderIdx;
                    const isDone = f.status === 'done';
                    const isAnalyzingThis = f.status === 'analyzing';
                    const critical = isDone ? f.analysis!.issues.filter(x => x.severity === 'critical').length : 0;
                    const high = isDone ? f.analysis!.issues.filter(x => x.severity === 'high').length : 0;
                    const total = isDone ? f.analysis!.issues.length : 0;
                    const hasErrors = critical > 0 || high > 0;
                    const leftColor = !isDone ? 'transparent'
                      : critical > 0 ? '#ef4444'
                        : high > 0 ? '#f97316'
                          : total > 0 ? '#eab308'
                            : '#22c55e';

                    return (
                      <button
                        key={i}
                        onClick={() => {
                          setActiveFolderIdx(i);
                          setCode(f.content);
                          if (isDone && f.analysis) onFolderFileSelect?.(f.name, f.content, f.analysis);
                        }}
                        className="w-full flex flex-col px-3 py-2 text-left transition-all"
                        style={{
                          background: isActive ? 'rgba(59,130,246,0.12)' : hasErrors && isDone ? 'rgba(239,68,68,0.04)' : 'transparent',
                          borderLeft: `3px solid ${isActive ? '#3b82f6' : leftColor}`,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {isAnalyzingThis
                            ? <span className="w-2 h-2 rounded-full border border-blue-400 border-t-transparent animate-spin flex-shrink-0" />
                            : <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: !isDone ? '#334155' : critical > 0 ? '#ef4444' : high > 0 ? '#f97316' : total > 0 ? '#eab308' : '#22c55e' }} />
                          }
                          <span className={`text-xs truncate flex-1 ${isActive ? 'text-blue-300 font-medium' : isDone ? 'text-gray-200' : 'text-gray-500'}`}>{f.name}</span>
                          {isDone && <span className="text-[10px] font-bold flex-shrink-0" style={{ color: critical > 0 ? '#ef4444' : high > 0 ? '#f97316' : total > 0 ? '#eab308' : '#22c55e' }}>{f.analysis!.overallScore}</span>}
                        </div>
                        {isDone && total > 0 && (
                          <div className="flex gap-1 mt-0.5 pl-4">
                            {critical > 0 && <span className="text-[9px] font-bold px-1 rounded" style={{ background: 'rgba(239,68,68,0.2)', color: '#f87171' }}>{critical}C</span>}
                            {high > 0 && <span className="text-[9px] font-bold px-1 rounded" style={{ background: 'rgba(249,115,22,0.2)', color: '#fb923c' }}>{high}H</span>}
                          </div>
                        )}
                        {isDone && total === 0 && <p className="text-[9px] text-green-500 pl-4">✓ clean</p>}
                        {isAnalyzingThis && <p className="text-[9px] text-blue-400 pl-4">analyzing…</p>}
                        {f.status === 'pending' && <p className="text-[9px] text-gray-600 pl-4">pending</p>}
                        {f.status === 'error' && <p className="text-[9px] text-red-500 pl-4">failed</p>}
                      </button>
                    );
                  })}
                </div>

                {/* Change folder */}
                <div className="border-t border-gray-800 px-3 py-2">
                  <input type="file" {...{ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>}
                    multiple onChange={handleFolderUpload} className="hidden" id="folder-repick" />
                  <label htmlFor="folder-repick" className="block text-center text-[11px] text-gray-600 hover:text-gray-300 cursor-pointer transition-colors">
                    ↩ Change folder
                  </label>
                </div>
              </div>

              {/* ── Code editor pane ── */}
              <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
                {activeFolderIdx !== null && folderEntries[activeFolderIdx] ? (
                  <>
                    <div className="px-4 py-2 border-b border-gray-800 flex items-center gap-2 flex-shrink-0">
                      <File className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                      <span className="text-xs text-gray-300 font-mono truncate">{folderEntries[activeFolderIdx].name}</span>
                      <span className="text-xs text-gray-600 ml-auto flex-shrink-0">{folderEntries[activeFolderIdx].content.split('\n').length} lines</span>
                    </div>
                    {tooltipInfo && (
                      <div className="fixed z-50 max-w-xs bg-gray-900 border border-gray-600 rounded-lg shadow-2xl p-3 text-xs pointer-events-none"
                        style={{ left: tooltipInfo.x, top: tooltipInfo.y, transform: 'translateY(-50%)' }}>
                        {tooltipInfo.issues.map((issue, idx) => {
                          const colors = SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.low;
                          return (
                            <div key={idx} className={idx > 0 ? 'mt-2 pt-2 border-t border-gray-700' : ''}>
                              <div className="flex items-center gap-1 mb-1">
                                <span className={`${colors.text} font-bold uppercase`}>{issue.severity}</span>
                                {issue.category && <span className="text-gray-500">· {issue.category}</span>}
                              </div>
                              <p className="text-gray-200 leading-snug">{issue.message}</p>
                              {issue.suggestion && <p className="text-gray-400 mt-1"><span className="text-green-400 font-semibold">Fix: </span>{issue.suggestion}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <div className="relative flex flex-1 overflow-hidden">
                      <div ref={overlayRef} className="absolute pointer-events-none overflow-hidden" style={{ left: 48, right: 0, top: 0, bottom: 0 }}>
                        {Object.entries(issuesByLine).map(([lineStr, lineIssues]) => {
                          const lineNum = Number(lineStr);
                          const worst = worstSeverity(lineIssues);
                          const colors = SEVERITY_COLORS[worst];
                          return <div key={lineNum} className="absolute w-full" style={{ top: (lineNum - 1) * LINE_H + PAD_TOP, height: LINE_H, backgroundColor: colors.bg, borderLeft: `2px solid ${colors.border}` }} />;
                        })}
                      </div>
                      <div ref={gutterRef} className="w-12 bg-gray-900/60 border-r border-gray-700/50 overflow-hidden flex-shrink-0 select-none" style={{ paddingTop: PAD_TOP }}>
                        {Array.from({ length: lineCount }, (_, i) => {
                          const lineNum = i + 1;
                          const lineIssues = issuesByLine[lineNum];
                          const isSelected = selectedIssueLine === lineNum;
                          if (!lineIssues) return <div key={lineNum} className="flex items-center justify-end pr-2 font-mono text-xs text-gray-600" style={{ height: LINE_H }}>{lineNum}</div>;
                          const worst = worstSeverity(lineIssues);
                          const colors = SEVERITY_COLORS[worst];
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
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">Select a file</div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* GITHUB mode — Repo file tree browser                               */}
      {/* ------------------------------------------------------------------ */}
      {inputMethod === 'github' && (
        <RepoExplorer
          onAnalyze={(repoCode, fileName) => {
            setCode(repoCode);
            onAnalyze(repoCode);
          }}
          isAnalyzing={isAnalyzing}
          repoUrl={githubUrl}
          setRepoUrl={setGithubUrl}
          filter={githubFilter}
          setFilter={setGithubFilter}
        />
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Analyze button + character count                                    */}
      {/* ------------------------------------------------------------------ */}
      {inputMethod !== 'github' && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            {code ? (
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>{code.length.toLocaleString()} characters ready</span>
                {uploadedFiles.length > 0 && <span className="text-gray-500">· {uploadedFiles.length} files</span>}
              </div>
            ) : (
              'No code provided'
            )}
          </div>
          <button
            onClick={() => onAnalyze(code)}
            disabled={!code || isAnalyzing || isUploading}
            className="flex items-center space-x-2 px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            {isAnalyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
            <span className="font-medium">
              {isAnalyzing ? 'Analyzing...' : isUploading ? 'Processing...' : 'Analyze Code'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
};
