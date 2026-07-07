import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';
import type { Trip, DayPlan, ItineraryItem, Leg, DayNote } from '../../types/trip';
import { printableDayNote } from '../../utils/dayNote';
import {
  formatWithWeekday,
  formatStayDuration,
  formatRange,
  diffDays,
  addDays,
} from '../../utils/date';
import { TRANSPORT_LABEL, formatDuration } from '../../utils/format';
import { buildStaticMapUrl, buildStaticMapWithPath, hasApiKey } from '../../services/googleMaps';
import { computeDayMarkers } from '../map/TripOverviewMap';

// ========== Fonts ==========
// 西文顯示字型用 react-pdf 內建 Times（不需要網路、零失敗風險）
// - Times-Roman  : 一般
// - Times-Italic : 斜體（封面標題）
// - Times-Bold   : 粗體

// Noto Sans TC — 中文黑體（內文、標籤、備註等次要文字）
Font.register({
  family: 'NotoSansTC',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/TC/NotoSansTC-Regular.otf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/TC/NotoSansTC-Medium.otf',
      fontWeight: 500,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/TC/NotoSansTC-Bold.otf',
      fontWeight: 700,
    },
  ],
});

// Noto Serif TC — 中文明體（用在標題、地點名稱等需要質感的文字）
Font.register({
  family: 'NotoSerifTC',
  fonts: [
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Serif/SubsetOTF/TC/NotoSerifTC-Regular.otf',
      fontWeight: 400,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Serif/SubsetOTF/TC/NotoSerifTC-Medium.otf',
      fontWeight: 500,
    },
    {
      src: 'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Serif/SubsetOTF/TC/NotoSerifTC-Bold.otf',
      fontWeight: 700,
    },
  ],
});

// react-pdf 預設的斷詞會把 CJK 字串當成一整個「詞」不拆，導致長中文地名硬撐
// 把卡片撐爆。這裡客製：CJK 字串拆成單字元（讓任意字之間都能換行）；
// ASCII 字串保持原樣（不要在英文 word 中間斷字）。
const CJK_RE = /[　-〿぀-ゟ゠-ヿ㐀-䶿一-鿿＀-￯]/;
Font.registerHyphenationCallback((word) => {
  if (CJK_RE.test(word)) return [...word];
  return [word];
});

// ========== Color tokens ==========
const C = {
  bgPage: '#FAF7F0',
  bgCard: '#FFFFFF',
  inkPrimary: '#2C2620',
  inkSecondary: '#6B5F50',
  inkMuted: '#A89C8B',
  inkFaint: '#C9B894',
  accentPrimary: '#2C4A3D',
  accentWarm: '#D85A30',
  accentPurple: '#5B4B7F',
  borderSoft: '#E8DFD0',
  borderMedium: '#D4C8B2',
};

// ========== 共用 styles ==========
const base = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansTC',
    backgroundColor: C.bgPage,
    color: C.inkPrimary,
    paddingTop: 40,
    paddingBottom: 30,
    paddingLeft: 50,
    paddingRight: 50,
    flexDirection: 'column',
  },
  spacer: { flex: 1 },
});

// ========== Helpers ==========
function getEndDate(trip: Trip): string {
  return addDays(trip.startDate, trip.days.length - 1);
}

function nonHotelCountInDay(day: DayPlan): number {
  return day.items.filter((it) => !it.isHotel).length;
}

interface OverviewMapData {
  markers: { lat: number; lng: number; label?: string }[];
  path: { lat: number; lng: number }[];
}

function buildOverviewMapData(trip: Trip): OverviewMapData {
  const days = computeDayMarkers(trip);
  // Sampling 規則：N > 25 → 只標 1, 5, 10, 15, 20, 25, 30 ...
  const N = days.length;
  const samplePoints =
    N > 25 ? new Set([1, 5, 10, 15, 20, 25, 30, 35].filter((n) => n <= N)) : null;

  const markers = days.map((d) => {
    let showLabel = true;
    if (samplePoints) showLabel = samplePoints.has(d.dayIndex);
    return {
      lat: d.lat,
      lng: d.lng,
      label: showLabel && d.dayIndex <= 9 ? String(d.dayIndex) : undefined,
    };
  });
  const path = days.map((d) => ({ lat: d.lat, lng: d.lng }));
  return { markers, path };
}

