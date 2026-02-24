/**
 * Import India district polygons from public GeoJSON into the Territory table.
 *
 * Run once from the backend directory:
 *   npx ts-node --transpile-only src/scripts/importDistrictPolygons.ts
 *
 * Source: https://github.com/geohacker/india/blob/master/district/india_district.geojson
 * Properties used: DISTRICT (name), ST_NM (state name)
 *
 * The script fetches the GeoJSON, matches each feature to a Territory record
 * by case-insensitive name (+ optional state), then stores the geometry
 * in the Territory.polygon JSONB column.
 */

import { supabase } from '../config/supabase';

const GEO_URL =
    'https://raw.githubusercontent.com/geohacker/india/master/district/india_district.geojson';

// Alternate name mappings for common spelling differences
const ALIASES: Record<string, string> = {
    'east godavari': 'east godavari',
    'west godavari': 'west godavari',
    'visakhapatnam': 'visakhapatnam',
    'sri potti sriramulu nellore': 'nellore',
    'y.s.r.': 'kadapa',
    'ysr': 'kadapa',
    'spsr nellore': 'nellore',
    'gautam buddha nagar': 'gautam buddha nagar',
    'sant ravidas nagar': 'bhadohi',
    'balrampur - ramanujganj': 'balrampur',
    'balrampur': 'balrampur',
    'north 24 parganas': 'north 24 parganas',
    'south 24 parganas': 'south 24 parganas',
    'paschim bardhaman': 'paschim bardhaman',
    'purba bardhaman': 'purba bardhaman',
    'paschim medinipur': 'paschim medinipur',
    'purba medinipur': 'purba medinipur',
    'kamrup metro': 'kamrup metropolitan',
};

const normalise = (s: string) => {
    const lower = s.toLowerCase().trim();
    return ALIASES[lower] || lower;
};

async function run() {
    console.log('Fetching India district GeoJSON…');
    const res = await fetch(GEO_URL);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const geojson = await res.json() as { features: any[] };
    console.log(`  ↳ ${geojson.features.length} features loaded.`);

    // Load all territories from DB
    const { data: territories, error } = await supabase
        .from('Territory')
        .select('id, name, state');
    if (error) throw error;
    console.log(`  ↳ ${territories!.length} territories in DB.`);

    // Build lookup: normalised_name → territory id
    const lookup = new Map<string, string>();
    for (const t of territories!) {
        lookup.set(normalise(t.name), t.id);
    }

    let matched = 0; let skipped = 0;

    const updates: { id: string; polygon: any }[] = [];
    for (const feature of geojson.features) {
        const rawName = feature.properties?.DISTRICT || feature.properties?.dtname || '';
        const normName = normalise(rawName);
        const tid = lookup.get(normName);
        if (!tid) { skipped++; continue; }

        updates.push({ id: tid, polygon: feature.geometry });
        matched++;
    }

    console.log(`  ↳ Matched: ${matched} | Skipped (no DB record): ${skipped}`);

    // Batch update
    for (let i = 0; i < updates.length; i += 50) {
        const batch = updates.slice(i, i + 50);
        for (const u of batch) {
            await supabase.from('Territory').update({ polygon: u.polygon }).eq('id', u.id);
        }
        console.log(`  ↳ Updated rows ${i + 1}–${Math.min(i + 50, updates.length)}`);
    }

    console.log('✅ Polygon import complete.');
    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
