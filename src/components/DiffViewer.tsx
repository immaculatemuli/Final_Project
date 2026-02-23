import React from 'react';
import { ArrowLeftRight, Check, X } from 'lucide-react';

interface DiffViewerProps {
    original: string;
    modified: string;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ original, modified }) => {
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');

    // Simple line-by-line diff logic (for demonstration purposes, a real diff lib is usually preferred but we can build a nice basic version)
    return (
        <div className="bg-slate-900 border border-white/10 rounded-xl overflow-hidden shadow-2xl">
            <div className="flex bg-slate-800 border-b border-white/10 p-3 items-center justify-between">
                <div className="flex items-center gap-2">
                    <ArrowLeftRight className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-semibold text-white">Code Transformation Diff</span>
                </div>
                <div className="flex gap-4 text-[10px] uppercase tracking-wider font-bold">
                    <span className="flex items-center gap-1 text-red-400"><X className="w-3 h-3" /> Original</span>
                    <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" /> AI Fixed</span>
                </div>
            </div>

            <div className="grid grid-cols-2 divide-x divide-white/10 h-[500px] font-mono text-sm leading-6 overflow-hidden">
                {/* Original Side */}
                <div className="bg-red-500/5 overflow-y-auto overflow-x-auto custom-scrollbar">
                    {originalLines.map((line, i) => {
                        const isRemoved = line !== modifiedLines[i];
                        return (
                            <div key={i} className={`flex px-4 min-h-[24px] ${isRemoved ? 'bg-red-500/20 text-red-200 border-l-2 border-red-500' : 'text-slate-400 opacity-50'}`}>
                                <span className="w-8 shrink-0 text-right pr-4 text-slate-600 select-none text-xs">{i + 1}</span>
                                <span className="whitespace-pre">{line || ' '}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Modified Side */}
                <div className="bg-emerald-500/5 overflow-y-auto overflow-x-auto custom-scrollbar">
                    {modifiedLines.map((line, i) => {
                        const isAdded = line !== originalLines[i];
                        return (
                            <div key={i} className={`flex px-4 min-h-[24px] ${isAdded ? 'bg-emerald-500/20 text-emerald-200 border-l-2 border-emerald-500 font-medium' : 'text-slate-300'}`}>
                                <span className="w-8 shrink-0 text-right pr-4 text-slate-600 select-none text-xs">{i + 1}</span>
                                <span className="whitespace-pre">{line || ' '}</span>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
