import { useEffect, useRef, useState } from 'react';
import Layout from '../../components/Layout';
import client from '../../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TerritoryData {
  id: string; name: string; state: string; region: string;
  latitude: number | null; longitude: number | null;
  revenue: number; deals: number; avgDeal: number;
  revenueLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}
interface PanelData {
  name: string; state: string; revenue: number;
  deals: number; avgDeal: number; revenueLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

// ─── Constants ────────────────────────────────────────────────────────────────
const FILL = { HIGH: '#22c55e', MEDIUM: '#f59e0b', LOW: '#ef4444' } as const;
const LABEL = { HIGH: 'High Revenue', MEDIUM: 'Medium Revenue', LOW: 'Low Revenue' } as const;
// India district GeoJSON — properties: DISTRICT (name), ST_NM (state)
const GEO_URL = 'https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson';

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Try multiple property keys that different GeoJSON sources use for district name */
const districtName = (props: any): string =>
  (props?.DISTRICT || props?.dtname || props?.NAME_2 || props?.district || '').toLowerCase().trim();

const stateFromProps = (props: any): string =>
  props?.ST_NM || props?.NAME_1 || props?.state || '';

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapPage() {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const mkLayerRef = useRef<any>(null);
  const geoDataRef = useRef<any>(null);                    // cached raw GeoJSON
  const tmapRef = useRef<Map<string, TerritoryData>>(new Map()); // lc-name → data
  const allowedRef = useRef<Set<string>>(new Set());       // lc-names allowed for SALES
  const allowedAllRef = useRef(true);
  const heatmapRef = useRef(true);                         // ref copy to avoid stale closures

  const [heatmap, setHeatmap] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [geoLoading, setGeoLoading] = useState(true);
  const [selected, setSelected] = useState<PanelData | null>(null);
  const [stats, setStats] = useState({ total: 0, withData: 0 });

  // ─── Style helper (uses refs, never stale) ──────────────────────────────────
  const styleFeature = (feature: any, isHeatmap: boolean): L.PathOptions => {
    const name = districtName(feature.properties);
    const data = tmapRef.current.get(name);
    const allowed = allowedAllRef.current || allowedRef.current.has(name);
    const lvl = data?.revenueLevel ?? 'LOW';
    const hasRevenue = data && data.revenue > 0;

    if (isHeatmap) {
      return {
        fillColor: allowed ? (hasRevenue ? FILL[lvl] : '#1e293b') : '#0f172a',
        fillOpacity: allowed ? (hasRevenue ? 0.72 : 0.18) : 0.08,
        color: '#0f172a',
        weight: 0.6,
        opacity: 0.9,
      };
    }
    return {
      fillColor: allowed ? '#334155' : '#111827',
      fillOpacity: allowed ? 0.25 : 0.08,
      color: '#475569',
      weight: 1,
      opacity: 0.8,
    };
  };

  // ─── Step 1: Fetch revenue data ─────────────────────────────────────────────
  useEffect(() => {
    client.get('/api/map/districts').then(r => {
      const map = new Map<string, TerritoryData>();
      (r.data.territories as TerritoryData[]).forEach(t => map.set(t.name.toLowerCase(), t));
      tmapRef.current = map;
      allowedAllRef.current = r.data.allowedAll;
      if (!r.data.allowedAll) allowedRef.current = new Set(Array.from(map.keys()));
      setApiReady(true);
    }).catch(() => setApiReady(true));
  }, []);

  // ─── Step 2: Init Leaflet map (India-centered) ───────────────────────────────
  useEffect(() => {
    let dead = false;
    import('leaflet').then(L => {
      if (dead || !mapEl.current) return;
      const el = mapEl.current as any;
      if (el._leaflet_id) { mapRef.current?.remove(); mapRef.current = null; }

      const map = L.map(mapEl.current, { center: [22.5, 78.9], zoom: 5, zoomControl: true });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO', subdomains: 'abcd', maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    });
    return () => {
      dead = true;
      mapRef.current?.remove(); mapRef.current = null; setMapReady(false);
    };
  }, []);

  // ─── Step 3: Build GeoJSON layer when both ready ────────────────────────────
  useEffect(() => {
    if (!mapReady || !apiReady) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !mapRef.current) return;

      // Fetch GeoJSON once (browser caches after first load)
      if (!geoDataRef.current) {
        setGeoLoading(true);
        try {
          const res = await fetch(GEO_URL);
          geoDataRef.current = await res.json();
        } catch {
          setGeoLoading(false);
          return;
        }
        setGeoLoading(false);
      } else {
        setGeoLoading(false);
      }

      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      // Remove stale layers
      geoLayerRef.current?.remove();
      mkLayerRef.current?.remove();

      // Build centroid markers (for heatmap-OFF mode)
      const mkGroup = L.layerGroup();
      tmapRef.current.forEach(t => {
        if (!t.latitude || !t.longitude) return;
        const mk = L.circleMarker([t.latitude, t.longitude], {
          radius: 5, fillColor: FILL[t.revenueLevel], color: '#fff',
          weight: 1.5, fillOpacity: 0.9, opacity: 1,
        });
        mk.bindTooltip(`<b>${t.name}</b><br/>$${t.revenue.toLocaleString()}`,
          { className: 'map-tooltip', direction: 'auto' });
        mk.on('click', () => setSelected({
          name: t.name, state: t.state, revenue: t.revenue,
          deals: t.deals, avgDeal: t.avgDeal, revenueLevel: t.revenueLevel,
        }));
        mkGroup.addLayer(mk);
      });
      mkLayerRef.current = mkGroup;

      // Build GeoJSON polygon layer
      let withData = 0;
      const layer = L.geoJSON(geoDataRef.current, {
        style: (f) => styleFeature(f, heatmapRef.current),
        onEachFeature: (feature, flayer) => {
          const rawName = districtName(feature.properties);
          const dispName = feature.properties?.DISTRICT || feature.properties?.dtname || rawName;
          const stateName = stateFromProps(feature.properties);
          const data = tmapRef.current.get(rawName);
          if (data) withData++;

          flayer.bindTooltip(
            `<div style="font-weight:700;font-size:13px">${dispName}</div>` +
            `<div style="font-size:11px;opacity:.7">${stateName}</div>` +
            (data
              ? `<div style="margin-top:4px">Revenue: <b>$${data.revenue.toLocaleString()}</b></div>` +
              `<div>Deals: ${data.deals}</div>`
              : `<div style="opacity:.5;margin-top:4px">No sales data</div>`),
            { className: 'map-tooltip', sticky: true, direction: 'auto' }
          );

          flayer.on({
            mouseover: (e: any) => {
              e.target.setStyle({ weight: 2, fillOpacity: Math.min((e.target.options.fillOpacity || 0.3) + 0.25, 1) });
              e.target.bringToFront();
            },
            mouseout: (e: any) => { layer.resetStyle(e.target); },
            click: () => {
              if (data) setSelected({
                name: dispName, state: stateName || data.state,
                revenue: data.revenue, deals: data.deals, avgDeal: data.avgDeal,
                revenueLevel: data.revenueLevel
              });
            },
          });
        },
      });

      geoLayerRef.current = layer.addTo(map);
      if (!heatmapRef.current) mkGroup.addTo(map);
      setStats({ total: geoDataRef.current.features?.length || 0, withData });
    })();

    return () => { cancelled = true; };
  }, [mapReady, apiReady]);

