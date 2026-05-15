import { useState } from 'react';
import {
  hashCredentials,
  checkAccountExists,
  registerAccount,
  saveSession,
} from '../../services/auth';

type Mode = 'idle' | 'busy';

interface Props {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<Mode>('idle');
  const [error, setError] = useState<string | null>(null);
  const [askCreate, setAskCreate] = useState<{ hash: string } | null>(null);

  async function tryLogin(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setAskCreate(null);

    const u = username.trim();
    if (u.length < 3) {
      setError('帳號至少 3 個字');
      return;
    }
    if (password.length < 8) {
      setError('密碼至少 8 個字');
      return;
    }

    setMode('busy');
    try {
      const hash = await hashCredentials(u, password);
      const exists = await checkAccountExists(hash);
      if (exists) {
        saveSession(u, hash);
        onSuccess();
      } else {
        setAskCreate({ hash });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '登入失敗');
    } finally {
      setMode('idle');
    }
  }

  async function confirmCreate() {
    if (!askCreate) return;
    setMode('busy');
    setError(null);
    try {
      await registerAccount(askCreate.hash);
      saveSession(username.trim(), askCreate.hash);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : '建立帳號失敗');
    } finally {
      setMode('idle');
      setAskCreate(null);
    }
  }

  return (
    <div className="login-root">
      <div className="login-card">
        <h1 className="login-brand">
          <em>胖齊肥柔去走走</em>
        </h1>
        <p className="login-tagline">登入後跨裝置同步行程</p>

        <form className="login-form" onSubmit={tryLogin}>
          <label className="login-field">
            <span className="login-label">帳號</span>
            <input
              type="text"
              className="login-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例：vincent"
              autoComplete="username"
              disabled={mode === 'busy'}
            />
          </label>

          <label className="login-field">
            <span className="login-label">密碼</span>
            <input
              type="password"
              className="login-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 8 字"
              autoComplete="current-password"
              disabled={mode === 'busy'}
            />
          </label>

          {error && <div className="login-error">{error}</div>}

          {!askCreate && (
            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={mode === 'busy'}
            >
              {mode === 'busy' ? '驗證中…' : '登入'}
            </button>
          )}

          {askCreate && (
            <div className="login-create-prompt">
              <div className="login-create-text">
                找不到「<strong>{username.trim()}</strong>」這個帳號。要用這組帳號密碼新建一個嗎？
              </div>
              <div className="login-create-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setAskCreate(null)}
                  disabled={mode === 'busy'}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmCreate}
                  disabled={mode === 'busy'}
                >
                  {mode === 'busy' ? '建立中…' : '建立新帳號'}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="login-hint">
          <strong>注意</strong>：忘記密碼沒有救援機制（資料 hash 不可逆）。請用密碼管理器存好。
        </div>
      </div>
    </div>
  );
}
