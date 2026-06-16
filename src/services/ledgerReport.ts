import type { Trip } from '../types/trip';
import type { Ledger } from '../types/ledger';
import { formatAmount, toTWD } from '../utils/money';
import {
  categoryTotals, restaurantTotalsTWD, accommodationTotalTWD, expensesTotalTWD,
  budgetBreakdown, categoryColor, formatStayRange, RESERVATION_LABEL,
} from '../utils/ledger';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
}

function table(headers: string[], aligns: ('l' | 'r')[], rows: string[][], foot?: string[]): string {
  const th = headers.map((h, i) => `<th class="${aligns[i] === 'r' ? 'r' : ''}">${esc(h)}</th>`).join('');
  const body = rows.map((r) => `<tr>${r.map((c, i) => `<td class="${aligns[i] === 'r' ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('');
  const tf = foot ? `<tfoot><tr>${foot.map((c, i) => `<td class="${aligns[i] === 'r' ? 'r' : ''}">${c}</td>`).join('')}</tr></tfoot>` : '';
  return `<table>${`<thead><tr>${th}</tr></thead>`}<tbody>${body}</tbody>${tf}</table>`;
}

/** 開新視窗列印「整本帳結算單」（可在列印對話框存成 PDF）。 */
export function printLedgerReport(trip: Trip, ledger: Ledger): void {
  const fx = ledger.fxRate;
  const A = (n: number) => `NT$${formatAmount(n)}`;
  const pmName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name ?? '';

  const cat = categoryTotals(ledger);
  const preTotal = cat.rows.reduce((s, r) => s + r.pre, 0);
  const duringTotal = cat.rows.reduce((s, r) => s + r.during, 0);
  const rst = restaurantTotalsTWD(ledger);
  const budgets = budgetBreakdown(ledger);

  const sections: string[] = [];

  // 總結
  sections.push(`<section><h2>消費總結</h2>
    <div class="stats">
      <div class="stat"><div class="k">實際總額</div><div class="v">${A(cat.grand)}</div></div>
      <div class="stat"><div class="k">前期開銷（已知/預訂）</div><div class="v">${A(preTotal)}</div></div>
      <div class="stat"><div class="k">流水帳（現場）</div><div class="v">${A(duringTotal)}</div></div>
    </div></section>`);

  // 五類別佔比
  if (cat.grand > 0) {
    const rows = cat.rows.map((r) => [
      `<span class="dot" style="background:${categoryColor(r.category)}"></span>${esc(r.category)}`,
      A(r.pre), A(r.during), `<b>${A(r.total)}</b>`, `${r.pct.toFixed(1)}%`,
    ]);
    sections.push(`<section><h2>各類別佔比</h2>${table(
      ['類別', '前期', '流水帳', '合計', '佔比'], ['l', 'r', 'r', 'r', 'r'], rows,
      ['合計', A(preTotal), A(duringTotal), `<b>${A(cat.grand)}</b>`, '100%'],
    )}</section>`);
  }

  // 預算達成
  if (budgets.length > 0) {
    const rows = budgets.map((b) => {
      const used = b.committed + b.during;
      const over = used > b.budget;
      return [esc(b.category), A(b.budget), A(used), `<span class="${over ? 'over' : 'ok'}">${over ? '超支 ' : '剩 '}${formatAmount(Math.abs(b.budget - used))}</span>`];
    });
    sections.push(`<section><h2>預算達成</h2>${table(['類別', '總預算', '已用', '狀態'], ['l', 'r', 'r', 'r'], rows)}</section>`);
  }

  // 住宿
  if (ledger.accommodations.length > 0) {
    const rows = ledger.accommodations.map((a) => [
      a.paid ? '✓' : '—', esc(a.area), `<b>${esc(a.name)}</b>`, esc(formatStayRange(a.checkIn, a.nights)),
      A(toTWD(a.price, a.currency, fx)), esc(a.platform),
    ]);
    sections.push(`<section><h2>住宿　<small>合計 ${A(accommodationTotalTWD(ledger))}</small></h2>${table(
      ['付', '區域', '飯店', '入住 → 退房', '總價', '平台'], ['l', 'l', 'l', 'l', 'r', 'l'], rows,
    )}</section>`);
  }

  // 餐廳預訂
  if (ledger.restaurants.length > 0) {
    const rows = ledger.restaurants.map((r) => [
      esc(r.date), `<b>${esc(r.name)}</b>`, esc(r.cuisine), esc(RESERVATION_LABEL[r.status]),
      r.estimated ? A(toTWD(r.estimated, r.estimatedCurrency ?? 'TWD', fx)) : '—',
      r.amount ? A(toTWD(r.amount, r.currency ?? 'TWD', fx)) : '—',
    ]);
    sections.push(`<section><h2>餐廳預訂　<small>預估 ${A(rst.estimated)}・實際 ${A(rst.actual)}</small></h2>${table(
      ['日期', '店名', '種類', '狀態', '預估', '實際'], ['l', 'l', 'l', 'l', 'r', 'r'], rows,
    )}</section>`);
  }

  // 其他固定項
  const pre = ledger.expenses.filter((e) => e.phase === 'pre');
  if (pre.length > 0) {
    const rows = pre.map((e) => [e.paid ? '✓' : '—', esc(e.category), `<b>${esc(e.title)}</b>`, A(toTWD(e.amount, e.currency, fx)), esc(e.note)]);
    sections.push(`<section><h2>其他固定項　<small>合計 ${A(expensesTotalTWD(ledger, 'pre'))}</small></h2>${table(
      ['付', '類別', '項目', '金額', '備註'], ['l', 'l', 'l', 'r', 'l'], rows,
    )}</section>`);
  }

  // 流水帳
  const during = [...ledger.expenses.filter((e) => e.phase === 'during')].sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  if (during.length > 0) {
    const rows = during.map((e) => [esc(e.date), esc(e.category), `<b>${esc(e.title)}</b>`, A(toTWD(e.amount, e.currency, fx)), esc(pmName(e.paymentMethodId))]);
    sections.push(`<section><h2>流水帳　<small>合計 ${A(expensesTotalTWD(ledger, 'during'))}</small></h2>${table(
      ['日期', '分類', '項目', '金額', '支付'], ['l', 'l', 'l', 'r', 'l'], rows,
    )}</section>`);
  }

  const sub = [ledger.destination, `1 ${ledger.localCurrency} = ${fx} TWD`, trip.startDate].filter(Boolean).join('　·　');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(trip.name)} 帳本</title>
<style>
  body { font-family: 'Noto Sans TC','Noto Sans JP',-apple-system,sans-serif; color: #2C2620; margin: 0; padding: 28px 32px; font-size: 13px; }
  h1 { font-size: 22px; color: #2C4A3D; margin: 0 0 2px; }
  .sub { color: #6B5F50; font-size: 13px; margin-bottom: 18px; }
  h2 { font-size: 15px; color: #2C4A3D; margin: 22px 0 8px; border-bottom: 1px solid #D4C8B2; padding-bottom: 5px; }
  h2 small { color: #A89C8B; font-weight: 400; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 0.5px solid #E8DFD0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #F2EDE0; font-weight: 600; }
  td.r, th.r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  tfoot td { background: #F7F2E5; font-weight: 600; }
  .stats { display: flex; gap: 14px; }
  .stat { flex: 1; background: #F7F2E5; border-radius: 8px; padding: 10px 14px; }
  .stat .k { color: #6B5F50; font-size: 12px; }
  .stat .v { font-size: 20px; font-weight: 600; }
  .dot { display: inline-block; width: 9px; height: 9px; border-radius: 2px; margin-right: 6px; vertical-align: middle; }
  .ok { color: #3B6D11; } .over { color: #A32D2D; }
  section { break-inside: avoid; }
  @media print { body { padding: 0; } @page { margin: 14mm; } }
</style></head><body>
  <h1>${esc(trip.name)}　旅遊帳本</h1>
  <div class="sub">${esc(sub)}</div>
  ${sections.join('')}
  <script>window.onload=function(){setTimeout(function(){window.print();},200);};</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) { window.alert('瀏覽器擋掉了彈出視窗，請允許彈出視窗後再試。'); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
