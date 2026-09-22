import type { Env } from './lib/env';
import { json } from './lib/http';
import * as auth from './api/auth';
import * as trips from './api/trips';
import * as asset from './api/asset';
import * as share from './api/share';
import * as ocr from './api/ocr';
import * as placePhoto from './api/placePhoto';
import * as account from './api/account';

/**
 * 多人版 walking 的進入點。
 *
 * 跟單人版（Cloudflare Pages + functions/）刻意完全分開：不同 Worker、不同網址、
 * 不同 KV / R2 / D1。單人版那邊一個字都不會動，資料也不共用。
 *
 * /api/* 由這裡處理，其餘一律丟給 ASSETS（build 出來的 SPA）。
 */

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (!path.startsWith('/api/')) return env.ASSETS.fetch(request);

    const method = request.method.toUpperCase();

    try {
      // ── 登入 ──
      if (path === '/api/auth/mode' && method === 'GET') return auth.mode();
      if (path === '/api/auth/google' && method === 'GET') return auth.start(request, env);
      if (path === '/api/auth/callback' && method === 'GET') return auth.callback(request, env);
      if (path === '/api/auth/session' && method === 'GET') return auth.session(request, env);
      if (path === '/api/auth/logout' && method === 'POST') return auth.logout(request, env);

      // ── 帳號 ──
      if (path === '/api/account' && method === 'DELETE') return account.remove(request, env);

      // ── 自己的行程 ──
      if (path === '/api/trips' && method === 'GET') return trips.list(request, env);

      const tripMatch = /^\/api\/trips\/([^/]+)$/.exec(path);
      if (tripMatch) {
        const id = decodeURIComponent(tripMatch[1]!);
        if (method === 'GET') return trips.get(request, env, id);
        if (method === 'PUT') return trips.put(request, env, id);
        if (method === 'DELETE') return trips.remove(request, env, id);
        return json({ error: '不支援的方法' }, 405);
      }

      // ── 公開分享 ──
      if (path === '/api/trip' && method === 'POST') return share.create(request, env);
      const shareMatch = /^\/api\/trip\/([^/]+)$/.exec(path);
      if (shareMatch && method === 'GET') return share.read(env, decodeURIComponent(shareMatch[1]!));

      // ── 發票自動判讀 ──
      if (path === '/api/receipt-scan' && method === 'POST') return ocr.scan(request, env);

      // ── 地點照片（跨使用者共用快取）──
      if (path === '/api/place-photo' && method === 'GET') return placePhoto.photo(request, env);

      // ── 圖片 ──
      if (path === '/api/asset' && method === 'POST') return asset.upload(request, env);
      const assetMatch = /^\/api\/asset\/(.+)$/.exec(path);
      if (assetMatch) {
        const key = decodeURIComponent(assetMatch[1]!);
        if (method === 'GET') return asset.download(request, env, key);
        if (method === 'DELETE') return asset.remove(request, env, key);
        return json({ error: '不支援的方法' }, 405);
      }

      return json({ error: '找不到這支 API' }, 404);
    } catch (err) {
      // 任何未預期的例外都不要把堆疊吐給前端
      console.error('unhandled', err);
      return json({ error: '伺服器發生錯誤' }, 500);
    }
  },
};
