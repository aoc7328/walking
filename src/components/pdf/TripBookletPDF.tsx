/**
 * 騎馬釘版 PDF：
 * - 每張實體紙 = A4 橫向（842×595pt），對摺後變兩頁 A5（420×595pt）
 * - 頁數補成 4 的倍數
 * - 套用 saddle stitch imposition：依「外摺 [N,1] / 內摺 [2,N-1] / ...」順序印
 * - 列印時：A4 橫向、雙面（短邊翻頁 / long edge depending on layout）、印完全部對摺裝訂
 */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import type { Trip, DayPlan, Leg } from '../../types/trip';
import {
  formatWithWeekday,
  formatStayDuration,
  formatRange,
  diffDays,
  addDays,
} from '../../utils/date';
import { TRANSPORT_LABEL, formatDuration } from '../../utils/format';
import { buildStaticMapWithPath, hasApiKey } from '../../services/googleMaps';
import { computeDayMarkers } from '../map/TripOverviewMap';

// ============ 字型（沿用 TripPDF 註冊的 NotoSansTC / NotoSerifTC / Times）============

// 不需要重複 Font.register —— TripPDF.tsx 已經做過全域註冊。
// 但如果只有 BookletPDF 被使用而 TripPDF 沒被 import，字型就沒註冊。
// 為了保險，這裡也註冊一次（react-pdf 對重複註冊是冪等的）。
const CJK_RE = /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿＀-￯]/;
Font.registerHyphenationCallback((word) => {
  if (CJK_RE.test(word)) return [...word];
  return [word];
});

// ============ Color tokens ============
const C = {
  bgPage: '#FAF7F0',
  bgCard: '#FFFFFF',
  inkPrimary: '#2C2620',
  inkSecondary: '#6B5F50',
  inkMuted: '#A89C8B',
  inkFaint: '#C9B894',
  accentPrimary: '#2C4A3D',
  accentWarm: '#D85A30',
  borderSoft: '#E8DFD0',
  borderMedium: '#D4C8B2',
};

// ============ 尺寸常數 ============
const A5_WIDTH = 420;   // pt
const A5_HEIGHT = 595;  // pt

// ============ Imposition ============

/**
 * 依騎馬釘規則重新排頁：N 必須是 4 的倍數，回傳 Array<[leftIdx, rightIdx]>，
 * 每個 pair 對應一張實體紙的一面，順序是「外摺正面 → 外摺背面 → 內摺正面 → ...」。
 * idx 是 0-indexed 對應 logical pages 陣列。
 *
 * 例：N=8 → [[7,0], [1,6], [5,2], [3,4]] （1-indexed: [8,1] [2,7] [6,3] [4,5]）
 */
function imposeOrder(N: number): Array<[number, number]> {
  if (N % 4 !== 0) throw new Error(`頁數必須是 4 的倍數，收到 ${N}`);
  const pairs: Array<[number, number]> = [];
  const sheets = N / 4;
  for (let s = 0; s < sheets; s++) {
    // 紙的外側（從外面看）：左=尾頁、右=首頁
    pairs.push([N - 1 - 2 * s, 2 * s]);
    // 紙的內側（攤開來看）：左=次頁、右=倒數第二頁
    pairs.push([2 * s + 1, N - 2 - 2 * s]);
  }
  return pairs;
}

// ============ 共用 helpers ============

function getEndDate(trip: Trip): string {
  return addDays(trip.startDate, trip.days.length - 1);
}

// ============ 半張頁面樣式（A5 portrait） ============

const half = StyleSheet.create({
  base: {
    width: A5_WIDTH,
    height: A5_HEIGHT,
    backgroundColor: C.bgPage,
    color: C.inkPrimary,
    fontFamily: 'NotoSansTC',
    paddingTop: 28,
    paddingBottom: 22,
    paddingLeft: 30,
    paddingRight: 30,
    flexDirection: 'column',
  },
});

// Spacer
const spacer = { flex: 1 };

// ============ 封面 half ============

