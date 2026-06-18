#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import time

TILE_EDGE_NM = 25.0
STEP_DEG = TILE_EDGE_NM / 60.0


def tile_bounds_from_key(key: str):
    lat_i, lon_i = [int(x) for x in key.split("|")]
    south = (lat_i * STEP_DEG) - 90.0
    west = (lon_i * STEP_DEG) - 180.0
    return {
        "latI": lat_i,
        "lonI": lon_i,
        "south": south,
        "west": west,
        "north": south + STEP_DEG,
        "east": west + STEP_DEG,
    }


def clean_value(value, lower=False):
    if value is None:
        return ""
    s = str(value).strip()
    return s.lower() if lower else s


MAJOR_HIGHWAY = {
    "motorway",
    "motorway_link",
    "trunk",
    "trunk_link",
    "primary",
    "primary_link",
    "secondary",
    "secondary_link",
    "tertiary",
    "tertiary_link",
}
MAJOR_RAIL = {"rail", "light_rail", "narrow_gauge", "subway", "tram"}
RAIL_FACILITIES = {
    "station",
    "halt",
    "signal_box",
    "switch",
    "signal",
    "level_crossing",
    "crossing",
    "junction",
    "platform",
    "buffer_stop",
}
INDUSTRIAL_MAN_MADE = {
    "water_works",
    "wastewater_plant",
    "works",
    "storage_tank",
    "silo",
    "chimney",
    "tower",
    "mast",
    "communications_tower",
}


def infer_infra_type(item):
    power = clean_value(item.get("power"), lower=True)
    generator_source = clean_value(item.get("generator_source"), lower=True)
    plant_source = clean_value(item.get("plant_source"), lower=True)
    highway = clean_value(item.get("highway"), lower=True)
    railway = clean_value(item.get("railway"), lower=True)
    waterway = clean_value(item.get("waterway"), lower=True)
    man_made = clean_value(item.get("man_made"), lower=True)
    bridge = clean_value(item.get("bridge"), lower=True)
    landuse = clean_value(item.get("landuse"), lower=True)
    amenity = clean_value(item.get("amenity"), lower=True)
    industrial = clean_value(item.get("industrial"), lower=True)
    if generator_source == "solar" or plant_source == "solar":
        return "solar"
    if generator_source == "wind" or plant_source == "wind":
        return "wind"
    if "hydro" in f"{generator_source} {plant_source}" or "water" in f"{generator_source} {plant_source}" or waterway in {"dam", "weir"}:
        return "hydro"
    if power in {"substation", "transformer", "switchgear", "converter", "compensator"}:
        return "power_station"
    if power in {"line", "minor_line", "cable", "tower", "pole"}:
        return "power_grid"
    if bridge and bridge != "no":
        return "bridge"
    if man_made == "bridge":
        return "bridge"
    if railway in MAJOR_RAIL or railway in RAIL_FACILITIES:
        return "rail"
    if highway in MAJOR_HIGHWAY:
        return "road"
    if landuse == "industrial" or industrial or man_made in INDUSTRIAL_MAN_MADE or amenity in {"water_works", "wastewater_plant", "waste_transfer_station", "fuel", "bus_station"}:
        return "industrial"
    if power:
        return "power"
    return "infra"


def normalize_row(row, kind):
    (
        osm_id,
        name,
        lat,
        lon,
        ref,
        operator,
        power,
        generator_source,
        plant_source,
        generator_method,
        plant_method,
        substation,
        transformer,
        voltage,
        frequency,
        location,
        utility,
        man_made,
        waterway,
        bridge,
        highway,
        railway,
        service,
        landuse,
        industrial,
        amenity,
        natural,
        water,
        building,
        material,
        sample_count,
    ) = row

    out = {
        "name": clean_value(name)[:90],
        "lat": round(float(lat), 6),
        "lon": round(float(lon), 6),
        "osm_kind": kind,
        "osm_id": str(osm_id or ""),
        "infra_enriched": True,
    }
    fields = {
        "ref": ref,
        "operator": operator,
        "power": power,
        "generator_source": generator_source,
        "plant_source": plant_source,
        "generator_method": generator_method,
        "plant_method": plant_method,
        "substation": substation,
        "transformer": transformer,
        "voltage": voltage,
        "frequency": frequency,
        "location": location,
        "utility": utility,
        "man_made": man_made,
        "waterway": waterway,
        "bridge": bridge,
        "highway": highway,
        "railway": railway,
        "service": service,
        "landuse": landuse,
        "industrial": industrial,
        "amenity": amenity,
        "natural": natural,
        "water": water,
        "building": building,
        "material": material,
    }
    for key, value in fields.items():
        lower = key not in {"ref", "operator", "voltage", "frequency"}
        s = clean_value(value, lower=lower)
        if s:
            out[key] = s[:120]
    out["infra_type"] = infer_infra_type(out)
    if kind == "way":
        out["sample_count"] = int(sample_count or 0)
    return out


