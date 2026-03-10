import React, { useEffect, useRef, useState } from 'react';
import { Code2, Shield, Zap, ArrowRight, CheckCircle2, Terminal, Cpu, BarChart3, Lock } from 'lucide-react';

interface LandingPageProps {
  onGetStarted: () => void;
}

const FEATURES = [
  {
    icon: Code2,
    title: 'Deep Code Analysis',
    description: 'Instant, comprehensive review of logic, complexity, and maintainability across any language.',
    color: 'cyan',
    gradient: 'from-cyan-500/20 to-cyan-600/5',
    border: 'rgba(6,182,212,0.3)',
    glow: 'rgba(6,182,212,0.12)',
  },
  {
    icon: Shield,
    title: 'Security Scanning',
    description: 'Deep OWASP Top-10 analysis catches injections, insecure dependencies, and auth flaws instantly.',
    color: 'violet',
    gradient: 'from-violet-500/20 to-violet-600/5',
    border: 'rgba(139,92,246,0.3)',
    glow: 'rgba(139,92,246,0.12)',
  },
  {
    icon: Shield,
    title: 'Security Scanning',
    description: 'Detect CVEs, injection flaws, exposed secrets, and OWASP Top-10 vulnerabilities automatically.',
    color: 'pink',
    gradient: 'from-pink-500/20 to-pink-600/5',
    border: 'rgba(236,72,153,0.3)',
    glow: 'rgba(236,72,153,0.12)',
  },
  {
    icon: Zap,
    title: 'AI-Powered Fixes',
    description: 'One-click Auto-Fix applies Llama 3.3 70B patches and re-analyzes to verify every improvement.',
    color: 'amber',
    gradient: 'from-amber-500/20 to-amber-600/5',
    border: 'rgba(245,158,11,0.3)',
    glow: 'rgba(245,158,11,0.12)',
  },
];

const STATS = [
  { value: '10K+', label: 'Code Reviews', color: '#06b6d4' },
  { value: '98%', label: 'Accuracy Rate', color: '#8b5cf6' },
  { value: '< 5s', label: 'Avg Analysis', color: '#ec4899' },
  { value: '12+', label: 'Languages', color: '#f59e0b' },
];

const CODE_LINES = [
  { prefix: '01', content: 'function processPayment(amount, user) {', color: '#67e8f9' },
  { prefix: '02', content: '  const query = `SELECT * FROM users', color: '#e2e8f0' },
  { prefix: '03', content: '    WHERE id = ${user.id}`;', color: '#fca5a5', warn: true },
  { prefix: '04', content: '  db.execute(query);', color: '#fca5a5', warn: true },
  { prefix: '05', content: '}', color: '#67e8f9' },
];

const ISSUES_DEMO = [
  { sev: 'critical', label: 'SQL Injection', line: 3 },
  { sev: 'high', label: 'Unvalidated Input', line: 4 },
  { sev: 'medium', label: 'Missing Auth Check', line: 1 },
];

// Particle component
const Particle: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div
    className="absolute w-1 h-1 rounded-full bg-cyan-400/60"
    style={{ animation: 'particle-drift 4s ease-out infinite', ...style }}
  />
);

