import MapView from '../map/MapView';

export default function MapPanel() {
  return (
    <section className="map-panel">
      <MapView />
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot hotel" />
          <span>飯店</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot added" />
          <span>已加入</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot search" />
          <span>搜尋結果</span>
        </div>
      </div>
    </section>
  );
}
