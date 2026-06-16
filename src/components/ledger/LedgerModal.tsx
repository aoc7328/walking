import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { getLedger } from '../../utils/ledger';
import { SAMPLE_KYUSHU_LEDGER } from '../../db/sampleLedger';
import PreDepartureTab from './PreDepartureTab';

type Tab = 'pre' | 'during' | 'analysis';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pre', label: '出發前 · 預訂' },
  { key: 'during', label: '出發後 · 流水帳' },
  { key: 'analysis', label: '消費分析' },
];

const PLACEHOLDER: Record<Tab, { title: string; lines: string[] }> = {
  pre: { title: '', lines: [] },
  during: {
    title: '出發後 · 旅途流水帳',
    lines: [
      '各類別預算進度條（已預訂 + 現場已花 + 剩餘可花，三段拆解）',
      '信用卡額度面板（每張卡已刷 / 上限，快滿變紅）',
      '流水帳明細（日期・分類・項目・金額雙向換算・支付方式）',
    ],
  },
  analysis: {
    title: '消費分析',
    lines: [
      '預估總額 vs 實際總額 + 差距',
      '五類別佔比圓環：交通 / 住宿 / 飲食 / 購物 / 其他',
      '前期開銷 vs 流水帳 大項彙總',
    ],
  },
};

export default function LedgerModal() {
  const open = useUIStore((s) => s.ledgerModalOpen);
  const close = useUIStore((s) => s.closeLedgerModal);
  const trip = useTripStore((s) => s.trip);
  const updateLedger = useTripStore((s) => s.updateLedger);
  const [tab, setTab] = useState<Tab>('pre');

  if (!open || !trip) return null;

  const ledger = getLedger(trip);

  function loadSample() {
    if (window.confirm('載入九州實帳範例？這會覆蓋目前這趟行程的帳本內容。')) {
      updateLedger(() => structuredClone(SAMPLE_KYUSHU_LEDGER));
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="ledger-modal">
        <div className="ledger-modal-header">
          <div>
            <div className="ledger-modal-title">帳本</div>
            <div className="ledger-modal-meta">
              {trip.name}　·　{ledger.localCurrency} ↔ TWD　·　匯率 1 {ledger.localCurrency} = {ledger.fxRate} TWD
            </div>
          </div>
          <div className="ledger-modal-header-actions">
            <button className="btn" onClick={loadSample} title="一鍵灌入九州實帳，方便用真實資料檢視">載入九州實帳</button>
            <button className="btn" onClick={close} title="關閉">關閉</button>
          </div>
        </div>

        <div className="ledger-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`ledger-tab${tab === t.key ? ' active' : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="ledger-modal-body">
          {tab === 'pre' ? (
            <PreDepartureTab ledger={ledger} tripName={trip.name} />
          ) : (
            <div className="ledger-placeholder">
              <div className="ledger-placeholder-title">{PLACEHOLDER[tab].title}</div>
              <ul className="ledger-placeholder-list">
                {PLACEHOLDER[tab].lines.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              <div className="ledger-placeholder-note">這個分頁的內容即將上線。</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
