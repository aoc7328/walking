import { HOME_CURRENCY } from '../types/ledger';

/**
 * 雙向匯率換算工具。
 * 約定：fxRate = 1 單位當地貨幣值多少台幣（例如 1 JPY = 0.21 TWD → fxRate=0.21）。
 */

/** 任意幣別金額換算成台幣。currency===TWD 直接回傳。 */
export function toTWD(amount: number, currency: string, fxRate: number): number {
  if (!Number.isFinite(amount)) return 0;
  if (currency === HOME_CURRENCY) return amount;
  return amount * fxRate;
}

/** 台幣換算成當地貨幣。fxRate 為 0 時回 0（避免除以 0）。 */
export function fromTWD(twd: number, fxRate: number): number {
  if (!Number.isFinite(twd) || !fxRate) return 0;
  return twd / fxRate;
}

/**
 * 給一筆「金額 + 幣別」，回傳「另一個幣別」的等值。
 * 輸入當地幣 → 回台幣；輸入台幣 → 回當地幣。
 * 用在輸入框旁邊即時顯示換算（付現記當地、刷卡記台幣都能互參照）。
 */
export function convertCounterpart(
  amount: number,
  currency: string,
  localCurrency: string,
  fxRate: number,
): { amount: number; currency: string } {
  if (currency === HOME_CURRENCY) {
    return { amount: fromTWD(amount, fxRate), currency: localCurrency };
  }
  return { amount: amount * fxRate, currency: HOME_CURRENCY };
}

/** 千分位整數格式（四捨五入）。 */
export function formatAmount(amount: number): string {
  return Math.round(amount || 0).toLocaleString('en-US');
}

/** 帶幣別前綴的金額，例如 'NT$7,560'、'¥36,000'、'NZD 138'。 */
export function formatMoney(amount: number, currency: string): string {
  const n = formatAmount(amount);
  switch (currency) {
    case 'TWD':
      return `NT$${n}`;
    case 'JPY':
      return `¥${n}`;
    case 'USD':
      return `$${n}`;
    case 'EUR':
      return `€${n}`;
    case 'CNY':
      return `¥${n}`;
    case 'KRW':
      return `₩${n}`;
    default:
      return `${currency} ${n}`;
  }
}
