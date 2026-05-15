import { useEffect, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { getUserId, setUserId } from '../../services/identity';

export default function UserIdModal() {
  const open = useUIStore((s) => s.userIdModalOpen);
  const close = useUIStore((s) => s.closeUserIdModal);

  const [currentId, setCurrentId] = useState('');
  const [newId, setNewId] = useState('');
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrentId(getUserId());
      setNewId('');
      setCopyState('idle');
      setErrMsg(null);
    }
  }, [open]);

  if (!open) return null;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(currentId);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      // ignore
    }
  }

  function handleSwitch() {
    setErrMsg(null);
    try {
      setUserId(newId);
      // 重新整理讓全 app 用新 userId 拉資料
      window.location.reload();
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : '切換失敗');
    }
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
          <h2 className="modal-title">同步 ID</h2>
          <p className="modal-subtitle">
            複製這串 ID 到另一台裝置，貼到下方欄位、套用後重新載入，就能看到一樣的行程。
          </p>

          <div className="user-id-row">
            <label className="user-id-label">這台裝置目前的 ID</label>
            <div className="user-id-input-row">
              <input
                className="share-url-input"
                type="text"
                value={currentId}
                readOnly
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button className="btn" onClick={handleCopy}>
                {copyState === 'copied' ? '已複製' : '複製'}
              </button>
            </div>
          </div>

          <div className="user-id-row">
            <label className="user-id-label">切換到另一個 ID（從別的裝置複製過來）</label>
            <div className="user-id-input-row">
              <input
                className="share-url-input"
                type="text"
                value={newId}
                placeholder="貼入 32 字元的同步 ID…"
                onChange={(e) => setNewId(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={handleSwitch}
                disabled={!newId.trim() || newId.trim() === currentId}
              >
                套用並重新整理
              </button>
            </div>
            {errMsg && <div className="user-id-error">{errMsg}</div>}
          </div>

          <div className="user-id-hint">
            <strong>注意</strong>：行程儲存在 Cloudflare KV，不同 ID 看到不同資料。
            <br />
            ID 丟了沒救——複製到密碼管理器或筆記裡備份。
          </div>

          <div className="modal-actions">
            <button className="btn" onClick={close}>
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