def is_low_value_bridge(item):
    bridge = clean_value(item.get("bridge"), lower=True)
    if not bridge or bridge == "no":
        return False
    if item.get("power") or item.get("generator_source") or item.get("plant_source"):
        return False
    if clean_value(item.get("man_made"), lower=True) == "bridge":
        return False
    railway = clean_value(item.get("railway"), lower=True)
    highway = clean_value(item.get("highway"), lower=True)
    if railway in {"rail", "light_rail", "narrow_gauge", "tram"}:
        return False
    if highway in {
        "motorway",
        "motorway_link",
        "trunk",
        "trunk_link",
        "primary",
        "primary_link",
        "secondary",
        "secondary_link",
        "tertiary",
        "tertiary_link",
    }:
        return False
    return True


def dedupe_features(features):
    features = [item for item in features if not is_low_value_bridge(item)]
    seen = set()
    deduped = []
    for item in features:
        key = (
            item.get("osm_kind"),
            item.get("osm_id"),
            round(float(item.get("lat", 0)), 5),
            round(float(item.get("lon", 0)), 5),
            item.get("power", ""),
            item.get("man_made", ""),
            item.get("generator_source", ""),
            item.get("plant_source", ""),
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(item)
    return deduped


def extract(con, pbf_path, bounds):
    south = bounds["south"]
    west = bounds["west"]
    north = bounds["north"]
    east = bounds["east"]

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE bbox_nodes AS
        SELECT
            id,
            CAST(lat AS DOUBLE) AS lat,
            CAST(lon AS DOUBLE) AS lon,
            tags
        FROM ST_ReadOSM('{pbf_path}')
        WHERE kind = 'node'
          AND lat BETWEEN {south} AND {north}
          AND lon BETWEEN {west} AND {east}
    """)

    infra_predicate = """
        tags['power'] IN ('plant','generator','substation','transformer','switchgear','converter','compensator','line','minor_line','cable')
        OR tags['generator:source'] IS NOT NULL
        OR tags['plant:source'] IS NOT NULL
        OR tags['generator:method'] IS NOT NULL
        OR tags['plant:method'] IS NOT NULL
        OR tags['substation'] IS NOT NULL
        OR tags['transformer'] IS NOT NULL
        OR tags['waterway'] IN ('dam','weir')
        OR tags['bridge'] IS NOT NULL
        OR tags['railway'] IN ('rail','light_rail','narrow_gauge','subway','tram','station','halt','signal_box','switch','signal','level_crossing','crossing','junction','platform','buffer_stop')
        OR tags['building'] IN ('train_station','transportation','railway')
        OR tags['historic'] IN ('railway_station')
        OR regexp_matches(lower(COALESCE(tags['name'], '')), '(stellwerk|bahnwaerter|bahnw.rter|bahnuebergang|bahn.bergang|haltepunkt)')
        OR tags['man_made'] IN ('bridge','water_works','wastewater_plant','works','storage_tank','silo','chimney')
    """

    common_cols = """
      id,
      COALESCE(tags['name'], tags['ref'], tags['operator'], '') AS name,
      lat,
      lon,
      tags['ref'] AS ref,
      tags['operator'] AS operator,
      tags['power'] AS power,
      tags['generator:source'] AS generator_source,
      tags['plant:source'] AS plant_source,
      tags['generator:method'] AS generator_method,
      tags['plant:method'] AS plant_method,
      tags['substation'] AS substation,
      tags['transformer'] AS transformer,
      tags['voltage'] AS voltage,
      tags['frequency'] AS frequency,
      tags['location'] AS location,
      tags['utility'] AS utility,
      tags['man_made'] AS man_made,
      tags['waterway'] AS waterway,
      tags['bridge'] AS bridge,
      tags['highway'] AS highway,
      tags['railway'] AS railway,
      tags['service'] AS service,
      tags['landuse'] AS landuse,
      tags['industrial'] AS industrial,
      tags['amenity'] AS amenity,
      tags['natural'] AS natural,
      tags['water'] AS water,
      tags['building'] AS building,
      tags['material'] AS material,
      1 AS sample_count
    """

    node_rows = con.execute(f"""
        SELECT {common_cols}
        FROM bbox_nodes
        WHERE {infra_predicate}
    """).fetchall()

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE candidate_ways AS
        SELECT id, tags, refs
        FROM ST_ReadOSM('{pbf_path}')
        WHERE kind = 'way'
          AND refs IS NOT NULL
          AND ({infra_predicate})
    """)

    way_sql = """
    WITH way_hits AS (
      SELECT DISTINCT w.id, w.tags, w.refs
      FROM candidate_ways w
      JOIN UNNEST(w.refs) AS r(ref_id) ON TRUE
      JOIN bbox_nodes bn ON bn.id = r.ref_id
    )
    SELECT
      wh.id,
      COALESCE(wh.tags['name'], wh.tags['ref'], wh.tags['operator'], '') AS name,
      AVG(bn.lat) AS lat,
      AVG(bn.lon) AS lon,
      wh.tags['ref'] AS ref,
      wh.tags['operator'] AS operator,
      wh.tags['power'] AS power,
      wh.tags['generator:source'] AS generator_source,
      wh.tags['plant:source'] AS plant_source,
      wh.tags['generator:method'] AS generator_method,
      wh.tags['plant:method'] AS plant_method,
      wh.tags['substation'] AS substation,
      wh.tags['transformer'] AS transformer,
      wh.tags['voltage'] AS voltage,
      wh.tags['frequency'] AS frequency,
      wh.tags['location'] AS location,
      wh.tags['utility'] AS utility,
      wh.tags['man_made'] AS man_made,
      wh.tags['waterway'] AS waterway,
      wh.tags['bridge'] AS bridge,
      wh.tags['highway'] AS highway,
      wh.tags['railway'] AS railway,
      wh.tags['service'] AS service,
      wh.tags['landuse'] AS landuse,
      wh.tags['industrial'] AS industrial,
      wh.tags['amenity'] AS amenity,
      wh.tags['natural'] AS natural,
      wh.tags['water'] AS water,
      wh.tags['building'] AS building,
      wh.tags['material'] AS material,
      COUNT(*) AS sample_count
    FROM way_hits wh
    JOIN UNNEST(wh.refs) AS r(ref_id) ON TRUE
    JOIN bbox_nodes bn ON bn.id = r.ref_id
    GROUP BY
      1,2,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30
    """
    way_rows = con.execute(way_sql).fetchall()

    features = [normalize_row(row, "node") for row in node_rows]
    features.extend(normalize_row(row, "way") for row in way_rows)
    return dedupe_features(features)


