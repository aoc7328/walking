import { useState } from 'react';
import { verifyPassword, saveUnlock } from '../../services/auth';

interface Props {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function unlock(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (await verifyPassword(password)) {
        saveUnlock();
        onSuccess();
      } else {
        setError('密碼不對');
        setPassword('');
      }
    } catch {
      setError('解鎖失敗，重新整理再試一次');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <h1 className="login-brand">
          <em>胖齊肥柔去走走</em>
        </h1>
        <p className="login-tagline">輸入密碼解鎖</p>

        <form className="login-form" onSubmit={unlock}>
          <label className="login-field">
            <span className="login-label">密碼</span>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={busy}
              /* eslint-disable-next-line jsx-a11y/no-autofocus */
              autoFocus
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="btn btn-primary login-submit" disabled={busy}>
            {busy ? '解鎖中…' : '解鎖'}
          </button>
        </form>

        <div className="login-hint">
          解鎖過的裝置會記住，下次開不用再打。密碼打錯只是進不來，<strong>不會動到任何行程資料</strong>。
        </div>
      </div>
    </div>
  );
}
