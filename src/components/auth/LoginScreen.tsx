import { useEffect, useState } from 'react';
import { getAuthMode, verifyPassword, type AuthMode } from '../../services/auth';

interface Props {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: Props) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** null = 還在問後端要顯示哪一種登入 */
  const [mode, setMode] = useState<AuthMode | null>(null);

  useEffect(() => {
    let alive = true;
    void getAuthMode().then((m) => {
      if (alive) setMode(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function unlock(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (await verifyPassword(password)) {
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
        <p className="login-tagline">{mode === 'google' ? '用 Google 帳號登入' : '輸入密碼解鎖'}</p>

        {mode === null && <div className="login-hint">載入中…</div>}

        {mode === 'google' && (
          <>
            {/* 走整頁跳轉而不是 fetch：OAuth 同意畫面本來就得離開這一頁 */}
            <a className="btn btn-primary login-submit login-google" href="/api/auth/google">
              使用 Google 登入
            </a>
            <div className="login-hint">
              我們只會拿到你的姓名、信箱與大頭貼，用來認得你是誰。
              <strong>不會</strong>讀取你的 Gmail、雲端硬碟或通訊錄。
              <br />
              登入即表示你同意
              <a href="/terms.html" target="_blank" rel="noreferrer">服務條款</a>
              與
              <a href="/privacy.html" target="_blank" rel="noreferrer">隱私權政策</a>。
            </div>
          </>
        )}

        {mode === 'password' && (
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
        )}

        {mode === 'password' && (
          <div className="login-hint">
            解鎖過的裝置會記住，下次開不用再打。密碼打錯只是進不來，<strong>不會動到任何行程資料</strong>。
          </div>
        )}
      </div>
    </div>
  );
}
