import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Trip } from '../../types/trip';
import type { CertRequest, Ledger, Restaurant, Ticket, VjwEntry } from '../../types/ledger';
import { buildReservationCard, type ReservationCardData } from '../../services/reservationCard';
import { buildCertCard, translateCertNote, CERT_KIND_LABEL } from '../../services/certCard';
import { imageSrc } from '../../services/assets';
import { getLedger, RESERVATION_LABEL } from '../../utils/ledger';
import { addDays, formatWithWeekday, toISODate } from '../../utils/date';
import { placeUrl } from '../../utils/gmaps';
import MobileSection from './MobileSection';

/**
 * 手機版「手牌」：所有現場要出示的東西都在這一頁。
 * 1. 證明文件申請牌（颱風延誤 / 停駛 / 住宿證明，跟櫃台要理賠用文件）
 * 2. 入境 QR（Visit Japan Web）
 * 3. 票券 / 訂位截圖
 * 4. 餐廳訂位牌（翻成當地語言的文字牌）
 *
 * 圖都在 R2，點下去全螢幕放大給對方看／掃。餐廳牌的內容跟電腦版列印的完全一致。
 */

interface Props {
  trip: Trip;
}

/** 目前打開的全螢幕內容：圖片或餐廳文字牌。 */
type Showing =
  | { kind: 'image'; title: string; sub?: string; src: string }
  | { kind: 'reservation'; restaurant: Restaurant }
  | { kind: 'cert'; cert: CertRequest };

function sortKey(r: Restaurant): string {
  return `${r.date ?? '9999-99-99'} ${r.time ?? '99:99'}`;
}

/** 全螢幕圖：入境 QR / 票券。純白底、圖盡量大，方便對方掃。 */
function ImageView({ item, onClose }: { item: Extract<Showing, { kind: 'image' }>; onClose: () => void }) {
  return (
    <div className="mv-cardview image" onClick={onClose}>
      <div className="mv-cardview-inner" onClick={(e) => e.stopPropagation()}>
        <div className="mv-cardview-heading">{item.title}</div>
        {item.sub && <div className="mv-cardview-sub">{item.sub}</div>}
        <img className="mv-cardview-img" src={item.src} alt={item.title} />
        <button className="mv-cardview-close" onClick={onClose}>
          關閉
        </button>
      </div>
    </div>
  );
}

