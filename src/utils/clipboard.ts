/**
 * 把字串塞進剪貼簿。失敗回 false（給 caller 顯示 fallback 提示）。
 * 手機瀏覽器在非 HTTPS / 舊版 WebView 下沒有 navigator.clipboard，所以留了 textarea 的老方法。
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
