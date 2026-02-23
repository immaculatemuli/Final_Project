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
  const [showAuth, setShowAuth] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'history' | 'snippets'>('home');
  const [restoredAnalysis, setRestoredAnalysis] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      setUser(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAuthSuccess = (user: User) => {
    setUser(user);
  };

  const handleGetStarted = () => {
    setShowAuth(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (!showAuth) {
      return <LandingPage onGetStarted={handleGetStarted} />;
    }
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
