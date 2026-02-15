import React, { useState } from 'react';
import { signInWithPopup, signOut, User, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Chrome, LogOut, User as UserIcon } from 'lucide-react';

interface GoogleAuthProps {
  onAuthSuccess: (user: User) => void;
}

export const GoogleAuth: React.FC<GoogleAuthProps> = ({ onAuthSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      console.log('Google sign-in successful:', user);
      onAuthSuccess(user);
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      setError(error.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        if (displayName) {
          await updateProfile(cred.user, { displayName });
        }
        onAuthSuccess(cred.user);
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        onAuthSuccess(cred.user);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error: any) {
      console.error('Sign out error:', error);
      setError('Failed to sign out');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-8 w-full max-w-md shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserIcon className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI Code Review</h1>
          <p className="text-gray-300">Sign in to start analyzing your code</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-center text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3">
          <form onSubmit={handleEmailSubmit} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="Display name"
                className="w-full p-3 bg-gray-900/50 border border-white/20 rounded-lg text-white focus:outline-none"
              />
            )}
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email"
              required
              className="w-full p-3 bg-gray-900/50 border border-white/20 rounded-lg text-white focus:outline-none"
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              required
              className="w-full p-3 bg-gray-900/50 border border-white/20 rounded-lg text-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? (mode === 'signup' ? 'Creating account...' : 'Signing in...') : (mode === 'signup' ? 'Create account' : 'Sign in')}
            </button>
          </form>
          <div className="flex items-center justify-center text-gray-300 text-sm">
            <span className="mr-2">or</span>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-900 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              <Chrome className="w-4 h-4 text-red-500" />
              <span>Continue with Google</span>
            </button>
          </div>
          <div className="text-center text-sm text-gray-300">
            {mode === 'signin' ? (
              <button onClick={() => setMode('signup')} className="text-blue-300 hover:underline">Create an account</button>
            ) : (
              <button onClick={() => setMode('signin')} className="text-blue-300 hover:underline">Have an account? Sign in</button>
            )}
          </div>
        </div>

        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            By signing in, you agree to our terms of service and privacy policy
          </p>
        </div>
      </div>
    </div>
  );
};

interface UserProfileProps {
  user: User;
  onSignOut: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ user, onSignOut }) => {
  return (
    <div className="flex items-center space-x-3">
      <img
        src={user.photoURL || ''}
        alt={user.displayName || 'User'}
        className="w-8 h-8 rounded-full border-2 border-gray-600"
      />
      <div className="hidden md:block">
        <p className="text-sm font-medium text-white">{user.displayName}</p>
        <p className="text-xs text-gray-400">{user.email}</p>
      </div>
      <button
        onClick={onSignOut}
        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
        title="Sign Out"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};