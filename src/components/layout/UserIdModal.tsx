import { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { getUsername, logout } from '../../services/auth';

export default function UserIdModal() {
  const open = useUIStore((s) => s.userIdModalOpen);
  const close = useUIStore((s) => s.closeUserIdModal);
  const [username, setUsername] = useState('');

  useEffect(() => {
    if (open) {
      setUsername(getUsername() ?? '(未知)');
    }
  }, [open]);

  if (!open) return null;

  function handleLogout() {
    const ok = window.confirm(
      '登出後這台裝置看不到行程，但雲端資料還在。確定登出？',
    );
    if (!ok) return;
    logout();
    window.location.reload();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal">
        <div className="modal-date">
          <h2 className="modal-title">帳號</h2>
          <p className="modal-subtitle">行程透過你的帳號雜湊存在 Cloudflare KV，跨裝置同步</p>

          <div className="account-row">
            <span className="account-label">目前登入</span>
            <span className="account-value">{username}</span>
          </div>

          <div className="user-id-hint">
            <strong>跨裝置使用</strong>：在另一台裝置打開站台、用同一組「帳號 + 密碼」登入，就能看到一樣的行程。
            <br />
            <strong>忘記密碼</strong>：無法救援。請用密碼管理器存好。
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={close}>
              關閉
            </button>
            <button className="btn btn-warm" onClick={handleLogout}>
              登出
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
