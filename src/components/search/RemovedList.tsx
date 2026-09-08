import type { RemovedPlace } from '../../types/trip';
import { useTripStore } from '../../stores/tripStore';
import { useUIStore } from '../../stores/uiStore';
import { placeUrl } from '../../utils/gmaps';

/**
 * 刪除紀錄：從行程移除過的地點。
 *
 * 存在的理由是一個真實踩過的坑——規劃時整段路線換掉，幾個月後想起
 *「我之前有記過一間讀谷的設計旅館」，卻只能去舊的分享快照裡碰運氣挖。
 * 這一頁就是讓那件事再也不用碰運氣。
 *
 * 只做兩件事：加回今天選的那一天、或永久移掉。刻意不做編輯，
 * 這是紀錄不是第二份行程。
 */

function when(ms: number): string {
  if (!ms) return '時間不明';
  const d = new Date(ms);
  const now = Date.now();
  const days = Math.floor((now - ms) / 86400000);
  const stamp = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  if (days <= 0) return `今天刪的`;
  if (days === 1) return `昨天刪的`;
  if (days < 30) return `${days} 天前刪的`;
  return `${stamp} 刪的`;
}

function Row({ rec, dayId, dayIndex }: { rec: RemovedPlace; dayId: string | null; dayIndex: number | null }) {
  const restore = useTripStore((s) => s.restoreRemoved);
  const purge = useTripStore((s) => s.purgeRemoved);
  const url = placeUrl(rec.placeId, rec.name, rec.coordinates.lat, rec.coordinates.lng);

  return (
    <div className="removed-row">
      <div className="removed-main">
        <div className="removed-name">
          {rec.iconEmoji && <span aria-hidden>{rec.iconEmoji} </span>}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer">
              {rec.name}
            </a>
          ) : (
            rec.name
          )}
        </div>
        <div className="removed-addr">{rec.address}</div>
        <div className="removed-meta">
          {when(rec.removedAt)}
          {rec.fromDate ? `　·　原本在 ${rec.fromDate}` : ''}
          {rec.phoneNumber ? `　·　${rec.phoneNumber}` : ''}
        </div>
        {rec.notes && rec.notes.length > 0 && (
          <div className="removed-notes">
            {rec.notes.map((n, i) => (
              <div key={i}>· {n}</div>
            ))}
          </div>
        )}
      </div>
      <div className="removed-actions">
        <button
          className="removed-restore"
          disabled={!dayId}
          onClick={() => dayId && restore(rec.placeId, dayId)}
          title={dayId ? `把這個地點加回 Day ${dayIndex}` : '請先在右邊選一天'}
        >
          加回 Day {dayIndex ?? '—'}
        </button>
        <button
          className="removed-purge"
          onClick={() => {
            if (window.confirm(`從刪除紀錄永久移掉「${rec.name}」？\n（這只是清掉紀錄，行程本來就已經沒有它了）`)) {
              purge(rec.placeId);
            }
          }}
          title="從紀錄裡永久移掉"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export default function RemovedList() {
  const trip = useTripStore((s) => s.trip);
  const currentDayId = useUIStore((s) => s.currentDayId);
  const day = trip?.days.find((d) => d.id === currentDayId) ?? null;
  const list = trip?.removedPlaces ?? [];

  if (list.length === 0) {
    return (
      <div className="empty-search">
        還沒有刪除紀錄。
        <br />
        之後從行程刪掉的地點會留在這裡，連當時寫的備註一起。
      </div>
    );
  }

  return (
    <>
      {list.map((rec) => (
        <Row key={rec.placeId} rec={rec} dayId={day?.id ?? null} dayIndex={day?.dayIndex ?? null} />
      ))}
    </>
  );
}
