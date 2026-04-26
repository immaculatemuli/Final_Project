import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { BrowserRouter } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';

const rootEl = document.getElementById('root');

if (!rootEl) {
  throw new Error('Root element #root was not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <AppErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </StrictMode>
);
