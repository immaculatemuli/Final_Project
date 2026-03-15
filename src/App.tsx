import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from './firebase';
import { GoogleAuth } from './components/GoogleAuth';
import { HomePage } from './components/HomePage';
import { LandingPage } from './components/LandingPage';
import HistoryPage from './components/HistoryPage';
import { SnippetsPage } from './components/SnippetsPage';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLanding, setShowLanding] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'history' | 'snippets'>('home');
  const [restoredAnalysis, setRestoredAnalysis] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
      // Skip landing/auth screens for already-authenticated users so that
      // share links (e.g. ?session=xyz) go straight to the app.
      if (u) {
        setShowLanding(false);
        setShowAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (u: User) => {
    setUser(u);
    setShowAuth(false);
  };

  const handleGetStarted = () => {
    setShowLanding(false);
    setShowAuth(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#040d1a' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400 text-sm">Loading…</p>
        </div>
      </div>
    );
  }

  // Always show landing page on first load
  if (showLanding) {
    return <LandingPage onGetStarted={handleGetStarted} />;
  }

  // Show auth page when coming from landing, or when not signed in
  if (showAuth || !user) {
    return <GoogleAuth onAuthSuccess={handleAuthSuccess} />;
  }

  if (currentView === 'history') {
    return (
      <HistoryPage
        user={user}
        onNavigate={(view) => setCurrentView(view as any)}
        onRestore={(analysis) => {
          setRestoredAnalysis(analysis);
          setCurrentView('home');
        }}
      />
    );
  }

  if (currentView === 'snippets') {
    return (
      <SnippetsPage
        user={user}
        onNavigate={(view) => setCurrentView(view as any)}
        onRestoreSnippet={(code, analysis) => {
          setRestoredAnalysis({ ...analysis, codeSnippet: code });
          setCurrentView('home');
        }}
      />
    );
  }

  return (
    <HomePage
      user={user}
      onNavigate={(view) => setCurrentView(view as any)}
      restoredAnalysis={restoredAnalysis}
      clearRestoredAnalysis={() => setRestoredAnalysis(null)}
    />
  );
}

export default App;