def sql_string(value: str) -> str:
    return str(value).replace("'", "''")


def parse_tiles(raw: str):
    out = []
    seen = set()
    for part in re.split(r"[\s,;]+", str(raw or "").strip()):
        if not part:
            continue
        if not re.match(r"^-?\d+\|-?\d+$", part):
            raise ValueError(f"Invalid tile key: {part}")
        if part in seen:
            continue
        seen.add(part)
        out.append(part)
    return out


def extract_many(con, pbf_path, tile_keys):
    bounds_by_tile = {tile: tile_bounds_from_key(tile) for tile in tile_keys}
    if not bounds_by_tile:
        return {}
    south = min(b["south"] for b in bounds_by_tile.values())
    west = min(b["west"] for b in bounds_by_tile.values())
    north = max(b["north"] for b in bounds_by_tile.values())
    east = max(b["east"] for b in bounds_by_tile.values())
    pbf_sql = sql_string(pbf_path)
    tile_values = ",".join(f"('{sql_string(tile)}')" for tile in tile_keys)
    tile_expr = (
        f"CAST(CAST(FLOOR((lat + 90.0) / {STEP_DEG}) AS BIGINT) AS VARCHAR)"
        f" || '|' || "
        f"CAST(CAST(FLOOR((lon + 180.0) / {STEP_DEG}) AS BIGINT) AS VARCHAR)"
    )

    con.execute("CREATE OR REPLACE TEMP TABLE requested_tiles(tile VARCHAR)")
    con.execute(f"INSERT INTO requested_tiles VALUES {tile_values}")
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE bbox_nodes AS
        WITH raw_nodes AS (
            SELECT
                {tile_expr} AS tile,
                id,
                CAST(lat AS DOUBLE) AS lat,
                CAST(lon AS DOUBLE) AS lon,
                tags
            FROM ST_ReadOSM('{pbf_sql}')
            WHERE kind = 'node'
              AND lat BETWEEN {south} AND {north}
              AND lon BETWEEN {west} AND {east}
        )
        SELECT rn.*
        FROM raw_nodes rn
        JOIN requested_tiles rt ON rt.tile = rn.tile
    """)

    infra_predicate = """
        tags['power'] IN ('plant','generator','substation','transformer','switchgear','converter','compensator','line','minor_line','cable')
        OR tags['generator:source'] IS NOT NULL
        OR tags['plant:source'] IS NOT NULL
        OR tags['generator:method'] IS NOT NULL
        OR tags['plant:method'] IS NOT NULL
        OR tags['substation'] IS NOT NULL
        OR tags['transformer'] IS NOT NULL
        OR tags['waterway'] IN ('dam','weir')
        OR tags['bridge'] IS NOT NULL
        OR tags['railway'] IN ('rail','light_rail','narrow_gauge','subway','tram','station','halt','signal_box','switch','signal','level_crossing','crossing','junction','platform','buffer_stop')
        OR tags['building'] IN ('train_station','transportation','railway')
        OR tags['historic'] IN ('railway_station')
        OR regexp_matches(lower(COALESCE(tags['name'], '')), '(stellwerk|bahnwaerter|bahnw.rter|bahnuebergang|bahn.bergang|haltepunkt)')
        OR tags['man_made'] IN ('bridge','water_works','wastewater_plant','works','storage_tank','silo','chimney')
    """

    common_cols = """
      id,
      COALESCE(tags['name'], tags['ref'], tags['operator'], '') AS name,
      lat,
      lon,
      tags['ref'] AS ref,
      tags['operator'] AS operator,
      tags['power'] AS power,
      tags['generator:source'] AS generator_source,
      tags['plant:source'] AS plant_source,
      tags['generator:method'] AS generator_method,
      tags['plant:method'] AS plant_method,
      tags['substation'] AS substation,
      tags['transformer'] AS transformer,
      tags['voltage'] AS voltage,
      tags['frequency'] AS frequency,
      tags['location'] AS location,
      tags['utility'] AS utility,
      tags['man_made'] AS man_made,
      tags['waterway'] AS waterway,
      tags['bridge'] AS bridge,
      tags['highway'] AS highway,
      tags['railway'] AS railway,
      tags['service'] AS service,
      tags['landuse'] AS landuse,
      tags['industrial'] AS industrial,
      tags['amenity'] AS amenity,
      tags['natural'] AS natural,
      tags['water'] AS water,
      tags['building'] AS building,
      tags['material'] AS material,
      1 AS sample_count
    """

    node_rows = con.execute(f"""
        SELECT tile, {common_cols}
        FROM bbox_nodes
        WHERE {infra_predicate}
    """).fetchall()

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE candidate_ways AS
        SELECT id, tags, refs
        FROM ST_ReadOSM('{pbf_sql}')
        WHERE kind = 'way'
          AND refs IS NOT NULL
          AND ({infra_predicate})
    """)

    way_rows = con.execute("""
    WITH way_hits AS (
      SELECT DISTINCT bn.tile, w.id, w.tags, w.refs
      FROM candidate_ways w
      JOIN UNNEST(w.refs) AS r(ref_id) ON TRUE
      JOIN bbox_nodes bn ON bn.id = r.ref_id
    )
    SELECT
      wh.tile,
      wh.id,
      COALESCE(wh.tags['name'], wh.tags['ref'], wh.tags['operator'], '') AS name,
      AVG(bn.lat) AS lat,
      AVG(bn.lon) AS lon,
      wh.tags['ref'] AS ref,
      wh.tags['operator'] AS operator,
      wh.tags['power'] AS power,
      wh.tags['generator:source'] AS generator_source,
      wh.tags['plant:source'] AS plant_source,
      wh.tags['generator:method'] AS generator_method,
      wh.tags['plant:method'] AS plant_method,
      wh.tags['substation'] AS substation,
      wh.tags['transformer'] AS transformer,
      wh.tags['voltage'] AS voltage,
      wh.tags['frequency'] AS frequency,
      wh.tags['location'] AS location,
      wh.tags['utility'] AS utility,
      wh.tags['man_made'] AS man_made,
      wh.tags['waterway'] AS waterway,
      wh.tags['bridge'] AS bridge,
      wh.tags['highway'] AS highway,
      wh.tags['railway'] AS railway,
      wh.tags['service'] AS service,
      wh.tags['landuse'] AS landuse,
      wh.tags['industrial'] AS industrial,
      wh.tags['amenity'] AS amenity,
      wh.tags['natural'] AS natural,
      wh.tags['water'] AS water,
      wh.tags['building'] AS building,
      wh.tags['material'] AS material,
      COUNT(*) AS sample_count
    FROM way_hits wh
    JOIN UNNEST(wh.refs) AS r(ref_id) ON TRUE
    JOIN bbox_nodes bn ON bn.id = r.ref_id AND bn.tile = wh.tile
    GROUP BY
      1,2,3,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31
    """).fetchall()

    out = {tile: [] for tile in tile_keys}
    for row in node_rows:
        tile = row[0]
        if tile in out:
            out[tile].append(normalize_row(row[1:], "node"))
    for row in way_rows:
        tile = row[0]
        if tile in out:
            out[tile].append(normalize_row(row[1:], "way"))
    return {tile: dedupe_features(features) for tile, features in out.items()}


