import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Bot, User, Sparkles } from 'lucide-react';
import type { ChatMessage } from '../services/aiAnalysis';

interface ChatPanelProps {
  messages: ChatMessage[];
  isChatting: boolean;
  hasCode: boolean;
  onSend: (message: string) => void;
}

const SUGGESTED = [
  'What does this code do?',
  'What is the biggest risk here?',
  'How can I improve performance?',
  'Explain line by line',
];

const ChatPanel: React.FC<ChatPanelProps> = ({ messages, isChatting, hasCode, onSend }) => {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isChatting]);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || isChatting) return;
    onSend(trimmed);
    setInput('');
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ── Empty state ─────────────────────────────────── */
  if (!hasCode) {
    return (
      <div className="rounded-2xl flex flex-col items-center justify-center gap-4 p-8 text-center"
        style={{ background: 'rgba(10,15,30,0.96)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '400px' }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}>
          <MessageSquare className="w-7 h-7 text-violet-400" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-white">AI Code Chat</h3>
          <p className="text-sm text-slate-500 max-w-xs">
            Paste your code in the editor, then ask anything — bugs, logic, improvements, explanations.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 w-full max-w-xs pt-1">
          {SUGGESTED.map(q => (
            <div key={q} className="px-3 py-2 rounded-xl text-xs text-slate-500 text-left"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              "{q}"
            </div>
          ))}
        </div>
      </div>
    );
  }

  /* ── Chat UI ─────────────────────────────────────── */
  return (
    <div className="rounded-2xl flex flex-col overflow-hidden"
      style={{ background: 'rgba(10,15,30,0.96)', border: '1px solid rgba(255,255,255,0.1)', minHeight: '400px', maxHeight: '680px' }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
          <Bot className="w-4 h-4 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-none">Code Chat</p>
          <p className="text-[10px] text-slate-500 mt-0.5">Ask anything about your code</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs text-slate-500">AI ready</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">

        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="flex-1 space-y-3">
              <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-300 leading-relaxed"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.15)' }}>
                Hi! I can see your code. Ask me anything — what it does, why something might be buggy, how to improve it, or what a specific line means.
              </div>
              {/* Suggested questions */}
              <div className="flex flex-wrap gap-2">
                {SUGGESTED.map(q => (
                  <button
                    key={q}
                    onClick={() => onSend(q)}
                    disabled={isChatting}
                    className="px-3 py-1.5 rounded-full text-xs text-slate-400 transition-all hover:text-white disabled:opacity-50"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Conversation */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            {/* Avatar */}
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5 ${msg.role === 'user' ? '' : ''}`}
              style={{
                background: msg.role === 'user'
                  ? 'linear-gradient(135deg, #06b6d4, #8b5cf6)'
                  : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
              }}>
              {msg.role === 'user'
                ? <User className="w-3.5 h-3.5 text-white" />
                : <Bot className="w-3.5 h-3.5 text-white" />
              }
            </div>

            {/* Bubble */}
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'}`}
              style={msg.role === 'user'
                ? { background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.15))', border: '1px solid rgba(139,92,246,0.2)', color: '#e2e8f0' }
                : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#cbd5e1' }
              }>
              {/* Render code blocks in AI responses */}
              {msg.role === 'assistant'
                ? <AssistantMessage content={msg.content} />
                : msg.content
              }
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isChatting && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}>
              <Bot className="w-3.5 h-3.5 text-white" />
            </div>
            <div className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              {[0, 1, 2].map(i => (
                <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-end gap-2 rounded-xl px-3 py-2"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Sparkles className="w-4 h-4 text-slate-600 flex-shrink-0 mb-1" />
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your code… (Enter to send)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none resize-none leading-relaxed"
            style={{ maxHeight: '100px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isChatting}
            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #ec4899)' }}
          >
            <Send className="w-3.5 h-3.5 text-white" />
          </button>
        </div>
        <p className="text-[10px] text-slate-600 mt-1.5 text-center">Shift+Enter for new line · Enter to send</p>
      </div>
    </div>
  );
};

/* ── Renders AI message with inline code block support ── */
const AssistantMessage: React.FC<{ content: string }> = ({ content }) => {
  const parts = content.split(/(```[\s\S]*?```)/g);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.slice(3, -3).split('\n');
          const lang = lines[0].trim();
          const code = lines.slice(lang ? 1 : 0).join('\n');
          return (
            <pre key={i} className="mt-2 mb-2 rounded-xl px-3 py-2.5 text-xs font-mono text-slate-300 overflow-x-auto"
              style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {code}
            </pre>
          );
        }
        return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
      })}
    </>
  );
};

export default ChatPanel;
