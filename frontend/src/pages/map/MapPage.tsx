import { useEffect, useState, useRef } from 'react';
import Layout from '../../components/Layout';
import client from '../../api/client';

interface TerritoryData {
  id: string; name: string; state: string | null; region: string | null;
  latitude: number | null; longitude: number | null;
  revenue: number; deals: number; colorBucket: 'HIGH' | 'MEDIUM' | 'LOW';
}

const COLOR_MAP = { HIGH: '#22c55e', MEDIUM: '#f59e0b', LOW: '#ef4444' };
const LABEL_MAP = { HIGH: '🟢 High Revenue', MEDIUM: '🟡 Medium Revenue', LOW: '🔴 Low Revenue' };

export default function MapPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [territories, setTerritories] = useState<TerritoryData[]>([]);
  const [selected, setSelected] = useState<TerritoryData | null>(null);
  const [heatmap, setHeatmap] = useState(true);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    client.get('/api/map/territories').then(r => {
      setTerritories(r.data); setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Initialize Leaflet map — safe against StrictMode double-mount
  useEffect(() => {
    let destroyed = false;

    import('leaflet').then(L => {
      if (destroyed || !mapContainerRef.current) return;

      // Guard: if this container already has a Leaflet instance, remove it first
      const container = mapContainerRef.current as any;
      if (container._leaflet_id) {
        mapInstanceRef.current?.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [39.5, -98.35],
        zoom: 4,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
      setMapReady(true); // ← triggers markers effect even if territories already loaded
    });

    return () => {
      destroyed = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        setMapReady(false);
      }
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add/refresh markers — fires when map is ready OR territories/heatmap change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || territories.length === 0) return;

    import('leaflet').then(L => {
      if (!mapInstanceRef.current) return;
      const map = mapInstanceRef.current;

      // Clear existing markers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];

      territories.forEach(t => {
        if (!t.latitude || !t.longitude) return;
        const color = heatmap ? COLOR_MAP[t.colorBucket] : '#3b82f6';
        const marker = L.circleMarker([t.latitude!, t.longitude!], {
          radius: 10, fillColor: color, color: '#fff', weight: 1.5,
          opacity: 1, fillOpacity: 0.85,
        }).addTo(map);
        marker.bindTooltip(
          `<b>${t.name}</b><br />$${t.revenue.toLocaleString()}`,
          { className: 'leaflet-tooltip-dark' }
        );
        marker.on('click', () => setSelected(t));
        markersRef.current.push(marker);
      });
    });
  }, [territories, heatmap, mapReady]);

  return (
    <Layout title="Territory Map" subtitle="USA District Revenue — Click a territory for details">
      {/* Controls */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <button id="toggle-heatmap" onClick={() => setHeatmap(h => !h)}
          className={heatmap ? 'btn-primary py-1.5 text-xs' : 'btn-secondary py-1.5 text-xs'}>
          {heatmap ? 'Heatmap ON' : 'Heatmap OFF'}
        </button>
        {/* Legend */}
        <div className="flex items-center gap-4">
          {(Object.entries(LABEL_MAP) as [keyof typeof LABEL_MAP, string][]).map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_MAP[key] }} />
              {label}
            </span>
          ))}
        </div>
        {loading && <span className="text-text-muted text-xs animate-pulse">Loading territories...</span>}
      </div>

      <div className="grid md:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 230px)' }}>
        {/* Map */}
        <div className="md:col-span-2 rounded-card overflow-hidden border border-bg-border" style={{ minHeight: 400 }}>
          <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
        </div>

        {/* Territory Detail Panel */}
        <div className="card flex flex-col overflow-y-auto">
          {selected ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-text-primary font-bold">{selected.name}</h3>
                <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary text-lg">&times;</button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="stat-card">
                  <span className="stat-card-label">Revenue</span>
                  <span className="stat-card-value text-xl text-accent">${selected.revenue.toLocaleString()}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">Deals</span>
                  <span className="stat-card-value text-xl">{selected.deals}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">Avg Deal</span>
                  <span className="stat-card-value text-xl">
                    {selected.deals > 0 ? `$${(selected.revenue / selected.deals).toFixed(0)}` : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="stat-card-label">Status</span>
                  <span className={`badge-${selected.colorBucket.toLowerCase() as 'high' | 'medium' | 'low'} self-start`}>
                    {LABEL_MAP[selected.colorBucket]}
                  </span>
                </div>
                {selected.region && (
                  <div className="flex flex-col gap-1">
                    <span className="stat-card-label">Region</span>
                    <span className="text-text-primary text-sm">{selected.region}</span>
                  </div>
                )}
                {selected.state && (
                  <div className="flex flex-col gap-1">
                    <span className="stat-card-label">State</span>
                    <span className="text-text-primary text-sm">{selected.state}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
              <span className="text-4xl">🗺️</span>
              <p className="text-text-muted text-sm">Click a territory marker on the map to view performance details.</p>
              <p className="text-text-subtle text-xs mt-2">{territories.length} territories loaded</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
