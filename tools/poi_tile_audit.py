#!/usr/bin/env python3
import argparse
import gzip
import json
import os
import re
from collections import Counter, defaultdict


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
POI_ROOT = os.path.join(ROOT, "obstacles", "poi-tiles")
CORE_ROOT = os.path.join(ROOT, "obstacles", "core-tiles")

CATEGORIES = [
    "bridge",
    "road",
    "dam",
    "telecom",
    "industry",
    "infrastructure",
    "castle",
    "water",
    "mountain",
    "city",
    "rail",
    "fire",
]


def norm(text):
    t = (text or "").lower()
    for a, b in (("ä", "ae"), ("ö", "oe"), ("ü", "ue"), ("ß", "ss")):
        t = t.replace(a, b)
    return t


def has_word(text, token):
    return re.search(r"(^|[^a-z0-9])" + re.escape(token) + r"([^a-z0-9]|$)", text or "") is not None


def classify(title):
    t = norm(title)
    if any(k in t for k in ["bruecke", "brucke", "bridge", "viadukt", "aquadukt", "steg", "pont", "puente"]):
        return "bridge"
    if any(
        k in t
        for k in [
            "autobahn",
            "kreuz",
            "dreieck",
            "kreuzung",
            "strasse",
            "highway",
            "motorway",
            "interstate",
            "freeway",
            "ring",
            "junction",
            "interchange",
            "tunnel",
            "bahn",
            "rail",
            "railway",
            "gleis",
            "bahnhof",
        ]
    ):
        return "road"
    if any(has_word(t, k) for k in ["staudamm", "talsperre", "stausee", "sperrmauer", "reservoir", "damm", "dam", "wehr"]):
        return "dam"
    if any(k in t for k in ["funkturm", "fernsehturm", "sendemast", "funkmast", "mast"]):
        return "telecom"
    if any(k in t for k in ["industrie", "werk", "fabrik", "kraftwerk", "anlage", "mine", "tagebau"]):
        return "industry"
    if any(has_word(t, k) for k in ["burg", "schloss", "ruine", "festung", "kloster", "dom", "monument", "denkmal"]):
        return "castle"
    if any(
        k in t
        for k in [
            "fluss",
            "strom",
            "kanal",
            "see",
            "talsperre",
            "teich",
            "insel",
            "weiher",
            "kueste",
            "hafen",
            "river",
            "lake",
            "bay",
            "fjord",
            "meer",
            "rhein",
            "donau",
            "elbe",
            "isar",
            "neckar",
        ]
    ):
        return "water"
    if any(has_word(t, k) for k in ["berg", "spitze", "horn", "gipfel", "kogel", "wald", "tal", "schlucht", "alpen", "pass"]):
        return "mountain"
    if any(k in t for k in ["stadt", "turm", "park", "stadion", "arena", "zentrum", "city"]):
        return "city"
    return "generic"


def is_settlement_only(feature):
    tags = feature["tags"]
    name = feature.get("name", "").strip()
    place = tags.get("place", "")
    is_place = place in ["city", "town", "village", "suburb", "hamlet", "locality", "neighbourhood", "quarter"]
    if not is_place:
        return False
    has_infra = (
        bool(tags.get("highway"))
        or bool(tags.get("railway"))
        or tags.get("power") in ["line", "minor_line", "cable", "tower", "pole", "substation", "plant", "generator", "transformer"]
        or tags.get("man_made") in ["bridge", "tower", "mast"]
        or tags.get("waterway") in ["dam", "weir"]
        or tags.get("layer") in ["road", "rail", "power", "hydro"]
    )
    if has_infra:
        return False
    return classify(name) == "city"


