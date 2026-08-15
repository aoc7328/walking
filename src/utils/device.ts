/**
 * 裝置判斷：決定登入後要給「手機版（唯讀看行程）」還是「電腦版（完整編輯）」。
 *
 * 前提：排行程一律在電腦上做；手機進來只是要看今天去哪、然後開 Google 導航。
 * 所以手機版是刻意閹掉的——不畫地圖、不編輯、不寫 KV。
 *
 * 判斷順序：
 *   1. 手動覆寫（網址 `?ui=mobile` / `?ui=desktop`，會記進 localStorage 當長期偏好）
 *   2. 自動偵測（UA 是手機，或「觸控螢幕 + 短邊 ≤ 820px」——後者才抓得到假裝成 Mac 的 iPad）
 *
 * 刻意只在啟動時判斷一次：桌機把視窗拉窄不該把正在排的行程換成唯讀版。
 */

const UI_MODE_KEY = 'walking.uiMode';

export type UIMode = 'mobile' | 'desktop';

function readStoredMode(): UIMode | null {
  try {
    const v = localStorage.getItem(UI_MODE_KEY);
    return v === 'mobile' || v === 'desktop' ? v : null;
  } catch {
    return null; // 無痕模式 / 禁用儲存
  }
}

export function setUIMode(mode: UIMode): void {
  try {
    localStorage.setItem(UI_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

/** 清掉手動偏好，回到自動判斷。 */
export function clearUIMode(): void {
  try {
    localStorage.removeItem(UI_MODE_KEY);
  } catch {
    // ignore
  }
}

/** 網址帶 ?ui=mobile|desktop → 存成偏好並回傳；沒帶回 null。 */
function readUrlOverride(): UIMode | null {
  try {
    const v = new URLSearchParams(window.location.search).get('ui');
    if (v === 'mobile' || v === 'desktop') {
      setUIMode(v);
      return v;
    }
  } catch {
    // ignore
  }
  return null;
}

/** 這台裝置「實際上」是不是手機/平板（不看手動偏好）。 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent ?? '';
  if (/Android|iPhone|iPod|Windows Phone|IEMobile|BlackBerry|Opera Mini/i.test(ua)) return true;
  // iPadOS 13+ 的 Safari UA 會偽裝成 Mac，抓不到關鍵字；改用「粗指標（手指）+ 螢幕短邊不大」認。
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return coarse && shortSide <= 820;
}

/** 這次要不要用手機版介面。 */
export function isMobileUI(): boolean {
  const override = readUrlOverride() ?? readStoredMode();
  if (override) return override === 'mobile';
  return isTouchDevice();
}
