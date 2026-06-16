import type { Ledger, ReservationStatus } from '../../types/ledger';
import { formatMoney, formatAmount, toTWD } from '../../utils/money';
import {
  formatStayRange,
  pricePerNight,
  accommodationTotalTWD,
  restaurantTotalsTWD,
  expensesTotalTWD,
  RESERVATION_LABEL,
} from '../../utils/ledger';
import { exportRestaurantsCSV } from '../../services/ledgerExport';

const STATUS_STYLE: Record<ReservationStatus, { bg: string; fg: string }> = {
  reserved: { bg: '#E1F5EE', fg: '#0F6E56' },
  none: { bg: 'var(--bg-soft)', fg: 'var(--ink-secondary)' },
  walkin: { bg: 'var(--bg-soft)', fg: 'var(--ink-secondary)' },
  impromptu: { bg: '#FAEEDA', fg: '#854F0B' },
  cancelled: { bg: '#FCEBEB', fg: '#A32D2D' },
};

function PaidBadge({ paid }: { paid: boolean }) {
  return paid ? (
    <span className="led-badge" style={{ background: '#E1F5EE', color: '#0F6E56' }}>已付</span>
  ) : (
    <span className="led-badge" style={{ background: 'var(--bg-soft)', color: 'var(--ink-muted)' }}>待付</span>
  );
}

export default function PreDepartureTab({ ledger, tripName }: { ledger: Ledger; tripName: string }) {
  const fx = ledger.fxRate;
  const pmName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name;

  const accTotal = accommodationTotalTWD(ledger);
  const rstTotals = restaurantTotalsTWD(ledger);
  const preExpenses = ledger.expenses.filter((e) => e.phase === 'pre');
  const preExpTotal = expensesTotalTWD(ledger, 'pre');

  return (
    <div>
      {/* 住宿 */}
      <section className="led-section">
        <div className="led-section-head">
          <div className="led-section-title">住宿　<span className="led-count">{ledger.accommodations.length}</span></div>
          <div className="led-section-total">合計　<b>{formatMoney(accTotal, 'TWD')}</b></div>
        </div>
        {ledger.accommodations.length === 0 ? (
          <div className="led-empty">還沒有住宿紀錄</div>
        ) : (
          <div className="led-rows">
            {ledger.accommodations.map((a) => (
              <div key={a.id} className="led-card">
                <div className="led-card-line1">
                  <PaidBadge paid={a.paid} />
                  {a.area && <span className="led-dim">{a.area}</span>}
                  <span className="led-name">{a.name}</span>
                  {a.platform && <span className="led-pill">{a.platform}</span>}
                </div>
                <div className="led-card-line2">
                  <span>{formatStayRange(a.checkIn, a.nights)}</span>
                  {a.meals && <span className="led-pill led-pill-green">{a.meals}</span>}
                  {!a.meals && <span className="led-dim">無附餐</span>}
                </div>
                <div className="led-card-line3">
                  <span className="led-dim">
                    {formatMoney(pricePerNight(a), a.currency)} / 晚 × {a.nights}
                  </span>
                  <span>
                    <b>{formatMoney(a.price, a.currency)}</b>
                    {a.currency !== 'TWD' && (
                      <span className="led-dim">　≈ {formatMoney(toTWD(a.price, a.currency, fx), 'TWD')}</span>
                    )}
                    {a.chargeDate && <span className="led-dim">　·　{a.chargeDate}</span>}
                    {pmName(a.paymentMethodId) && <span className="led-dim">　·　{pmName(a.paymentMethodId)}</span>}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 餐廳預訂 */}
      <section className="led-section">
        <div className="led-section-head">
          <div className="led-section-title">餐廳預訂　<span className="led-count">{ledger.restaurants.length}</span></div>
          <div className="led-section-actions">
            <span className="led-section-total">
              預估 {formatAmount(rstTotals.estimated)}　·　實際 <b>{formatAmount(rstTotals.actual)}</b>
            </span>
            {ledger.restaurants.length > 0 && (
              <button className="led-export-btn" onClick={() => exportRestaurantsCSV(ledger, tripName)} title="匯出 CSV 給秘書訂位">
                匯出 CSV
              </button>
            )}
          </div>
        </div>
        {ledger.restaurants.length === 0 ? (
          <div className="led-empty">還沒有餐廳預訂</div>
        ) : (
          <div className="led-rows">
            {ledger.restaurants.map((r) => {
              const st = STATUS_STYLE[r.status];
              const actualTWD = r.amount ? toTWD(r.amount, r.currency ?? 'TWD', fx) : 0;
              return (
                <div key={r.id} className="led-card">
                  <div className="led-card-line1">
                    <span className="led-dim led-date">
                      {r.date.slice(5).replace('-', '/')}{r.time ? ` ${r.time}` : ''}
                    </span>
                    <span className="led-name">{r.name}</span>
                    <span className="led-badge" style={{ background: st.bg, color: st.fg }}>{RESERVATION_LABEL[r.status]}</span>
                  </div>
                  <div className="led-card-line2">
                    {r.cuisine && <span className="led-pill">{r.cuisine}</span>}
                    {r.channel && <span className="led-pill">管道 · {r.channel}</span>}
                    {r.bookingRef && <span className="led-pill">編號 {r.bookingRef}</span>}
                    {pmName(r.paymentMethodId) && <span className="led-pill">{pmName(r.paymentMethodId)}</span>}
                  </div>
                  <div className="led-card-line3">
                    <span className="led-dim">
                      {r.note ?? ''}
                      {r.contact ? `　${r.contact}` : ''}
                    </span>
                    <span>
                      {r.estimated ? <span className="led-dim">估 {formatAmount(r.estimated)}　</span> : null}
                      {r.amount ? (
                        <>
                          <b>{formatMoney(r.amount, r.currency ?? 'TWD')}</b>
                          {(r.currency ?? 'TWD') !== 'TWD' && (
                            <span className="led-dim">　≈ {formatMoney(actualTWD, 'TWD')}</span>
                          )}
                        </>
                      ) : (
                        <span className="led-dim">未消費</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 其他固定項 */}
      <section className="led-section">
        <div className="led-section-head">
          <div className="led-section-title">其他固定項　<span className="led-count">{preExpenses.length}</span></div>
          <div className="led-section-total">合計　<b>{formatMoney(preExpTotal, 'TWD')}</b></div>
        </div>
        {preExpenses.length === 0 ? (
          <div className="led-empty">還沒有其他固定項（機票/租車/保險/換匯/門票…）</div>
        ) : (
          <div className="led-rows">
            {preExpenses.map((e) => (
              <div key={e.id} className="led-line">
                <PaidBadge paid={e.paid} />
                <span className="led-pill">{e.category}</span>
                <span className="led-name" style={{ flex: 1 }}>{e.title}</span>
                {e.note && <span className="led-dim led-ellipsis">{e.note}</span>}
                <b>{formatMoney(e.amount, e.currency)}</b>
                {e.currency !== 'TWD' && (
                  <span className="led-dim">≈ {formatMoney(toTWD(e.amount, e.currency, fx), 'TWD')}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