const coverStyle = StyleSheet.create({
  rule: {
    width: 50,
    height: 0.5,
    backgroundColor: C.accentWarm,
    marginTop: 14,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'NotoSerifTC',
    fontWeight: 700,
    fontSize: 32,
    color: C.inkPrimary,
    lineHeight: 1.2,
    letterSpacing: -0.6,
  },
  range: {
    fontFamily: 'Times-Italic',
    fontSize: 14,
    color: C.inkSecondary,
  },
  days: {
    fontFamily: 'NotoSerifTC',
    fontSize: 11,
    color: C.inkMuted,
    marginTop: 3,
  },
  footer: {
    fontFamily: 'NotoSansTC',
    fontSize: 8,
    color: C.inkMuted,
    letterSpacing: 1.5,
    textAlign: 'center',
  },
});

function CoverHalf({ trip }: { trip: Trip }) {
  const end = getEndDate(trip);
  const total = diffDays(trip.startDate, end) + 1;
  return (
    <View style={half.base}>
      <View style={spacer} />
      <Text style={coverStyle.title}>{trip.name}</Text>
      <View style={coverStyle.rule} />
      <Text style={coverStyle.range}>{formatRange(trip.startDate, end)}</Text>
      <Text style={coverStyle.days}>{total} 天</Text>
      <View style={spacer} />
      <Text style={coverStyle.footer}>胖齊肥柔去走走　·　TRIP BOOKLET</Text>
    </View>
  );
}

// ============ 整段行程地圖 half（封面背後／內頁第二頁）============

const overviewStyle = StyleSheet.create({
  label: {
    fontFamily: 'NotoSerifTC',
    fontSize: 10,
    color: C.inkMuted,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  mapImage: {
    width: '100%',
    flex: 1,
    objectFit: 'cover',
    borderRadius: 3,
  },
  caption: {
    fontFamily: 'NotoSansTC',
    fontSize: 9,
    color: C.inkMuted,
    marginTop: 8,
    textAlign: 'center',
  },
});

function OverviewMapHalf({ trip }: { trip: Trip }) {
  const days = computeDayMarkers(trip);
  const markers = days.map((d) => ({ lat: d.lat, lng: d.lng }));
  const path = days.map((d) => ({ lat: d.lat, lng: d.lng }));
  const mapUrl = hasApiKey()
    ? buildStaticMapWithPath(markers, path, '600x800')
    : null;
  const end = getEndDate(trip);
  return (
    <View style={half.base}>
      <Text style={overviewStyle.label}>整段行程　ROUTE OVERVIEW</Text>
      {mapUrl && <Image src={mapUrl} style={overviewStyle.mapImage} />}
      <Text style={overviewStyle.caption}>
        {formatRange(trip.startDate, end)}　·　{trip.days.length} 天
      </Text>
    </View>
  );
}

// ============ 空白 half ============

function BlankHalf() {
  return <View style={half.base} />;
}

// ============ 當日 half ============

const dayHeaderStyle = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  left: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  dayLabel: {
    fontFamily: 'Times-Roman',
    fontSize: 20,
    color: C.accentPrimary,
    letterSpacing: -0.4,
  },
  dayNum: {
    fontFamily: 'Times-Italic',
    fontSize: 20,
    color: C.accentPrimary,
    letterSpacing: -0.4,
  },
  progress: {
    fontFamily: 'NotoSansTC',
    fontSize: 10,
    color: C.inkMuted,
    marginLeft: 2,
  },
  right: { flexDirection: 'column', alignItems: 'flex-end' },
  tripName: {
    fontFamily: 'NotoSerifTC',
    fontSize: 10,
    fontWeight: 500,
    color: C.inkPrimary,
  },
  date: {
    fontFamily: 'NotoSerifTC',
    fontSize: 9,
    color: C.inkSecondary,
    marginTop: 1,
  },
  divider: {
    width: '100%',
    height: 0.5,
    backgroundColor: C.borderMedium,
    marginTop: 4,
    marginBottom: 8,
  },
});

