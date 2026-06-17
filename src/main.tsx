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
  const hash = window.location.hash;
  return hash.startsWith('#view=') || hash.startsWith('#v=');
}

createRoot(rootEl).render(
  <StrictMode>
    {isViewerRoute() ? <TripViewer /> : <App />}
  </StrictMode>,
);

// PWA：部署新版後，新的 service worker 接管時自動重新整理，
// 避免使用者一直停在舊快取版本（首次安裝不重載，只有「換版」才重載）。
if ('serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    if (hadController) window.location.reload();
  });
}
