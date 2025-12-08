import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import { auth } from './firebase';
import { GoogleAuth } from './components/GoogleAuth';
// import { HomePage } from './components/HomePage';
// import { Routes, Route } from 'react-router-dom';
import HistoryPage from './components/HistoryPage';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
    return <GoogleAuth onAuthSuccess={handleAuthSuccess} />;
  }

  return (
    <Routes>
      {/* <Route path="/" element={<HomePage user={user} />} />
      <Route path="/history" element={<HistoryPage user={user} />} /> */}
    </Routes>
  );
}

export default App;
