import { clearSession, type SessionEnv } from '../../_lib/auth';

type PagesContext = { request: Request; env: SessionEnv };

export async function onRequestPost(context: PagesContext): Promise<Response> {
  return clearSession(context.request, context.env);
}
