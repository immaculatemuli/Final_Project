import React, { useState } from 'react';
import {
  X, Copy, Download, CheckCircle, Share2, Send, Loader2, Code2,
} from 'lucide-react';
import { sendFixedCodeEmail } from '../services/aiAnalysis';

// ── Language → file extension map ─────────────────────────────────────────────
const LANG_EXT: Record<string, string> = {
  javascript: 'js', typescript: 'ts', python: 'py', java: 'java',
  'c++': 'cpp', cpp: 'cpp', c: 'c', 'c#': 'cs', csharp: 'cs',
  go: 'go', rust: 'rs', swift: 'swift', kotlin: 'kt', ruby: 'rb',
  php: 'php', html: 'html', css: 'css', scss: 'scss',
  sql: 'sql', bash: 'sh', shell: 'sh', yaml: 'yaml', json: 'json',
  jsx: 'jsx', tsx: 'tsx', vue: 'vue', svelte: 'svelte',
};

function getExtension(language: string) {
  return LANG_EXT[language?.toLowerCase()] ?? 'txt';
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface ShareFixedCodeModalProps {
  fixedCode: string;
  language: string;
  preFixScore: number | null;
  postFixScore: number;
  onClose: () => void;
  fileName?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────
const ShareFixedCodeModal: React.FC<ShareFixedCodeModalProps> = ({
  fixedCode,
  language,
  preFixScore,
  postFixScore,
  onClose,
  fileName,
}) => {
  const [copied, setCopied] = useState(false);
  const [emailAddr, setEmailAddr] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const ext = getExtension(language);
  const filename = fileName || `fixed-code.${ext}`;
  const scoreDelta = preFixScore !== null ? postFixScore - preFixScore : null;

  // ── Copy ────────────────────────────────────────────────────────────────────
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fixedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      alert('Could not copy to clipboard. Please copy manually.');
    }
  };

  // ── Download ────────────────────────────────────────────────────────────────
  const handleDownload = () => {
    const blob = new Blob([fixedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Email ───────────────────────────────────────────────────────────────────
  const handleEmail = async () => {
    if (!emailAddr.trim()) return;
    setSendingEmail(true);

    try {
      const subject = `AI Fixed Code: ${filename} (IntelliCode)`;

      // Build a professional HTML body
      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1e293b; background: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
          <h2 style="color: #3b82f6; margin-bottom: 8px;">IntelliCode Fixed Code</h2>
          <p style="font-size: 14px; margin-bottom: 24px;">The AI has optimized and fixed the code for <strong>${filename}</strong>.</p>
          
          ${scoreDelta !== null ? `
          <div style="background: #eff6ff; padding: 16px; border-radius: 12px; border-left: 4px solid #3b82f6; margin-bottom: 24px;">
            <p style="margin: 0; font-weight: bold; color: #1e40af; font-size: 14px;">Quality Improved!</p>
            <p style="margin: 4px 0 0; color: #3b82f6; font-size: 13px;">Code score improved from ${preFixScore} to ${postFixScore} (+${scoreDelta} pts).</p>
          </div>
          ` : ''}

          <div style="background: #0f172a; padding: 20px; border-radius: 12px; color: #e2e8f0; font-family: monospace; font-size: 13px; line-height: 1.6; overflow-x: auto;">
            <pre style="margin: 0; white-space: pre-wrap; word-break: break-all;">${fixedCode.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
          </div>

          <p style="margin-top: 24px; font-size: 11px; color: #64748b; text-align: center;">
            Sent from IntelliCode — Advanced AI Code Review Assistant.<br/>
            © 2026 IntelliCode AI Research
          </p>
        </div>
      `;

      // 1. Also copy to clipboard as a courtesy
      try { await navigator.clipboard.writeText(fixedCode); } catch { /* ignore */ }

      // 2. Call the REAL backend email service
      const success = await sendFixedCodeEmail(emailAddr, 'Developer', subject, html);
      
      if (success) {
        setEmailSent(true);
        setTimeout(() => setEmailSent(false), 3000);
      } else {
        alert('The email could not be sent. Please check your internet connection or use the Download option.');
      }
    } catch (err: unknown) {
      console.error('[Email Send Error]', err);
      // Fallback: If the backend fails, try mailto: as a last resort
      const body = encodeURIComponent(`Hi,\n\nHere is the fixed code for ${filename}:\n\n${fixedCode}`);
      window.location.href = `mailto:${emailAddr}?subject=Fixed Code Fallback&body=${body}`;
      alert('Backend email service is temporarily unavailable. Attempting to open your local mail client instead.');
    } finally {
      setSendingEmail(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {/* Modal */}
      <div
        className="w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl"
        style={{
          background: 'linear-gradient(160deg,#07152a,#040d1a)',
          border: '1px solid rgba(6,182,212,0.25)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(6,182,212,0.1)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(6,182,212,0.05)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#06b6d4,#8b5cf6)' }}>
              <Share2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Share Fixed Code</h2>
              <p className="text-[11px] text-slate-500">Choose how to share the AI-fixed version</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Score improvement banner */}
          {scoreDelta !== null && scoreDelta >= 0 && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: 'rgba(74,222,128,0.07)', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />
              <p className="text-xs text-green-300">
                Score improved <span className="font-bold">{preFixScore} → {postFixScore}</span>
                {' '}(<span className="font-bold">+{scoreDelta} pts</span>) after auto-fix
              </p>
            </div>
          )}

          {/* Code preview */}
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <Code2 className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[11px] font-mono text-slate-400">{filename}</span>
              <span className="ml-auto text-[10px] text-slate-600">
                {fixedCode.split('\n').length} lines
              </span>
            </div>
            <pre
              className="text-xs font-mono text-slate-300 p-3 overflow-auto leading-5"
              style={{ maxHeight: '140px', background: 'rgba(0,0,0,0.4)' }}
            >
              <code>{fixedCode.slice(0, 600)}{fixedCode.length > 600 ? '\n…' : ''}</code>
            </pre>
          </div>

          {/* ── Option 1: Copy ──────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Option 1 — Copy to Clipboard</p>
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: copied ? 'rgba(74,222,128,0.15)' : 'rgba(6,182,212,0.08)',
                border: `1px solid ${copied ? 'rgba(74,222,128,0.35)' : 'rgba(6,182,212,0.25)'}`,
                color: copied ? '#4ade80' : '#06b6d4',
              }}
            >
              {copied
                ? <><CheckCircle className="w-4 h-4" /> Copied to clipboard!</>
                : <><Copy className="w-4 h-4" /> Copy fixed code</>
              }
            </button>
          </div>

          {/* ── Option 2: Download ──────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Option 2 — Download File</p>
            <button
              onClick={handleDownload}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'rgba(139,92,246,0.08)',
                border: '1px solid rgba(139,92,246,0.25)',
                color: '#a78bfa',
              }}
            >
              <Download className="w-4 h-4" />
              Download as <span className="font-mono text-[11px] ml-1">{filename}</span>
            </button>
          </div>

          {/* ── Option 3: Email ─────────────────────────────────── */}
          <div className="space-y-2">
            <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-widest">Option 3 — Email Fixed Code</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={emailAddr}
                onChange={e => setEmailAddr(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleEmail()}
                placeholder="recipient@example.com"
                className="flex-1 text-sm px-3 py-2.5 rounded-xl outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#f1f5f9',
                }}
              />
              <button
                onClick={handleEmail}
                disabled={!emailAddr.trim() || sendingEmail}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)' }}
              >
                {sendingEmail
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : emailSent
                    ? <CheckCircle className="w-4 h-4" />
                    : <Send className="w-4 h-4" />
                }
                {emailSent ? 'Sent!' : 'Send'}
              </button>
            </div>
            <p className="text-[10px] text-slate-600">
              Opens your email client with the fixed code in the message body.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="flex justify-end px-6 py-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareFixedCodeModal;
