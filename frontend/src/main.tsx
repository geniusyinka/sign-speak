import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import { SettingsProvider } from './context/SettingsContext.tsx';
import { ConversationProvider } from './context/ConversationContext.tsx';
import './styles/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SettingsProvider>
      <ConversationProvider>
        <App />
      </ConversationProvider>
    </SettingsProvider>
  </StrictMode>
);
