import type { Env } from './env';
import { randomToken } from './http';

export interface User {
  id: string;
  google_sub: string;
  email: string;
  name: string;
  picture: string;
  created_at: number;
  /** 付費加購的行程額度；免費額度另外算（見 tripLimit）。 */
  extra_trip_slots: number;
}

const DEFAULT_FREE_LIMIT = 3;

/** 這個使用者總共可以有幾個行程 = 免費額度 + 加購。 */
export function tripLimit(env: Env, user: User): number {
  const free = Number(env.FREE_TRIP_LIMIT ?? DEFAULT_FREE_LIMIT);
  return (Number.isFinite(free) ? free : DEFAULT_FREE_LIMIT) + (user.extra_trip_slots ?? 0);
}

export async function findById(env: Env, id: string): Promise<User | null> {
  return env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(id).first<User>();
}

/**
 * Google 登入後建檔或更新。
 *
 * 認人一律看 google_sub（Google 保證穩定且唯一），不看 email——
 * email 可以換，換了之後還是同一個人，資料不能因此變成別人的。
 */
export async function upsertFromGoogle(
  env: Env,
  profile: { sub: string; email: string; name: string; picture: string },
): Promise<User> {
  const existing = await env.DB.prepare('SELECT * FROM users WHERE google_sub = ?').bind(profile.sub).first<User>();

  if (existing) {
    await env.DB.prepare('UPDATE users SET email = ?, name = ?, picture = ? WHERE id = ?')
      .bind(profile.email, profile.name, profile.picture, existing.id)
      .run();
    return { ...existing, email: profile.email, name: profile.name, picture: profile.picture };
  }

  const user: User = {
    id: `usr_${randomToken(12)}`,
    google_sub: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    created_at: Date.now(),
    extra_trip_slots: 0,
  };
  await env.DB.prepare(
    'INSERT INTO users (id, google_sub, email, name, picture, created_at, extra_trip_slots) VALUES (?, ?, ?, ?, ?, ?, 0)',
  )
    .bind(user.id, user.google_sub, user.email, user.name, user.picture, user.created_at)
    .run();
  return user;
}
