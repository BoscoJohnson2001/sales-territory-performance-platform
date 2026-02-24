/**
 * Geolocation Service
 * - getCurrentLocation()  : uses browser navigator.geolocation
 * - reverseGeocode()      : OpenStreetMap Nominatim reverse geocode
 *
 * Results are session-cached to avoid redundant API calls.
 */

export interface GeoCoords { latitude: number; longitude: number; }
export interface GeoDistrict { district: string; state: string; country: string; }

// ── Session cache ─────────────────────────────────────────────────────────────
let _coordsCache: GeoCoords | null = null;
let _geocodeCache: Map<string, GeoDistrict> = new Map();

// ── 1. Get current location ───────────────────────────────────────────────────
export function getCurrentLocation(): Promise<GeoCoords> {
    if (_coordsCache) return Promise.resolve(_coordsCache);

    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation not supported by this browser.'));
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords: GeoCoords = {
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                };
                _coordsCache = coords;
                resolve(coords);
            },
            (err) => {
                const messages: Record<number, string> = {
                    1: 'Location permission denied.',
                    2: 'Location unavailable.',
                    3: 'Location request timed out.',
                };
                reject(new Error(messages[err.code] ?? 'Unknown geolocation error.'));
            },
            { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 }
        );
    });
}

// ── 2. Reverse geocode via Nominatim ─────────────────────────────────────────
export async function reverseGeocode(lat: number, lng: number): Promise<GeoDistrict> {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (_geocodeCache.has(key)) return _geocodeCache.get(key)!;

    const url =
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
        `&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;

    const res = await fetch(url, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'SalesTerritoryPlatform/1.0' },
    });

    if (!res.ok) throw new Error(`Nominatim error: ${res.status}`);

    const data = await res.json();
    const addr = data.address || {};

    // Nominatim uses different keys depending on country/zoom level
    const district =
        addr.county || addr.district || addr.city_district ||
        addr.suburb || addr.city || addr.town || addr.village || '';
    const state = addr.state || '';
    const country = addr.country || '';

    const result: GeoDistrict = { district, state, country };
    _geocodeCache.set(key, result);
    return result;
}

/** Clear session cache (e.g. on logout) */
export function clearGeoCache() {
    _coordsCache = null;
    _geocodeCache = new Map();
}
