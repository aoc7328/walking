import { createSession, privateJson, type SessionEnv } from '../../_lib/auth';

type PagesContext = { request: Request; env: SessionEnv };

export async function onRequestPost(context: PagesContext): Promise<Response> {
  let body: { password?: unknown };
  try { body = await context.request.json(); } catch { return privateJson({ error: '登入資料格式不正確' }, 400); }
  const password = typeof body.password === 'string' ? body.password : '';
  if (!password || password.length > 200) return privateJson({ error: '密碼不正確' }, 401);
  return createSession(context.env, password);
}