function buildDayMapData(day: DayPlan): OverviewMapData {
  const markers = day.items.map((it, i) => ({
    lat: it.place.coordinates.lat,
    lng: it.place.coordinates.lng,
    label: i + 1 <= 9 ? String(i + 1) : undefined,
  }));
  const path = day.items.map((it) => it.place.coordinates);
  return { markers, path };
}

// ========== Cover Page ==========
const cover = StyleSheet.create({
  title: {
    fontFamily: 'NotoSerifTC',
    fontWeight: 700,
    fontSize: 44,
    color: C.inkPrimary,
    lineHeight: 1.2,
    letterSpacing: -1,
  },
  rule: {
    width: 60,
    height: 0.5,
    backgroundColor: C.accentWarm,
    marginTop: 16,
    marginBottom: 16,
  },
  range: {
    fontFamily: 'Times-Italic',
    fontSize: 17,
    color: C.inkSecondary,
  },
  days: {
    fontFamily: 'NotoSerifTC',
    fontSize: 13,
    color: C.inkMuted,
    marginTop: 4,
  },
  mapLabel: {
    fontFamily: 'NotoSansTC',
    fontSize: 10,
    color: C.inkMuted,
    letterSpacing: 1.8,
    marginBottom: 10,
  },
  mapImage: {
    width: '100%',
    height: 360,
    objectFit: 'cover',
    borderRadius: 4,
  },
});

function CoverPage({ trip }: { trip: Trip }) {
  const end = getEndDate(trip);
  const total = diffDays(trip.startDate, end) + 1;
  const overview = buildOverviewMapData(trip);
  const mapUrl = hasApiKey()
    ? buildStaticMapWithPath(overview.markers, overview.path, '700x400')
    : null;
  return (
    <Page size="A4" style={base.page}>
      <View style={base.spacer} />
      <Text style={cover.title}>{trip.name}</Text>
      <View style={cover.rule} />
      <Text style={cover.range}>{formatRange(trip.startDate, end)}</Text>
      <Text style={cover.days}>{total} 天</Text>
      <View style={base.spacer} />
      <Text style={cover.mapLabel}>行程總覽　ROUTE OVERVIEW</Text>
      {mapUrl && <Image src={mapUrl} style={cover.mapImage} />}
      <View style={base.spacer} />
    </Page>
  );
}

// ========== Day Page ==========
function computeScale(N: number): number {
  if (N <= 4) return 1.05;
  if (N <= 8) return 1.0;
  if (N <= 10) return 0.95;
  if (N <= 12) return 0.9;
  if (N <= 15) return 0.82;
  return 0.72;
}

function computeColumnsCount(N: number): number {
  return N <= 8 ? 2 : 3;
}

/**
 * 當日地圖高度（pt）。項目越多 → 地圖越矮，把空間讓給卡片，
 * 避免內容溢出到下一頁產生空白頁。
 */
function computeMapHeight(N: number): number {
  if (N <= 4) return 320;
  if (N <= 8) return 280;
  if (N <= 10) return 230;
  if (N <= 12) return 190;
  return 160;
}

const dayHeaderStyle = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 8,
  },
  left: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  dayLabel: {
    fontFamily: 'Times-Roman',
    fontSize: 28,
    color: C.accentPrimary,
    letterSpacing: -0.5,
  },
  dayNum: {
    fontFamily: 'Times-Italic',
    fontSize: 28,
    color: C.accentPrimary,
    letterSpacing: -0.5,
  },
  progress: {
    fontFamily: 'NotoSansTC',
    fontSize: 12,
    color: C.inkMuted,
    marginLeft: 2,
  },
  right: { flexDirection: 'column', alignItems: 'flex-end' },
  tripName: {
    fontFamily: 'NotoSerifTC',
    fontSize: 13,
    fontWeight: 500,
    color: C.inkPrimary,
  },
  date: {
    fontFamily: 'NotoSerifTC',
    fontSize: 12,
    color: C.inkSecondary,
    marginTop: 2,
  },
  divider: {
    width: '100%',
    height: 0.5,
    backgroundColor: C.borderMedium,
    marginTop: 8,
    marginBottom: 12,
  },
});

