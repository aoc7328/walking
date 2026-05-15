// 一次性腳本：用 PBKDF2 算出 username+password 的雜湊，POST 到部署上的 /api/auth/register。
// 用法：node scripts/register-account.mjs <username> <password> [siteOrigin]
// 例：node scripts/register-account.mjs aoc7328 194k0039 https://walking2.pages.dev

import crypto from 'node:crypto';

const [, , username, password, originArg] = process.argv;
const origin = originArg ?? 'https://walking2.pages.dev';

if (!username || !password) {
  console.error('Usage: node scripts/register-account.mjs <username> <password> [origin]');
  process.exit(1);
}

const u = username.trim().toLowerCase();
const salt = `walking:${u}`;
const hashBuf = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
const hash = hashBuf.toString('hex');

console.log(`username : ${u}`);
console.log(`hash     : ${hash}`);
console.log(`endpoint : ${origin}/api/auth/register?u=${hash}`);
console.log('');

const res = await fetch(`${origin}/api/auth/register?u=${hash}`, { method: 'POST' });
console.log(`status   : ${res.status} ${res.statusText}`);
console.log(`body     : ${await res.text()}`);
