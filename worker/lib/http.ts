/** 私有資料一律 no-store：行程、收據不該被任何中間層快取。 */
export function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

export function readCookie(request: Request, name: string): string | null {
  const raw = request.headers.get('Cookie') ?? '';
  for (const item of raw.split(';')) {
    const [key, ...rest] = item.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return null;
}

export function setCookie(name: string, value: string, maxAgeSeconds: number): string {
  return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function randomToken(bytes = 32): string {
  return hex(crypto.getRandomValues(new Uint8Array(bytes)));
}

/** 長度固定的字串比較，避免用比較耗時洩漏內容。 */
export function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