def feature_matches(feature, category):
    cat = (category or "").lower()
    tags = feature["tags"]
    raw = feature.get("rawType", "")
    name_n = norm(feature.get("name", ""))

    is_water = (
        tags.get("waterway") in ["river", "stream", "canal", "dam", "weir"]
        or tags.get("natural") == "water"
        or tags.get("water") in ["lake", "reservoir", "pond", "basin"]
        or tags.get("landuse") in ["reservoir", "basin"]
        or tags.get("layer") == "hydro"
    )
    dam_name = any(has_word(name_n, k) for k in ["talsperre", "staudamm", "stausee", "sperrmauer", "reservoir"])
    is_dam = (
        tags.get("waterway") in ["dam", "weir"]
        or tags.get("landuse") in ["reservoir", "basin"]
        or tags.get("water") == "reservoir"
        or (dam_name and not tags.get("highway"))
    )
    is_road = bool(tags.get("highway")) or tags.get("layer") == "road" or raw == "highway"
    is_rail = (
        bool(tags.get("railway"))
        or tags.get("layer") == "rail"
        or raw == "railway"
        or any(has_word(name_n, k) for k in ["bahn", "bahnhof", "gleis", "schiene", "rail", "railway"])
    )
    is_transport = is_road or is_rail or tags.get("power") in ["line", "minor_line", "cable"] or tags.get("layer") in ["road", "rail"]
    is_telecom = not (
        tags.get("highway") == "speed_camera"
        or tags.get("amenity") == "speed_camera"
        or tags.get("man_made") == "surveillance"
        or tags.get("railway") in ["signal", "switch", "level_crossing"]
    ) and (
        tags.get("man_made") in ["tower", "mast"]
        or tags.get("power") in ["tower", "pole"]
        or "wind" in tags.get("obstacle_type", "")
        or "mast" in raw
        or "tower" in raw
        or "wind" in raw
        or any(has_word(name_n, k) for k in ["windrad", "windkraft", "windturbine"])
    )
    is_bridge = tags.get("man_made") == "bridge" or any(has_word(name_n, k) for k in ["bruecke", "brucke", "bridge", "viadukt"])
    is_mountain = tags.get("natural") in ["peak", "valley", "cliff", "ridge", "saddle"] or (
        not is_transport and any(has_word(name_n, k) for k in ["berg", "gipfel", "tal", "schlucht"])
    )
    is_castle = (
        tags.get("historic") in ["castle", "ruins", "fort", "monument"]
        or (not is_transport and tags.get("tourism") == "attraction" and (has_word(name_n, "burg") or has_word(name_n, "schloss")))
        or (not is_transport and (has_word(name_n, "burg") or has_word(name_n, "schloss")))
    )
    is_city = tags.get("place") in ["city", "town", "village", "suburb"]
    is_industry = (
        tags.get("landuse") in ["industrial", "quarry", "brownfield", "landfill"]
        or tags.get("power") in ["substation", "plant", "generator", "transformer"]
        or tags.get("man_made") in ["water_works", "wastewater_plant", "works", "storage_tank", "silo", "chimney"]
        or tags.get("amenity") in ["wastewater_plant", "waste_transfer_station", "water_works"]
        or any(has_word(name_n, k) for k in ["umspannwerk", "wasserwerk", "klaerwerk", "klärwerk", "kraftwerk", "heizkraftwerk", "industrie", "werk", "fabrik", "anlage"])
    )
    is_infra = (
        is_road
        or is_rail
        or is_telecom
        or is_industry
        or is_bridge
        or tags.get("power") in ["line", "minor_line", "cable"]
        or any(has_word(name_n, k) for k in ["strom", "hochspannung", "freileitung"])
    )
    is_fire = is_mountain or (not is_transport and (has_word(name_n, "wald") or has_word(name_n, "forst"))) or tags.get("natural") in ["wood", "heath"]

    if cat == "water":
        return is_water
    if cat == "dam":
        return is_dam
    if cat == "road":
        return is_road and not is_settlement_only(feature)
    if cat == "rail":
        return is_rail
    if cat == "telecom":
        return is_telecom
    if cat == "bridge":
        return is_bridge
    if cat == "mountain":
        return is_mountain
    if cat == "castle":
        return is_castle
    if cat == "city":
        return is_city
    if cat == "industry":
        return is_industry
    if cat == "infrastructure":
        return is_infra and not is_settlement_only(feature)
    if cat == "fire":
        return is_fire
    return False


def looks_junction_label(name):
    s = (name or "").strip()
    return bool(s and (" / " in s or re.match(r"^\s*[A-ZÄÖÜ][a-zäöüß.-]+\s*/\s*[A-ZÄÖÜ][a-zäöüß.-]+\s*$", s, re.I)))


def is_numeric_like(name):
    s = (name or "").strip()
    if not s:
        return False
    return re.match(r"^[0-9]+([a-z])?$", re.sub(r"\s+", "", s), re.I) is not None


def is_code_like(name):
    s = (name or "").strip()
    if not s:
        return False
    return bool(
        re.match(r"^[A-Z]?\s*\d{1,5}(?:[\/.-]\d{1,5})?$", s, re.I)
        or re.match(r"^\d{1,4}\s*[A-Z]\d{0,3}$", s, re.I)
        or re.match(r"^[A-Z]{1,3}\s*\d{1,4}$", s, re.I)
    )


