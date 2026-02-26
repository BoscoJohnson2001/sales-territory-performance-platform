import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../components/Layout';
import client from '../../api/client';
import { getCurrentLocation, reverseGeocode } from '../../services/geolocation.service';
import { useAuth } from '../../context/AuthContext';
import {
  HiOutlineFire, HiCurrencyRupee, HiShoppingBag, HiTrendingUp,
  HiLocationMarker, HiSearch, HiShieldCheck, HiQuestionMarkCircle,
  HiLockClosed, HiExclamationCircle, HiCalendar, HiX, HiArrowRight, HiPlus, HiCheckCircle,
  HiOutlineMap
} from 'react-icons/hi';
import SaleRecordModal, { Product, Territory } from '../../components/SaleRecordModal';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TerritoryData {
  id: string; name: string; state: string; region: string;
  latitude: number | null; longitude: number | null;
  revenue: number; deals: number; avgDeal: number;
  revenueLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}
interface PanelData extends TerritoryData { displayName: string; geoState: string; }

type GeoStatus =
  | 'idle'
  | 'detecting'
  | 'geocoding'
  | 'matched'
  | 'unassigned'      // SALES role — district not in their territories
  | 'no_match'        // coords found but no GeoJSON district matched
  | 'denied'
  | 'error';

// ─── Constants ────────────────────────────────────────────────────────────────
const FILL = { HIGH: '#22c55e', MEDIUM: '#f59e0b', LOW: '#ef4444' } as const;
const LABEL = { HIGH: 'High Revenue', MEDIUM: 'Medium Revenue', LOW: 'Low Revenue' } as const;
const GEO_URL = 'https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson';
const GEO_ENABLED = (import.meta as any).env?.VITE_ENABLE_GEOLOCATION !== 'false';

const districtName = (props: any): string =>
  (props?.DISTRICT || props?.dtname || props?.NAME_2 || props?.district || '').toLowerCase().trim();

const stateFromProps = (props: any): string =>
  props?.ST_NM || props?.NAME_1 || props?.state || '';