function buildCardStyles(scale: number) {
  const s = (n: number) => n * scale;
  return StyleSheet.create({
    card: {
      backgroundColor: C.bgCard,
      border: `0.5pt solid ${C.borderSoft}`,
      borderRadius: s(3),
      paddingTop: s(5),
      paddingBottom: s(5),
      paddingLeft: s(7),
      paddingRight: s(7),
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s(6),
      marginBottom: s(3),
    },
    markerStack: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: s(3),
    },
    marker: {
      width: s(18),
      height: s(18),
      borderRadius: s(9),
      backgroundColor: C.accentPrimary,
      color: 'white',
      textAlign: 'center',
      fontFamily: 'Times-Bold',
      fontSize: s(9),
      paddingTop: s(4),
    },
    emojiBadge: {
      fontFamily: 'NotoSansTC',
      fontSize: s(13),
      lineHeight: 1,
      textAlign: 'center',
      width: s(18),
    },
    body: { flex: 1, flexDirection: 'column' },
    time: {
      fontFamily: 'Times-Bold',
      fontSize: s(12),
      color: C.accentPrimary,
      marginBottom: s(1),
    },
    name: {
      fontFamily: 'NotoSerifTC',
      fontWeight: 500,
      color: C.inkPrimary,
      lineHeight: 1.2,
    },
    stay: {
      fontFamily: 'NotoSansTC',
      fontSize: s(8),
      color: C.inkMuted,
      marginTop: s(1),
    },
    notes: {
      marginTop: s(4),
      paddingTop: s(3),
      borderTop: `0.5pt dashed ${C.borderMedium}`,
      flexDirection: 'column',
      gap: s(1),
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s(3),
    },
    noteBullet: {
      color: C.accentWarm,
      fontSize: s(8),
      lineHeight: 1.3,
    },
    noteText: {
      fontFamily: 'NotoSansTC',
      fontSize: s(8),
      color: C.inkSecondary,
      lineHeight: 1.3,
      flex: 1,
    },
    leg: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: s(26),
      paddingTop: s(2),
      paddingBottom: s(2),
      gap: s(3),
    },
    legMode: {
      fontFamily: 'NotoSansTC',
      fontSize: s(8),
      fontWeight: 500,
      color: C.accentPrimary,
    },
    legDot: { fontSize: s(8), color: C.inkFaint },
    legTime: {
      fontFamily: 'NotoSansTC',
      fontSize: s(8),
      color: C.inkMuted,
    },
  });
}

function computeBookletScale(N: number): number {
  if (N <= 4) return 1.0;
  if (N <= 6) return 0.92;
  if (N <= 8) return 0.85;
  if (N <= 10) return 0.78;
  if (N <= 12) return 0.72;
  return 0.65;
}

function computeBookletMapHeight(N: number): number {
  if (N <= 4) return 180;
  if (N <= 6) return 150;
  if (N <= 8) return 130;
  if (N <= 10) return 110;
  if (N <= 12) return 95;
  return 80;
}

function computeNameFontSize(name: string, baseSize: number): number {
  let weight = 0;
  for (const ch of name) weight += /[　-鿿＀-￯]/.test(ch) ? 2 : 1;
  // A5 比 A4 窄，閾值要更嚴
  if (weight <= 32) return baseSize;
  if (weight <= 44) return baseSize * 0.88;
  if (weight <= 60) return baseSize * 0.78;
  return baseSize * 0.68;
}

const footerStyle = StyleSheet.create({
  row: {
    flexShrink: 0,
    paddingTop: 4,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  text: {
    fontFamily: 'NotoSansTC',
    fontSize: 8,
    color: C.inkMuted,
  },
});

const dayMapStyle = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    marginTop: 8,
  },
  label: {
    fontFamily: 'NotoSerifTC',
    fontSize: 8,
    color: C.inkMuted,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  image: {
    width: '100%',
    objectFit: 'cover',
    borderRadius: 2,
  },
});

