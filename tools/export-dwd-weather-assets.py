#!/usr/bin/env python3
"""Export a rolling ICON-EU forecast window as versioned static tiles."""

import argparse
from datetime import datetime, timedelta, timezone
import gzip
import json
from pathlib import Path
from runpy import run_path
from tempfile import TemporaryDirectory
from time import monotonic
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
import zlib


# 3° tiles, sampled at 0.125°. Bounds are south, west, north, east.
BOUNDS = (45, 3, 57, 18)
TILE_DEGREES = 3
SAMPLES_PER_DEGREE = 8
SIDE = TILE_DEGREES * SAMPLES_PER_DEGREE
MISSING = -32768
UI_HOURS_AHEAD = 12
# Reserve beyond the UI window: a missed or late scheduled run (GitHub delays
# schedules by hours) must not empty the timeline. Re-export when it shrinks.
HOURS_AHEAD = 30
MIN_RESERVE_HOURS = 24
PUBLISHED_URL = "https://ga-dwd-alpha.einherjer.workers.dev"
HTTP_HEADERS = {"User-Agent": "GA-Dispatcher-Weather-Export/1.0"}
MAP_FIELDS = (("clcl", None), ("clcm", None), ("clch", None),
              ("u_10m", None), ("v_10m", None))
ENCODING = {
    # Store (value - offset) * scale as a little-endian signed int16.
    "pmsl": (100000, .2), "fi": (0, .2), "t": (273.15, 5), "t_2m": (273.15, 5),
    "u": (0, 5), "v": (0, 5), "u_10m": (0, 5), "v_10m": (0, 5),
}


def write_tile(path, fields, columns, selection, inside, np):
    parts = []
    for field in fields:
        data = columns[field][selection]
        offset, scale = ENCODING.get(field[0], (0, 1))
        data = np.where(inside[selection] & np.isfinite(data),
                        np.clip(np.rint((data - offset) * scale), MISSING + 1, 32767), MISSING)
        parts.append(data.astype("<i2").tobytes())
    payload = gzip.compress(b"".join(parts), compresslevel=6, mtime=0)
    path.write_bytes(payload)
    return len(payload)


def read_manifest(url, schema):
    try:
        with urlopen(Request(url + "/manifest.json", headers=HTTP_HEADERS), timeout=15) as response:
            data = json.loads(response.read(65536))
    except HTTPError as error:
        if error.code != 404:
            raise
        return {}
    expected = json.loads(json.dumps(schema))
    if not isinstance(data, dict) or any(data.get(key) != value for key, value in expected.items()):
        return {}
    terms = {}
    for item in data.get("terms", []):
        valid = datetime.fromtimestamp(item["validAt"] / 1000, timezone.utc)
        run = datetime.fromtimestamp(item["runAt"] / 1000, timezone.utc)
        if item.get("key") == term_key(valid, run) and run <= valid:
            terms[valid] = run
    return terms


def term_key(valid, run):
    return f"{valid:%Y%m%d%H}-{run:%Y%m%d%H}"


def covers(terms, current, hours_back):
    return all(current + timedelta(hours=hour) in terms for hour in range(-hours_back, UI_HOURS_AHEAD + 1))


def read_tile(url, expected_size):
    with urlopen(Request(url, headers=HTTP_HEADERS), timeout=12) as response:
        payload = response.read(131073)
    decoder = zlib.decompressobj(16 + zlib.MAX_WBITS)
    if len(payload) > 131072 or len(decoder.decompress(payload, expected_size + 1)) != expected_size or not decoder.eof:
        raise ValueError("Invalid cached DWD tile")
    return payload


def reuse_term(pool, url, destination, tiles, profile_fields):
    requests = {}
    for lat, lon in tiles:
        for name, fields in (("map", MAP_FIELDS), ("profile", profile_fields)):
            filename = f"{lat}-{lon}-{name}.bin.gz"
            requests[filename] = pool.submit(read_tile, f"{url}/{destination.name}/{filename}", len(fields) * SIDE * SIDE * 2)
    try:
        contents = {filename: future.result() for filename, future in requests.items()}
    except (URLError, TimeoutError, ValueError, zlib.error):
        return None
    finally:
        for future in requests.values():
            if not future.cancel():
                future.exception()
    for filename, payload in contents.items():
        (destination / filename).write_bytes(payload)
    return sum(map(len, contents.values()))


