/**
 * 站點備註的顯示用清洗：去頭尾空白、丟掉空字串。
 *
 * 備註編輯器把欄位清空時曾經只留下 ""，加上舊版銜接站會把備註整包複製到隔天，
 * 一份行程裡累積了一堆 [""]。存的資料不強制改（使用者可能正在打字），
 * 但所有「顯示」一律過這一層，空的就當沒有。
 */
export function cleanNotes(notes: string[] | undefined): string[] {
  if (!notes) return [];
  const out: string[] = [];
  for (const n of notes) {
    const t = n.trim();
    if (t) out.push(t);
  }
  return out;
}