function DayHeader({
  trip,
  day,
  totalDays,
}: {
  trip: Trip;
  day: DayPlan;
  totalDays: number;
}) {
  return (
    <View>
      <View style={dayHeaderStyle.row}>
        <View style={dayHeaderStyle.left}>
          <Text style={dayHeaderStyle.dayLabel}>
            Day <Text style={dayHeaderStyle.dayNum}>{day.dayIndex}</Text>
          </Text>
          <Text style={dayHeaderStyle.progress}>
            / {totalDays}
          </Text>
        </View>
        <View style={dayHeaderStyle.right}>
          <Text style={dayHeaderStyle.tripName}>{trip.name}</Text>
          <Text style={dayHeaderStyle.date}>{formatWithWeekday(day.date)}</Text>
        </View>
      </View>
      <View style={dayHeaderStyle.divider} />
    </View>
  );
}

// 卡片 + leg 樣式（要 scale 動態縮放，所以用函式產生）
function buildCardStyles(scale: number) {
  const s = (n: number) => n * scale;
  return StyleSheet.create({
    card: {
      backgroundColor: C.bgCard,
      border: `0.5pt solid ${C.borderSoft}`,
      borderRadius: s(4),
      paddingTop: s(7),
      paddingBottom: s(7),
      paddingLeft: s(10),
      paddingRight: s(10),
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s(8),
    },
    markerStack: {
      flexDirection: 'column',
      alignItems: 'center',
      gap: s(4),
    },
    marker: {
      width: s(22),
      height: s(22),
      borderRadius: s(11),
      backgroundColor: C.accentPrimary,
      color: 'white',
      textAlign: 'center',
      fontFamily: 'Times-Bold',
      fontSize: s(11),
      paddingTop: s(5),
    },
    markerHotel: {
      backgroundColor: C.accentPurple,
    },
    emojiBadge: {
      fontFamily: 'NotoSansTC',
      fontSize: s(16),
      lineHeight: 1,
      textAlign: 'center',
      width: s(22),
    },
    body: {
      flex: 1,
      flexDirection: 'column',
    },
    time: {
      fontFamily: 'Times-Bold',
      fontSize: s(15),
      color: C.accentPrimary,
      marginBottom: s(2),
    },
    name: {
      fontFamily: 'NotoSerifTC',
      fontWeight: 500,
      color: C.inkPrimary,
      lineHeight: 1.25,
    },
    stay: {
      fontFamily: 'NotoSansTC',
      fontSize: s(10),
      color: C.inkMuted,
      marginTop: s(1),
    },
    notes: {
      marginTop: s(5),
      paddingTop: s(4),
      borderTop: `0.5pt dashed ${C.borderMedium}`,
      flexDirection: 'column',
      gap: s(2),
    },
    noteRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s(4),
    },
    noteBullet: {
      color: C.accentWarm,
      fontSize: s(10),
      lineHeight: 1.4,
    },
    noteText: {
      fontFamily: 'NotoSansTC',
      fontSize: s(10),
      color: C.inkSecondary,
      lineHeight: 1.4,
      flex: 1,
    },
    leg: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: s(34),
      paddingTop: s(4),
      paddingBottom: s(4),
      gap: s(4),
    },
    legMode: {
      fontFamily: 'NotoSansTC',
      fontSize: s(10),
      fontWeight: 500,
      color: C.accentPrimary,
    },
    legDot: {
      fontSize: s(10),
      color: C.inkFaint,
    },
    legTime: {
      fontFamily: 'NotoSansTC',
      fontSize: s(10),
      color: C.inkMuted,
    },
    crossLeg: {
      fontFamily: 'NotoSansTC',
      fontSize: s(9),
      color: C.inkMuted,
      paddingLeft: s(30),
      paddingTop: s(4),
      marginTop: s(2),
    },
    noteCardList: {
      flexDirection: 'column',
      gap: s(6),
      marginTop: s(8),
    },
    noteCard: {
      backgroundColor: C.bgCard,
      border: `0.5pt solid ${C.borderSoft}`,
      borderRadius: s(4),
      paddingTop: s(8),
      paddingBottom: s(8),
      paddingLeft: s(11),
      paddingRight: s(11),
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: s(8),
    },
    noteCardIcon: {
      fontFamily: 'NotoSansTC',
      fontSize: s(15),
      lineHeight: 1,
      width: s(20),
      textAlign: 'center',
    },
    noteCardText: {
      flex: 1,
      fontFamily: 'NotoSansTC',
      fontSize: s(11),
      color: C.inkPrimary,
      lineHeight: 1.5,
    },
  });
}

