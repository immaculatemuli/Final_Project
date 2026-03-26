import React, { useRef, useEffect } from 'react';
import { ArrowLeftRight, Minus, Plus, Equal } from 'lucide-react';

interface DiffViewerProps {
  original: string;
  modified: string;
}

type DiffOp = 'equal' | 'remove' | 'add';

interface DiffLine {
  op: DiffOp;
  origLine: string | null;  // shown on left
  newLine: string | null;   // shown on right
  origNum: number | null;
  newNum: number | null;
}

// ─── LCS-based diff ──────────────────────────────────────────────────────────
function computeDiff(origLines: string[], newLines: string[]): DiffLine[] {
  const O = origLines.length;
  const N = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: O + 1 }, () => new Array(N + 1).fill(0));
  for (let i = O - 1; i >= 0; i--) {
    for (let j = N - 1; j >= 0; j--) {
      if (origLines[i] === newLines[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  // Trace back through LCS table to produce aligned diff rows
  const result: DiffLine[] = [];
  let i = 0, j = 0;
  let origNum = 1, newNum = 1;

  while (i < O || j < N) {
    if (i < O && j < N && origLines[i] === newLines[j]) {
      // Equal
      result.push({ op: 'equal', origLine: origLines[i], newLine: newLines[j], origNum, newNum });
      i++; j++; origNum++; newNum++;
    } else if (j < N && (i >= O || dp[i][j + 1] >= dp[i + 1][j])) {
      // Added in new
      result.push({ op: 'add', origLine: null, newLine: newLines[j], origNum: null, newNum });
      j++; newNum++;
    } else {
      // Removed from original
      result.push({ op: 'remove', origLine: origLines[i], newLine: null, origNum, newNum: null });
      i++; origNum++;
    }
  }

  return result;
}

// ─── Character-level diff for a changed line pair ────────────────────────────
function charDiff(a: string, b: string): { aParts: { text: string; changed: boolean }[]; bParts: { text: string; changed: boolean }[] } {
  // Word-level tokenisation — good enough for code
  const tokenize = (s: string) => s.match(/\w+|\W/g) ?? [];
  const at = tokenize(a);
  const bt = tokenize(b);

  const M = at.length, K = bt.length;
  const dp2: number[][] = Array.from({ length: M + 1 }, () => new Array(K + 1).fill(0));
  for (let i = M - 1; i >= 0; i--)
    for (let j = K - 1; j >= 0; j--)
      dp2[i][j] = at[i] === bt[j] ? dp2[i + 1][j + 1] + 1 : Math.max(dp2[i + 1][j], dp2[i][j + 1]);

  const aParts: { text: string; changed: boolean }[] = [];
  const bParts: { text: string; changed: boolean }[] = [];
  let i = 0, j = 0;
  while (i < M || j < K) {
    if (i < M && j < K && at[i] === bt[j]) {
      aParts.push({ text: at[i], changed: false });
      bParts.push({ text: bt[j], changed: false });
      i++; j++;
    } else if (j < K && (i >= M || dp2[i][j + 1] >= dp2[i + 1][j])) {
      bParts.push({ text: bt[j], changed: true });
      j++;
    } else {
      aParts.push({ text: at[i], changed: true });
      i++;
    }
  }

  return { aParts, bParts };
}

// ─── Component ───────────────────────────────────────────────────────────────
export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified }) => {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // Sync scroll between both panes
  const syncScroll = (src: HTMLDivElement, dst: HTMLDivElement) => {
    dst.scrollTop = src.scrollTop;
    dst.scrollLeft = src.scrollLeft;
  };

  const origLines = original.split('\n');
  const newLines = modified.split('\n');
  const diff = computeDiff(origLines, newLines);

  const removed = diff.filter(l => l.op === 'remove').length;
  const added = diff.filter(l => l.op === 'add').length;
  const changed = Math.min(removed, added);

  // Find first changed line index and auto-scroll to it
  useEffect(() => {
    const firstChangedIdx = diff.findIndex(l => l.op !== 'equal');
    if (firstChangedIdx > 0 && leftRef.current) {
      const LINE_H = 24;
      const offset = Math.max(0, firstChangedIdx - 3) * LINE_H;
      leftRef.current.scrollTop = offset;
      if (rightRef.current) rightRef.current.scrollTop = offset;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original, modified]);

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3"
        style={{ background: 'rgba(0,0,0,0.4)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">Auto-Fix Diff</span>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          {removed > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <Minus className="w-3 h-3" />{removed} removed
            </span>
          )}
          {added > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <Plus className="w-3 h-3" />{added} added
            </span>
          )}
          {changed > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Equal className="w-3 h-3" />{changed} changed
            </span>
          )}
          {removed === 0 && added === 0 && (
            <span className="text-slate-500">No changes detected</span>
          )}
        </div>
        <div className="flex items-center gap-4 text-[10px] uppercase tracking-wider font-bold">
          <span className="flex items-center gap-1 text-red-400"><Minus className="w-3 h-3" />Original</span>
          <span className="flex items-center gap-1 text-emerald-400"><Plus className="w-3 h-3" />Fixed</span>
        </div>
      </div>

      {/* Split pane */}
      <div className="grid grid-cols-2 divide-x" style={{ height: '520px', borderColor: 'rgba(255,255,255,0.06)' }}>

        {/* ── LEFT: Original ─────────────────────────── */}
        <div
          ref={leftRef}
          className="overflow-auto font-mono text-xs leading-6"
          style={{ background: 'rgba(239,68,68,0.03)' }}
          onScroll={e => rightRef.current && syncScroll(e.currentTarget, rightRef.current)}
        >
          <div style={{ minWidth: 'max-content' }}>
            {diff.map((row, idx) => {
              if (row.op === 'add') {
                return (
                  <div key={idx} className="flex min-h-[24px]" style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <span className="w-10 shrink-0 select-none" />
                    <span className="w-5 shrink-0 select-none" />
                    <span className="px-3 text-slate-700 italic text-[10px] leading-6">·</span>
                  </div>
                );
              }
              const isRemoved = row.op === 'remove';

              // Improved pairing: Find the corresponding 'add' in this contiguous block of changes
              let pairLine: string | null = null;
              if (isRemoved) {
                // Find how many 'remove' operations preceded this one in the current block
                let removeOffset = 0;
                for (let k = idx - 1; k >= 0 && diff[k].op === 'remove'; k--) removeOffset++;
                
                // Find the start of the 'add' block following this 'remove' block
                let searchIdx = idx + 1;
                while (searchIdx < diff.length && diff[searchIdx].op === 'remove') searchIdx++;
                
                // Match with the add at the same relative offset
                const targetAddIdx = searchIdx + removeOffset;
                if (targetAddIdx < diff.length && diff[targetAddIdx].op === 'add') {
                  pairLine = diff[targetAddIdx].newLine;
                }
              }

              let parts: { text: string; changed: boolean }[] | null = null;
              if (isRemoved && pairLine !== null) {
                parts = charDiff(row.origLine ?? '', pairLine).aParts;
              }

              return (
                <div
                  key={idx}
                  className="flex min-h-[24px]"
                  style={{
                    background: isRemoved ? 'rgba(239,68,68,0.18)' : 'transparent',
                    borderLeft: isRemoved ? '3px solid rgba(239,68,68,0.7)' : '3px solid transparent',
                  }}
                >
                  <span className="w-10 shrink-0 text-right pr-3 select-none text-slate-600 leading-6">
                    {row.origNum}
                  </span>
                  <span className="w-5 shrink-0 text-center select-none leading-6 font-bold"
                    style={{ color: 'rgba(239,68,68,0.8)' }}>
                    {isRemoved ? '−' : ' '}
                  </span>
                  <span className="px-2 whitespace-pre leading-6"
                    style={{ color: isRemoved ? '#fca5a5' : '#475569' }}>
                    {parts
                      ? parts.map((p, pi) => (
                        <span key={pi} style={p.changed ? { background: 'rgba(239,68,68,0.45)', borderRadius: 3, padding: '0 1px' } : {}}>
                          {p.text}
                        </span>
                      ))
                      : (row.origLine ?? '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── RIGHT: Fixed ───────────────────────────── */}
        <div
          ref={rightRef}
          className="overflow-auto font-mono text-xs leading-6"
          style={{ background: 'rgba(16,185,129,0.03)' }}
          onScroll={e => leftRef.current && syncScroll(e.currentTarget, leftRef.current)}
        >
          <div style={{ minWidth: 'max-content' }}>
            {diff.map((row, idx) => {
              if (row.op === 'remove') {
                return (
                  <div key={idx} className="flex min-h-[24px]" style={{ background: 'rgba(0,0,0,0.15)' }}>
                    <span className="w-10 shrink-0 select-none" />
                    <span className="w-5 shrink-0 select-none" />
                    <span className="px-3 text-slate-700 italic text-[10px] leading-6">·</span>
                  </div>
                );
              }
              const isAdded = row.op === 'add';

              // Improved pairing: Find the corresponding 'remove' in this contiguous block of changes
              let pairLine: string | null = null;
              if (isAdded) {
                // Find how many 'add' operations preceded this one in the current block
                let addOffset = 0;
                for (let k = idx - 1; k >= 0 && diff[k].op === 'add'; k--) addOffset++;
                
                // Find the start of the 'remove' block preceding this 'add' block
                let searchIdx = idx - 1;
                while (searchIdx >= 0 && diff[searchIdx].op === 'add') searchIdx--;
                
                // Match with the remove at the same relative offset (counting backwards from the end of the remove block)
                // Actually easier to just find the start of the remove block
                let removeStartIdx = searchIdx;
                while (removeStartIdx >= 0 && diff[removeStartIdx].op === 'remove') removeStartIdx--;
                removeStartIdx++; // move to first remove
                
                const targetRemoveIdx = removeStartIdx + addOffset;
                if (targetRemoveIdx <= searchIdx && diff[targetRemoveIdx].op === 'remove') {
                  pairLine = diff[targetRemoveIdx].origLine;
                }
              }

              let parts: { text: string; changed: boolean }[] | null = null;
              if (isAdded && pairLine !== null) {
                parts = charDiff(pairLine, row.newLine ?? '').bParts;
              }

              return (
                <div
                  key={idx}
                  className="flex min-h-[24px]"
                  style={{
                    background: isAdded ? 'rgba(16,185,129,0.18)' : 'transparent',
                    borderLeft: isAdded ? '3px solid rgba(16,185,129,0.7)' : '3px solid transparent',
                  }}
                >
                  <span className="w-10 shrink-0 text-right pr-3 select-none text-slate-600 leading-6">
                    {row.newNum}
                  </span>
                  <span className="w-5 shrink-0 text-center select-none leading-6 font-bold"
                    style={{ color: 'rgba(16,185,129,0.9)' }}>
                    {isAdded ? '+' : ' '}
                  </span>
                  <span className="px-2 whitespace-pre leading-6"
                    style={{ color: isAdded ? '#6ee7b7' : '#64748b' }}>
                    {parts
                      ? parts.map((p, pi) => (
                        <span key={pi} style={p.changed ? { background: 'rgba(16,185,129,0.4)', borderRadius: 3, padding: '0 1px' } : {}}>
                          {p.text}
                        </span>
                      ))
                      : (row.newLine ?? '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Footer legend */}
      <div className="flex items-center justify-center gap-6 px-5 py-2 text-[10px] text-slate-600"
        style={{ background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(239,68,68,0.4)' }} />
          Removed / changed word
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(16,185,129,0.4)' }} />
          Added / fixed word
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(255,255,255,0.06)' }} />
          Unchanged
        </span>
      </div>
    </div>
  );
};
