#!/usr/bin/env python3
"""JSON adapter for the native DWD ICON-EU grid."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import json
import math
import os
from pathlib import Path
import select
import shutil
import socket
import tempfile
import threading
import time
from urllib.error import HTTPError
from urllib.parse import parse_qs, unquote, urlsplit
from urllib.request import Request, urlopen

try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import eccodes as ec
    import numpy as np
except (ImportError, OSError):
    ec = np = None

BASE = "https://opendata.dwd.de/weather/nwp/v1/m/icon-eu/p"
UTC = timezone.utc
LEVELS = (1000, 950, 925, 900, 875, 850, 825, 800, 775, 700, 600, 500, 400)
PROFILE = tuple((key, level) for level in LEVELS for key in ("clc", "fi", "t", "u", "v"))
PROFILE_SURFACE = (("ww", None), ("t_2m", None))
SURFACE = tuple((key, None) for key in (
    "clcl", "clcm", "clch", "clct", "u_10m", "v_10m", "pmsl", "ceiling", "hsurf"
))
GRID = {
    "gridType": "unstructured_grid", "numberOfDataPoints": 768608,
    "uuidOfHGrid": "832c1507fbc73eb384139890094d2c60",
}
CONSTANT_FIELDS = {"hsurf", "clat", "clon"}
FT_PER_M = 3.280839895
KT_PER_MS = 3600 / 1852
CACHE_HOURS = 4
CACHE_IDLE_SECONDS = 20 * 60


class PrefetchDeferred(Exception):
    pass


def url_for(run, valid, field):
    key, level = field
    step = 0 if key in CONSTANT_FIELDS else (valid - run) // timedelta(hours=1)
    pressure = f"/lvt1/100/lv1/{level * 100}" if level is not None else ""
    return f"{BASE}/{key.upper()}{pressure}/r/{run:%Y-%m-%dT%H}%3A00/s/PT{step:03d}H00M.grib2"


def decode_field(body, run, valid, field):
    gid = ec.codes_new_from_message(body)
    try:
        if any(ec.codes_get(gid, key) != value for key, value in GRID.items()):
            raise ValueError("Unexpected ICON-EU grid")
        date = ec.codes_get(gid, "dataDate")
        hour = ec.codes_get(gid, "dataTime")
        if date != int(run.strftime("%Y%m%d")) or hour != run.hour * 100:
            raise ValueError("Unexpected ICON-EU run")
        if field[0] not in CONSTANT_FIELDS:
            valid_date = ec.codes_get(gid, "validityDate")
            valid_time = ec.codes_get(gid, "validityTime")
            if valid_date != int(valid.strftime("%Y%m%d")) or valid_time != valid.hour * 100:
                raise ValueError("Unexpected ICON-EU forecast time")
        values = ec.codes_get_values(gid)
        if ec.codes_get(gid, "bitmapPresent"):
            bitmap = ec.codes_get_array(gid, "bitmap")
            values[bitmap == 0] = np.nan
        return values.astype(np.float32)
    finally:
        ec.codes_release(gid)


def scalar(value, scale=1, offset=0):
    return round(float(value) * scale + offset, 2) if np.isfinite(value) else None


def wind(u, v):
    if not (np.isfinite(u) and np.isfinite(v)):
        return None, None
    return round(math.hypot(u, v) * KT_PER_MS, 2), round(math.degrees(math.atan2(-u, -v)) % 360, 1) % 360


def model_sample(lat, lon, fields, profile):
    speed, direction = wind(fields["u_10m", None], fields["v_10m", None])
    return {
        "lat": lat, "lon": lon,
        "cloudLowPct": scalar(fields["clcl", None]), "cloudMidPct": scalar(fields["clcm", None]),
        "cloudHighPct": scalar(fields["clch", None]), "cloudTotalPct": scalar(fields["clct", None]),
        "wspd": speed, "wdir": direction, "mslPressureHpa": scalar(fields["pmsl", None], 0.01),
        "visibilityM": None,
        "ceilingMslM": scalar(fields["ceiling", None]),
        "modelTerrainMslM": scalar(fields["hsurf", None]),
        "weatherCode": scalar(fields.get(("ww", None), np.nan)),
        "temp2mC": scalar(fields.get(("t_2m", None), np.nan), 1, -273.15),
        "pressureProfile": [
            {"hPa": level, "geopotentialFt": scalar(fields["fi", level], FT_PER_M / 9.80665),
             "temperatureC": scalar(fields["t", level], 1, -273.15), "cloudPct": scalar(fields["clc", level]),
             "windKt": barbs[0], "windDirDeg": barbs[1]}
            for level in LEVELS
            for barbs in [wind(fields["u", level], fields["v", level])]
        ] if profile else [],
    }


class IconEu:
    def __init__(self, cache):
        self.cache = cache
        self.cache.mkdir(parents=True, exist_ok=True)
        self.lock = threading.Lock()
        self.prefetch_lock = threading.Lock()
        self.grid_lock = threading.Lock()
        self.grid = None
        self.warming_folder = None
        self.pool = ThreadPoolExecutor(max_workers=8)
        self.choice = None
        self.retry_after = 0

    def choose(self, valid):
        choice = self.choice
        if choice and choice[0] == valid and time.monotonic() - choice[2] < 5 * 60:
            return choice[1]
        reference = min(valid, datetime.now(UTC))
        candidate = reference.replace(hour=reference.hour - reference.hour % 3, minute=0, second=0, microsecond=0)
        for hours_back in (0, 3, 6, 9):
            run = candidate - timedelta(hours=hours_back)
            try:
                for field in (("fi", LEVELS[-1]), ("pmsl", None), ("hsurf", None)):
                    req = Request(url_for(run, valid, field), method="HEAD")
                    with urlopen(req, timeout=8):
                        pass
            except HTTPError as exc:
                if exc.code != 404:
                    raise
            else:
                self.choice = (valid, run, time.monotonic())
                return run
        raise ValueError("No published ICON-EU run for forecast hour")

    def download_field(self, run, valid, field):
        with urlopen(url_for(run, valid, field), timeout=20) as response:
            body = response.read(8 * 1024 * 1024 + 1)
        if len(body) > 8 * 1024 * 1024:
            raise ValueError("ICON-EU field exceeded size limit")
        return decode_field(body, run, valid, field)

    def point_indices(self, run, points):
        with self.grid_lock:
            if self.grid is None:
                lat = self.download_field(run, run, ("clat", None))
                lon = self.download_field(run, run, ("clon", None))
                order = np.argsort(lat).astype(np.int32)
                self.grid = lat[order], lon[order], order
        latitudes, longitudes, order = self.grid
        indices = []
        # Only use nearby grid cells. Points outside the native nest must not
        # inherit distant weather from the closest boundary cell.
        for lat, lon in points:
            lo, hi = latitudes.searchsorted([lat - 0.15, lat + 0.15])
            nearest = -1
            if lo < hi:
                distance = ((latitudes[lo:hi] - lat) ** 2 +
                            ((longitudes[lo:hi] - lon) * math.cos(math.radians(lat))) ** 2)
                offset = np.argmin(distance)
                if distance[offset] < 0.15 ** 2:
                    nearest = order[lo + offset]
            indices.append(nearest)
        return indices

    def field(self, folder, run, valid, field):
        key, level = field
        target = folder / f"{key}-{level or 'surface'}.npy"
        if not target.exists():
            data = self.download_field(run, valid, field)
            with tempfile.NamedTemporaryFile(dir=folder, suffix=".pending", delete=False) as stream:
                pending = Path(stream.name)
                try:
                    np.save(stream, data, allow_pickle=False)
                    stream.close()
                    pending.replace(target)
                finally:
                    pending.unlink(missing_ok=True)
        return np.load(target, mmap_mode="r", allow_pickle=False)

    def prune_cache(self, keep=None):
        now = time.time()
        oldest_term = (datetime.now(UTC) - timedelta(hours=3)).strftime("%Y%m%d%H")
        protected = {keep, self.warming_folder} - {None}
        entries = []
        for folder in self.cache.glob("v[12]-*-*"):
            if not folder.is_dir() or folder.is_symlink() or folder in protected:
                continue
            try:
                last_used = folder.stat().st_mtime
            except FileNotFoundError:
                continue
            if now - last_used >= CACHE_IDLE_SECONDS or folder.name.split("-")[1] < oldest_term:
                self.remove_snapshot(folder)
            else:
                entries.append((last_used, folder))
        for _, folder in sorted(entries, reverse=True)[CACHE_HOURS - len(protected):]:
            self.remove_snapshot(folder)

    def remove_snapshot(self, folder):
        # Multiple local web starters can share the same on-disk cache.
        try:
            with (folder / ".lease").open("ab") as lease:
                if fcntl is not None:
                    fcntl.flock(lease, fcntl.LOCK_EX | fcntl.LOCK_NB)
                shutil.rmtree(folder, ignore_errors=True)
        except (FileNotFoundError, BlockingIOError):
            pass

    def clean_while_idle(self, stop):
        while not stop.is_set():
            if self.lock.acquire(blocking=False):
                try:
                    self.prune_cache()
                finally:
                    self.lock.release()
            stop.wait(60)

    def prepare_snapshot(self, run, valid):
        folder = self.cache / f"v2-{valid:%Y%m%d%H}-{run:%Y%m%d%H}"
        lease_path = folder / ".lease"
        while True:
            folder.mkdir(exist_ok=True)
            try:
                lease = lease_path.open("ab")
            except FileNotFoundError:
                continue
            try:
                if fcntl is not None:
                    fcntl.flock(lease, fcntl.LOCK_SH)
                if lease_path.stat().st_ino != os.fstat(lease.fileno()).st_ino:
                    lease.close()
                    continue
            except FileNotFoundError:
                lease.close()
                continue
            except Exception:
                lease.close()
                raise
            try:
                folder.touch()
                self.prune_cache(keep=folder)
                return folder, lease
            except Exception:
                lease.close()
                raise

    def sample_field(self, folder, run, valid, field, indices):
        try:
            return self.field(folder, run, valid, field)[indices]
        except HTTPError as exc:
            if field in PROFILE_SURFACE and exc.code == 404:
                return np.full(len(indices), np.nan)
            raise

    def prefetch(self, valid, fields, points, cancelled):
        if not self.prefetch_lock.acquire(blocking=False):
            raise PrefetchDeferred()
        lease = None
        try:
            if self.lock.locked() or cancelled() or time.monotonic() < self.retry_after:
                raise PrefetchDeferred()
            run = self.choose(valid)
            indices = self.point_indices(run, points)
            if max(indices) < 0:
                return run, {}, indices
            if not self.lock.acquire(blocking=False):
                raise PrefetchDeferred()
            try:
                self.warming_folder, lease = self.prepare_snapshot(run, valid)
            finally:
                self.lock.release()

            # At most one background field in flight. Foreground requests never
            # acquire the prefetch lock or wait for the remainder of a warm-up.
            vectors = {}
            for field in fields:
                if self.lock.locked() or cancelled():
                    raise PrefetchDeferred()
                vectors[field] = self.sample_field(self.warming_folder, run, valid, field, indices)
            return run, vectors, indices
        finally:
            if lease is not None:
                lease.close()
            self.warming_folder = None
            self.prefetch_lock.release()

    def query(self, points, profile, valid=None, prefetch=False, cancelled=lambda: False):
        valid = valid or datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
        locations = [i for i, (lat, lon) in enumerate(points) if 24 <= lat <= 72 and -26 <= lon <= 65]
        samples = [None] * len(points)
        if not locations:
            return {"source": "dwd-icon-eu", "runAt": None, "validAt": None, "samples": samples}
        candidates = [points[i] for i in locations]
        fields = SURFACE + (PROFILE + PROFILE_SURFACE if profile else ())
        if prefetch:
            run, vectors, indices = self.prefetch(valid, fields, candidates, cancelled)
        else:
            run, vectors, indices = self.query_foreground(valid, fields, candidates)
        for row, (i, index) in enumerate(zip(locations, indices)):
            if index < 0:
                continue
            values = {field: column[row] for field, column in vectors.items()}
            samples[i] = model_sample(*points[i], values, profile)
        return {"source": "dwd-icon-eu", "runAt": int(run.timestamp()) * 1000,
                "validAt": int(valid.timestamp()) * 1000, "samples": samples}

    def query_foreground(self, valid, fields, points):
        with self.lock:
            if time.monotonic() < self.retry_after:
                raise ValueError("ICON-EU download cooling down")
            try:
                run = self.choose(valid)
                indices = self.point_indices(run, points)
                if max(indices) < 0:
                    return run, {}, indices
                folder, lease = self.prepare_snapshot(run, valid)
                with lease:
                    futures = {field: self.pool.submit(self.sample_field, folder, run, valid, field, indices)
                               for field in fields}
                    vectors = {}
                    try:
                        for field, future in futures.items():
                            vectors[field] = future.result()
                    finally:
                        # Drain running writes before releasing the cache lease.
                        for future in futures.values():
                            if not future.cancel():
                                future.exception()
            except Exception:
                self.retry_after = time.monotonic() + 60
                self.choice = None
                raise
        return run, vectors, indices


class LocalWeatherServer(ThreadingHTTPServer):
    # The web shell loads many scripts in parallel while ICON files are fetching.
    request_queue_size = 64


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        if self.server.allowed_origins and urlsplit(self.path).path == "/api/dwd-icon-eu":
            self.send_header("Vary", "Origin")
            origin = self.headers.get("Origin")
            if origin in self.server.allowed_origins:
                self.send_header("Access-Control-Allow-Origin", origin)
        super().end_headers()

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path != "/api/dwd-icon-eu":
            if self.server.web_root:
                super().do_GET()
            else:
                self.send_error(404)
            return
        if self.server.icon is None:
            self.reply(503, {"error": "DWD ICON-EU dependencies are missing"})
            return
        try:
            params = parse_qs(url.query, keep_blank_values=True)
            if params.keys() - {"points", "profile", "valid", "prefetch"}:
                self.reply(400, {"error": "Supported parameters: points, profile, valid, prefetch"})
                return
            encoded = params.get("points", [""])[0].split(";")
            if not 1 <= len(encoded) <= 96:
                raise ValueError()
            points = [tuple(map(float, point.split(","))) for point in encoded]
            if any(len(point) != 2 or not all(map(math.isfinite, point)) for point in points):
                raise ValueError()
            valid = None
            if "valid" in params:
                term = int(params["valid"][0])
                current = int(time.time()) // 3600 * 3600
                if term % 3600 or not current - 3 * 3600 <= term <= current + 12 * 3600:
                    self.reply(400, {"error": "Forecast time must be a UTC hour within -3/+12 hours"})
                    return
                valid = datetime.fromtimestamp(term, UTC)
        except ValueError:
            self.reply(400, {"error": "Expected up to 96 latitude,longitude pairs"})
            return
        profile = params.get("profile") == ["1"]
        prefetch = params.get("prefetch") == ["1"]
        if prefetch and (not profile or valid is None):
            self.reply(400, {"error": "Prefetch requires a profile forecast hour"})
            return
        try:
            payload = self.server.icon.query(points, profile, valid, prefetch, self.client_disconnected)
        except PrefetchDeferred:
            self.send_response(204)
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return
        except (OSError, ValueError, ec.CodesInternalError) as exc:
            self.log_error("%s", exc)
            self.reply(503, {"error": "DWD ICON-EU temporarily unavailable"}, retry_after=60)
            return
        self.reply(200, payload)

    def client_disconnected(self):
        try:
            readable, _, _ = select.select([self.connection], [], [], 0)
            return bool(readable) and not self.connection.recv(1, socket.MSG_PEEK)
        except OSError:
            return True

    def send_head(self):
        if not self.server.web_root:
            self.send_error(404)
            return None
        path = unquote(urlsplit(self.path).path)
        if any(part.startswith(".") for part in path.split("/")):
            self.send_error(404)
            return None
        if self.server.icon and path in ("/", "/index.html"):
            page = (self.server.web_root / "index.html").read_bytes()
            bootstrap = (b'<script>window.GA_DWD_WEATHER_URL="/api/dwd-icon-eu";'
                         b'window.GA_DWD_WEATHER_PREFETCH=true;</script>')
            page = page.replace(b"<head>", b"<head>" + bootstrap, 1)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(page)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            return BytesIO(page)
        return super().send_head()

    def reply(self, status, payload, retry_after=None):
        body = json.dumps(payload, allow_nan=False, separators=(",", ":")).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if retry_after:
            self.send_header("Retry-After", str(retry_after))
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", default=54582, type=int)
    parser.add_argument("--bind", default="127.0.0.1")
    parser.add_argument("--web-root", type=Path)
    parser.add_argument("--allow-origin", action="append", default=[], metavar="HTTPS_ORIGIN",
                        help="Browser origin allowed to read the API from a different HTTPS site")
    parser.add_argument("--cache-dir", type=Path, default=Path(tempfile.gettempdir()) / "ga-dwd-icon-eu")
    args = parser.parse_args()
    for origin in args.allow_origin:
        parsed = urlsplit(origin)
        if parsed.scheme != "https" or not parsed.hostname or parsed.username is not None or origin != f"https://{parsed.netloc}":
            parser.error("--allow-origin requires an HTTPS origin without a path, query or fragment")
    if ec is None and args.web_root is None:
        parser.error("DWD ICON-EU requires eccodes and numpy")
    if args.web_root:
        args.web_root = args.web_root.resolve()
        if not (args.web_root / "index.html").is_file():
            parser.error("--web-root must contain index.html")
    handler = partial(Handler, directory=args.web_root)
    with LocalWeatherServer((args.bind, args.port), handler) as server:
        server.web_root = args.web_root
        server.allowed_origins = frozenset(args.allow_origin)
        server.icon = IconEu(args.cache_dir) if ec is not None else None
        stop = threading.Event()
        if server.icon:
            threading.Thread(target=server.icon.clean_while_idle, args=(stop,), daemon=True).start()
            print(f"[GA Dispatcher] DWD ICON-EU aktiv · /api/dwd-icon-eu auf Port {args.port}", flush=True)
        else:
            print("[GA Dispatcher] DWD ICON-EU: Für diese Quelle eccodes und numpy in .venv-dwd installieren.", flush=True)
        try:
            server.serve_forever()
        finally:
            stop.set()


if __name__ == "__main__":
    main()
