import React, { useState } from 'react';
import {
  signInWithPopup, signOut, User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword, updateProfile
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { LogOut, User as UserIcon, Cpu, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

interface GoogleAuthProps {
  onAuthSuccess: (user: User) => void;
}

/* ── SECTION: MAIN COMPONENT ──────────────────────── */
export const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthSuccess }) => {
  /* ── 1. States & User Setup ──────────────────── */
  const currentUser = auth.currentUser;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPass, setShowPass] = useState(false);

  /* ── 2. Google OAuth Logic ─────────────────────── */
  const handleGoogleSignIn = async () => {
    setError('');
    // Trigger popup IMMEDIATELY before any async state updates to prevent browser blocking
    try {
      const result = await signInWithPopup(auth, googleProvider);
      setLoading(true);
      onAuthSuccess(result.user);
    } catch (e: any) {
      if (e.code === 'auth/popup-blocked') {
        setError('The Google login window was blocked. Please click the "Pop-up blocked" icon in your browser address bar and allow it.');
      } else if (e.code === 'auth/cancelled-popup-request') {
        // User closed the popup, ignore or show minimal error
      } else {
        setError(e.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  /* ── 3. Email & Password Logic (Firebase) ──────── */
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) await updateProfile(cred.user, { displayName });
        onAuthSuccess(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(cred.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  /* ── SECTION: RENDER UI ─────────────────────────── */
  return (
    <div className="min-h-screen flex items-start justify-center relative overflow-x-hidden overflow-y-auto py-10"
      style={{ background: '#040d1a' }}>

      {/* Background blobs */}
      <div className="blob w-96 h-96 top-0 left-0"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.1), transparent 70%)' }} />
      <div className="blob w-96 h-96 bottom-0 right-0"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.1), transparent 70%)' }} />

      {/* Dot grid */}
      <div className="dot-grid absolute inset-0 opacity-30" />

      <div className="relative w-full max-w-md px-6 page-enter">

        {/* Logo */}
        <div className="text-center mb-8 space-y-3">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-extrabold text-aurora">Intellicode</span>
          </div>
          <p className="text-slate-400 text-sm">
            {mode === 'signin' ? 'Sign in to start analyzing your code' : 'Create your free account'}
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 space-y-5"
          style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* ── AUTH CARD CONTAINER ───────────────── */}

          {/* Already signed in — continue option */}
          {currentUser && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl px-4 py-3"
                style={{ background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.2)' }}>
                {currentUser.photoURL ? (
                  <img src={currentUser.photoURL} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
                    <UserIcon className="w-4 h-4 text-white" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{currentUser.displayName || 'Signed in'}</p>
                  <p className="text-xs text-slate-400 truncate">{currentUser.email}</p>
                </div>
              </div>
              <button
                onClick={() => onAuthSuccess(currentUser)}
                className="btn-glow w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
              >
                Continue as {currentUser.displayName?.split(' ')[0] || 'me'}
                <ArrowRight className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5" />
                <span className="text-xs text-slate-600">or sign in with a different account</span>
                <div className="flex-1 h-px bg-white/5" />
              </div>
            </div>
          )}

          {/* Tab switcher */}
          <div className="flex rounded-xl overflow-hidden p-1"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                style={mode === m
                  ? { background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', color: '#fff' }
                  : { color: '#64748b' }
                }
              >
                {m === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl px-4 py-3 text-sm text-red-400 flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span className="mt-0.5">⚠</span> {error}
            </div>
          )}

          {/* Form */}
          {/* ── EMAIL FORM SECTION ────────────────── */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Display name"
                  className="input-field pl-10"
                />
              </div>
            )}

            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="input-field pl-10"
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                required
                className="input-field pl-10 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-glow w-full py-3 rounded-xl font-bold text-white flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)' }}
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/5" />
            <span className="text-xs text-slate-600">or continue with</span>
            <div className="flex-1 h-px bg-white/5" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-semibold transition-all hover:bg-white/90 disabled:opacity-50"
            style={{ background: '#fff', color: '#111' }}
          >
            <FcGoogle className="w-5 h-5" />
            Continue with Google
          </button>

          <p className="text-center text-xs text-slate-600">
            By continuing, you agree to our{' '}
            <a href="#" className="text-cyan-500 hover:text-cyan-400">Terms of Service</a>{' '}
            and{' '}
            <a href="#" className="text-cyan-500 hover:text-cyan-400">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ── User Profile chip (used in header) ──────────────── */
interface UserProfileProps { user: User; onSignOut: () => void; }

export const UserProfile: React.FC<UserProfileProps> = ({ user, onSignOut }) => (
  <div className="flex items-center gap-3">
    {user.photoURL ? (
      <img src={user.photoURL} alt={user.displayName || 'User'}
        className="w-8 h-8 rounded-full ring-2 ring-cyan-500/40" />
    ) : (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center">
        <UserIcon className="w-4 h-4 text-white" />
      </div>
    )}
    <div className="hidden md:block">
      <p className="text-sm font-medium text-white leading-none">{user.displayName || 'User'}</p>
      <p className="text-xs text-slate-500 mt-0.5">{user.email}</p>
    </div>
    <button
      onClick={onSignOut}
      className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 transition-colors"
      title="Sign Out"
    >
      <LogOut className="w-4 h-4" />
    </button>
  </div>
);