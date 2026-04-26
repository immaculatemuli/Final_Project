import React, { useState } from 'react';
import {
  Github,
  FolderOpen,
  Folder as FolderIcon,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  Play,
  Loader2,
  Star,
  GitFork,
  AlertCircle,
  RefreshCw,
  X,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  download_url?: string;
  children?: TreeNode[];
}

interface RepoInfo {
  fullName: string;
  description: string;
  stars: number;
  forks: number;
  language: string;
  defaultBranch: string;
}

interface RepoExplorerProps {
  /** Called when the user clicks "Analyze" on a selected file */
  onAnalyze: (code: string, fileName: string) => void;
  isAnalyzing: boolean;
  repoUrl: string;
  setRepoUrl: (url: string) => void;
  filter: string;
  setFilter: (f: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CODE_EXTS = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h',
  '.php', '.rb', '.go', '.rs', '.cs', '.swift', '.kt', '.vue', '.svelte',
  '.html', '.css', '.scss', '.json', '.xml', '.yaml', '.yml', '.md', '.sh', '.sql'];

function isCodeFile(name: string) {
  const lower = name.toLowerCase();
  return CODE_EXTS.some(ext => lower.endsWith(ext));
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const colors: Record<string, string> = {
    ts: '#3178c6', tsx: '#3178c6', js: '#f0c000', jsx: '#61dafb',
    py: '#3572A5', java: '#b07219', go: '#00ADD8', rs: '#c4600a',
    css: '#563d7c', scss: '#c6538c', html: '#e34f26', json: '#cbcb41',
    md: '#083fa1', php: '#4F5D95', rb: '#701516', cs: '#178600',
  };
  return colors[ext] ?? '#64748b';
}

function formatSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

// ─── TreeRow ─────────────────────────────────────────────────────────────────

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  selectedPath: string | null;
  onSelect: (node: TreeNode) => void;
  filter: string;
}

