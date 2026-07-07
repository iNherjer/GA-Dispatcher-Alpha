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


def parse_tile_list(value: str) -> List[str]:
    tiles = []
    seen = set()
    for raw in str(value or "").replace(",", " ").split():
        key = raw.strip()
        if not key or "|" not in key:
            continue
        try:
            tile_bounds_from_key(key)
        except Exception:
            continue
        if key in seen:
            continue
        seen.add(key)
        tiles.append(key)
    return tiles


def sql_quote(value: str) -> str:
    return "'" + str(value).replace("'", "''") + "'"


def configure_duckdb(con):
    temp_dir = os.environ.get("OBS_WORKBENCH_DUCKDB_TEMP_DIR", "").strip()
    memory_limit = os.environ.get("OBS_WORKBENCH_DUCKDB_MEMORY_LIMIT", "1GB").strip() or "1GB"
    threads_raw = os.environ.get("OBS_WORKBENCH_DUCKDB_THREADS", "4").strip()
    try:
        threads = max(1, int(threads_raw))
    except Exception:
        threads = 4
    con.execute(f"SET threads TO {threads};")
    con.execute("SET preserve_insertion_order=false;")
    con.execute(f"SET memory_limit = {sql_quote(memory_limit)};")
    if temp_dir:
        os.makedirs(temp_dir, exist_ok=True)
        try:
            con.execute(f"SET temp_directory = {sql_quote(temp_dir)};")
        except Exception:
            pass


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
    way_nodes AS (
      SELECT
        w.id   AS way_id,
        w.tags AS tags,
        r.ref_id,
        r.ord,
        bn.lat,
        bn.lon
      FROM candidate_ways w
      JOIN UNNEST(w.refs) WITH ORDINALITY AS r(ref_id, ord) ON TRUE
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
        ordered = sorted(items, key=lambda it: json.dumps(it, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
        for it in ordered:
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


def chunk_extract_batch(con, pbf_path: str, tile_keys: List[str]) -> Dict[str, Dict[str, Any]]:
    bounds_by_tile = {tile: tile_bounds_from_key(tile) for tile in tile_keys}
    if not bounds_by_tile:
        return {}

    south = min(b["south"] for b in bounds_by_tile.values())
    west = min(b["west"] for b in bounds_by_tile.values())
    north = max(b["north"] for b in bounds_by_tile.values())
    east = max(b["east"] for b in bounds_by_tile.values())

    values = ",\n".join(
        f"('{tile}', {b['south']}, {b['west']}, {b['north']}, {b['east']})"
        for tile, b in bounds_by_tile.items()
    )
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE batch_tiles(tile, south, west, north, east) AS
        SELECT * FROM (VALUES {values}) AS v(tile, south, west, north, east)
    """)

    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE batch_bbox_nodes AS
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

    con.execute("""
        CREATE OR REPLACE TEMP TABLE batch_bbox_nodes_tile AS
        SELECT t.tile, n.id, n.lat, n.lon, n.tags
        FROM batch_bbox_nodes n
        JOIN batch_tiles t
          ON n.lat BETWEEN t.south AND t.north
         AND n.lon BETWEEN t.west  AND t.east
    """)
    con.execute(f"""
        CREATE OR REPLACE TEMP TABLE batch_candidate_ways AS
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

    obs_sql = """
    SELECT
      tile,
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
    FROM batch_bbox_nodes_tile
    WHERE
      tags['generator:source'] = 'wind'
      OR tags['man_made'] IN ('mast','tower')
      OR tags['power']    IN ('tower','pole')
    """

    way_points_sql = """
    WITH
    way_nodes AS (
      SELECT
        bn.tile,
        w.id   AS way_id,
        w.tags AS tags,
        r.ref_id,
        r.ord,
        bn.lat,
        bn.lon
      FROM batch_candidate_ways w
      JOIN UNNEST(w.refs) WITH ORDINALITY AS r(ref_id, ord) ON TRUE
      JOIN batch_bbox_nodes_tile bn ON bn.id = r.ref_id
    ),
    sampled AS (
      SELECT
        tile, way_id, tags, ref_id, ord, lat, lon,
        ROW_NUMBER() OVER (PARTITION BY tile, way_id ORDER BY ord) AS rn,
        COUNT(*)      OVER (PARTITION BY tile, way_id)             AS cnt
      FROM way_nodes
    )
    SELECT
      tile,
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
      tile,
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
    FROM batch_bbox_nodes_tile
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
    try:
        way_rows = con.execute(way_points_sql).fetchall()
    except Exception:
        way_rows = _way_points_batch_fallback(con)

    out = {tile: {"obs": [], "lin": [], "poi": []} for tile in tile_keys}

    for r in obs_rows:
        tile, t, name, lat, lon, hft = r
        if tile not in out or not isinstance(hft, int) or hft < 30:
            continue
        out[tile]["obs"].append({
            "type": t, "name": name or "",
            "lat": float(lat), "lon": float(lon),
            "hFt": int(hft), "elevFt": 0,
        })

    for r in way_rows:
        (tile, layer, name, lat, lon, highway, railway, waterway, power,
         man_made, natural, water, landuse, tourism, historic, amenity, leisure,
         generator_source, plant_source, generator_method, plant_method, substation,
         transformer, voltage, operator, ref, bridge) = r
        if tile not in out:
            continue
        out[tile]["lin"].append({
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

    for r in poi_rows:
        (tile, name, lat, lon, natural, water, landuse, tourism, historic,
         amenity, leisure, man_made, power, railway, highway, place,
         generator_source, plant_source, generator_method, plant_method, substation,
         transformer, voltage, operator, ref, bridge) = r
        if tile not in out:
            continue
        out[tile]["poi"].append({
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
        deduped = []
        ordered = sorted(items, key=lambda it: json.dumps(it, sort_keys=True, ensure_ascii=False, separators=(",", ":")))
        for it in ordered:
            sig = tuple(it.get(k) for k in keys)
            if sig in seen:
                continue
            seen.add(sig)
            deduped.append(it)
        return deduped

    for tile, data in out.items():
        data["obs"] = dedupe(data["obs"], ["type", "name", "lat", "lon"])
        data["lin"] = dedupe(data["lin"], ["layer", "name", "lat", "lon", "highway", "railway", "waterway", "power", "man_made"])
        data["poi"] = dedupe(data["poi"], ["name", "lat", "lon", "tourism", "historic", "natural", "water", "landuse",
                                           "man_made", "power", "railway", "highway", "place"])

    return out


def _way_points_fallback(con):
    """Simpler way-points query without LATERAL — for older DuckDB builds."""
    sql = """
    WITH
    way_nodes AS (
      SELECT
        w.id AS way_id, w.tags AS tags,
        r.ref_id, r.ord,
        bn.lat, bn.lon
      FROM candidate_ways w
      JOIN UNNEST(w.refs) WITH ORDINALITY AS r(ref_id, ord) ON TRUE
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


def _way_points_batch_fallback(con):
    """Batch way-points query without LATERAL — for older DuckDB builds."""
    sql = """
    WITH
    way_nodes AS (
      SELECT
        bn.tile,
        w.id AS way_id,
        w.tags AS tags,
        r.ref_id,
        r.ord,
        bn.lat,
        bn.lon
      FROM batch_candidate_ways w
      JOIN UNNEST(w.refs) WITH ORDINALITY AS r(ref_id, ord) ON TRUE
      JOIN batch_bbox_nodes_tile bn ON bn.id = r.ref_id
    ),
    sampled AS (
      SELECT *,
        ROW_NUMBER() OVER (PARTITION BY tile, way_id ORDER BY ord) AS rn,
        COUNT(*)      OVER (PARTITION BY tile, way_id)             AS cnt
      FROM way_nodes
    )
    SELECT
      tile,
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


def build_result(tile: str, bounds: Dict[str, float], data: Dict[str, Any], pbf_path: str, duration_sec: float) -> Dict[str, Any]:
    return {
        "v": 1,
        "tile": tile,
        "grid": {"edgeNm": TILE_EDGE_NM, "stepDeg": STEP_DEG},
        "bounds": {
            "south": bounds["south"], "west": bounds["west"],
            "north": bounds["north"], "east": bounds["east"],
        },
        "source": os.path.basename(pbf_path),
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "durationSec": round(duration_sec, 3),
        "counts": {"obs": len(data["obs"]), "lin": len(data["lin"]), "poi": len(data["poi"])},
        "obs": data["obs"],
        "lin": data["lin"],
        "poi": data["poi"],
    }


def write_result(out_path: str, result: Dict[str, Any]) -> int:
    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, separators=(",", ":"))
    return os.path.getsize(out_path)


def main():
    ap = argparse.ArgumentParser(description="Build 25x25 NM combined tile(s) from OSM PBF")
    ap.add_argument("--pbf",  required=True, help="Path to .osm.pbf")
    ap.add_argument("--lat",  type=float, default=None)
    ap.add_argument("--lon",  type=float, default=None)
    ap.add_argument("--tile", default="", help="Explicit tile key latI|lonI")
    ap.add_argument("--tiles", default="", help="Comma/space separated tile keys latI|lonI")
    ap.add_argument("--out",  default="", help="Output JSON path for single tile mode")
    ap.add_argument("--out-dir", default="", help="Output directory for --tiles batch mode")
    args = ap.parse_args()

    tiles = parse_tile_list(args.tiles)
    tile = args.tile.strip()
    if tile and tile not in tiles:
        tiles.insert(0, tile)
    if not tiles:
        if args.lat is None or args.lon is None:
            raise SystemExit("Either --tile/--tiles or both --lat and --lon are required")
        tiles = [tile_key(args.lat, args.lon)]
    if len(tiles) > 1 and not args.out_dir:
        raise SystemExit("--out-dir is required when using --tiles with more than one tile")
    if len(tiles) == 1 and not (args.out or args.out_dir):
        raise SystemExit("--out or --out-dir is required")

    import duckdb
    con = duckdb.connect()
    con.execute("LOAD spatial;")
    configure_duckdb(con)

    t0 = time.time()
    if len(tiles) == 1 and not args.tiles:
        tile = tiles[0]
        bounds = tile_bounds_from_key(tile)
        data = chunk_extract(con, args.pbf, bounds)
        dt = time.time() - t0
        result = build_result(tile, bounds, data, args.pbf, dt)
        out_path = args.out or os.path.join(args.out_dir, f"{tile.replace('|', '_')}.combined.json")
        sz = write_result(out_path, result)
        print(json.dumps({
            "tile": tile, "durationSec": result["durationSec"],
            "counts": result["counts"], "sizeBytes": sz, "out": out_path,
        }, ensure_ascii=False))
        return

    data_by_tile = chunk_extract_batch(con, args.pbf, tiles)
    dt = time.time() - t0
    rows = []
    for tile in tiles:
        bounds = tile_bounds_from_key(tile)
        data = data_by_tile.get(tile) or {"obs": [], "lin": [], "poi": []}
        result = build_result(tile, bounds, data, args.pbf, dt)
        out_path = args.out if len(tiles) == 1 and args.out else os.path.join(args.out_dir, f"{tile.replace('|', '_')}.combined.json")
        sz = write_result(out_path, result)
        rows.append({"tile": tile, "durationSec": result["durationSec"], "counts": result["counts"], "sizeBytes": sz, "out": out_path})
    print(json.dumps({
        "tiles": len(rows),
        "durationSec": round(dt, 3),
        "counts": {
            "obs": sum(r["counts"]["obs"] for r in rows),
            "lin": sum(r["counts"]["lin"] for r in rows),
            "poi": sum(r["counts"]["poi"] for r in rows),
        },
        "outputs": rows,
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