def feature_from_node(node, src="tile"):
    try:
        lat = float(node.get("lat"))
        lon = float(node.get("lon"))
    except Exception:
        return None
    return {
        "lat": lat,
        "lon": lon,
        "name": str(node.get("name") or node.get("n") or "").strip(),
        "sourceKind": str(node.get("sourceKind") or src),
        "rawType": str(node.get("type") or "").lower(),
        "tags": {
            "layer": str(node.get("layer") or "").lower(),
            "highway": str(node.get("highway") or "").lower(),
            "waterway": str(node.get("waterway") or "").lower(),
            "water": str(node.get("water") or "").lower(),
            "natural": str(node.get("natural") or "").lower(),
            "landuse": str(node.get("landuse") or "").lower(),
            "power": str(node.get("power") or "").lower(),
            "railway": str(node.get("railway") or "").lower(),
            "man_made": str(node.get("man_made") or "").lower(),
            "tourism": str(node.get("tourism") or "").lower(),
            "historic": str(node.get("historic") or "").lower(),
            "amenity": str(node.get("amenity") or "").lower(),
            "leisure": str(node.get("leisure") or "").lower(),
            "place": str(node.get("place") or "").lower(),
            "obstacle_type": str(node.get("obstacle_type") or node.get("type") or "").lower(),
        },
    }


def parse_payload(payload):
    out = []
    core = payload.get("core") if isinstance(payload.get("core"), dict) else None
    poi_obj = payload.get("poi") if isinstance(payload.get("poi"), dict) and isinstance(payload.get("poi", {}).get("poi"), list) else None
    obs = payload.get("obs") if isinstance(payload.get("obs"), list) else (core.get("obs") if core and isinstance(core.get("obs"), list) else [])
    lin = payload.get("lin") if isinstance(payload.get("lin"), list) else (core.get("lin") if core and isinstance(core.get("lin"), list) else [])
    poi = payload.get("poi") if isinstance(payload.get("poi"), list) else (poi_obj.get("poi") if poi_obj else [])

    for e in obs:
        f = feature_from_node(
            {
                **e,
                "sourceKind": "obs",
                "layer": "obs",
                "man_made": "tower"
                if ("mast" in str(e.get("type", "")).lower() or "tower" in str(e.get("type", "")).lower())
                else "",
                "power": "tower" if "power" in str(e.get("type", "")).lower() else "",
            },
            "obs",
        )
        if f:
            out.append(f)

    for e in lin:
        legacy = str(e.get("type", "")).lower()
        is_road = legacy in ["highway", "motorway", "motorway_link", "trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link", "tertiary", "tertiary_link", "residential", "service"]
        is_hydro = legacy in ["river", "stream", "canal", "ditch", "drain", "water", "lake", "reservoir", "dam", "weir"]
        is_rail = legacy in ["railway", "rail", "tram", "light_rail", "subway"]
        is_power = legacy in ["power", "powerline", "power_line", "line", "minor_line", "cable"]
        layer = str(e.get("layer") or "").lower() or ("road" if is_road else "hydro" if is_hydro else "rail" if is_rail else "power" if is_power else "")
        node = {
            **e,
            "sourceKind": "lin",
            "layer": layer,
            "highway": (str(e.get("highway") or "").lower() or legacy) if is_road else str(e.get("highway") or "").lower(),
            "waterway": (str(e.get("waterway") or "").lower() or (legacy if legacy in ["dam", "weir", "river", "stream", "canal", "ditch", "drain"] else ""))
            if is_hydro
            else str(e.get("waterway") or "").lower(),
            "water": (str(e.get("water") or "").lower() or (legacy if legacy in ["lake", "reservoir"] else "")) if is_hydro else str(e.get("water") or "").lower(),
            "natural": (str(e.get("natural") or "").lower() or ("water" if legacy in ["water", "lake", "reservoir"] else "")) if is_hydro else str(e.get("natural") or "").lower(),
            "power": (str(e.get("power") or "").lower() or ("line" if legacy == "power" else legacy)) if is_power else str(e.get("power") or "").lower(),
            "railway": (str(e.get("railway") or "").lower() or legacy) if is_rail else str(e.get("railway") or "").lower(),
            "man_made": (str(e.get("man_made") or "").lower() or "bridge") if legacy == "bridge" else str(e.get("man_made") or "").lower(),
        }
        f = feature_from_node(node, "lin")
        if f:
            out.append(f)

    for e in poi:
        f = feature_from_node({**e, "sourceKind": "poi", "layer": "poi"}, "poi")
        if f:
            out.append(f)
    return out


def read_json_auto(file_path):
    with open(file_path, "rb") as fh:
        b = fh.read()
    if file_path.endswith(".gz"):
        b = gzip.decompress(b)
    return json.loads(b.decode("utf-8"))


def tile_key_from_path(root, file_path):
    rel = os.path.relpath(file_path, root).replace("\\", "/")
    m = re.match(r"^(\d+)/(\d+)\.json(?:\.gz)?$", rel)
    if not m:
        return None
    return f"{m.group(1)}|{m.group(2)}"