// ─── Point-in-Polygon (ray casting — no external dep needed) ─────────────────
function pointInPolygon(lat: number, lng: number, coords: number[][][]): boolean {
  // coords[0] = outer ring, coords[1..] = holes (ignored for fast check)
  const ring = coords[0];
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];  // [lng, lat]
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInGeoJSONFeature(lat: number, lng: number, geometry: any): boolean {
  if (!geometry) return false;
  if (geometry.type === 'Polygon') return pointInPolygon(lat, lng, geometry.coordinates);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates.some((poly: number[][][]) => pointInPolygon(lat, lng, poly));
  }
  return false;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MapPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const geoLayerRef = useRef<any>(null);
  const mkLayerRef = useRef<any>(null);
  const geoDataRef = useRef<any>(null);
  const tmapRef = useRef<Map<string, TerritoryData>>(new Map());
  const allowedRef = useRef<Set<string>>(new Set());
  const allowedAllRef = useRef(true);
  const heatmapRef = useRef(true);
  const highlightRef = useRef<any>(null); // currently highlighted layer
  const activeTooltipLayerRef = useRef<any>(null); // layer whose tooltip is currently open

  const [heatmap, setHeatmap] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [mapReady, setMapReady] = useState(false);
  const [apiReady, setApiReady] = useState(false);
  const [geoLoading, setGeoLoading] = useState(true);
  const [selected, setSelected] = useState<PanelData | null>(null);
  const [stats, setStats] = useState({ total: 0, withData: 0 });

  // Geolocation state
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');
  const [geoToast, setGeoToast] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [myDistrict, setMyDistrict] = useState<string | null>(null); // matched district name

  // Sale Modal state
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [toast, setToast] = useState('');

  const showToast = useCallback((msg: string, dur = 4000) => {
    setGeoToast(msg);
    setTimeout(() => setGeoToast(null), dur);
  }, []);

  // ── Style helper ────────────────────────────────────────────────────────────
  const styleFeature = (feature: any, isHeatmap: boolean): any => {
    const name = districtName(feature.properties);
    const data = tmapRef.current.get(name);
    const allowed = allowedAllRef.current || allowedRef.current.has(name);
    const lvl = data?.revenueLevel ?? 'LOW';
    const hasRev = data && data.revenue > 0;

    if (isHeatmap) {
      return {
        fillColor: allowed ? (hasRev ? FILL[lvl] : '#1e293b') : '#0f172a',
        fillOpacity: allowed ? (hasRev ? 0.70 : 0.18) : 0.08,
        color: '#0f172a', weight: 0.6, opacity: 0.9,
      };
    }
    return {
      fillColor: allowed ? '#334155' : '#111827',
      fillOpacity: allowed ? 0.25 : 0.08,
      color: '#475569', weight: 1, opacity: 0.8,
    };
  };

  // ── Step 1: Revenue data ────────────────────────────────────────────────────
  useEffect(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    setApiReady(false); // Trigger loading state
    client.get(`/api/map/districts?startDate=${startDate}&endDate=${endDate}`).then(r => {
      const map = new Map<string, TerritoryData>();
      (r.data.territories as TerritoryData[]).forEach(t => map.set(t.name.toLowerCase(), t));
      tmapRef.current = map;
      allowedAllRef.current = r.data.allowedAll;
      if (!r.data.allowedAll) allowedRef.current = new Set(Array.from(map.keys()));
      setApiReady(true);
    }).catch(() => setApiReady(true));
  }, [selectedMonth]);

  // Fetch products and territories for Sale Modal (Sales role only)
  useEffect(() => {
    if (user?.role === 'SALES') {
      Promise.all([
        client.get('/api/sales/products').catch(() => ({ data: [] })),
        client.get('/api/sales/territories').catch(() => ({ data: [] })),
      ]).then(([pr, tr]) => {
        setProducts(pr.data);
        setTerritories(tr.data);
      });
    }
  }, [user]);

  const handleSaleSuccess = () => {
    setShowSaleModal(false);
    setToast('✅ Sale recorded successfully!');
    setTimeout(() => setToast(''), 4000);
    // Optionally refresh map data here if needed, but usually not necessary for a single sale record
  };

  // ── Step 2: Init Leaflet map ────────────────────────────────────────────────
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

  // ── Step 3: Build GeoJSON layer ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !apiReady) return;
    let cancelled = false;

    (async () => {
      const L = await import('leaflet');
      if (cancelled || !mapRef.current) return;

      if (!geoDataRef.current) {
        setGeoLoading(true);
        try {
          const res = await fetch(GEO_URL);
          geoDataRef.current = await res.json();
        } catch {
          setGeoLoading(false);
          showToast('⚠️ Failed to load district GeoJSON.');
          return;
        }
        setGeoLoading(false);
      } else {
        setGeoLoading(false);
      }

      if (cancelled || !mapRef.current) return;
      const map = mapRef.current;

      geoLayerRef.current?.remove();
      mkLayerRef.current?.remove();
      highlightRef.current = null;


      // Centroid marker layer (heatmap-OFF) — only districts WITH sales data
      const mkGroup = L.layerGroup();
      tmapRef.current.forEach(t => {
        if (!t.latitude || !t.longitude) return;
        // ── Only show markers where there is actual sales activity ──
        if (t.revenue === 0 && t.deals === 0) return;

        const color = FILL[t.revenueLevel];
        const isHigh = t.revenueLevel === 'HIGH';

        const icon = L.divIcon({
          className: '',
          iconSize: [22, 28],
          iconAnchor: [11, 28],
          popupAnchor: [0, -28],
          html: `
            <div style="position:relative;width:22px;height:28px">
              ${isHigh ? `<div style="
                position:absolute;top:50%;left:50%;
                transform:translate(-50%,-60%);
                width:28px;height:28px;border-radius:50%;
                background:${color}44;
                animation:mapPulse 1.6s ease-out infinite;
              "></div>` : ''}
              <svg viewBox="0 0 22 28" xmlns="http://www.w3.org/2000/svg"
                style="width:22px;height:28px;filter:drop-shadow(0 2px 6px ${color}88)">
                <path d="M11 0C4.925 0 0 4.925 0 11c0 7.667 11 17 11 17s11-9.333 11-17C22 4.925 17.075 0 11 0z"
                  fill="${color}" />
                <circle cx="11" cy="11" r="4.5" fill="white" fill-opacity="0.92"/>
              </svg>
            </div>`,
        });

        const mk = L.marker([t.latitude, t.longitude], { icon });
        mk.bindTooltip(
          `<div style="font-weight:700;font-size:13px">${t.name}</div>` +
          `<div style="font-size:11px;opacity:.7">${t.state}</div>` +
          `<div style="margin-top:4px">Revenue: <b>₹{t.revenue.toLocaleString()}</b></div>` +
          `<div>Deals: ${t.deals}</div>`,
          { className: 'map-tooltip', direction: 'auto' }
        );
        mk.on('click', () => setSelected({ ...t, displayName: t.name, geoState: t.state }));
        mkGroup.addLayer(mk);
      });
      mkLayerRef.current = mkGroup;


      // GeoJSON polygon layer
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
              ? `<div style="margin-top:4px">Revenue: <b>₹${data.revenue.toLocaleString()}</b></div><div>Deals: ${data.deals}</div>`
              : `<div style="opacity:.5;margin-top:4px">No sales data</div>`),
            { className: 'map-tooltip', sticky: false, direction: 'auto' }
          );

          flayer.on({
            mouseover: (e: any) => {
              // Close any previously open tooltip before opening the new one
              if (activeTooltipLayerRef.current && activeTooltipLayerRef.current !== e.target) {
                activeTooltipLayerRef.current.closeTooltip();
              }
              activeTooltipLayerRef.current = e.target;
              e.target.openTooltip();

              if (highlightRef.current !== e.target)
                e.target.setStyle({ weight: 2.5, fillOpacity: Math.min((e.target.options.fillOpacity || .3) + .2, 1) });
              e.target.bringToFront();
            },
            mouseout: (e: any) => {
              e.target.closeTooltip();
              if (activeTooltipLayerRef.current === e.target) activeTooltipLayerRef.current = null;
              if (highlightRef.current !== e.target) layer.resetStyle(e.target);
            },
            click: (e: any) => {
              if (data) {
                setSelected({ ...data, displayName: dispName, geoState: stateName || data.state });
                if (highlightRef.current && highlightRef.current !== e.target) {
                  layer.resetStyle(highlightRef.current);
                }
                highlightRef.current = e.target;
                e.target.setStyle({ weight: 3, color: '#ffffff', opacity: 1 });
                e.target.bringToFront();
              }
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

  // ── Step 4: Geolocation flow (runs after GeoJSON layer is built) ────────────
  useEffect(() => {
    if (!mapReady || !apiReady || geoLoading) return;
    if (!GEO_ENABLED) return;
    if (!geoDataRef.current || !geoLayerRef.current) return;

    let cancelled = false;
    setGeoStatus('detecting');

    (async () => {
      let lat: number, lng: number;
      try {
        const coords = await getCurrentLocation();
        lat = coords.latitude; lng = coords.longitude;
        setUserCoords({ lat, lng });
      } catch (err: any) {
        if (cancelled) return;
        const msg = err.message || 'Location unavailable';
        setGeoStatus(msg.includes('denied') ? 'denied' : 'error');
        showToast(`📍 ${msg}. Showing full India view.`);
        return;
      }

      if (cancelled) return;
      setGeoStatus('geocoding');

      // Place user marker on map
      const L = await import('leaflet');
      if (cancelled || !mapRef.current) return;
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="width:14px;height:14px;background:#60a5fa;border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px #60a5fa88"></div>`,
        iconSize: [14, 14], iconAnchor: [7, 7],
      });
      L.marker([lat, lng], { icon: userIcon })
        .bindTooltip('📍 Your location', { className: 'map-tooltip', permanent: false })
        .addTo(mapRef.current);

      // Point-in-polygon match against loaded GeoJSON
      let matchedFeature: any = null;
      let matchedLayer: any = null;

      if (geoLayerRef.current) {
        geoLayerRef.current.eachLayer((layer: any) => {
          if (matchedFeature) return;
          if (pointInGeoJSONFeature(lat, lng, layer.feature?.geometry)) {
            matchedFeature = layer.feature;
            matchedLayer = layer;
          }
        });
      }

      // Fallback: reverse geocode if pip failed (e.g. boundary gaps)
      if (!matchedFeature) {
        try {
          const geo = await reverseGeocode(lat, lng);
          if (cancelled) return;
          const normDistrict = geo.district.toLowerCase().trim();
          // Try to find a territory by geocoded district name
          geoLayerRef.current?.eachLayer((layer: any) => {
            if (matchedFeature) return;
            const fname = districtName(layer.feature?.properties);
            if (fname === normDistrict || fname.includes(normDistrict) || normDistrict.includes(fname)) {
              matchedFeature = layer.feature;
              matchedLayer = layer;
            }
          });
        } catch { /* Nominatim failed — no match */ }
      }

      if (cancelled) return;

      if (!matchedFeature || !matchedLayer) {
        setGeoStatus('no_match');
        // Just zoom to user's location
        mapRef.current?.setView([lat, lng], 9);
        showToast('📍 Zoomed to your location. No matching district found in data.');
        return;
      }

      const rawName = districtName(matchedFeature.properties);
      const dispName = matchedFeature.properties?.DISTRICT || rawName;
      const stateName = stateFromProps(matchedFeature.properties);
      const data = tmapRef.current.get(rawName);

      // Role check for SALES
      if (!allowedAllRef.current && !allowedRef.current.has(rawName)) {
        setGeoStatus('unassigned');
        mapRef.current?.setView([lat, lng], 9);
        showToast(`🚫 You are not assigned to ${dispName}. Zoomed to your location.`, 6000);
        return;
      }

      // Zoom to district (no highlight — keep normal choropleth colour)
      mapRef.current?.fitBounds(matchedLayer.getBounds(), { padding: [40, 40], maxZoom: 11 });

      setMyDistrict(dispName);
      setGeoStatus('matched');

      // Auto-open side panel and highlight
      if (data && matchedLayer) {
        setSelected({ ...data, displayName: dispName, geoState: stateName || data.state });
        highlightRef.current = matchedLayer;
        matchedLayer.setStyle({ weight: 3, color: '#ffffff', opacity: 1 });
        matchedLayer.bringToFront();
      }
      showToast(`📍 Your district: ${dispName}`, 3000);
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, apiReady, geoLoading]);

  // ── Heatmap toggle ──────────────────────────────────────────────────────────
  useEffect(() => {
    heatmapRef.current = heatmap;
    if (!geoLayerRef.current) return;
    geoLayerRef.current.eachLayer((layer: any) => {
      layer.setStyle(styleFeature(layer.feature, heatmap));
    });
    if (mkLayerRef.current && mapRef.current) {
      if (heatmap) mkLayerRef.current.remove();
      else mkLayerRef.current.addTo(mapRef.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heatmap]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const showSidePanel = !!selected || (!!userCoords && !!myDistrict);
  const lvlColor = selected ? FILL[selected.revenueLevel] : '#6b7280';

  const GeoStatusBadge = () => {
    if (geoStatus === 'idle' || geoStatus === 'matched') return null;
    const map: Record<GeoStatus, { icon: string; text: string; color: string }> = {
      idle: { icon: '', text: '', color: '' },
      detecting: { icon: HiSearch, text: 'Detecting your location…', color: '#60a5fa' },
      geocoding: { icon: HiLocationMarker, text: 'Identifying district…', color: '#a78bfa' },
      matched: { icon: '', text: '', color: '' },
      unassigned: { icon: HiShieldCheck, text: 'District not assigned', color: '#ef4444' },
      no_match: { icon: HiQuestionMarkCircle, text: 'District not in data', color: '#f59e0b' },
      denied: { icon: HiLockClosed, text: 'Location denied', color: '#6b7280' },
      error: { icon: HiExclamationCircle, text: 'Location unavailable', color: '#f59e0b' },
    };
    const info = map[geoStatus];
    if (!info.text) return null;
    const Icon = info.icon as any;
    return (
      <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full animate-pulse"
        style={{ backgroundColor: info.color + '22', color: info.color, border: `1px solid ${info.color}44` }}>
        <Icon className="text-sm" /> {info.text}
      </span>
    );
  };

  return (
    <Layout title="Territory Map" subtitle="India District Revenue Choropleth — click a district for details">
      {/* Toast */}
      {(geoToast || toast) && (
        <div className="fixed top-4 right-4 z-[9999] max-w-xs px-4 py-3 rounded-xl text-sm text-white shadow-2xl backdrop-blur-md border border-white/10 animate-fade-in"
          style={{ background: 'rgba(15,23,42,0.95)' }}>
          {toast ? (
            <div className="flex items-center gap-3">
              {toast.startsWith('✅') ? <HiCheckCircle className="text-green-400 text-lg flex-shrink-0" /> : <HiExclamationCircle className="text-red-400 text-lg flex-shrink-0" />}
              <span>{toast.replace(/^[✅❌]/, '').trim()}</span>
            </div>
          ) : geoToast}
        </div>
      )}

      {/* Sale Modal */}
      {showSaleModal && (
        <SaleRecordModal
          products={products}
          territories={territories}
          initialTerritoryId={selected?.id}
          onClose={() => setShowSaleModal(false)}
          onSuccess={handleSaleSuccess}
        />
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-bg-card border border-bg-border shadow-sm transition-all hover:bg-bg-hover">
          <HiOutlineFire className={`text-xs ${heatmap ? 'text-amber-400' : 'text-text-muted'}`} />
          <span className="text-xs font-semibold text-text-muted select-none">Heatmap</span>
          <button
            id="toggle-heatmap"
            type="button"
            onClick={() => setHeatmap(h => !h)}
            className={`toggle-switch ${heatmap ? 'toggle-switch-on' : 'toggle-switch-off'}`}
            aria-checked={heatmap}
            role="switch"
          >
            <span className={`toggle-thumb ${heatmap ? 'toggle-thumb-on' : 'toggle-thumb-off'}`} />
          </button>
        </div>

        {/* Legend */}
        {heatmap ? (
          <div className="flex items-center gap-3">
            {(Object.entries(LABEL) as [keyof typeof LABEL, string][]).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: FILL[k] }} /> {v}
              </span>
            ))}
          </div>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="w-3 h-3 rounded-full border border-slate-400 bg-slate-600" />
            Outlines + centroid markers
          </span>
        )}

        {/* Geo status inline badge */}
        <GeoStatusBadge />

        {/* My district badge */}
        {myDistrict && geoStatus === 'matched' && (
          <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full"
            style={{ backgroundColor: '#60a5fa22', color: '#60a5fa', border: '1px solid #60a5fa44' }}>
            <HiLocationMarker /> Viewing your district: <b className="ml-1">{myDistrict}</b>
          </span>
        )}

        <span className="ml-auto text-xs text-text-muted">
          {geoLoading
            ? '⏳ Loading GeoJSON…'
            : `${stats.withData} / ${stats.total} districts with revenue data`}
        </span>

        {/* Month Selector */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-bg-card border border-bg-border shadow-sm transition-all hover:bg-bg-hover">
          <HiCalendar className="text-text-muted" />
          <input
            type="month"
            className="bg-transparent border-none text-xs font-semibold text-text-primary focus:outline-none cursor-pointer"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4" style={{ height: 'calc(100vh - 230px)' }}>
        {/* Map */}
        <div className={`${showSidePanel ? 'md:col-span-2' : 'md:col-span-3'} rounded-card overflow-hidden border border-bg-border relative`} style={{ minHeight: 400 }}>
          <div ref={mapEl} style={{ width: '100%', height: '100%' }} />

          {geoLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: 'rgba(8,9,15,0.8)' }}>
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <p className="text-text-muted text-sm">Loading India district boundaries…</p>
              <p className="text-text-subtle text-xs">First load only (~15 MB, cached after)</p>
            </div>
          )}

          {(geoStatus === 'detecting' || geoStatus === 'geocoding') && !geoLoading && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-blue-300"
              style={{ background: 'rgba(30,41,59,0.9)', border: '1px solid rgba(96,165,250,0.3)' }}>
              <div className="w-3 h-3 border border-blue-400 border-t-transparent rounded-full animate-spin" />
              {geoStatus === 'detecting' ? 'Detecting your location…' : 'Identifying district…'}
            </div>
          )}
        </div>

        {/* Side panel */}
        {showSidePanel && (
          <div className="card flex flex-col overflow-y-auto">
            {selected ? (
              <>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-text-primary font-bold text-base">{selected.displayName}</h3>
                    <p className="text-text-muted text-xs">{selected.geoState || selected.state}</p>
                    {myDistrict === selected.displayName && (
                      <span className="inline-flex items-center gap-1 mt-1 text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#60a5fa22', color: '#60a5fa', border: '1px solid #60a5fa44' }}>
                        <HiLocationMarker className="text-[10px]" /> Your current district
                      </span>
                    )}
                  </div>
                  <button onClick={() => {
                    setSelected(null);
                    if (highlightRef.current) {
                      geoLayerRef.current?.resetStyle(highlightRef.current);
                      highlightRef.current = null;
                    }
                  }}
                    className="text-text-muted hover:text-text-primary">
                    <HiX className="text-xl" />
                  </button>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="stat-card">
                    <span className="stat-card-label">Total Revenue</span>
                    <div className="flex items-center gap-2">
                      <span className="stat-card-value">
                        {selected.revenue > 0 ? `₹${selected.revenue.toLocaleString()}` : '—'}
                      </span>
                      <HiCurrencyRupee className="text-base text-amber-400 opacity-70" />
                    </div>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Total Deals</span>
                    <div className="flex items-center gap-2">
                      <span className="stat-card-value">{selected.deals || '—'}</span>
                      <HiShoppingBag className="text-base text-blue-400 opacity-70" />
                    </div>
                  </div>
                  <div className="stat-card">
                    <span className="stat-card-label">Avg Deal Value</span>
                    <div className="flex items-center gap-2">
                      <span className="stat-card-value">
                        {selected.deals > 0 ? `₹${selected.avgDeal.toLocaleString()}` : '—'}
                      </span>
                      <HiTrendingUp className="text-base text-green-400 opacity-70" />
                    </div>
                  </div>

                  <div className="stat-card">
                    <span className="stat-card-label">Revenue Status</span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: lvlColor + '22', color: lvlColor, border: `1px solid ${lvlColor}` }}>
                      {LABEL[selected.revenueLevel]}
                    </span>
                  </div>
                  {userCoords && myDistrict === selected.displayName && (
                    <div className="flex flex-col gap-1 mt-1">
                      <span className="stat-card-label">Your Coordinates</span>
                      <span className="text-text-primary text-xs font-mono">
                        {userCoords.lat.toFixed(4)}°N, {userCoords.lng.toFixed(4)}°E
                      </span>
                    </div>
                  )}
                </div>

                {user?.role !== 'ADMIN' && (
                  <div className="mt-auto pt-4 border-t border-bg-border flex flex-row gap-2">
                    {user?.role === 'SALES' && (
                      <button
                        id="add-sale-on-map"
                        onClick={() => setShowSaleModal(true)}
                        className="btn-primary flex-1 justify-center flex items-center gap-1.5 px-2 text-xs"
                      >
                        <HiPlus className="text-sm" />
                        Add Sale
                      </button>
                    )}
                    <button
                      id="view-territory-detail"
                      onClick={() => navigate(`/territory-performance/${selected.id}`)}
                      className="btn-secondary flex-1 justify-center group flex items-center gap-1.5 px-2 text-xs text-center"
                    >
                      Performance
                      <HiArrowRight className="group-hover:translate-x-1 transition-transform text-sm" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-2">
                <HiOutlineMap className="text-5xl text-text-muted opacity-20" />
                <p className="text-text-muted text-sm font-medium">
                  {geoStatus === 'detecting' || geoStatus === 'geocoding'
                    ? 'Finding your district…'
                    : 'Click a district polygon'}
                </p>
                <p className="text-text-subtle text-xs">
                  {geoStatus === 'denied' ? 'Allow location access and refresh to auto-detect'
                    : geoStatus === 'unassigned' ? 'You are not assigned to your current district'
                      : geoStatus === 'no_match' ? 'Your location is outside mapped territories'
                        : heatmap ? 'Colored districts have revenue data'
                          : 'Switch Heatmap ON to see revenue colors'}
                </p>
                {GEO_ENABLED && geoStatus === 'denied' && (
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-secondary py-1 text-xs mt-1">
                    🔄 Retry location
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