  // ─── Step 4: Update styles on heatmap toggle ─────────────────────────────────
  useEffect(() => {
    heatmapRef.current = heatmap;
    if (!geoLayerRef.current || !mapReady) return;

    // Update polygon fills
    geoLayerRef.current.eachLayer((layer: any) => {
      layer.setStyle(styleFeature(layer.feature, heatmap));
    });

    // Toggle centroid markers
    if (mkLayerRef.current && mapRef.current) {
      if (heatmap) mkLayerRef.current.remove();
      else mkLayerRef.current.addTo(mapRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmap]);

  // ─── Render ───────────────────────────────────────────────────────────────────
  const lvlColor = selected ? FILL[selected.revenueLevel] : '#6b7280';

  return (
    <Layout title="Territory Map" subtitle="India District Revenue Choropleth — click a district for details">
      {/* Toolbar */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        {/* Heatmap toggle */}
        <button id="toggle-heatmap" onClick={() => setHeatmap(h => !h)}
          className={heatmap ? 'btn-primary py-1.5 text-xs' : 'btn-secondary py-1.5 text-xs'}>
          {heatmap ? '🌡️ Heatmap ON' : '🗺️ Heatmap OFF'}
        </button>

        {/* Legend */}
        {heatmap ? (
          <div className="flex items-center gap-4">
            {(Object.entries(LABEL) as [keyof typeof LABEL, string][]).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: FILL[k] }} />
                {v}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="w-3 h-3 rounded-sm bg-slate-700" />No data
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-3 h-3 rounded-full border border-slate-400 bg-slate-600" />
            District outlines + centroid markers
          </div>
        )}

        {/* Status */}
        <span className="ml-auto text-xs text-text-muted">
          {geoLoading ? '⏳ Loading GeoJSON…'
            : `${stats.withData} / ${stats.total} districts with revenue data`}
        </span>
      </div>

      <div className="grid md:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 230px)' }}>
        {/* Map */}
        <div className="md:col-span-2 rounded-card overflow-hidden border border-bg-border relative" style={{ minHeight: 400 }}>
          <div ref={mapEl} style={{ width: '100%', height: '100%' }} />
          {geoLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/80 gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-text-muted text-sm">Loading India district boundaries…</p>
              <p className="text-text-subtle text-xs">First load only (~15 MB, then cached)</p>
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="card flex flex-col overflow-y-auto">
          {selected ? (
            <>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-text-primary font-bold text-base">{selected.name}</h3>
                  <p className="text-text-muted text-xs">{selected.state}</p>
                </div>
                <button onClick={() => setSelected(null)}
                  className="text-text-muted hover:text-text-primary text-xl leading-none">&times;</button>
              </div>

              <div className="flex flex-col gap-3">
                <div className="stat-card">
                  <span className="stat-card-label">Total Revenue</span>
                  <span className="stat-card-value text-xl text-accent">
                    {selected.revenue > 0 ? `$${selected.revenue.toLocaleString()}` : '—'}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">Total Deals</span>
                  <span className="stat-card-value text-xl">{selected.deals || '—'}</span>
                </div>
                <div className="stat-card">
                  <span className="stat-card-label">Avg Deal Value</span>
                  <span className="stat-card-value text-xl">
                    {selected.deals > 0 ? `$${selected.avgDeal.toLocaleString()}` : '—'}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="stat-card-label">Revenue Status</span>
                  <span className="self-start text-xs font-semibold px-2 py-1 rounded-full"
                    style={{ backgroundColor: lvlColor + '22', color: lvlColor, border: `1px solid ${lvlColor}` }}>
                    {LABEL[selected.revenueLevel]}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
              <span className="text-5xl">🗺️</span>
              <p className="text-text-muted text-sm font-medium">Click a district polygon</p>
              <p className="text-text-subtle text-xs">
                {heatmap
                  ? 'Colored districts have revenue data'
                  : 'Switch Heatmap ON to see revenue colors'}
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

// Tell TypeScript about the PathOptions parameter type used inline
declare type L = typeof import('leaflet');