function DayHalf({
  trip,
  day,
  totalDays,
}: {
  trip: Trip;
  day: DayPlan;
  totalDays: number;
}) {
  const N = day.items.length;
  const scale = computeBookletScale(N);
  const styles = buildCardStyles(scale);
  const mapHeight = computeBookletMapHeight(N);
  const baseNameSize = 10 * scale;

  const markers = day.items.map((it) => ({
    lat: it.place.coordinates.lat,
    lng: it.place.coordinates.lng,
  }));
  const path = day.items.map((it) => it.place.coordinates);
  const dayMapUrl = hasApiKey()
    ? buildStaticMapWithPath(markers, path, '500x300')
    : null;

  return (
    <View style={half.base}>
      {/* Header */}
      <View style={dayHeaderStyle.row}>
        <View style={dayHeaderStyle.left}>
          <Text style={dayHeaderStyle.dayLabel}>
            Day <Text style={dayHeaderStyle.dayNum}>{day.dayIndex}</Text>
          </Text>
          <Text style={dayHeaderStyle.progress}>/ {totalDays}</Text>
        </View>
        <View style={dayHeaderStyle.right}>
          <Text style={dayHeaderStyle.tripName}>{trip.name}</Text>
          <Text style={dayHeaderStyle.date}>{formatWithWeekday(day.date)}</Text>
        </View>
      </View>
      <View style={dayHeaderStyle.divider} />

      {/* 卡片區 */}
      <View style={{ flex: 1, flexDirection: 'column' }}>
        {day.items.map((item, idx) => {
          const leg: Leg | undefined = idx > 0 ? day.legs[idx - 1] : undefined;
          const markerLabel = String(idx + 1);
          const nameFontSize = computeNameFontSize(item.place.name, baseNameSize);
          return (
            <View key={item.id}>
              {leg && (
                <View style={styles.leg}>
                  <Text style={styles.legMode}>{TRANSPORT_LABEL[leg.mode] ?? leg.mode}</Text>
                  <Text style={styles.legDot}>·</Text>
                  <Text style={styles.legTime}>{formatDuration(leg.durationMinutes)}</Text>
                </View>
              )}
              <View style={styles.card}>
                <View style={styles.markerStack}>
                  <Text style={styles.marker}>{markerLabel}</Text>
                  {item.place.iconEmoji && (
                    <Text style={styles.emojiBadge}>{item.place.iconEmoji}</Text>
                  )}
                </View>
                <View style={styles.body}>
                  <Text style={styles.time}>{item.arrivalTime}</Text>
                  <Text style={[styles.name, { fontSize: nameFontSize }]}>
                    {item.place.name}
                  </Text>
                  <Text style={styles.stay}>{formatStayDuration(item.stayMinutes)}</Text>
                  {item.notes && item.notes.length > 0 && (
                    <View style={styles.notes}>
                      {item.notes.map((n, i) => (
                        <View key={i} style={styles.noteRow}>
                          <Text style={styles.noteBullet}>·</Text>
                          <Text style={styles.noteText}>{n}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* 當日路線地圖 */}
      <View style={dayMapStyle.wrap}>
        <Text style={dayMapStyle.label}>當日路線　TODAY&apos;S ROUTE</Text>
        {dayMapUrl && <Image src={dayMapUrl} style={[dayMapStyle.image, { height: mapHeight }]} />}
      </View>

      {/* Footer */}
      <View style={footerStyle.row}>
        <Text style={footerStyle.text}>
          {formatWithWeekday(day.date)}　·　Day {day.dayIndex} / {totalDays}
        </Text>
      </View>
    </View>
  );
}

// ============ Document ============

// 騎馬釘整本 A4 橫向頁面（一張紙的一面 = 兩個 A5 並排）
const sheetStyle = StyleSheet.create({
  page: {
    flexDirection: 'row',
    backgroundColor: C.bgPage,
  },
});

export function TripBookletPDF({ trip }: { trip: Trip }) {
  const end = getEndDate(trip);
  const totalDays = diffDays(trip.startDate, end) + 1;
  const daysWithItems = trip.days.filter((d) => d.items.length > 0);

  // 1. 收集 logical pages（每個 = A5 內容元件）
  const logicalPages: React.ReactElement[] = [];
  logicalPages.push(<CoverHalf trip={trip} key="cover" />);
  logicalPages.push(<OverviewMapHalf trip={trip} key="overview" />);
  for (const day of daysWithItems) {
    logicalPages.push(
      <DayHalf trip={trip} day={day} totalDays={totalDays} key={day.id} />,
    );
  }

  // 2. 補空白頁到 4 的倍數（補在最後 = 內封底）
  while (logicalPages.length % 4 !== 0) {
    logicalPages.push(<BlankHalf key={`blank-${logicalPages.length}`} />);
  }

  // 3. Imposition
  const N = logicalPages.length;
  const pairs = imposeOrder(N);

  // 4. 每個 pair 變成一張 A4 橫向 PDF page
  return (
    <Document title={`${trip.name} - 騎馬釘版`}>
      {pairs.map(([leftIdx, rightIdx], i) => (
        <Page
          key={i}
          size="A4"
          orientation="landscape"
          style={sheetStyle.page}
        >
          {logicalPages[leftIdx]}
          {logicalPages[rightIdx]}
        </Page>
      ))}
    </Document>
  );
}
