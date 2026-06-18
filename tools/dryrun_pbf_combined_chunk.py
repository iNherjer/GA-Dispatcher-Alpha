#!/usr/bin/env python3
import argparse
import json
import math
import os
import time
from typing import Dict, Any, List

# Keep same raster as current obstacle workbench/profile logic
TILE_EDGE_NM = 25.0
STEP_DEG = TILE_EDGE_NM / 60.0


def tile_key(lat: float, lon: float) -> str:
    lat_i = math.floor((lat + 90.0) / STEP_DEG)
    lon_i = math.floor((lon + 180.0) / STEP_DEG)
    return f"{lat_i}|{lon_i}"


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


def chunk_extract(con, pbf_path: str, bounds: Dict[str, float]) -> Dict[str, Any]:
    south = bounds["south"]
    west = bounds["west"]
    north = bounds["north"]
    east = bounds["east"]

    # ------------------------------------------------------------------ #
    # PASS 1 – single scan: all nodes in bbox, keep all useful tags.      #
    # This replaces 3 separate ST_ReadOSM(nodes) calls.                   #
    # ------------------------------------------------------------------ #
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE bbox_nodes AS
        SELECT
            id,
            CAST(lat AS DOUBLE) AS lat,
            CAST(lon AS DOUBLE) AS lon,
            tags
        FROM ST_ReadOSM('{pbf_path}')
        WHERE kind = 'node'
          AND lat  BETWEEN {south} AND {north}
          AND lon  BETWEEN {west}  AND {east}
    """)

    # ------------------------------------------------------------------ #
    # PASS 2 – single scan: all candidate ways (tag-filtered, no bbox).   #
    # Bbox intersection is done via JOIN on bbox_nodes (already in RAM).  #
    # ------------------------------------------------------------------ #
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE candidate_ways AS
        SELECT id, tags, refs
        FROM ST_ReadOSM('{pbf_path}')
        WHERE kind = 'way'
          AND refs IS NOT NULL
          AND (
            tags['highway']  IS NOT NULL
            OR tags['railway']  IS NOT NULL
            OR tags['waterway'] IS NOT NULL
            OR tags['natural']  = 'water'
            OR tags['water']    IS NOT NULL
            OR tags['landuse']  IN ('reservoir','basin')
            OR tags['power']    IN ('line','minor_line','cable','plant','generator','substation','transformer','switchgear','converter','compensator')
            OR tags['generator:source'] IS NOT NULL
            OR tags['plant:source'] IS NOT NULL
            OR tags['generator:method'] IS NOT NULL
            OR tags['plant:method'] IS NOT NULL
            OR tags['substation'] IS NOT NULL
            OR tags['transformer'] IS NOT NULL
            OR tags['bridge'] IS NOT NULL
            OR tags['man_made'] IN ('bridge','tower','mast')
            OR tags['historic'] IS NOT NULL
            OR tags['tourism']  IS NOT NULL
            OR tags['leisure']  IS NOT NULL
            OR tags['amenity']  IS NOT NULL
          )
    """)

    # ------------------------------------------------------------------ #
    # All following queries hit only the in-RAM temp tables — no more PBF #
    # ------------------------------------------------------------------ #

    obs_sql = """
    SELECT
      CASE
        WHEN tags['generator:source'] = 'wind' THEN 'wind'
        WHEN tags['power'] = 'tower'           THEN 'power_tower'
        ELSE 'mast'
      END AS type,
      tags['name'] AS name,
      lat, lon,
      CAST(COALESCE(
          TRY_CAST(REPLACE(tags['height'],',','.') AS DOUBLE),
          CASE WHEN tags['generator:source']='wind' THEN 120 ELSE 50 END
      ) * 3.28084 AS BIGINT) AS hFt
    FROM bbox_nodes
    WHERE
      tags['generator:source'] = 'wind'
      OR tags['man_made'] IN ('mast','tower')
      OR tags['power']    IN ('tower','pole')
    """

    way_points_sql = """
    WITH
    way_hits AS (
      SELECT DISTINCT w.id, w.tags, w.refs
      FROM candidate_ways w
      JOIN LATERAL (SELECT UNNEST(w.refs) AS ref_id) r ON TRUE
      JOIN bbox_nodes bn ON bn.id = r.ref_id
    ),
    way_nodes AS (
      SELECT
        wh.id   AS way_id,
        wh.tags AS tags,
        r.ref_id,
        r.ord,
        bn.lat,
        bn.lon
      FROM way_hits wh
      JOIN LATERAL (
          SELECT ref_id, generate_subscripts(wh.refs,1) AS ord, UNNEST(wh.refs) AS ref_id2
      ) r ON r.ref_id = r.ref_id2
      JOIN bbox_nodes bn ON bn.id = r.ref_id
    ),
    sampled AS (
      SELECT
        way_id, tags, ref_id, ord, lat, lon,
        ROW_NUMBER() OVER (PARTITION BY way_id ORDER BY ord) AS rn,
        COUNT(*)      OVER (PARTITION BY way_id)             AS cnt
      FROM way_nodes
    )
    SELECT
      CASE
        WHEN tags['highway']  IS NOT NULL                                                    THEN 'road'
        WHEN tags['railway']  IS NOT NULL                                                    THEN 'rail'
        WHEN tags['waterway'] IS NOT NULL OR tags['natural']='water'
             OR tags['water'] IS NOT NULL OR tags['landuse'] IN ('reservoir','basin')        THEN 'hydro'
        WHEN tags['power']    IN ('line','minor_line','cable')                               THEN 'powerline'
        WHEN tags['man_made'] IN ('bridge','tower','mast')                                   THEN 'man_made'
        ELSE 'poi_way'
      END AS layer,
      COALESCE(tags['name'], tags['ref'], tags['operator'], '') AS name,
      lat, lon,
      tags['highway']  AS highway,
      tags['railway']  AS railway,
      tags['waterway'] AS waterway,
      tags['power']    AS power,
      tags['man_made'] AS man_made,
      tags['natural']  AS natural,
      tags['water']    AS water,
      tags['landuse']  AS landuse,
      tags['tourism']  AS tourism,
      tags['historic'] AS historic,
      tags['amenity']  AS amenity,
      tags['leisure']  AS leisure,
      tags['generator:source'] AS generator_source,
      tags['plant:source'] AS plant_source,
      tags['generator:method'] AS generator_method,
      tags['plant:method'] AS plant_method,
      tags['substation'] AS substation,
      tags['transformer'] AS transformer,
      tags['voltage'] AS voltage,
      tags['operator'] AS operator,
      tags['ref'] AS ref,
      tags['bridge'] AS bridge
    FROM sampled
    WHERE rn = 1 OR rn = cnt OR (cnt >= 10 AND rn % 6 = 0) OR (cnt < 10 AND rn % 3 = 0)
    """

    poi_nodes_sql = """
    SELECT
      COALESCE(tags['name'], tags['ref'], '') AS name,
      lat, lon,
      tags['natural']  AS natural,
      tags['water']    AS water,
      tags['landuse']  AS landuse,
      tags['tourism']  AS tourism,
      tags['historic'] AS historic,
      tags['amenity']  AS amenity,
      tags['leisure']  AS leisure,
      tags['man_made'] AS man_made,
      tags['power']    AS power,
      tags['railway']  AS railway,
      tags['highway']  AS highway,
      tags['place']    AS place,
      tags['generator:source'] AS generator_source,
      tags['plant:source'] AS plant_source,
      tags['generator:method'] AS generator_method,
      tags['plant:method'] AS plant_method,
      tags['substation'] AS substation,
      tags['transformer'] AS transformer,
      tags['voltage'] AS voltage,
      tags['operator'] AS operator,
      tags['ref'] AS ref,
      tags['bridge'] AS bridge
    FROM bbox_nodes
    WHERE
      tags['tourism']  IS NOT NULL
      OR tags['historic'] IS NOT NULL
      OR tags['natural']  IS NOT NULL
      OR tags['water']    IS NOT NULL
      OR tags['landuse']  IN ('industrial','quarry','brownfield','landfill','reservoir','basin')
      OR tags['amenity']  IS NOT NULL
      OR tags['leisure']  IS NOT NULL
      OR tags['man_made'] IS NOT NULL
      OR tags['power']    IS NOT NULL
      OR tags['generator:source'] IS NOT NULL
      OR tags['plant:source'] IS NOT NULL
      OR tags['generator:method'] IS NOT NULL
      OR tags['plant:method'] IS NOT NULL
      OR tags['substation'] IS NOT NULL
      OR tags['transformer'] IS NOT NULL
      OR tags['bridge'] IS NOT NULL
      OR tags['railway']  IS NOT NULL
      OR tags['highway']  IN ('motorway_junction','trunk_junction','crossing','traffic_signals')
      OR tags['place']    IS NOT NULL
    """

    obs_rows = con.execute(obs_sql).fetchall()
    poi_rows = con.execute(poi_nodes_sql).fetchall()

    # Way query — use simpler fallback if the LATERAL syntax fails on older DuckDB
    try:
        way_rows = con.execute(way_points_sql).fetchall()
    except Exception:
        way_rows = _way_points_fallback(con)

    obs = []
    for r in obs_rows:
        t, name, lat, lon, hft = r
        if not isinstance(hft, int) or hft < 30:
            continue
        obs.append({
            "type": t, "name": name or "",
            "lat": float(lat), "lon": float(lon),
            "hFt": int(hft), "elevFt": 0,
        })

    lines = []
    for r in way_rows:
        (layer, name, lat, lon, highway, railway, waterway, power,
         man_made, natural, water, landuse, tourism, historic, amenity, leisure,
         generator_source, plant_source, generator_method, plant_method, substation,
         transformer, voltage, operator, ref, bridge) = r
        lines.append({
            "layer": layer, "name": name or "",
            "lat": float(lat), "lon": float(lon),
            "highway": highway, "railway": railway, "waterway": waterway,
            "power": power, "man_made": man_made, "natural": natural,
            "water": water, "landuse": landuse, "tourism": tourism,
            "historic": historic, "amenity": amenity, "leisure": leisure,
            "generator_source": generator_source, "plant_source": plant_source,
            "generator_method": generator_method, "plant_method": plant_method,
            "substation": substation, "transformer": transformer, "voltage": voltage,
            "operator": operator, "ref": ref, "bridge": bridge,
        })

    poi = []
    for r in poi_rows:
        (name, lat, lon, natural, water, landuse, tourism, historic,
         amenity, leisure, man_made, power, railway, highway, place,
         generator_source, plant_source, generator_method, plant_method, substation,
         transformer, voltage, operator, ref, bridge) = r
        poi.append({
            "name": name or "", "lat": float(lat), "lon": float(lon),
            "natural": natural, "water": water, "landuse": landuse,
            "tourism": tourism, "historic": historic, "amenity": amenity,
            "leisure": leisure, "man_made": man_made, "power": power,
            "railway": railway, "highway": highway, "place": place,
            "generator_source": generator_source, "plant_source": plant_source,
            "generator_method": generator_method, "plant_method": plant_method,
            "substation": substation, "transformer": transformer, "voltage": voltage,
            "operator": operator, "ref": ref, "bridge": bridge,
        })

    def dedupe(items, keys):
        seen = set()
        out = []
        for it in items:
            sig = tuple(it.get(k) for k in keys)
            if sig in seen:
                continue
            seen.add(sig)
            out.append(it)
        return out

    obs   = dedupe(obs,   ["type", "name", "lat", "lon"])
    lines = dedupe(lines, ["layer", "name", "lat", "lon", "highway", "railway", "waterway", "power", "man_made"])
    poi   = dedupe(poi,   ["name", "lat", "lon", "tourism", "historic", "natural", "water", "landuse",
                           "man_made", "power", "railway", "highway", "place"])

    return {"obs": obs, "lin": lines, "poi": poi}


