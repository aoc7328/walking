// 把本地 JSON 行程上傳到指定帳號 hash 的 KV namespace
// 用法：node scripts/upload-trip.mjs <jsonPath> <accountHash> [origin]

import fs from 'node:fs/promises';

const [, , jsonPath, hash, originArg] = process.argv;
const origin = originArg ?? 'https://walking2.pages.dev';

if (!jsonPath || !hash) {
  console.error('Usage: node scripts/upload-trip.mjs <jsonPath> <accountHash> [origin]');
  process.exit(1);
}

const raw = await fs.readFile(jsonPath, 'utf8');
const trip = JSON.parse(raw);

if (!trip.id) {
  console.error('JSON 沒有 .id 欄位');
  process.exit(1);
}

console.log(`trip name: ${trip.name}`);
console.log(`trip id:   ${trip.id}`);
console.log(`days:      ${trip.days?.length}`);
console.log(`endpoint:  ${origin}/api/trips/${trip.id}?u=${hash}`);
console.log('');

const res = await fetch(`${origin}/api/trips/${trip.id}?u=${hash}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(trip),
});
console.log(`status: ${res.status} ${res.statusText}`);
console.log(`body:   ${await res.text()}`);
