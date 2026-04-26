import React, { useRef, useEffect, useMemo } from 'react';
import { ArrowLeftRight, Minus, Plus, X } from 'lucide-react';

interface DiffViewerProps {
  original: string;
  modified: string;
  onClose: () => void;
}

type DiffOp = 'equal' | 'remove' | 'add';

interface DiffLine {
  op: DiffOp;
  origLine: string | null;
  newLine: string | null;
  origNum: number | null;
  newNum: number | null;
}

function computeDiff(origLines: string[], newLines: string[]): DiffLine[] {
  const result: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < origLines.length || j < newLines.length) {
    if (i < origLines.length && j < newLines.length && origLines[i] === newLines[j]) {
      result.push({ op: 'equal', origLine: origLines[i], newLine: newLines[j], origNum: i + 1, newNum: j + 1 });
      i++; j++;
    } else if (i < origLines.length && (!newLines[j] || origLines[i] !== newLines[j])) {
      let found = -1;
      for (let k = j; k < Math.min(j + 20, newLines.length); k++) {
        if (newLines[k] === origLines[i]) { found = k; break; }
      }
      if (found !== -1) {
        while (j < found) {
          result.push({ op: 'add', origLine: null, newLine: newLines[j], origNum: null, newNum: j + 1 });
          j++;
        }
      } else {
        result.push({ op: 'remove', origLine: origLines[i], newLine: null, origNum: i + 1, newNum: null });
        i++;
      }
    } else if (j < newLines.length) {
      result.push({ op: 'add', origLine: null, newLine: newLines[j], origNum: null, newNum: j + 1 });
      j++;
    }
  }
  return result;
}

function charDiff(a: string, b: string) {
  const tokenize = (s: string) => s.match(/\w+|\W/g) ?? [];
  const at = tokenize(a);
  const bt = tokenize(b);
  const aParts: { text: string; changed: boolean }[] = [];
  const bParts: { text: string; changed: boolean }[] = [];
  let i = 0, j = 0;
  while (i < at.length || j < bt.length) {
    if (i < at.length && j < bt.length && at[i] === bt[j]) {
      aParts.push({ text: at[i], changed: false });
      bParts.push({ text: bt[j], changed: false });
      i++; j++;
    } else if (i < at.length) {
      aParts.push({ text: at[i], changed: true });
      i++;
    } else if (j < bt.length) {
      bParts.push({ text: bt[j], changed: true });
      j++;
    }
  }
  return { aParts, bParts };
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified, onClose }) => {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const syncScroll = (src: HTMLDivElement, dst: HTMLDivElement) => {
    dst.scrollTop = src.scrollTop;
    dst.scrollLeft = src.scrollLeft;
  };

  const { diff, removed, added, isTooLarge } = useMemo(() => {
    const oLines = (original || '').replace(/\r/g, '').split('\n');
    const nLines = (modified || '').replace(/\r/g, '').split('\n');
    const tooLarge = oLines.length > 5000;
    const rawDiff = tooLarge ? [] : computeDiff(oLines, nLines);
    
    const d: DiffLine[] = [];
    let k = 0;
    while (k < rawDiff.length) {
      if (rawDiff[k].op === 'equal') {
        d.push(rawDiff[k]);
        k++;
      } else {
        const rems: DiffLine[] = [];
        const adds: DiffLine[] = [];
        while (k < rawDiff.length && rawDiff[k].op !== 'equal') {
          if (rawDiff[k].op === 'remove') rems.push(rawDiff[k]);
          else adds.push(rawDiff[k]);
          k++;
        }
        const max = Math.max(rems.length, adds.length);
        for (let m = 0; m < max; m++) {
          const r = rems[m], a = adds[m];
          if (r && a) d.push({ op: 'change' as any, origLine: r.origLine, newLine: a.newLine, origNum: r.origNum, newNum: a.newNum });
          else if (r) d.push(r);
          else if (a) d.push(a);
        }
      }
    }
    return { 
      diff: d, 
      removed: rawDiff.filter(l => l.op === 'remove').length, 
      added: rawDiff.filter(l => l.op === 'add').length,
      isTooLarge: tooLarge
    };
  }, [original, modified]);

  useEffect(() => {
    const idx = diff.findIndex(l => l.op !== 'equal');
    if (idx > 0 && leftRef.current && rightRef.current) {
      const offset = Math.max(0, idx - 3) * 24;
      leftRef.current.scrollTop = offset;
      rightRef.current.scrollTop = offset;
    }
  }, [diff]);

  return (
    <div className="rounded-2xl overflow-hidden shadow-2xl bg-slate-900 border border-white/10">
      <div className="flex items-center justify-between px-5 py-3 bg-black/40 border-b border-white/5">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-white">Auto-Fix Comparison</span>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest">
          {removed > 0 && <span className="text-red-400">-{removed} lines</span>}
          {added > 0 && <span className="text-emerald-400">+{added} lines</span>}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all">
          <X className="w-4 h-4" />
        </button>
      </div>

      {isTooLarge && <div className="p-10 text-center text-slate-500">File too large for live diff preview.</div>}

      <div className="grid grid-cols-2 divide-x divide-white/5 h-[500px]">
        <div ref={leftRef} className="overflow-auto font-mono text-[11px] leading-6 bg-red-500/5" onScroll={e => rightRef.current && syncScroll(e.currentTarget, rightRef.current)}>
          {diff.map((row, idx) => {
            if (row.op === 'add') return <div key={idx} className="h-6 bg-black/20" />;
            const isChg = row.op === 'remove' || (row.op as string) === 'change';
            const parts = isChg && row.origLine && row.newLine ? charDiff(row.origLine, row.newLine).aParts : null;
            return (
              <div key={idx} className={`flex h-6 ${isChg ? 'bg-red-500/20 border-l-2 border-red-500' : ''}`}>
                <span className="w-10 shrink-0 text-right pr-2 opacity-30 select-none">{row.origNum}</span>
                <span className="px-2 whitespace-pre truncate">
                  {parts ? parts.map((p, pi) => <span key={pi} className={p.changed ? 'bg-red-500/40 rounded' : ''}>{p.text}</span>) : (row.origLine || ' ')}
                </span>
              </div>
            );
          })}
        </div>
        <div ref={rightRef} className="overflow-auto font-mono text-[11px] leading-6 bg-emerald-500/5" onScroll={e => leftRef.current && syncScroll(e.currentTarget, leftRef.current)}>
          {diff.map((row, idx) => {
            if (row.op === 'remove') return <div key={idx} className="h-6 bg-black/20" />;
            const isChg = row.op === 'add' || (row.op as string) === 'change';
            const parts = isChg && row.origLine && row.newLine ? charDiff(row.origLine, row.newLine).bParts : null;
            return (
              <div key={idx} className={`flex h-6 ${isChg ? 'bg-emerald-500/20 border-l-2 border-emerald-500' : ''}`}>
                <span className="w-10 shrink-0 text-right pr-2 opacity-30 select-none">{row.newNum}</span>
                <span className="px-2 whitespace-pre truncate">
                  {parts ? parts.map((p, pi) => <span key={pi} className={p.changed ? 'bg-emerald-500/40 rounded' : ''}>{p.text}</span>) : (row.newLine || ' ')}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
