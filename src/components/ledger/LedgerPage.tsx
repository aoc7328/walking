import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { getLedger } from '../../utils/ledger';
import { printLedgerReport } from '../../services/ledgerReport';
import PreDeparturePage from './PreDeparturePage';
import DuringTripPage from './DuringTripPage';
import AnalysisPage from './AnalysisPage';
import SettingsPage from './SettingsPage';
import { BackToTop } from './LedgerNav';
import TripSwitcher from '../layout/TripSwitcher';

type Tab = 'pre' | 'during' | 'analysis' | 'settings';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pre', label: '出發前 · 預訂' },
  { key: 'during', label: '出發後 · 流水帳' },
  { key: 'analysis', label: '消費分析' },
  { key: 'settings', label: '設定' },
];

export default function LedgerPage() {
  const open = useUIStore((s) => s.ledgerModalOpen);
  const close = useUIStore((s) => s.closeLedgerModal);
  const openOverviewModal = useUIStore((s) => s.openOverviewModal);
  const openNotesModal = useUIStore((s) => s.openNotesModal);
  const openDownloadModal = useUIStore((s) => s.openDownloadModal);
  const openShareModal = useUIStore((s) => s.openShareModal);
  const trip = useTripStore((s) => s.trip);
  const dirty = useTripStore((s) => s.dirty);
  const saveTrip = useTripStore((s) => s.saveTrip);
  const saveAsNewTrip = useTripStore((s) => s.saveAsNewTrip);
  const persisted = useTripStore((s) => s.persisted);
  const [tab, setTab] = useState<Tab>('pre');
  const [saving, setSaving] = useState(false);

  if (!open || !trip) return null;

  const ledger = getLedger(trip);
  const pendingTodos = trip.todos?.filter((t) => !t.done && t.text.trim() !== '').length ?? 0;

  async function handleSave() {
    if (saving) return;
    setSaving(true);
    try {
      if (persisted) {
        await saveTrip();
      } else {
        const name = window.prompt('這趟還沒存過，要存成新行程。行程名稱：', trip?.name ?? '新行程');
        if (name) await saveAsNewTrip(name);
      }
    } catch (err) {
      window.alert('儲存失敗：' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="ledger-page">
      <div className="ledger-page-bar">
        <button className="ledger-page-back" onClick={close} title="回到行程地圖">
          ← 返回行程
        </button>
        <div className="ledger-page-heading">
          <span className="ledger-page-title">帳本</span>
          <span className="ledger-page-meta">
            {trip.name}　·　1 {ledger.localCurrency} = {ledger.fxRate} TWD
          </span>
        </div>
        <div className="ledger-page-bar-actions">
          <button className="btn" onClick={openOverviewModal} title="整段行程總覽地圖">總覽</button>
          <button className="btn btn-badge-host" onClick={openNotesModal} title="出發前待辦提醒（私人）">
            待辦
            {pendingTodos > 0 && <span className="todo-badge" aria-label={`${pendingTodos} 項未完成`}>{pendingTodos}</span>}
          </button>
          <TripSwitcher />
          <button className="btn" onClick={() => printLedgerReport(trip, ledger)} title="列印整本帳結算單（可存成 PDF）">列印 / PDF</button>
          <button className="btn" onClick={openDownloadModal} title="下載 PDF（普通版 / 騎馬釘小冊子）">下載</button>
          <button className="btn" onClick={openShareModal} title="產生 QR Code 與分享連結">分享</button>
          <button
            className={`btn${dirty || !persisted ? ' btn-primary' : ''}`}
            onClick={handleSave}
            disabled={saving || (persisted && !dirty)}
            title="把帳本變更存到雲端，重整也不會不見"
          >
            {saving ? '儲存中…' : !persisted ? '另存行程' : dirty ? '儲存 ●' : '已儲存'}
          </button>
        </div>
      </div>

      <div className="ledger-page-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`ledger-page-tab${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="ledger-page-body">
        {tab === 'pre' && <PreDeparturePage ledger={ledger} tripName={trip.name} />}
        {tab === 'during' && <DuringTripPage ledger={ledger} />}
        {tab === 'analysis' && <AnalysisPage ledger={ledger} trip={trip} />}
        {tab === 'settings' && <SettingsPage ledger={ledger} tripName={trip.name} />}
      </div>
      <BackToTop />
    </div>
  );
}
