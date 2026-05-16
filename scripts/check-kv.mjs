// 一次性檢查腳本：看 KV 裡某 user 有什麼 trip
// 用法：node scripts/check-kv.mjs <hash> [origin]

const [, , hash, originArg] = process.argv;
const origin = originArg ?? 'https://walking2.pages.dev';

if (!hash) {
  console.error('Usage: node scripts/check-kv.mjs <hash> [origin]');
  process.exit(1);
}

const res = await fetch(`${origin}/api/trips?u=${hash}`);
console.log(`status: ${res.status}`);
const body = await res.text();
try {
  const trips = JSON.parse(body);
  if (Array.isArray(trips)) {
    console.log(`共 ${trips.length} 個 trip:`);
    trips.forEach((t, i) => {
      console.log(`  [${i + 1}] id=${t.id}`);
      console.log(`      name=${t.name}`);
      console.log(`      startDate=${t.startDate}, days=${t.days?.length ?? '?'}`);
      console.log(`      updatedAt=${new Date(t.updatedAt || 0).toISOString()}`);
    });
  } else {
    console.log('Response:', body);
  }
} catch {
  console.log('Raw:', body);
}