def build_tile_index():
    idx = defaultdict(dict)
    for root, layer in [(POI_ROOT, "poi"), (CORE_ROOT, "core")]:
        for dirpath, _, files in os.walk(root):
            for fn in files:
                if not (fn.endswith(".json") or fn.endswith(".json.gz")):
                    continue
                full = os.path.join(dirpath, fn)
                tk = tile_key_from_path(root, full)
                if not tk:
                    continue
                idx[tk][layer] = full
    return idx


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--presence-only", action="store_true", help="Fast scan: per tile/category presence instead of full feature counts.")
    parser.add_argument("--evidence", type=int, default=80, help="Minimum eligible hits per category before early stop in presence mode.")
    parser.add_argument("--evidence-tiles", type=int, default=12, help="Minimum eligible tiles per category before early stop in presence mode.")
    args = parser.parse_args()

    idx = build_tile_index()
    stats = {
        c: {
            "matched": 0,
            "eligible": 0,
            "namedEligible": 0,
            "tilesMatched": set(),
            "tilesEligible": set(),
            "names": Counter(),
            "sources": Counter(),
        }
        for c in CATEGORIES
    }
    total_features = 0
    presence_only = bool(args.presence_only)

    active_categories = set(CATEGORIES)

    for tile_key, refs in idx.items():
        features = []
        if refs.get("poi"):
            for f in parse_payload(read_json_auto(refs["poi"])):
                f["fetchSource"] = "local-poi-split"
                features.append(f)
        if refs.get("core"):
            for f in parse_payload(read_json_auto(refs["core"])):
                f["fetchSource"] = "local-core-split"
                features.append(f)

        tile_has_match = {c: False for c in active_categories}
        tile_has_eligible = {c: False for c in active_categories}

        for f in features:
            total_features += 1
            tags = f["tags"]
            name = f.get("name", "").strip()
            has_name = bool(name)
            for cat in list(active_categories):
                if presence_only and tile_has_eligible[cat]:
                    continue
                if not feature_matches(f, cat):
                    continue
                st = stats[cat]
                tile_has_match[cat] = True
                if not presence_only:
                    st["matched"] += 1

                eligible = True
                if cat == "dam" and (not has_name) and f.get("sourceKind") == "lin":
                    eligible = False
                if cat == "road":
                    if not has_name:
                        eligible = False
                    if f.get("sourceKind") == "poi" and not tags.get("highway"):
                        eligible = False
                    if tags.get("highway") == "motorway_junction":
                        eligible = False
                    if looks_junction_label(name) or is_code_like(name):
                        eligible = False
                if cat == "infrastructure":
                    if not has_name:
                        eligible = False
                    if tags.get("highway") == "motorway_junction":
                        eligible = False
                    if looks_junction_label(name) or is_code_like(name):
                        eligible = False
                if cat == "rail":
                    rail_tag = tags.get("railway", "")
                    is_rail_op = rail_tag in ["signal", "switch", "level_crossing", "crossing"]
                    if is_rail_op and not has_name:
                        eligible = False
                    if is_numeric_like(name) or is_code_like(name):
                        eligible = False
                if cat == "telecom":
                    if (not has_name) and ("wind" not in tags.get("obstacle_type", "")):
                        eligible = False
                    if is_numeric_like(name) or is_code_like(name):
                        eligible = False
                if not eligible:
                    continue

                tile_has_eligible[cat] = True
                st["eligible"] += 1
                if has_name:
                    st["namedEligible"] += 1
                    if len(st["names"]) < 250:
                        st["names"][name] += 1
                src_key = f"{f.get('fetchSource', 'n/a')}:{f.get('sourceKind', 'n/a')}"
                if len(st["sources"]) < 20 or src_key in st["sources"]:
                    st["sources"][src_key] += 1

        for cat in list(active_categories):
            st = stats[cat]
            if tile_has_match[cat]:
                st["tilesMatched"].add(tile_key)
                if presence_only:
                    st["matched"] += 1
            if tile_has_eligible[cat]:
                st["tilesEligible"].add(tile_key)

        if presence_only:
            for c in list(active_categories):
                if (
                    stats[c]["eligible"] >= max(1, int(args.evidence))
                    and len(stats[c]["tilesEligible"]) >= max(1, int(args.evidence_tiles))
                ):
                    active_categories.discard(c)
            done = all(
                stats[c]["eligible"] >= max(1, int(args.evidence))
                and len(stats[c]["tilesEligible"]) >= max(1, int(args.evidence_tiles))
                for c in CATEGORIES
            )
            if done:
                break

    out = {
        "tileCount": len(idx),
        "totalFeatures": total_features,
        "presenceOnly": presence_only,
        "categories": {},
    }
    for cat in CATEGORIES:
        st = stats[cat]
        out["categories"][cat] = {
            "matched": st["matched"],
            "eligible": st["eligible"],
            "namedEligible": st["namedEligible"],
            "tilesMatched": len(st["tilesMatched"]),
            "tilesEligible": len(st["tilesEligible"]),
            "topSources": st["sources"].most_common(6),
            "sampleNames": st["names"].most_common(12),
        }

    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
