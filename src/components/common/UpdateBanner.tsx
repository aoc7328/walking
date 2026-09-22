import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/**
 * 有新版時跳一條提示。
 *
 * 為什麼需要：這是 PWA，Service Worker 會把整包前端快取起來。原本設
 * `registerType: 'autoUpdate'`，行為是「下次載入時背景更新、再下次才生效」——
 * 使用者要重整兩次才看得到新版。自己一個人用無所謂，多人版的話每次部署之後
 * 都會有人跑在舊版上，回報的 bug 可能早就修好了，很難查。
 *
 * 改成由使用者自己決定時機：偵測到新版就跳提示，按下去才重新載入。
 */
export default function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [reload, setReload] = useState<(() => void) | null>(null);

  useEffect(() => {
    const update = registerSW({
      immediate: true,
      onNeedRefresh() {
        // 存成函式的回傳值，不然 setState 會把它當成 updater 呼叫掉
        setReload(() => () => void update(true));
        setReady(true);
      },
    });
  }, []);

  if (!ready) return null;

  return (
    <div className="upd-banner" role="status">
      <span className="upd-text">有新版本可以用了</span>
      <button className="upd-btn" onClick={() => reload?.()}>
        重新載入
      </button>
      <button className="upd-close" onClick={() => setReady(false)} aria-label="稍後再說">
        ×
      </button>
    </div>
  );
}