def _way_points_fallback(con):
    """Simpler way-points query without LATERAL — for older DuckDB builds."""
    sql = """
    WITH
    way_hits AS (
      SELECT DISTINCT w.id, w.tags, w.refs
      FROM candidate_ways w
      JOIN UNNEST(w.refs) AS r(ref_id) ON TRUE
      JOIN bbox_nodes bn ON bn.id = r.ref_id
    ),
    way_nodes AS (
      SELECT
        wh.id AS way_id, wh.tags AS tags,
        r.ref_id, r.ord,
        bn.lat, bn.lon
      FROM way_hits wh
      JOIN UNNEST(wh.refs) WITH ORDINALITY AS r(ref_id, ord) ON TRUE
      JOIN bbox_nodes bn ON bn.id = r.ref_id
    ),
    sampled AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY way_id ORDER BY ord) AS rn,
        COUNT(*)      OVER (PARTITION BY way_id)             AS cnt
      FROM way_nodes
    )
    SELECT
      CASE
        WHEN tags['highway']  IS NOT NULL                                               THEN 'road'
        WHEN tags['railway']  IS NOT NULL                                               THEN 'rail'
        WHEN tags['waterway'] IS NOT NULL OR tags['natural']='water'
             OR tags['water'] IS NOT NULL OR tags['landuse'] IN ('reservoir','basin')   THEN 'hydro'
        WHEN tags['power']    IN ('line','minor_line','cable')                          THEN 'powerline'
        WHEN tags['man_made'] IN ('bridge','tower','mast')                              THEN 'man_made'
        ELSE 'poi_way'
      END AS layer,
      COALESCE(tags['name'], tags['ref'], tags['operator'], '') AS name,
      lat, lon,
      tags['highway'] AS highway, tags['railway'] AS railway, tags['waterway'] AS waterway,
      tags['power'] AS power, tags['man_made'] AS man_made, tags['natural'] AS natural,
      tags['water'] AS water, tags['landuse'] AS landuse, tags['tourism'] AS tourism,
      tags['historic'] AS historic, tags['amenity'] AS amenity, tags['leisure'] AS leisure,
      tags['generator:source'] AS generator_source,
      tags['plant:source'] AS plant_source,
      tags['generator:method'] AS generator_method,
      tags['plant:method'] AS plant_method,
      tags['substation'] AS substation,
      tags['transformer'] AS transformer,
      tags['voltage'] AS voltage,
      tags['operator'] AS operator,
      tags['ref'] AS ref,
      tags['bridge'] AS bridge
    FROM sampled
    WHERE rn = 1 OR rn = cnt OR (cnt >= 10 AND rn % 6 = 0) OR (cnt < 10 AND rn % 3 = 0)
    """
    return con.execute(sql).fetchall()