/** PDF 版這天的備註：無時間/地點，只有圖示（可選）＋ 自由文字（保留換行）。 */
function NoteBlock({
  note,
  styles,
}: {
  note: DayNote;
  styles: ReturnType<typeof buildCardStyles>;
}) {
  return (
    <View style={styles.noteCard}>
      {note.iconEmoji ? <Text style={styles.noteCardIcon}>{note.iconEmoji}</Text> : null}
      <Text style={styles.noteCardText}>{note.text}</Text>
    </View>
  );
}

/**
 * 估算地點名字應該用多大字級。
 * react-pdf 沒辦法像瀏覽器那樣量測 DOM，只能用啟發式：
 * - 計算「視覺重量」：CJK 字佔 2 單位、ASCII 佔 1 單位
 * - 依重量決定字級。一張卡片寬度大概能放 ~24 weight 一行；兩行可容 ~48。
 * - 超過 48 開始縮字，最多縮到 base 的 65%。
 *
 * 跟 in-app 的 useAutoFitText 同樣精神：先換行、塞不下才縮字。
 */
function computeNameFontSize(name: string, baseSize: number): number {
  let weight = 0;
  for (const ch of name) {
    weight += /[　-鿿＀-￯]/.test(ch) ? 2 : 1;
  }
  if (weight <= 48) return baseSize;
  if (weight <= 60) return baseSize * 0.88;
  if (weight <= 78) return baseSize * 0.78;
  return baseSize * 0.68;
}

function Card({
  item,
  index,
  styles,
  baseNameSize,
}: {
  item: ItineraryItem;
  index: number;
  styles: ReturnType<typeof buildCardStyles>;
  baseNameSize: number;
}) {
  const markerLabel = String(index + 1);
  const nameFontSize = computeNameFontSize(item.place.name, baseNameSize);
  return (
    <View style={styles.card}>
      <View style={styles.markerStack}>
        <Text style={[styles.marker, item.isHotel ? styles.markerHotel : {}]}>
          {markerLabel}
        </Text>
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
  );
}

function LegRow({
  leg,
  styles,
}: {
  leg: Leg;
  styles: ReturnType<typeof buildCardStyles>;
}) {
  return (
    <View style={styles.leg}>
      <Text style={styles.legMode}>{TRANSPORT_LABEL[leg.mode] ?? leg.mode}</Text>
      <Text style={styles.legDot}>·</Text>
      <Text style={styles.legTime}>{formatDuration(leg.durationMinutes)}</Text>
    </View>
  );
}

function CrossLeg({
  styles,
}: {
  styles: ReturnType<typeof buildCardStyles>;
}) {
  return <Text style={styles.crossLeg}>↳ 接續下一欄</Text>;
}

const dayMapStyle = StyleSheet.create({
  wrap: {
    flexShrink: 0,
    marginTop: 14,
  },
  label: {
    fontFamily: 'NotoSansTC',
    fontSize: 10,
    color: C.inkMuted,
    letterSpacing: 1.8,
    marginBottom: 6,
  },
  image: {
    width: '100%',
    objectFit: 'cover',
    borderRadius: 3,
  },
});

