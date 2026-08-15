import type { Trip } from '../../types/trip';
import { getLedger, formatStayRange, RESERVATION_LABEL } from '../../utils/ledger';
import { formatAmount, formatMoney, toTWD } from '../../utils/money';
import { formatWithWeekday, toISODate } from '../../utils/date';
import { placeUrl } from '../../utils/gmaps';
import MobileSection from './MobileSection';

/**
 * 手機版「資料」：出國時偶爾要查、但每次都不能沒有的東西。
 * 1. 住宿：住哪、幾晚、訂哪個平台、付了沒、免費取消到哪天
 * 2. 固定項目支出：機票 / KKday 行程 / 租車 / 保險 / eSIM… 出發前就付掉的那些
 *
 * 純唯讀。要改一律回電腦版。
 */

interface Props {
  trip: Trip;
}

export default function MobileInfo({ trip }: Props) {
  const ledger = getLedger(trip);
  const today = toISODate(new Date());
  const fx = ledger.fxRate;

  const stays = [...ledger.accommodations].sort((a, b) =>
    (a.checkIn ?? '9999-99-99').localeCompare(b.checkIn ?? '9999-99-99'),
  );
  const fixed = ledger.expenses.filter((e) => e.phase === 'pre');
  const fixedTotal = fixed.reduce((s, e) => s + toTWD(e.amount, e.currency, fx), 0);
  const payName = (id?: string) => ledger.paymentMethods.find((p) => p.id === id)?.name ?? '';

  /** 今晚住哪：入住日 ≤ 今天 < 退房日。 */
  function isTonight(checkIn: string | undefined, nights: number): boolean {
    if (!checkIn) return false;
    const out = new Date(checkIn);
    out.setDate(out.getDate() + Math.max(1, nights));
    return checkIn <= today && today < toISODate(out);
  }

  // 今晚住哪預設展開，其餘收起來
  const tonightCount = stays.filter((a) => isTonight(a.checkIn, a.nights)).length;

  return (
    <div className="mv-info">
      <MobileSection
        id="stays"
        title="住宿"
        count={stays.length}
        defaultOpen={tonightCount > 0}
        badge={tonightCount > 0 ? '今晚' : undefined}
      >
      {stays.length === 0 && <div className="mv-empty">還沒有住宿資料</div>}
      {stays.map((a) => {
        const tonight = isTonight(a.checkIn, a.nights);
        const mapUrl = placeUrl(undefined, a.name);
        return (
          <div key={a.id} className={`mv-info-card${tonight ? ' now' : ''}`}>
            <div className="mv-info-title">
              {a.name || '（未命名住宿）'}
              {tonight && <span className="mv-resv-today-tag">今晚</span>}
            </div>
            <div className="mv-info-sub">
              {formatStayRange(a.checkIn, a.nights)}
              {a.area ? `　·　${a.area}` : ''}
            </div>
            <dl className="mv-kv">
              {a.platform && (
                <div>
                  <dt>訂購平台</dt>
                  <dd>{a.platform}</dd>
                </div>
              )}
              <div>
                <dt>金額</dt>
                <dd>
                  {formatMoney(a.price, a.currency)}
                  {a.currency !== 'TWD' && `（NT$${formatAmount(toTWD(a.price, a.currency, fx))}）`}
                  <span className={a.paid ? 'mv-paid' : 'mv-unpaid'}>{a.paid ? '已付' : '未付'}</span>
                </dd>
              </div>
              {a.paymentMethodId && (
                <div>
                  <dt>支付</dt>
                  <dd>{payName(a.paymentMethodId)}</dd>
                </div>
              )}
              {a.meals && (
                <div>
                  <dt>附餐</dt>
                  <dd>{a.meals}</dd>
                </div>
              )}
              {a.chargeDate && (
                <div>
                  <dt>免費取消至</dt>
                  <dd>{formatWithWeekday(a.chargeDate)}</dd>
                </div>
              )}
              {a.note && (
                <div>
                  <dt>備註</dt>
                  <dd className="multiline">{a.note}</dd>
                </div>
              )}
            </dl>
            {mapUrl && (
              <a className="mv-resv-map" href={mapUrl} target="_blank" rel="noreferrer">
                找這間飯店 ↗
              </a>
            )}
          </div>
        );
      })}
      </MobileSection>

      <MobileSection
        id="fixed"
        title="固定項目支出"
        count={fixed.length}
        badge={`合計 ${formatMoney(fixedTotal, 'TWD')}`}
      >
      {fixed.length === 0 && <div className="mv-empty">還沒有固定項目（機票 / 行程 / 租車…）</div>}
      {fixed.map((e) => (
        <div key={e.id} className="mv-info-row">
          <div className="mv-info-row-main">
            <div className="mv-info-row-title">
              <span className="mv-entry-cat">{e.category}</span>
              {e.title || '（未命名）'}
            </div>
            <div className="mv-info-row-sub">
              {e.date ? `${e.date}　·　` : ''}
              {e.paymentMethodId ? `${payName(e.paymentMethodId)}　·　` : ''}
              <span className={e.paid ? 'mv-paid' : 'mv-unpaid'}>{e.paid ? '已付' : '未付'}</span>
            </div>
            {e.note && <div className="mv-info-row-note">{e.note}</div>}
          </div>
          <div className="mv-entry-money">
            <span className="mv-entry-amt">{formatMoney(e.amount, e.currency)}</span>
            {e.currency !== 'TWD' && (
              <span className="mv-entry-twd">{formatMoney(toTWD(e.amount, e.currency, fx), 'TWD')}</span>
            )}
          </div>
        </div>
      ))}
      </MobileSection>

      {/* 餐廳的錢與訂位狀態在「手牌」分頁，這裡只補一句指路，免得以為漏了 */}
      {ledger.restaurants.length > 0 && (
        <div className="mv-info-hint">
          餐廳預訂（{ledger.restaurants.filter((r) => r.status === 'reserved').length} 筆
          {RESERVATION_LABEL.reserved}）在「手牌」分頁。
        </div>
      )}
    </div>
  );
}