def main():
    ap = argparse.ArgumentParser(description="Build one 25x25 NM combined tile from OSM PBF")
    ap.add_argument("--pbf",  required=True, help="Path to .osm.pbf")
    ap.add_argument("--lat",  type=float, default=None)
    ap.add_argument("--lon",  type=float, default=None)
    ap.add_argument("--tile", default="", help="Explicit tile key latI|lonI")
    ap.add_argument("--out",  required=True, help="Output JSON path")
    args = ap.parse_args()

    tile = args.tile.strip()
    if not tile:
        if args.lat is None or args.lon is None:
            raise SystemExit("Either --tile or both --lat and --lon are required")
        tile = tile_key(args.lat, args.lon)
    bounds = tile_bounds_from_key(tile)

    import duckdb
    con = duckdb.connect()
    con.execute("LOAD spatial;")
    con.execute("SET threads TO 4;")
    con.execute("SET memory_limit = '1GB';")

    t0 = time.time()
    data = chunk_extract(con, args.pbf, bounds)
    dt = time.time() - t0

    result = {
        "v": 1,
        "tile": tile,
        "grid": {"edgeNm": TILE_EDGE_NM, "stepDeg": STEP_DEG},
        "bounds": {
            "south": bounds["south"], "west": bounds["west"],
            "north": bounds["north"], "east": bounds["east"],
        },
        "source": os.path.basename(args.pbf),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "durationSec": round(dt, 3),
        "counts": {"obs": len(data["obs"]), "lin": len(data["lin"]), "poi": len(data["poi"])},
        "obs": data["obs"],
        "lin": data["lin"],
        "poi": data["poi"],
    }

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))

    sz = os.path.getsize(args.out)
    print(json.dumps({
        "tile": tile, "durationSec": result["durationSec"],
        "counts": result["counts"], "sizeBytes": sz, "out": args.out,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
