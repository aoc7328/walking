import { hasSession, privateJson, type AuthEnv } from '../../_lib/auth';

type PagesContext = { request: Request; env: AuthEnv };

export async function onRequestGet(context: PagesContext): Promise<Response> {
  return privateJson({ ok: await hasSession(context.request, context.env) });
}
