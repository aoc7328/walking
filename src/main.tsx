import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import TripViewer from './components/share/TripViewer';
import './styles/index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('找不到 #root 容器');
}

function isViewerRoute(): boolean {
  return window.location.hash.startsWith('#view=');
}

createRoot(rootEl).render(
  <StrictMode>
    {isViewerRoute() ? <TripViewer /> : <App />}
  </StrictMode>,
);
