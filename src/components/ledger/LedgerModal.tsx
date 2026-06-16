import { useState } from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useTripStore } from '../../stores/tripStore';
import { getLedger } from '../../utils/ledger';

type Tab = 'pre' | 'during' | 'analysis';

const TABS: { key: Tab; label: string }[] = [
  { key: 'pre', label: '出發前 · 預訂' },
  { key: 'during', label: '出發後 · 流水帳' },
  { key: 'analysis', label: '消費分析' },
];

/** 各分頁 P1 先放結構說明的空殼，P2/P3 再填進真正的表與圖。 */
const PLACEHOLDER: Record<Tab, { title: string; lines: string[] }> = {
  pre: {
    title: '出發前 · 已知 / 預訂項目',
    lines: [
      '住宿訂房表（付款狀態・區域・店名・入住日+晚數・每晚價+幣別・含早餐・平台・刷卡日）',
      '餐廳預訂表（狀態・種類・時間・訂位資訊・預約管道/編號・開銷・支付）— 可匯出 CSV/PDF 給秘書',
      '其他固定項（交通/簽證/保險/eSIM…）',
      '各類別預算設定（餐飲、購物…的預算天花板）',
    ],
  },
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
      '三大塊圓環：固定成本 / 吃飯 / 購物',
      '各類別明細比例',
    ],
  },
};

export default function LedgerModal() {
  const open = useUIStore((s) => s.ledgerModalOpen);
  const close = useUIStore((s) => s.closeLedgerModal);
  const trip = useTripStore((s) => s.trip);
  const [tab, setTab] = useState<Tab>('pre');

  if (!open || !trip) return null;

  const ledger = getLedger(trip);
  const ph = PLACEHOLDER[tab];

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
          <button className="btn" onClick={close} title="關閉">關閉</button>
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
          <div className="ledger-placeholder">
            <div className="ledger-placeholder-title">{ph.title}</div>
            <ul className="ledger-placeholder-list">
              {ph.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="ledger-placeholder-note">這個分頁的內容即將上線。</div>
          </div>
        </div>
      </div>
    </div>
  );
}
