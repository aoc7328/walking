/**
 * 同步 ID：辨認「這台裝置代表哪個使用者」。
 * 第一次造訪自動產生 32 字元 hex，存在 localStorage。
 * 想跨裝置同步：到 Settings 看 ID，貼到另一台。
 */

const KEY = 'walking.userId';

function generate(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

export function getUserId(): string {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[a-f0-9]{16,40}$/i.test(id)) {
      id = generate();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // 私密模式或 localStorage 壞掉，每次產一個（暫時的）
    return generate();
  }
}

/** 切換到別的同步 ID（從另一台裝置複製過來） */
export function setUserId(raw: string): void {
  const cleaned = raw.trim().toLowerCase().replace(/[^a-f0-9]/g, '');
  if (cleaned.length < 16) {
    throw new Error('同步 ID 長度不夠（需要至少 16 個十六進位字元）');
  }
  localStorage.setItem(KEY, cleaned);
}

/** 截短顯示：a3b2c1d4e5-1234abcd → a3b2c1d4 … 1234abcd */
export function formatUserIdShort(id: string): string {
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}