const TreeRow: React.FC<TreeRowProps> = ({ node, depth, selectedPath, onSelect, filter }) => {
  const [open, setOpen] = useState(depth < 1); // expand root level by default

  const hasMatchingDescendant = (n: TreeNode): boolean => {
    if (!filter) return true;
    if (n.name.toLowerCase().includes(filter.toLowerCase())) return true;
    return (n.children ?? []).some(hasMatchingDescendant);
  };

  if (!hasMatchingDescendant(node)) return null;

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 transition-colors text-left rounded"
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {open
            ? <ChevronDown className="w-3 h-3 flex-shrink-0 text-slate-500" />
            : <ChevronRight className="w-3 h-3 flex-shrink-0 text-slate-500" />
          }
          {open
            ? <FolderOpen className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
            : <FolderIcon className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
          }
          <span className="text-xs text-slate-300 truncate font-medium">{node.name}</span>
          {node.children && (
            <span className="ml-auto text-[10px] text-slate-600 flex-shrink-0">{node.children.length}</span>
          )}
        </button>
        {open && node.children && (
          <div>
            {node.children.map(child => (
              <TreeRow
                key={child.path}
                node={child}
                depth={depth + 1}
                selectedPath={selectedPath}
                onSelect={onSelect}
                filter={filter}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // File row
  const isSelected = selectedPath === node.path;
  const isCode = isCodeFile(node.name);
  const color = fileIcon(node.name);

  return (
    <button
      onClick={() => isCode && onSelect(node)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded transition-all text-left ${
        isSelected
          ? 'bg-cyan-500/15 border-l-2 border-cyan-400'
          : isCode
            ? 'hover:bg-white/5 cursor-pointer border-l-2 border-transparent'
            : 'opacity-40 cursor-not-allowed border-l-2 border-transparent'
      }`}
      style={{ paddingLeft: `${8 + depth * 16}px` }}
      disabled={!isCode}
      title={isCode ? node.name : `${node.name} — not a supported code file`}
    >
      <span className="w-3 h-3 flex-shrink-0" />
      <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
      <span
        className={`text-xs truncate flex-1 ${isSelected ? 'text-cyan-300 font-semibold' : isCode ? 'text-slate-300' : 'text-slate-600'}`}
      >
        {node.name}
      </span>
      {node.size && isCode && (
        <span className="text-[10px] text-slate-600 flex-shrink-0 ml-1">{formatSize(node.size)}</span>
      )}
    </button>
  );
};

// ─── RepoExplorer ─────────────────────────────────────────────────────────────

 const RepoExplorer: React.FC<RepoExplorerProps> = ({ 
  onAnalyze, isAnalyzing, repoUrl, setRepoUrl, filter, setFilter 
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);

  // Auto-fetch tree when repoUrl is synced (and not already loaded)
  React.useEffect(() => {
    const parsed = parseRepoUrl(repoUrl.trim());
    if (parsed && !repoInfo && !loading) {
      fetchTree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repoUrl]);

  const parseRepoUrl = (rawInput: string) => {
    const input = rawInput.trim();
    if (!input) return null;

    // Support "owner/repo" shorthand.
    const shorthand = input.match(/^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/);
    if (shorthand) {
      return { owner: shorthand[1], repo: shorthand[2].replace(/\.git$/i, '') };
    }

    try {
      const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`;
      const u = new URL(normalized);
      if (!/^(www\.)?github\.com$/i.test(u.hostname)) return null;

      const parts = u.pathname.split('/').filter(Boolean);
      if (parts.length < 2) return null;

      const owner = parts[0];
      const repo = parts[1].replace(/\.git$/i, '');
      if (!owner || !repo) return null;

      return { owner, repo };
    } catch {
      return null;
    }
  };

  const fetchTree = async () => {
    const parsed = parseRepoUrl(repoUrl.trim());
    if (!parsed) {
      setError('Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo)');
      return;
    }
    setLoading(true);
    setError(null);
    setTree([]);
    setSelectedNode(null);
    setFileContent(null);
    setRepoInfo(null);

    try {
      const resp = await fetch('/api/repoTree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner: parsed.owner, repo: parsed.repo }),
      });
      const data = await resp.json() as { tree?: TreeNode[]; repoInfo?: RepoInfo; error?: string };
      if (!resp.ok || data.error) throw new Error(data.error ?? `Server error ${resp.status}`);
      setTree(data.tree ?? []);
      setRepoInfo(data.repoInfo ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch repository');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = async (node: TreeNode) => {
    setSelectedNode(node);
    setFileContent(null);
    if (!node.download_url) return;
    setLoadingFile(true);
    try {
      const resp = await fetch(node.download_url);
      if (!resp.ok) throw new Error(`Could not fetch file: ${resp.status}`);
      const text = await resp.text();
      if (text.length > 100_000) throw new Error('File too large (> 100 KB). Please select a smaller file.');
      setFileContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
      setSelectedNode(null);
    } finally {
      setLoadingFile(false);
    }
  };

  const handleAnalyze = () => {
    if (fileContent && selectedNode) {
      onAnalyze(fileContent, selectedNode.name);
    }
  };

  const reset = () => {
    setTree([]);
    setRepoInfo(null);
    setSelectedNode(null);
    setFileContent(null);
    setError(null);
    setFilter('');
  };

  // ── Empty state ──
  if (tree.length === 0) {
    return (
      <div className="space-y-4">
        {/* URL input */}
        <div
          className="rounded-xl p-5 space-y-3"
          style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2 mb-1">
            <Github className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-300">GitHub Repository</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={repoUrl}
                onChange={e => setRepoUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && fetchTree()}
                placeholder="https://github.com/owner/repository"
                className="w-full text-sm rounded-lg px-3 py-2.5 font-mono bg-transparent text-slate-200 placeholder-slate-600 focus:outline-none"
                style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}
              />
            </div>
            <button
              onClick={fetchTree}
              disabled={loading || !repoUrl.trim()}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)' }}
            >
              {loading
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <><Github className="w-4 h-4" /> Load</>
              }
            </button>
          </div>
          {error && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}
            >
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Hint */}
        <div className="text-center text-xs text-slate-600 py-4">
          Enter any public GitHub repository URL to browse its files and select one to analyze
        </div>
      </div>
    );
  }

  // ── Tree loaded ──
  const fileCount = (nodes: TreeNode[]): number =>
    nodes.reduce((acc, n) => acc + (n.type === 'file' ? 1 : fileCount(n.children ?? [])), 0);

  const totalFiles = fileCount(tree);
  const codeFiles = (nodes: TreeNode[]): number =>
    nodes.reduce((acc, n) => acc + (n.type === 'file' && isCodeFile(n.name) ? 1 : codeFiles(n.children ?? [])), 0);
  const totalCode = codeFiles(tree);

  return (
    <div className="flex flex-col gap-2" style={{ height: '480px' }}>
      {/* Repo info bar */}
      {repoInfo && (
        <div
          className="flex items-center gap-3 px-3 py-2 rounded-lg flex-shrink-0"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <Github className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-200 truncate">{repoInfo.fullName}</p>
            {repoInfo.description && (
              <p className="text-[10px] text-slate-500 truncate">{repoInfo.description}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0 text-[10px] text-slate-500">
            {repoInfo.language && (
              <span className="text-slate-400 font-medium">{repoInfo.language}</span>
            )}
            <span className="flex items-center gap-1">
              <Star className="w-3 h-3" />{repoInfo.stars.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <GitFork className="w-3 h-3" />{repoInfo.forks.toLocaleString()}
            </span>
            <button
              onClick={reset}
              className="text-slate-600 hover:text-slate-400 transition-colors"
              title="Change repository"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Main split: tree + preview */}
      <div className="flex flex-1 gap-2 min-h-0">

        {/* File tree panel */}
        <div
          className="flex flex-col rounded-xl overflow-hidden flex-shrink-0"
          style={{ width: '220px', background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Tree header */}
          <div
            className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-600" />
              <input
                type="text"
                value={filter}
                onChange={e => setFilter(e.target.value)}
                placeholder="Filter files…"
                className="w-full text-xs pl-6 pr-2 py-1 rounded bg-transparent focus:outline-none text-slate-300 placeholder-slate-700"
                style={{ border: '1px solid rgba(255,255,255,0.07)' }}
              />
            </div>
          </div>
          <div className="px-2 py-1 flex-shrink-0">
            <span className="text-[10px] text-slate-600">{totalCode} code files / {totalFiles} total</span>
          </div>

          {/* Tree scroll */}
          <div className="flex-1 overflow-y-auto py-1">
            {tree.map(node => (
              <TreeRow
                key={node.path}
                node={node}
                depth={0}
                selectedPath={selectedNode?.path ?? null}
                onSelect={handleSelectFile}
                filter={filter}
              />
            ))}
          </div>
        </div>

        {/* Preview + action panel */}
        <div
          className="flex-1 flex flex-col rounded-xl overflow-hidden min-w-0"
          style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {loadingFile && (
            <div className="flex-1 flex items-center justify-center gap-3 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
              <span className="text-sm">Loading file…</span>
            </div>
          )}

          {!loadingFile && !selectedNode && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-600">
              <FileText className="w-10 h-10 opacity-30" />
              <p className="text-sm">Click a file in the tree to preview it</p>
              <p className="text-xs opacity-70">Only highlighted files (code) can be analyzed</p>
            </div>
          )}

          {!loadingFile && selectedNode && fileContent !== null && (
            <>
              {/* File header */}
              <div
                className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
              >
                <FileText className="w-3.5 h-3.5 flex-shrink-0" style={{ color: fileIcon(selectedNode.name) }} />
                <span className="text-xs font-mono text-slate-300 truncate flex-1">{selectedNode.path}</span>
                <span className="text-[10px] text-slate-600 flex-shrink-0">
                  {fileContent.split('\n').length} lines
                </span>
              </div>

              {/* Code preview */}
              <pre
                className="flex-1 overflow-auto text-xs font-mono text-slate-300 leading-5 p-4"
                style={{ minHeight: 0 }}
              >
                <code>{fileContent}</code>
              </pre>

              {/* Analyze bar */}
              <div
                className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(6,182,212,0.05)' }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-300 font-semibold truncate">{selectedNode.name}</p>
                  <p className="text-[10px] text-slate-500">{fileContent.split('\n').length} lines · {formatSize(selectedNode.size)}</p>
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50 disabled:cursor-wait transition-all"
                  style={{ background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)' }}
                >
                  {isAnalyzing
                    ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</>
                    : <><Play className="w-4 h-4" /> Analyze</>
                  }
                </button>
              </div>
            </>
          )}

          {!loadingFile && error && !fileContent && (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-red-400 p-4">
              <AlertCircle className="w-8 h-8 opacity-60" />
              <p className="text-sm text-center">{error}</p>
              <button
                onClick={() => setError(null)}
                className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
              >
                <RefreshCw className="w-3 h-3" /> Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RepoExplorer;