/** 全螢幕餐廳訂位牌（已翻成目的地語言）。 */
function ReservationView({
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

/**
 * 全螢幕證明申請牌。
 *
 * 請求文是手寫的固定句型，同步就畫得出來——櫃台常常沒訊號，這一面不能等網路。
 * 只有使用者自己打的「補充」是中文自由文字，翻好了才換上去，翻不到就維持中文。
 */
function CertView({ cert, ledger, onClose }: { cert: CertRequest; ledger: Ledger; onClose: () => void }) {
  const card = useMemo(() => buildCertCard(cert, ledger), [cert, ledger]);
  const rawNote = card.noteRowIndex >= 0 ? card.rows[card.noteRowIndex]!.value : '';
  const [note, setNote] = useState('');

  // 依賴全放原始值（字串）：ledger / cert 物件每次 render 都是新的，
  // 拿物件當依賴等於每重繪一次就打一次翻譯 API。
  useEffect(() => {
    let cancelled = false;
    setNote('');
    if (!rawNote) return;
    void translateCertNote(rawNote, card.lang).then((t) => {
      if (!cancelled) setNote(t);
    });
    return () => {
      cancelled = true;
    };
  }, [cert.id, rawNote, card.lang]);

  const rows = card.rows.map((r, i) => (i === card.noteRowIndex && note ? { ...r, value: note } : r));

  return (
    <div className="mv-cardview" onClick={onClose}>
      <div className="mv-cardview-inner" onClick={(e) => e.stopPropagation()}>
        <div className="mv-cert-intro">{card.intro}</div>
        <div className="mv-cardview-heading">{card.heading}</div>
        <div className="mv-cert-doc">{card.docName}</div>
        <div className="mv-cert-body">
          {card.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        <dl className="mv-cardview-rows">
          {rows.map((row, i) => (
            <div key={i} className="mv-cardview-row">
              <dt>{row.label}</dt>
              <dd className={row.multiline ? 'multiline' : undefined}>{row.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mv-cert-thanks">{card.thanks}</div>
        <div className="mv-cert-zh">{card.zhSummary}</div>
        <button className="mv-cardview-close" onClick={onClose}>
          關閉
        </button>
      </div>
    </div>
  );
}

function CertRow({ c, onShow }: { c: CertRequest; onShow: () => void }) {
  const when =
    c.kind === 'stay' && c.date
      ? `${formatWithWeekday(c.date)} 〜 ${formatWithWeekday(c.endDate || addDays(c.date, 1))}`
      : c.date
        ? formatWithWeekday(c.date)
        : '未指定日期';
  return (
    <div className={`mv-resv-row${c.done ? ' mv-cert-got' : ''}`}>
      <div className="mv-resv-main">
        <div className="mv-resv-name">
          {c.target || '（未填對象）'}
          {c.done && <span className="mv-cert-done-tag">已拿到</span>}
        </div>
        <div className="mv-resv-sub">
          <span className={`mv-cert-kind k-${c.kind}`}>{CERT_KIND_LABEL[c.kind]}</span>
          <span>{when}</span>
          {c.serviceNo && <span>{c.serviceNo}</span>}
          {c.refNo && <span>No. {c.refNo}</span>}
        </div>
        <div className="mv-resv-actions">
          <button className="mv-resv-show" onClick={onShow}>
            <span aria-hidden>🪪</span> 出示手牌
          </button>
        </div>
      </div>
    </div>
  );
}

function VjwRow({ v, onShow }: { v: VjwEntry; onShow: () => void }) {
  const src = imageSrc(v);
  return (
    <button className="mv-tk-row" onClick={onShow}>
      {src ? <img className="mv-tk-thumb" src={src} alt="入境 QR" /> : <div className="mv-tk-thumb empty">—</div>}
      <div className="mv-tk-main">
        <div className="mv-tk-title">{v.nameZh?.trim() || v.nameEn?.trim() || '（未填姓名）'}</div>
        <div className="mv-tk-sub">
          {v.nameEn?.trim() ? `${v.nameEn.trim().toUpperCase()}　·　` : ''}Visit Japan Web
        </div>
      </div>
      <span className="mv-tk-go" aria-hidden>
        出示 ›
      </span>
    </button>
  );
}

function TicketRow({ t, today, onShow }: { t: Ticket; today: string; onShow: () => void }) {
  return (
    <button className={`mv-tk-row${t.date === today ? ' today' : ''}`} onClick={onShow}>
      <img className="mv-tk-thumb" src={imageSrc(t)} alt={t.title} />
      <div className="mv-tk-main">
        <div className="mv-tk-title">
          {t.title || '（未命名票券）'}
          {t.date === today && <span className="mv-resv-today-tag">今天</span>}
        </div>
        <div className="mv-tk-sub">
          {t.date ? formatWithWeekday(t.date) : '未指定日期'}
          {t.note ? `　·　${t.note}` : ''}
        </div>
      </div>
      <span className="mv-tk-go" aria-hidden>
        出示 ›
      </span>
    </button>
  );
}

function ReservationRow({
  r,
  today,
  onShow,
}: {
  r: Restaurant;
  today: string;
  onShow: () => void;
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
          <span className={`mv-resv-status s-${r.status}`}>{RESERVATION_LABEL[r.status]}</span>
          {r.cuisine && <span>{r.cuisine}</span>}
          {r.partySize !== undefined && <span>{r.partySize} 位</span>}
        </div>
        {/* 自用備忘，只有自己看得到；出示給店家的牌上刻意不放 */}
        {r.note && <div className="mv-resv-note">{r.note}</div>}
        <div className="mv-resv-actions">
          <button className="mv-resv-show" onClick={onShow}>
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

export default function MobileCards({ trip }: Props) {
  const ledger = getLedger(trip);
  const [showing, setShowing] = useState<Showing | null>(null);

  const today = toISODate(new Date());
  // 沒拿到的排前面（依日期），拿到的沉到最後——櫃台前要找的一定是還沒辦的那幾張
  const certs = [...(ledger.certs ?? [])].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99');
  });
  const certsTodo = certs.filter((c) => !c.done).length;
  const vjw = ledger.vjw ?? [];
  const tickets = [...(ledger.tickets ?? [])].sort((a, b) =>
    (a.date ?? '9999-99-99').localeCompare(b.date ?? '9999-99-99'),
  );
  const active = ledger.restaurants.filter((r) => r.status !== 'cancelled');
  const upcoming = active
    .filter((r) => (r.date ?? '9999-99-99') >= today)
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const past = active
    .filter((r) => (r.date ?? '9999-99-99') < today)
    .sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

  // 「今天要用的」預設展開，其餘一律收起來——不然東西一多整頁都在捲
  const ticketsToday = tickets.filter((t) => t.date === today).length;
  const resvToday = upcoming.filter((r) => r.date === today).length;

  const nothing = certs.length === 0 && vjw.length === 0 && tickets.length === 0 && active.length === 0;

  return (
    <div className="mv-resv">
      {nothing && (
        <div className="mv-empty">
          這趟還沒有可出示的東西。
          <br />
          入境 QR、票券圖、餐廳訂位、證明申請牌都在電腦版的帳本建立。
        </div>
      )}

      {certs.length > 0 && (
        <MobileSection
          id="certs"
          title="證明文件"
          count={certs.length}
          defaultOpen={certsTodo > 0}
          badge={certsTodo > 0 ? `待辦 ${certsTodo}` : undefined}
        >
          {certs.map((c) => (
            <CertRow key={c.id} c={c} onShow={() => setShowing({ kind: 'cert', cert: c })} />
          ))}
        </MobileSection>
      )}

      {vjw.length > 0 && (
        <MobileSection id="vjw" title="入境 QR" count={vjw.length}>
          {vjw.map((v) => (
            <VjwRow
              key={v.id}
              v={v}
              onShow={() =>
                setShowing({
                  kind: 'image',
                  title: v.nameZh?.trim() || v.nameEn?.trim().toUpperCase() || 'Visit Japan Web',
                  sub: [v.nameZh?.trim() ? v.nameEn?.trim().toUpperCase() : '', 'Visit Japan Web 入境 QR']
                    .filter(Boolean)
                    .join('　·　'),
                  src: imageSrc(v),
                })
              }
            />
          ))}
        </MobileSection>
      )}

      {tickets.length > 0 && (
        <MobileSection
          id="tickets"
          title="票券"
          count={tickets.length}
          defaultOpen={ticketsToday > 0}
          badge={ticketsToday > 0 ? `今天 ${ticketsToday}` : undefined}
        >
          {tickets.map((t) => (
            <TicketRow
              key={t.id}
              t={t}
              today={today}
              onShow={() =>
                setShowing({
                  kind: 'image',
                  title: t.title || '票券',
                  sub: [t.date ? formatWithWeekday(t.date) : '', t.note ?? ''].filter(Boolean).join('　·　'),
                  src: imageSrc(t),
                })
              }
            />
          ))}
        </MobileSection>
      )}

      {upcoming.length > 0 && (
        <MobileSection
          id="resv-upcoming"
          title="餐廳訂位"
          count={upcoming.length}
          defaultOpen={resvToday > 0}
          badge={resvToday > 0 ? `今天 ${resvToday}` : undefined}
        >
          {upcoming.map((r) => (
            <ReservationRow
              key={r.id}
              r={r}
              today={today}
              onShow={() => setShowing({ kind: 'reservation', restaurant: r })}
            />
          ))}
        </MobileSection>
      )}

      {past.length > 0 && (
        <MobileSection id="resv-past" title="已過去的訂位" count={past.length}>
          <div className="mv-resv-past">
            {past.map((r) => (
              <ReservationRow
                key={r.id}
                r={r}
                today={today}
                onShow={() => setShowing({ kind: 'reservation', restaurant: r })}
              />
            ))}
          </div>
        </MobileSection>
      )}

      {/* 掛到 body：全螢幕出示原本畫在可捲區裡，iOS Safari 會把捲動容器變成獨立的
          堆疊環境，底部分頁列會壓在上面（關閉鈕被蓋住）。 */}
      {showing?.kind === 'image' &&
        createPortal(<ImageView item={showing} onClose={() => setShowing(null)} />, document.body)}
      {showing?.kind === 'reservation' &&
        createPortal(
          <ReservationView restaurant={showing.restaurant} ledger={ledger} onClose={() => setShowing(null)} />,
          document.body,
        )}
      {showing?.kind === 'cert' &&
        createPortal(
          <CertView cert={showing.cert} ledger={ledger} onClose={() => setShowing(null)} />,
          document.body,
        )}
    </div>
  );
}