const footerStyle = StyleSheet.create({
  row: {
    flexShrink: 0,
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  text: {
    fontFamily: 'NotoSansTC',
    fontSize: 10,
    color: C.inkMuted,
  },
});

function DayPage({
  trip,
  day,
  totalDays,
}: {
  trip: Trip;
  day: DayPlan;
  totalDays: number;
}) {
  const N = day.items.length;
  const scale = computeScale(N);
  const styles = buildCardStyles(scale);
  const cols = computeColumnsCount(N);
  const cardsPerCol = Math.max(1, Math.ceil(N / cols));
  // 地點名字基準大小（隨 scale 動態縮放）。各 Card 再依字數啟發式微調。
  const baseNameSize = 12 * scale;
  const mapHeight = computeMapHeight(N);

  // 分欄
  const columns: ItineraryItem[][] = [];
  const itemIndices: number[][] = [];
  for (let c = 0; c < cols; c++) {
    const start = c * cardsPerCol;
    const end = Math.min(N, start + cardsPerCol);
    columns.push(day.items.slice(start, end));
    itemIndices.push(
      Array.from({ length: end - start }, (_, i) => start + i),
    );
  }

  // 這天的備註（有文字或圖示才印）。
  const note = printableDayNote(day);

  const dayMap = buildDayMapData(day);
  // 改用接近 1.75:1 的 aspect，跟 PDF 顯示區（A4 內容寬 ~495pt / 高 280pt）對齊，
  // 避免 objectFit:cover 切掉邊緣。只有真的有景點才畫當日地圖（放空日不畫）。
  const dayMapUrl = N > 0 && hasApiKey()
    ? buildStaticMapWithPath(dayMap.markers, dayMap.path, '700x400')
    : null;

  return (
    <Page size="A4" style={base.page} wrap={false}>
      <DayHeader trip={trip} day={day} totalDays={totalDays} />

      {/* 中段（flex 1 吃剩餘空間）：行程卡格線 + 小卡片 */}
      <View style={{ flex: 1 }}>
        {N > 0 && (
          <View style={{ flexDirection: 'row', gap: 14 }}>
            {columns.map((colItems, ci) => (
              <View key={ci} style={{ flex: 1, flexDirection: 'column', gap: 0 }}>
                {colItems.map((item, idx) => {
                  const globalIdx = itemIndices[ci]![idx]!;
                  const showLegBefore = idx > 0;
                  const prevGlobalIdx = globalIdx - 1;
                  const leg = showLegBefore ? day.legs[prevGlobalIdx] : null;
                  return (
                    <View key={item.id}>
                      {leg && <LegRow leg={leg} styles={styles} />}
                      <Card
                        item={item}
                        index={globalIdx}
                        styles={styles}
                        baseNameSize={baseNameSize}
                      />
                    </View>
                  );
                })}
                {ci < cols - 1 && colItems.length > 0 && <CrossLeg styles={styles} />}
              </View>
            ))}
          </View>
        )}

        {note && (
          <View style={styles.noteCardList}>
            <NoteBlock note={note} styles={styles} />
          </View>
        )}
      </View>

      {/* 當日路線地圖（放空日沒有景點 → 不畫） */}
      {N > 0 && (
        <View style={dayMapStyle.wrap}>
          <Text style={dayMapStyle.label}>當日路線　TODAY&apos;S ROUTE</Text>
          {dayMapUrl && (
            <Image
              src={dayMapUrl}
              style={[dayMapStyle.image, { height: mapHeight }]}
            />
          )}
        </View>
      )}

      {/* 頁尾 */}
      <View style={footerStyle.row}>
        <Text style={footerStyle.text}>
          {formatWithWeekday(day.date)}　·　Day {day.dayIndex} / {totalDays}
        </Text>
      </View>
    </Page>
  );
}

// ========== Document ==========
export function TripPDF({ trip }: { trip: Trip }) {
  const end = getEndDate(trip);
  const totalDays = diffDays(trip.startDate, end) + 1;
  // 有景點、或有備註（放空日）都要印；兩者皆空的天才略過。
  const daysWithItems = trip.days.filter((d) => d.items.length > 0 || !!printableDayNote(d));
  void nonHotelCountInDay; // 給未來 layout 用，先消除未用警告
  void buildStaticMapUrl;
  return (
    <Document title={trip.name}>
      <CoverPage trip={trip} />
      {daysWithItems.map((day) => (
        <DayPage key={day.id} trip={trip} day={day} totalDays={totalDays} />
      ))}
    </Document>
  );
}