export const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
  const [navScrolled, setNavScrolled] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setNavScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const particles = Array.from({ length: 14 }, (_, i) => ({
    style: {
      left: `${(i * 7.3) % 100}%`,
      top: `${(i * 13.7) % 80}%`,
      animationDelay: `${i * 0.31}s`,
      animationDuration: `${3 + (i % 3)}s`,
    },
  }));

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: '#040d1a', color: '#f1f5f9' }}>

      {/* ── Navigation ──────────────────────────────── */}
      <nav
        className="fixed top-0 w-full z-50 transition-all duration-300"
        style={{
          background: navScrolled ? 'rgba(4,13,26,0.85)' : 'transparent',
          backdropFilter: navScrolled ? 'blur(24px)' : 'none',
          borderBottom: navScrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="relative w-9 h-9">
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 opacity-20 blur-sm" />
              <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-white" />
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight text-aurora">Intellicode</span>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
            {['Features', 'How it Works', 'Pricing'].map(l => (
              <a key={l} href="#" className="hover:text-white transition-colors duration-200">{l}</a>
            ))}
          </div>

          {/* CTA */}
          <button
            onClick={onGetStarted}
            className="btn-glow relative px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
          >
            <span className="relative z-10">Sign In →</span>
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────── */}
      <section ref={heroRef} className="relative min-h-screen flex items-center pt-20 overflow-hidden">

        {/* Ambient blobs */}
        <div className="blob w-[600px] h-[600px] top-[-100px] left-[-200px]"
          style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.12), transparent 70%)' }} />
        <div className="blob w-[500px] h-[500px] bottom-[-150px] right-[-100px]"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.12), transparent 70%)' }} />

        {/* Dot grid */}
        <div className="dot-grid absolute inset-0 opacity-40" />

        {/* Floating particles */}
        {particles.map((p, i) => <Particle key={i} style={p.style} />)}

        <div className="relative max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center py-20">

          {/* Left copy */}
          <div className="space-y-8">
            <div className="animate-slide-up">
              <span className="tag neon-border text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                Llama 3.3 70B Powered
              </span>
            </div>

            <h1 className="animate-slide-up delay-100 text-5xl sm:text-6xl font-extrabold leading-tight tracking-tight hero-title">
              Write{' '}
              <span className="text-aurora">Smarter</span>
              {' '}Code,{' '}
              <br />Ship{' '}
              <span className="text-aurora">Faster</span>
            </h1>

            <p className="animate-slide-up delay-200 text-lg text-slate-400 leading-relaxed max-w-lg">
              Intellicode AI reviews your code in under 5 seconds — spotting security flaws,
              performance bottlenecks, and logic bugs. Then fixes them automatically.
            </p>

            <div className="animate-slide-up delay-300 flex flex-col sm:flex-row gap-4">
              <button
                onClick={onGetStarted}
                className="btn-glow group relative px-8 py-4 rounded-xl text-base font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
              >
                Start Free Analysis
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="glass glass-hover px-8 py-4 rounded-xl text-base font-semibold text-slate-300 flex items-center justify-center gap-2">
                <Terminal className="w-4 h-4 text-cyan-400" />
                View Live Demo
              </button>
            </div>

            {/* Stats row */}
            <div className="animate-slide-up delay-400 grid grid-cols-2 sm:grid-cols-4 gap-6 pt-6 border-t border-white/5">
              {STATS.map((s) => (
                <div key={s.label} className="space-y-1">
                  <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-xs text-slate-500 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live code preview card */}
          <div className="animate-float hidden lg:block">
            <div className="relative">
              {/* Glow behind card */}
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-violet-500/10 rounded-3xl blur-2xl" />

              <div className="relative glass rounded-2xl overflow-hidden scanlines">
                {/* Card header */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-white/5"
                  style={{ background: 'rgba(0,0,0,0.3)' }}>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                    <div className="w-3 h-3 rounded-full bg-green-500/80" />
                  </div>
                  <span className="ml-2 text-xs text-slate-500 font-mono">payment.js — Intellicode Analysis</span>
                </div>

                {/* Code area */}
                <div className="p-5 font-mono text-sm">
                  {CODE_LINES.map((line) => (
                    <div key={line.prefix}
                      className="flex items-start gap-4 py-0.5 rounded px-1"
                      style={line.warn ? { background: 'rgba(239,68,68,0.08)' } : {}}>
                      <span className="line-number">{line.prefix}</span>
                      <span style={{ color: line.color }}>{line.content}</span>
                      {line.warn && (
                        <span className="ml-auto text-red-400 text-xs flex-shrink-0">⚠ SQL Injection</span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Issues panel */}
                <div className="border-t border-white/5 p-4 space-y-2"
                  style={{ background: 'rgba(0,0,0,0.2)' }}>
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BarChart3 className="w-3 h-3 text-cyan-400" />
                    Issues Found
                  </div>
                  {ISSUES_DEMO.map((issue) => (
                    <div key={issue.label}
                      className="flex items-center justify-between rounded-lg px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <div className="flex items-center gap-2">
                        <span className={`badge-${issue.sev} tag text-xs`}>{issue.sev}</span>
                        <span className="text-sm text-slate-300">{issue.label}</span>
                      </div>
                      <span className="text-xs text-slate-500 font-mono">L{issue.line}</span>
                    </div>
                  ))}

                  {/* Score */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-sm text-slate-400">Health Score</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-red-500 to-orange-500" />
                      </div>
                      <span className="text-sm font-bold text-orange-400">42/100</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 glass neon-border rounded-xl px-4 py-2 flex items-center gap-2 shadow-xl">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold text-green-400">Auto-Fix Ready</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────── */}
      <section id="features" className="py-28 px-6 relative">
        <div className="blob w-[400px] h-[400px] top-20 right-20"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.08), transparent 70%)' }} />

        <div className="max-w-7xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <div className="tag neon-border text-violet-400 mx-auto inline-flex">Core Capabilities</div>
            <h2 className="text-4xl sm:text-5xl font-extrabold">
              Everything your code{' '}
              <span className="text-aurora">needs</span>
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto text-lg">
              A full-stack intelligence platform built for professional developers who ship fast and break nothing.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="glass glass-hover feature-card rounded-2xl p-6 space-y-4 relative overflow-hidden"
                >
                  {/* Top gradient accent */}
                  <div className="absolute top-0 left-0 right-0 h-px"
                    style={{ background: `linear-gradient(90deg, transparent, ${f.border}, transparent)` }} />

                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center`}
                    style={{ border: `1px solid ${f.border}` }}>
                    <Icon className="w-5 h-5" style={{ color: f.border.replace('0.3', '1').replace('a)', ')') }} />
                  </div>

                  <div>
                    <h3 className="text-base font-bold mb-2">{f.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{f.description}</p>
                  </div>

                  {/* Bottom glow */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                    style={{ background: `radial-gradient(ellipse at 50% 100%, ${f.glow}, transparent)` }} />
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────── */}
      <section className="py-28 px-6 relative" style={{ background: 'rgba(255,255,255,0.01)' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center space-y-4 mb-20">
            <div className="tag neon-border text-cyan-400 mx-auto inline-flex">How it Works</div>
            <h2 className="text-4xl sm:text-5xl font-extrabold">
              Analysis in <span className="text-aurora">3 steps</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                icon: Code2,
                title: 'Paste Your Code',
                desc: 'Drop in a snippet or upload a file. Any language, any size.',
                color: '#06b6d4',
              },
              {
                step: '02',
                icon: Cpu,
                title: 'AI Reviews Instantly',
                desc: 'Llama 3.3 70B scans for security, performance, and logic issues in under 5 seconds.',
                color: '#8b5cf6',
              },
              {
                step: '03',
                icon: Zap,
                title: 'Fix with One Click',
                desc: 'Auto-Fix patches every issue, then re-analyzes to prove the score improved.',
                color: '#ec4899',
              },
            ].map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.step} className="relative group">
                  {/* Connector line */}
                  {i < 2 && (
                    <div className="hidden md:block absolute top-8 left-full w-full h-px z-10"
                      style={{
                        background: 'linear-gradient(90deg, rgba(6,182,212,0.4), rgba(6,182,212,0.05))',
                        width: 'calc(100% - 4rem)',
                        marginLeft: '2rem',
                      }} />
                  )}
                  <div className="glass glass-hover rounded-2xl p-8 space-y-4 text-center">
                    <div className="relative w-16 h-16 mx-auto">
                      <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        style={{ background: `radial-gradient(circle, ${s.color}20, transparent)` }} />
                      <div className="w-16 h-16 rounded-full flex items-center justify-center"
                        style={{ background: `${s.color}15`, border: `1px solid ${s.color}40` }}>
                        <Icon className="w-7 h-7" style={{ color: s.color }} />
                      </div>
                      <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center"
                        style={{ background: s.color, color: '#040d1a' }}>{s.step}</div>
                    </div>
                    <h3 className="text-lg font-bold">{s.title}</h3>
                    <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Benefits ────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div>
              <div className="tag neon-border text-pink-400 mb-6 inline-flex">Why Teams Choose Us</div>
              <h2 className="text-4xl sm:text-5xl font-extrabold leading-tight">
                Built for modern{' '}
                <span className="text-aurora">developer teams</span>
              </h2>
            </div>

            <div className="space-y-4">
              {[
                { icon: Lock, text: 'Enterprise-grade security scanning (OWASP Top-10)' },
                { icon: Zap, text: 'Sub-5-second analysis with Llama 3.3 70B' },
                { icon: BarChart3, text: 'Real-time quality metrics with visual progress bars' },
                { icon: Code2, text: 'Multi-file upload and folder scanning support' },
                { icon: Terminal, text: 'Collaborative sessions for live team code review' },
                { icon: CheckCircle2, text: 'Auto-Fix with automatic re-analysis verification' },
              ].map((b, i) => {
                const Icon = b.icon;
                return (
                  <div key={i} className="glass glass-hover rounded-xl px-4 py-3 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <span className="text-sm text-slate-300">{b.text}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Metrics card */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 to-cyan-500/10 rounded-3xl blur-2xl" />
            <div className="relative glass rounded-2xl p-8 space-y-6">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-400 uppercase tracking-widest">Sample Analysis</span>
                <span className="tag badge-low">Score: 91/100</span>
              </div>

              {[
                { label: 'Security', val: 95, color: '#06b6d4' },
                { label: 'Performance', val: 87, color: '#8b5cf6' },
                { label: 'Maintainability', val: 90, color: '#ec4899' },
                { label: 'Readability', val: 92, color: '#f59e0b' },
              ].map((m) => (
                <div key={m.label} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-slate-400">{m.label}</span>
                    <span className="text-sm font-bold" style={{ color: m.color }}>{m.val}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden progress-bar">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${m.val}%`, background: `linear-gradient(90deg, ${m.color}80, ${m.color})` }} />
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-white/5 grid grid-cols-3 gap-4">
                {[
                  { label: 'Issues', val: '3', color: '#fbbf24' },
                  { label: 'Smells', val: '1', color: '#06b6d4' },
                  { label: 'Debt', val: 'Low', color: '#4ade80' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <div className="text-xl font-bold" style={{ color: s.color }}>{s.val}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden">
            {/* Animated bg */}
            <div className="absolute inset-0"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.15), rgba(139,92,246,0.15), rgba(236,72,153,0.1))',
                backgroundSize: '300% 300%',
                animation: 'aurora 6s ease infinite',
              }} />
            <div className="absolute inset-0 border border-white/10 rounded-3xl" />

            <div className="relative p-12 sm:p-16 text-center space-y-8">
              <h2 className="text-4xl sm:text-5xl font-extrabold">
                Ready to write{' '}
                <span className="text-aurora">better</span>{' '}
                code?
              </h2>
              <p className="text-slate-300 text-lg max-w-xl mx-auto">
                Join thousands of developers who ship faster, safer code with Intellicode.
                Free to start — no credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={onGetStarted}
                  className="btn-glow group px-10 py-4 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="glass glass-hover px-10 py-4 rounded-xl font-semibold text-slate-300 text-base">
                  Learn More
                </button>
              </div>
              <p className="text-slate-500 text-sm">No credit card • Instant analysis • Cancel anytime</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────── */}
      <footer className="border-t border-white/5 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-10 mb-12">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
                  <Cpu className="w-4 h-4 text-white" />
                </div>
                <span className="font-bold text-aurora">Intellicode</span>
              </div>
              <p className="text-slate-500 text-sm leading-relaxed">AI-powered code intelligence for modern development teams.</p>
            </div>
            {[
              { title: 'Product', links: ['Features', 'Pricing', 'Changelog', 'FAQ'] },
              { title: 'Company', links: ['About', 'Blog', 'Careers', 'Contact'] },
              { title: 'Legal', links: ['Privacy', 'Terms', 'Security', 'Cookies'] },
            ].map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">{col.title}</h4>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l}>
                      <a href="#" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="border-t border-white/5 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-600">
            <span>© 2026 Intellicode · MKU Final Project. All rights reserved.</span>
            <div className="flex gap-6">
              {['Twitter', 'GitHub', 'LinkedIn'].map((s) => (
                <a key={s} href="#" className="hover:text-slate-300 transition-colors">{s}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
