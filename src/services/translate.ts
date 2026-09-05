/**
 * 中文 → 目的地語言的輕量翻譯（MyMemory 免費 API）。
 *
 * 只用在「要拿給當地人看」的自由欄位（訂位牌備考、證明申請牌的補充說明）。
 * 固定句型一律用手寫的對照表，不走這裡——現場出示的請求文不能靠機器翻譯，
 * 而且沒網路時也必須顯示得出來。
 *
 * 翻譯結果存 localStorage：手機在櫃台常常沒訊號，只要這段字在有網路時
 * 翻過一次，之後離線出示仍是翻好的內容。
 */

export type TranslateTarget = 'ja' | 'en';

const cache = new Map<string, string>();

const TR_CACHE_KEY = 'walking.trCache';
const TR_CACHE_MAX = 400;
let cacheLoaded = false;

function ensureCacheLoaded(): void {
  if (cacheLoaded) return;
  cacheLoaded = true;
  try {
    const raw = localStorage.getItem(TR_CACHE_KEY);
    if (!raw) return;
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, unknown>)) {
      if (typeof v === 'string') cache.set(k, v);
    }
  } catch {
    // 壞掉的快取直接無視
  }
}

function persistCache(): void {
  try {
    const obj: Record<string, string> = {};
    let n = 0;
    for (const [k, v] of cache) {
      if (n++ >= TR_CACHE_MAX) break;
      obj[k] = v;
    }
    localStorage.setItem(TR_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // 配額滿 / 無痕模式：純快取，失敗不影響功能
  }
}

/**
 * 這段文字是不是已經是目的地語言了？是的話絕對不能再送去翻。
 *
 * 使用者的「飲食習慣與語言需求」「補充」有時候本來就是用日文寫的，
 * 再丟一次 zh-TW→ja 會被弄壞：實際遇過「妻は少し英語が話せます」
 * 被翻成「私の妻は小さく、英語を話します」（我太太很小），而這張牌是要給店家看的。
 * - 日文：出現任何假名就一定是日文（中文不會有假名）。
 * - 英文：幾乎沒有中日文字元就當作已經是英文。
 */
function alreadyInTarget(text: string, target: TranslateTarget): boolean {
  if (target === 'ja') return /[\u3040-\u309F\u30A0-\u30FF]/.test(text);
  return !/[\u3000-\u9FFF\uFF00-\uFFEF]/.test(text);
}

/** 用 MyMemory 免費翻譯（zh-TW → 目的地語言）。失敗或警示就回原文。 */
export async function translateText(text: string, target: TranslateTarget): Promise<string> {
  const t = text.trim();
  if (!t) return '';
  if (alreadyInTarget(t, target)) return text;
  ensureCacheLoaded();
  const key = `${target}:${t}`;
  if (cache.has(key)) return cache.get(key)!;
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(t)}&langpair=${encodeURIComponent('zh-TW|' + target)}`;
    const res = await fetch(url);
    const data = await res.json();
    const out = data?.responseData?.translatedText;
    const ok = typeof out === 'string' && out && !/MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out);
    // 只快取「真的翻成功」的；失敗時回原文但不寫進快取，
    // 否則一次額度用盡就把未翻譯的中文永久留在快取裡。
    if (!ok) return text;
    cache.set(key, out);
    persistCache();
    return out;
  } catch {
    return text;
  }
}

/** 多行文字逐行翻譯，保留換行。 */
export async function translateLines(text: string, target: TranslateTarget): Promise<string> {
  const lines = text.split('\n');
  const out = await Promise.all(lines.map((l) => (l.trim() ? translateText(l, target) : Promise.resolve(''))));
  return out.join('\n');
}
