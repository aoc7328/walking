import { useEffect, useRef, useState } from 'react';
import { getAuthMode } from '../../services/auth';

interface Session {
  ok: boolean;
  user?: { name: string; email: string; picture: string };
  quota?: { used: number; limit: number };
}

/**
 * 帳號按鈕：顯示目前登入的人，點開可以看配額與登出。
 *
 * 只在多人版（Google 登入）出現。單人版是一組共用密碼、也只有他一個人用，
 * 多一顆登出鈕只會擋路，所以偵測到密碼版就整個不渲染。
 */
export default function AccountButton({ compact = false }: { compact?: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    void getAuthMode().then(async (mode) => {
      if (mode !== 'google' || !alive) return;
      try {
        const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
        if (alive && res.ok) setSession(await res.json());
      } catch {
        // 拿不到就不顯示，不要因為這顆鈕擋住整個畫面
      }
    });
    return () => { alive = false; };
  }, []);

  // 點外面就收起來
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  if (!session?.ok || !session.user) return null;
  const { name, email, picture } = session.user;

  async function logout() {
    setBusy(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // 就算請求失敗也重整——cookie 可能已經清掉了
    }
    window.location.href = '/';
  }

  return (
    <div className="acct" ref={boxRef}>
      <button
        className={`acct-btn${compact ? ' compact' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title={`${name}（${email}）`}
        aria-expanded={open}
      >
        {picture ? <img className="acct-avatar" src={picture} alt="" referrerPolicy="no-referrer" /> : <span className="acct-avatar acct-avatar-fallback">{name.slice(0, 1)}</span>}
        {!compact && <span className="acct-name">{name}</span>}
      </button>

      {open && (
        <div className="acct-menu">
          <div className="acct-who">
            <div className="acct-who-name">{name}</div>
            <div className="acct-who-mail">{email}</div>
          </div>
          {session.quota && (
            <div className="acct-quota">
              行程 {session.quota.used} / {session.quota.limit}
            </div>
          )}
          <button className="acct-logout" onClick={() => void logout()} disabled={busy}>
            {busy ? '登出中…' : '登出'}
          </button>
        </div>
      )}
    </div>
  );
}
