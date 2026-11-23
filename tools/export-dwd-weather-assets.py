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


# 3° tiles, sampled at 0.125°. Bounds are south, west, north, east.
BOUNDS = (45, 3, 57, 18)
TILE_DEGREES = 3
SAMPLES_PER_DEGREE = 8
SIDE = TILE_DEGREES * SAMPLES_PER_DEGREE
MISSING = -32768
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


def export(output, dates, cache, source):
    np = source["np"]
    model = source["IconEu"](cache)
    profile_fields = tuple(dict.fromkeys(MAP_FIELDS + source["SURFACE"] + source["PROFILE_SURFACE"] + source["PROFILE"]))
    south, west, north, east = BOUNDS
    tiles = [(lat, lon) for lat in range(south, north, TILE_DEGREES)
             for lon in range(west, east, TILE_DEGREES)]
    points = [(lat + y / SAMPLES_PER_DEGREE, lon + x / SAMPLES_PER_DEGREE)
              for lat, lon in tiles for y in range(SIDE) for x in range(SIDE)]
    indices = None
    terms = []
    total = 0
    started = monotonic()
    try:
        for valid in dates:
            start = monotonic()
            run = model.choose(valid)
            if indices is None:
                indices = np.asarray(model.point_indices(run, points))
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
            key = f"{valid:%Y%m%d%H}-{run:%Y%m%d%H}"
            destination = output / "v1" / key
            destination.mkdir(parents=True)
            size = 0
            for i, (lat, lon) in enumerate(tiles):
                selection = slice(i * SIDE * SIDE, (i + 1) * SIDE * SIDE)
                for name, fields in (("map", MAP_FIELDS), ("profile", profile_fields)):
                    size += write_tile(destination / f"{lat}-{lon}-{name}.bin.gz", fields, columns, selection, indices >= 0, np)
            total += size
            terms.append({"validAt": int(valid.timestamp()) * 1000, "runAt": int(run.timestamp()) * 1000, "key": key})
            print(f"{valid:%Y-%m-%d %H UTC}: fetch and decode {ready-start:.2f}s, export {monotonic()-ready:.2f}s, {size} bytes", flush=True)
    finally:
        model.pool.shutdown()
    manifest = {"version": 1, "source": "dwd-icon-eu", "bounds": BOUNDS, "tileDegrees": TILE_DEGREES,
                "samplesPerDegree": SAMPLES_PER_DEGREE, "levels": source["LEVELS"], "encoding": ENCODING,
                "fields": {"map": MAP_FIELDS, "profile": profile_fields}, "terms": terms}
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
    parser.add_argument("--hours-ahead", type=int, default=12, choices=range(13))
    args = parser.parse_args()
    if args.output.exists():
        parser.error("output must be a fresh directory")
    source = run_path(str(Path(__file__).with_name("dwd-icon-eu-service.py")))
    if source["np"] is None:
        parser.error("DWD ICON-EU requires eccodes and numpy")
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    dates = [now + timedelta(hours=hour) for hour in range(-args.hours_back, args.hours_ahead + 1)]
    with TemporaryDirectory(prefix="ga-dwd-export-") as cache:
        export(args.output, dates, Path(cache), source)


if __name__ == "__main__":
    main()