def build_payload(tile, bounds, poi, pbf_path, duration_sec):
    return {
        "v": 1,
        "schema": "ga.infraEnrichment.v1",
        "tile": tile,
        "grid": {"edgeNm": TILE_EDGE_NM, "stepDeg": STEP_DEG},
        "bounds": {
            "south": bounds["south"],
            "west": bounds["west"],
            "north": bounds["north"],
            "east": bounds["east"],
        },
        "source": os.path.basename(pbf_path),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "durationSec": round(duration_sec, 3),
        "counts": {"poi": len(poi)},
        "poi": poi,
    }


def write_payload(payload, out_path):
    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser(description="Extract infra enrichment POIs for 25 NM tiles from OSM PBF")
    ap.add_argument("--pbf", required=True, help="Path to .osm.pbf")
    ap.add_argument("--tile", help="Tile key latI|lonI")
    ap.add_argument("--tiles", help="Comma/space separated tile keys latI|lonI")
    ap.add_argument("--out", help="Output JSON path for single-tile mode")
    ap.add_argument("--out-dir", help="Output directory for multi-tile mode")
    args = ap.parse_args()

    tiles = parse_tiles(args.tiles) if args.tiles else parse_tiles(args.tile or "")
    if not tiles:
        raise SystemExit("Missing required --tile or --tiles")
    if len(tiles) == 1 and not args.out and not args.out_dir:
        raise SystemExit("Missing --out or --out-dir")
    if len(tiles) > 1 and not args.out_dir:
        raise SystemExit("Multi-tile mode requires --out-dir")

    import duckdb
    con = duckdb.connect()
    con.execute("LOAD spatial;")
    con.execute("SET threads TO 4;")
    con.execute("SET memory_limit = '1GB';")

    t0 = time.time()
    if len(tiles) == 1:
        tile = tiles[0]
        bounds = tile_bounds_from_key(tile)
        poi = extract(con, args.pbf, bounds)
        dt = time.time() - t0
        payload = build_payload(tile, bounds, poi, args.pbf, dt)
        out_path = args.out or os.path.join(args.out_dir, f"{tile.replace('|', '_')}.infra.json")
        size = write_payload(payload, out_path)
        print(json.dumps({
            "tile": tile,
            "durationSec": payload["durationSec"],
            "counts": payload["counts"],
            "sizeBytes": size,
            "out": out_path,
        }, ensure_ascii=False))
        return

    results = extract_many(con, args.pbf, tiles)
    dt = time.time() - t0
    rows = []
    for tile in tiles:
        bounds = tile_bounds_from_key(tile)
        poi = results.get(tile, [])
        payload = build_payload(tile, bounds, poi, args.pbf, dt)
        out_path = os.path.join(args.out_dir, f"{tile.replace('|', '_')}.infra.json")
        size = write_payload(payload, out_path)
        rows.append({
            "tile": tile,
            "counts": payload["counts"],
            "sizeBytes": size,
            "out": out_path,
        })

    print(json.dumps({
        "tiles": tiles,
        "durationSec": round(dt, 3),
        "counts": {"tiles": len(tiles), "poi": sum(r["counts"]["poi"] for r in rows)},
        "outputs": rows,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
