import React from 'react';
import {
  BookOpen,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  Users,
  Zap,
  Star,
  Code,
  AlertCircle,
} from 'lucide-react';
import type { CodeExplanation } from '../services/aiAnalysis';

interface ExplanationPanelProps {
  explanation: CodeExplanation | null;
  isExplaining: boolean;
}

const complexityConfig = {
  Simple: { color: '#4ade80', bg: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
  Moderate: { color: '#facc15', bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.25)' },
  Complex: { color: '#f87171', bg: 'rgba(248,113,113,0.1)', border: 'rgba(248,113,113,0.25)' },
};

const ExplanationPanel: React.FC<ExplanationPanelProps> = ({ explanation, isExplaining }) => {

  /* ── Loading ──────────────────────────────────────── */
  if (isExplaining) {
    return (
      <div className="glass rounded-2xl p-8 h-full flex flex-col items-center justify-center gap-6"
        style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: '400px' }}>
        <div className="relative">
          <div className="w-16 h-16 rounded-full" style={{ border: '2px solid rgba(139,92,246,0.15)' }} />
          <div className="absolute inset-0 w-16 h-16 rounded-full animate-spin"
            style={{ border: '2px solid transparent', borderTopColor: '#8b5cf6' }} />
          <div className="absolute inset-2 w-12 h-12 rounded-full animate-spin"
            style={{ border: '2px solid transparent', borderTopColor: '#ec4899', animationDirection: 'reverse', animationDuration: '1.2s' }} />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-base font-bold text-white">Reading Your Code</h3>
          <p className="text-sm text-slate-500">AI is crafting a plain English explanation…</p>
        </div>
        <div className="w-48 space-y-2">
          {['Understanding structure', 'Mapping data flow', 'Writing explanation'].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full animate-pulse"
                style={{ background: '#8b5cf6', animationDelay: `${i * 0.4}s` }} />
              <span className="text-xs text-slate-500">{step}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Empty ────────────────────────────────────────── */
  if (!explanation) {
    return (
      <div className="glass rounded-2xl p-8"
        style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: '400px' }}>
        <div className="flex flex-col items-center justify-center h-64 space-y-5 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
            <BookOpen className="w-8 h-8 text-violet-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white">Code Explainer</h3>
            <p className="text-sm text-slate-500 max-w-xs">
              Paste your code in the editor and click{' '}
              <strong className="text-violet-400">Explain</strong> to get a plain English breakdown.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {[
              { label: 'Purpose', color: '#8b5cf6' },
              { label: 'Flow', color: '#ec4899' },
              { label: 'Key Points', color: '#06b6d4' },
            ].map((item) => (
              <div key={item.label} className="text-center px-3 py-2 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="w-2 h-2 rounded-full mx-auto mb-1" style={{ background: item.color }} />
                <span className="text-xs text-slate-500">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ── Result ───────────────────────────────────────── */
  const cmplx = complexityConfig[explanation.complexity];

  return (
    <div className="glass rounded-2xl overflow-hidden flex flex-col"
      style={{ border: '1px solid rgba(255,255,255,0.07)', minHeight: '400px' }}>

      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-violet-400" />
            Code Explanation
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Code className="w-3 h-3" />{explanation.language}
            </span>
            <span>·</span>
            <span>{explanation.audience}</span>
          </p>
        </div>

        {/* Complexity badge */}
        <span className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: cmplx.bg, color: cmplx.color, border: `1px solid ${cmplx.border}` }}>
          {explanation.complexity}
        </span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">

        {/* Purpose banner */}
        <div className="rounded-xl p-4"
          style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-violet-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-violet-400">Purpose</span>
          </div>
          <p className="text-sm text-slate-200 leading-relaxed font-medium">{explanation.purpose}</p>
        </div>

        {/* Overview */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Overview</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed">{explanation.overview}</p>
        </div>

        {/* Sections */}
        {explanation.sections.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Code Breakdown</span>
            </div>
            <div className="space-y-2.5">
              {explanation.sections.map((section, i) => (
                <div key={i} className="rounded-xl p-3.5"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-bold text-white">{section.title}</span>
                    {section.lines && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono text-slate-500"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                        Lines {section.lines}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{section.explanation}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inputs + Outputs */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {explanation.inputs.length > 0 && (
            <div className="rounded-xl p-3.5"
              style={{ background: 'rgba(6,182,212,0.05)', border: '1px solid rgba(6,182,212,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <ArrowDownToLine className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Inputs</span>
              </div>
              <ul className="space-y-1.5">
                {explanation.inputs.map((inp, i) => (
                  <li key={i} className="text-xs text-slate-300 flex items-start gap-1.5">
                    <span className="text-cyan-600 mt-0.5">→</span>{inp}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {explanation.outputs && (
            <div className="rounded-xl p-3.5"
              style={{ background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)' }}>
              <div className="flex items-center gap-2 mb-2">
                <ArrowUpFromLine className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-green-400">Output</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{explanation.outputs}</p>
            </div>
          )}
        </div>

        {/* Key Points */}
        {explanation.keyPoints.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Key Points to Know</span>
            </div>
            <ul className="space-y-2">
              {explanation.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold text-white"
                    style={{ background: 'rgba(245,158,11,0.3)' }}>{i + 1}</span>
                  <span className="text-sm text-slate-300 leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Dependencies + Audience */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {explanation.dependencies.length > 0 && (
            <div className="rounded-xl p-3.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Dependencies</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {explanation.dependencies.map((dep, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-xs text-slate-300"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {explanation.audience && (
            <div className="rounded-xl p-3.5"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">Audience</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">{explanation.audience}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ExplanationPanel;
