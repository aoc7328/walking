import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import type { Trip } from '../../types/trip';
import { formatWithWeekday, formatStayDuration } from '../../utils/date';
import { TRANSPORT_LABEL, formatDuration } from '../../utils/format';
import { buildStaticMapUrl, hasApiKey } from '../../services/googleMaps';

// 註冊繁中字型，否則 @react-pdf 預設 Helvetica 沒有 CJK 字元 → 亂碼
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

const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansTC',
    paddingTop: 36,
    paddingBottom: 36,
    paddingHorizontal: 40,
    backgroundColor: '#FAF7F0',
  },
  title: {
    fontSize: 26,
    color: '#2C4A3D',
    marginBottom: 4,
  },
  meta: {
    fontSize: 14,
    color: '#A89C8B',
    marginBottom: 16,
  },
  dayHeading: {
    fontSize: 20,
    color: '#2C4A3D',
    marginBottom: 6,
    borderBottom: '0.5pt solid #E8DFD0',
    paddingBottom: 4,
  },
  mapImage: {
    width: '100%',
    height: 180,
    marginBottom: 10,
    borderRadius: 4,
  },
  card: {
    backgroundColor: '#FFFFFF',
    border: '0.5pt solid #E8DFD0',
    borderRadius: 4,
    padding: 8,
    marginBottom: 4,
    flexDirection: 'row',
    gap: 8,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2C4A3D',
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
    paddingTop: 5,
  },
  markerHotel: {
    backgroundColor: '#5B4B7F',
  },
  cardBody: {
    flexDirection: 'column',
    flex: 1,
  },
  timeName: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 2,
  },
  time: {
    fontSize: 15,
    color: '#2C4A3D',
    fontWeight: 500,
  },
  name: {
    fontSize: 15,
    color: '#2C2620',
    fontWeight: 500,
  },
  stay: {
    fontSize: 13,
    color: '#A89C8B',
  },
  addr: {
    fontSize: 13,
    color: '#A89C8B',
    marginTop: 1,
  },
  note: {
    fontSize: 13,
    color: '#6B5F50',
    marginTop: 2,
  },
  leg: {
    fontSize: 13,
    color: '#A89C8B',
    paddingLeft: 32,
    paddingVertical: 4,
  },
});

export function TripPDF({ trip }: { trip: Trip }) {
  return (
    <Document title={trip.name}>
      {trip.days.map((day) => {
        const markers = day.items.map((it, idx) => ({
          lat: it.place.coordinates.lat,
          lng: it.place.coordinates.lng,
          label: it.isHotel ? 'H' : String(idx + 1),
          color: it.isHotel ? 'purple' : 'green',
        }));
        const mapUrl = hasApiKey() && markers.length > 0 ? buildStaticMapUrl(markers, '700x350') : null;

        return (
          <Page key={day.id} size="A4" style={styles.page}>
            <Text style={styles.title}>{trip.name}</Text>
            <Text style={styles.meta}>
              Day {day.dayIndex}　·　{formatWithWeekday(day.date)}
              {day.city ? `　·　${day.city}` : ''}
            </Text>
            <Text style={styles.dayHeading}>當日行程</Text>
            {mapUrl && <Image style={styles.mapImage} src={mapUrl} />}
            {day.items.map((it, idx) => {
              const leg = idx > 0 ? day.legs[idx - 1] : null;
              const markerLabel = it.isHotel ? 'H' : String(idx + 1);
              return (
                <View key={it.id}>
                  {leg && (
                    <Text style={styles.leg}>
                      {TRANSPORT_LABEL[leg.mode] ?? leg.mode}　·　{formatDuration(leg.durationMinutes)}
                    </Text>
                  )}
                  <View style={styles.card}>
                    <Text style={[styles.marker, ...(it.isHotel ? [styles.markerHotel] : [])]}>
                      {markerLabel}
                    </Text>
                    <View style={styles.cardBody}>
                      <View style={styles.timeName}>
                        <Text style={styles.time}>{it.arrivalTime}</Text>
                        <Text style={styles.name}>{it.place.name}</Text>
                      </View>
                      <Text style={styles.stay}>{formatStayDuration(it.stayMinutes)}</Text>
                      <Text style={styles.addr}>{it.place.address}</Text>
                      {it.notes &&
                        it.notes.map((n, i) => (
                          <Text key={i} style={styles.note}>
                            • {n}
                          </Text>
                        ))}
                    </View>
                  </View>
                </View>
              );
            })}
          </Page>
        );
      })}
    </Document>
  );
}
