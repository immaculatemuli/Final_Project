import React, { useState } from 'react';
import {
  Github,
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
  Upload,
  FolderOpen,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
  download_url?: string;
  content?: string; // Add for local files
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
  /** Called when a file with a pre-existing bulk result is selected */
  onResultSelected: (code: string, fileName: string, result: any) => void;
  isAnalyzing: boolean;
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
  bulkResults: Record<string, any>; // Add this
}

const TreeRow: React.FC<TreeRowProps> = ({ node, depth, selectedPath, onSelect, filter, bulkResults }) => {
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
                bulkResults={bulkResults}
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
  const analysis = bulkResults[node.path];
  const score = analysis?.overallScore;

  return (
    <button
      onClick={() => isCode && onSelect(node)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 rounded transition-all text-left group ${
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

      {/* Score Badge */}
      {score !== undefined && (
        <span 
          className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 border"
          style={{ 
            background: score >= 80 ? 'rgba(34,197,94,0.1)' : score >= 60 ? 'rgba(234,179,8,0.1)' : 'rgba(239,68,68,0.1)',
            color: score >= 80 ? '#4ade80' : score >= 60 ? '#facc15' : '#f87171',
            borderColor: score >= 80 ? 'rgba(34,197,94,0.2)' : score >= 60 ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)'
          }}
        >
          {score}
        </span>
      )}

      {node.size && isCode && score === undefined && (
        <span className="text-[10px] text-slate-600 flex-shrink-0 ml-1 group-hover:block hidden">{formatSize(node.size)}</span>
      )}
    </button>
  );
};

// ─── RepoExplorer ─────────────────────────────────────────────────────────────

const RepoExplorer: React.FC<RepoExplorerProps> = ({ onAnalyze, onResultSelected, isAnalyzing }) => {
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [repoInfo, setRepoInfo] = useState<RepoInfo | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [filter, setFilter] = useState('');
  const [bulkResults, setBulkResults] = useState<Record<string, any>>({});
  const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [explorerMode, setExplorerMode] = useState<'github' | 'local'>('github');

  const parseRepoUrl = (url: string) => {
    const m = url.match(/github\.com\/([^/\s]+)\/([^/\s]+)/);
    if (!m) return null;
    return { owner: m[1], repo: m[2].replace(/\.git$/, '') };
  };

  const handleLocalFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setLoading(true);
    setError(null);
    setTree([]);
    setSelectedNode(null);

    try {
      const result: TreeNode[] = [];
      const pathMap: Record<string, TreeNode> = {};

      for (const file of Array.from(files)) {
        // Skip hidden files/folders (like .git)
        if (file.webkitRelativePath.includes('/.')) continue;

        const parts = file.webkitRelativePath.split('/');
        let parent: TreeNode[] = result;
        let currentPath = '';

        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          currentPath = currentPath ? `${currentPath}/${part}` : part;
          const isLast = i === parts.length - 1;

          if (!pathMap[currentPath]) {
            const newNode: TreeNode = {
              name: part,
              path: currentPath,
              type: isLast ? 'file' : 'dir',
              size: isLast ? file.size : 0,
              children: isLast ? undefined : [],
            };
            if (isLast && isCodeFile(part)) {
              newNode.content = await file.text();
            }
            pathMap[currentPath] = newNode;
            parent.push(newNode);
          }
          if (!isLast) {
            parent = pathMap[currentPath].children!;
          }
        }
      }

      setTree(result);
      if (result.length > 0) {
        setRepoInfo({
          fullName: result[0].name,
          description: 'Local Folder Upload',
          stars: 0,
          forks: 0,
          language: 'Local',
          defaultBranch: 'main'
        });
      }
    } catch (err) {
      setError('Failed to process local folder');
    } finally {
      setLoading(false);
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
    setBulkResults({});
    setBulkProgress(null);

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

  // Helper to find all code files in the tree
  const getAllCodeFiles = (nodes: TreeNode[]): TreeNode[] => {
    let files: TreeNode[] = [];
    nodes.forEach(n => {
      if (n.type === 'file' && isCodeFile(n.name)) files.push(n);
      if (n.children) files = [...files, ...getAllCodeFiles(n.children)];
    });
    return files;
  };

  const handleScanAll = async () => {
    const files = getAllCodeFiles(tree).slice(0, 20); // Cap at 20 for reliability
    if (files.length === 0) return;

    setIsBulkAnalyzing(true);
    setBulkProgress({ current: 0, total: files.length });

    // Iterate through files
    for (let i = 0; i < files.length; i++) {
      const node = files[i];
      
      try {
        let text = node.content; // Try local first
        if (!text && node.download_url) {
          const resp = await fetch(node.download_url);
          text = await resp.text();
        }

        if (text) {
          const analResp = await fetch('/api/analyzeCode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: text }),
          });
          const analData = await analResp.json();
          if (analData.success && analData.analysis) {
            setBulkResults(prev => ({ ...prev, [node.path]: analData.analysis }));
          }
        }
      } catch (err) {
        console.error(`Failed to analyze ${node.path}`, err);
      }
      setBulkProgress({ current: i + 1, total: files.length });
    }
    setIsBulkAnalyzing(false);
    setTimeout(() => setBulkProgress(null), 3000);
  };

  const handleSelectFile = async (node: TreeNode) => {
    setSelectedNode(node);
    setFileContent(null);
    
    // If local content exists, use it immediately
    if (node.content) {
      setFileContent(node.content);
      if (bulkResults[node.path]) {
        onResultSelected(node.content, node.name, bulkResults[node.path]);
      }
      return;
    }

    if (!node.download_url) return;
    setLoadingFile(true);
    try {
      const resp = await fetch(node.download_url);
      if (!resp.ok) throw new Error(`Could not fetch file: ${resp.status}`);
      const text = await resp.text();
      if (text.length > 200_000) throw new Error('File too large. Please select a smaller file.');
      setFileContent(text);

      // If we already have a bulk result, push it to main view
      if (bulkResults[node.path]) {
        onResultSelected(text, node.name, bulkResults[node.path]);
      }
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
    setBulkResults({});
    setBulkProgress(null);
  };

  if (tree.length === 0) {
    return (
      <div className="space-y-4">
        {/* Mode Tabs */}
        <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setExplorerMode('github')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              explorerMode === 'github' ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-3.5 h-3.5" /> GitHub Repo
          </button>
          <button
            onClick={() => setExplorerMode('local')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${
              explorerMode === 'local' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderIcon className="w-3.5 h-3.5" /> Local Folder
          </button>
        </div>

        {explorerMode === 'github' ? (
          <div
            className="rounded-xl p-5 space-y-3"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Github className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-300">Browse GitHub</span>
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
                  : <><Play className="w-4 h-4" /> Load</>
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
        ) : (
          <div
            className="rounded-xl p-8 border-2 border-dashed border-white/10 hover:border-indigo-500/50 transition-all text-center group"
            style={{ background: 'rgba(255,255,255,0.02)' }}
          >
            <FolderOpen className="w-10 h-10 text-slate-500 mx-auto mb-4 group-hover:text-indigo-400 transition-colors" />
            <h3 className="text-sm font-bold text-slate-200 mb-1">Upload Local Project</h3>
            <p className="text-xs text-slate-500 mb-6">Select a folder to browse and scan its contents</p>
            
            <input 
              type="file" 
              {...{ webkitdirectory: 'true' } as React.InputHTMLAttributes<HTMLInputElement>}
              onChange={handleLocalFolderUpload} 
              className="hidden" 
              id="local-repo-upload" 
            />
            <label 
              htmlFor="local-repo-upload"
              className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-bold cursor-pointer transition-all shadow-lg shadow-indigo-500/20 active:scale-95"
            >
              <Upload className="w-4 h-4" /> Choose Folder
            </label>
            {loading && (
              <div className="mt-4 flex items-center justify-center gap-2 text-indigo-400 text-xs font-bold">
                <Loader2 className="w-3 h-3 animate-spin" /> Processing files...
              </div>
            )}
          </div>
        )}

        {/* Hint */}
        <div className="text-center text-xs text-slate-600 py-4">
          Browse any repo or folder to see its full structure and scan it for errors in one click.
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
            className="flex flex-col gap-2 px-3 py-2 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2">
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
              <button
                onClick={handleScanAll}
                disabled={isBulkAnalyzing || totalCode === 0}
                className="p-1 px-1.5 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 hover:bg-cyan-500/20 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                title="Analyze Entire Repo"
              >
                {isBulkAnalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              </button>
            </div>

            {/* Bulk Progress Bar */}
            {bulkProgress && (
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-bold text-slate-500 px-0.5">
                  <span className="text-cyan-400">ANALYZING REPO</span>
                  <span>{bulkProgress.current} / {bulkProgress.total}</span>
                </div>
                <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden border border-white/5">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300 shadow-[0_0_8px_rgba(6,182,212,0.5)]"
                    style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="px-2 py-1 flex-shrink-0 flex justify-between items-center">
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
                bulkResults={bulkResults}
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
