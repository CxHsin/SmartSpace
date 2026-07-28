import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

if (window.smartSpace !== undefined) {
  void window.smartSpace.app.getInfo({}).then((response) => {
    document.documentElement.dataset.smartSpaceIpc = response.ok ? 'ready' : 'error';
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
