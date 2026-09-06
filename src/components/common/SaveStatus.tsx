import { useTripStore } from '../../stores/tripStore';

/**
 * 自動儲存的狀態指示，取代原本的「儲存」按鈕。
 *
 * 平常是不能點的純文字（沒有東西要使用者做）。只有存不進去的時候才變成可點的
 * 重試按鈕——這是唯一需要使用者注意的狀態，所以做得明顯。
 *
 * mock 範例行程（persisted === false）不自動存，這時候仍然顯示「另存新行程」，
 * 由呼叫端接手，因為它需要先取名字。
 */
export default function SaveStatus({ onSaveAs }: { onSaveAs: () => void }) {
  const persisted = useTripStore((s) => s.persisted);
  const dirty = useTripStore((s) => s.dirty);
  const saveState = useTripStore((s) => s.saveState);
  const lastSavedAt = useTripStore((s) => s.lastSavedAt);
  const saveError = useTripStore((s) => s.saveError);
  const retrySave = useTripStore((s) => s.retrySave);

  if (!persisted) {
    return (
      <button className={`btn${dirty ? ' btn-primary' : ''}`} onClick={onSaveAs} title="這趟還沒存過，要先取名另存成新行程">
        另存新行程
      </button>
    );
  }

  if (saveState === 'error') {
    return (
      <button
        className="btn btn-savestate error"
        onClick={retrySave}
        title={`存不進雲端：${saveError ?? '未知錯誤'}\n變更還在這個分頁裡，網路恢復會自動再試，也可以點這裡立刻重試。`}
      >
        ⚠ 未同步，點一下重試
      </button>
    );
  }

  const time = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;
  const label =
    saveState === 'saving' ? '儲存中…' : dirty ? '尚未儲存…' : time ? `已自動儲存 ${time}` : '已自動儲存';

  return (
    <span className={`btn btn-savestate${saveState === 'saving' || dirty ? ' busy' : ''}`} title="每次編輯都會自動存到雲端，不用手動按儲存">
      {label}
    </span>
  );
}
