import { useState } from 'react';
import AppShell from './components/layout/AppShell';
import LoginScreen from './components/auth/LoginScreen';
import { isLoggedIn } from './services/auth';

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => isLoggedIn());

  if (!authed) {
    return <LoginScreen onSuccess={() => setAuthed(true)} />;
  }
  return <AppShell />;
}