def choose_runs(model, dates, current, previous, covered):
    # Probe the end of the UI window. A run may appear in the directory before
    # all fields needed for the displayed window are ready. The 03/09/15/21 UTC
    # runs reach only +30 h, so the reserve hours are chosen separately.
    threshold = current + timedelta(hours=UI_HOURS_AHEAD + 1)
    try:
        latest = model.choose(threshold)
    except (URLError, TimeoutError, ValueError):
        if covered:
            return None
        raise
    reserve = current + timedelta(hours=min(MIN_RESERVE_HOURS, (dates[-1] - current) // timedelta(hours=1)))
    if (covered and previous and max(previous) >= reserve and threshold in previous
            and latest <= previous[threshold]):
        return None
    runs = {}
    for valid in dates:
        # Past hours already published stay stable. The UI window uses the
        # newest run without regressing a published term. Reserve hours keep
        # their published run (cheap reuse) and are refreshed once they enter
        # the UI window; new reserve hours take the newest run reaching them.
        if valid < current:
            runs[valid] = previous.get(valid) or model.choose(valid)
        elif valid <= threshold:
            runs[valid] = max(latest, previous.get(valid, latest))
        else:
            runs[valid] = previous.get(valid) or model.choose(valid)
    return runs


def export(output, dates, cache, source, current, check, hours_back):
    np = source["np"]
    model = source["IconEu"](cache)
    profile_fields = tuple(dict.fromkeys(MAP_FIELDS + source["SURFACE"] + source["PROFILE_SURFACE"] + source["PROFILE"]))
    schema = {"version": 1, "source": "dwd-icon-eu", "bounds": BOUNDS, "tileDegrees": TILE_DEGREES,
              "samplesPerDegree": SAMPLES_PER_DEGREE, "levels": source["LEVELS"], "encoding": ENCODING,
              "fields": {"map": MAP_FIELDS, "profile": profile_fields}}
    south, west, north, east = BOUNDS
    tiles = [(lat, lon) for lat in range(south, north, TILE_DEGREES)
             for lon in range(west, east, TILE_DEGREES)]
    points = [(lat + y / SAMPLES_PER_DEGREE, lon + x / SAMPLES_PER_DEGREE)
              for lat, lon in tiles for y in range(SIDE) for x in range(SIDE)]
    indices = None
    terms = []
    total = 0
    started = monotonic()
    covered = False
    try:
        previous = read_manifest(PUBLISHED_URL, schema) if check else {}
        covered = covers(previous, current, hours_back)
        runs = choose_runs(model, dates, current, previous, covered)
        if runs is None:
            print("No newer complete DWD run; the published forecast still covers the UI window.", flush=True)
            return
        for valid in dates:
            start = monotonic()
            run = runs[valid]
            key = term_key(valid, run)
            destination = output / "v1" / key
            destination.mkdir(parents=True)
            terms.append({"validAt": int(valid.timestamp()) * 1000, "runAt": int(run.timestamp()) * 1000, "key": key})
            if run == previous.get(valid):
                size = reuse_term(model.pool, PUBLISHED_URL + "/v1", destination, tiles, profile_fields)
                if size is not None:
                    total += size
                    print(f"{valid:%Y-%m-%d %H UTC}: reused {size} bytes", flush=True)
                    continue
            if indices is None:
                indices = np.asarray(model.point_indices(run, points))
                inside = indices >= 0
            folder, lease = model.prepare_snapshot(run, valid)
            with lease:
                futures = {field: model.pool.submit(model.sample_field, folder, run, valid, field, indices)
                           for field in profile_fields}
                try:
                    columns = {field: future.result() for field, future in futures.items()}
                finally:
                    for future in futures.values():
                        if not future.cancel():
                            future.exception()
            ready = monotonic()
            size = 0
            for i, (lat, lon) in enumerate(tiles):
                selection = slice(i * SIDE * SIDE, (i + 1) * SIDE * SIDE)
                for name, fields in (("map", MAP_FIELDS), ("profile", profile_fields)):
                    size += write_tile(destination / f"{lat}-{lon}-{name}.bin.gz", fields, columns, selection, inside, np)
            total += size
            print(f"{valid:%Y-%m-%d %H UTC}: fetch and decode {ready-start:.2f}s, export {monotonic()-ready:.2f}s, {size} bytes", flush=True)
    except HTTPError as error:
        if covered and (error.code in (404, 429) or error.code >= 500):
            print(f"DWD returned HTTP {error.code}; retaining the published forecast window.", flush=True)
            return
        raise
    except (URLError, TimeoutError):
        if covered:
            print("DWD temporarily unreachable; retaining the published forecast window.", flush=True)
            return
        raise
    finally:
        model.pool.shutdown()
    manifest = {**schema, "terms": terms}
    headers = """/manifest.json
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=60, must-revalidate
/v1/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=3600
  Content-Type: application/octet-stream
"""
    (output / "_headers").write_text(headers, encoding="utf-8")
    (output / "manifest.json").write_text(json.dumps(manifest, separators=(",", ":")), encoding="utf-8")
    print(f"Snapshot: {len(terms)} hours, {len(tiles) * len(terms) * 2} tiles, {total} bytes, {monotonic()-started:.2f}s", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    parser.add_argument("--hours-back", type=int, default=3, choices=range(4))
    parser.add_argument("--hours-ahead", type=int, default=HOURS_AHEAD, choices=range(49))
    parser.add_argument("--check-published", action="store_true", help="Reuse the published files and skip unchanged covered windows")
    args = parser.parse_args()
    if args.output.exists():
        parser.error("output must be a fresh directory")
    source = run_path(str(Path(__file__).with_name("dwd-icon-eu-service.py")))
    if source["np"] is None:
        parser.error("DWD ICON-EU requires eccodes and numpy")
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    dates = [now + timedelta(hours=hour) for hour in range(-args.hours_back, args.hours_ahead + 1)]
    with TemporaryDirectory(prefix="ga-dwd-export-") as cache:
        export(args.output, dates, Path(cache), source, now, args.check_published, args.hours_back)


if __name__ == "__main__":
    main()
