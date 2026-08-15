import { useEffect, useState } from 'react';
import type { Trip } from '../../types/trip';
import type { Ledger, Restaurant } from '../../types/ledger';
import { buildReservationCard, type ReservationCardData } from '../../services/reservationCard';
import { getLedger, RESERVATION_LABEL } from '../../utils/ledger';
import { formatWithWeekday, toISODate } from '../../utils/date';
import { placeUrl } from '../../utils/gmaps';

/**
 * 手機版「訂位」：現場出示用的手牌。
 *
 * 內容跟電腦版列印的預訂牌是同一份（共用 buildReservationCard），差別只在
 * 這裡是全螢幕大字給店員看，不是印出來。翻譯結果有存 localStorage，
 * 只要有網路時開過一次，之後在店裡沒訊號也照樣是翻好的內容。
 */

interface Props {
  trip: Trip;
}

/** 依日期 + 時間排序用的鍵。 */
function sortKey(r: Restaurant): string {
  return `${r.date ?? '9999-99-99'} ${r.time ?? '99:99'}`;
}

function StatusChip({ r }: { r: Restaurant }) {
  return <span className={`mv-resv-status s-${r.status}`}>{RESERVATION_LABEL[r.status]}</span>;
}

function ReservationRow({
  r,
  today,
  onOpen,
}: {
  r: Restaurant;
  today: string;
  onOpen: () => void;
}) {
  const mapUrl = placeUrl(undefined, r.name);
  return (
    <div className={`mv-resv-row${r.date === today ? ' today' : ''}`}>
      <div className="mv-resv-when">
        <span className="mv-resv-date">{r.date ? formatWithWeekday(r.date) : '未定日期'}</span>
        <span className="mv-resv-time">{r.time || '—'}</span>
      </div>
      <div className="mv-resv-main">
        <div className="mv-resv-name">
          {r.name || '（未命名餐廳）'}
          {r.date === today && <span className="mv-resv-today-tag">今天</span>}
        </div>
        <div className="mv-resv-sub">
          <StatusChip r={r} />
          {r.cuisine && <span>{r.cuisine}</span>}
          {r.partySize !== undefined && <span>{r.partySize} 位</span>}
        </div>
        {/* 自用備忘，只有自己看得到；出示給店家的牌上刻意不放 */}
        {r.note && <div className="mv-resv-note">{r.note}</div>}
        <div className="mv-resv-actions">
          <button className="mv-resv-show" onClick={onOpen}>
            <span aria-hidden>🪪</span> 出示手牌
          </button>
          {mapUrl && (
            <a className="mv-resv-map" href={mapUrl} target="_blank" rel="noreferrer">
              找這家店 ↗
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

/** 全螢幕手牌：給店員看的那一面。 */
function CardOverlay({
  restaurant,
  ledger,
  onClose,
}: {
  restaurant: Restaurant;
  ledger: Ledger;
  onClose: () => void;
}) {
  const [data, setData] = useState<ReservationCardData | null>(null);
  const [failed, setFailed] = useState(false);

  // ⚠️ 依賴只放 restaurant.id：ledger / restaurant 物件每次 render 都是新的，
  // 拿物件當依賴等於每次重繪都去打一次翻譯 API。
  useEffect(() => {
    let cancelled = false;
    setData(null);
    setFailed(false);
    buildReservationCard(restaurant, ledger)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant.id]);

  return (
    <div className="mv-cardview" onClick={onClose}>
      <div className="mv-cardview-inner" onClick={(e) => e.stopPropagation()}>
        {!data && !failed && <div className="mv-cardview-loading">翻訳中… / 翻譯中…</div>}
        {failed && <div className="mv-cardview-loading">產生失敗，請關掉重開</div>}
        {data && (
          <>
            <div className="mv-cardview-heading">{data.heading}</div>
            <dl className="mv-cardview-rows">
              {data.rows.map((row, i) => (
                <div key={i} className="mv-cardview-row">
                  <dt>{row.label}</dt>
                  <dd className={row.multiline ? 'multiline' : undefined}>{row.value}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <button className="mv-cardview-close" onClick={onClose}>
          關閉
        </button>
      </div>
    </div>
  );
}

export default function MobileReservations({ trip }: Props) {
  const ledger = getLedger(trip);
  const [openId, setOpenId] = useState<string | null>(null);

  const today = toISODate(new Date());
  const active = ledger.restaurants.filter((r) => r.status !== 'cancelled');
  const upcoming = active
    .filter((r) => (r.date ?? '9999-99-99') >= today)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const past = active
    .filter((r) => (r.date ?? '9999-99-99') < today)
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  const opened = openId ? active.find((r) => r.id === openId) ?? null : null;

  return (
    <div className="mv-resv">
      {active.length === 0 && (
        <div className="mv-empty">
          這趟還沒有餐廳預訂。
          <br />
          餐廳要在電腦版的帳本「出發前」分頁建立。
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <div className="mv-section-head">接下來</div>
          {upcoming.map((r) => (
            <ReservationRow key={r.id} r={r} today={today} onOpen={() => setOpenId(r.id)} />
          ))}
        </>
      )}

      {past.length > 0 && (
        <>
          <div className="mv-section-head">已過去</div>
          <div className="mv-resv-past">
            {past.map((r) => (
              <ReservationRow key={r.id} r={r} today={today} onOpen={() => setOpenId(r.id)} />
            ))}
          </div>
        </>
      )}

      {opened && (
        <CardOverlay restaurant={opened} ledger={ledger} onClose={() => setOpenId(null)} />
      )}
    </div>
  );
}
