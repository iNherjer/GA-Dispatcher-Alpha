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
    con.execute(f"SET memory_limit = {sql_quote(memory_limit)};")
    if temp_dir:
        os.makedirs(temp_dir, exist_ok=True)
        try:
            con.execute(f"SET temp_directory = {sql_quote(temp_dir)};")
        except Exception:
            pass


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
DRIVABLE_HIGHWAY = MAJOR_HIGHWAY | {
    "living_street",
    "residential",
    "road",
    "service",
    "unclassified",
}
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
RAIL_STANDALONE_TARGETS = {"station", "halt", "signal_box", "level_crossing", "crossing", "junction", "buffer_stop"}
RAIL_CLUSTER_TARGETS = {"switch", "signal", "level_crossing", "crossing", "junction"}
INDUSTRIAL_MAN_MADE = {
    "water_works",
    "wastewater_plant",
    "works",
    "storage_tank",
    "water_tower",
    "gasometer",
    "silo",
    "chimney",
    "tower",
    "mast",
    "communications_tower",
}
WATER_UTILITY_AMENITIES = {"water_works", "wastewater_plant"}
WASTE_AMENITIES = {"recycling", "waste_disposal", "waste_transfer_station"}
MARINE_AMENITIES = {"ferry_terminal"}
MARINE_LEISURE = {"marina"}
MARINE_MAN_MADE = {"pier", "dock", "quay", "jetty"}
MARINE_WATERWAYS = {"dock", "lock_gate"}
PUBLIC_BUILDING_VALUES = {
    "civic",
    "commercial",
    "hospital",
    "industrial",
    "public",
    "retail",
    "school",
    "train_station",
    "transportation",
    "university",
    "warehouse",
}
PUBLIC_AMENITIES = {
    "bus_station",
    "clinic",
    "college",
    "community_centre",
    "courthouse",
    "fire_station",
    "fuel",
    "hospital",
    "kindergarten",
    "police",
    "post_office",
    "school",
    "townhall",
    "university",
    "water_works",
    "wastewater_plant",
    "waste_transfer_station",
}
INSPECTION_LANDUSE = {"brownfield", "commercial", "construction", "depot", "industrial", "landfill", "quarry", "retail"}
ENERGY_STORAGE_SOURCES = {"battery", "storage"}
ENERGY_PLANT_SOURCES = {"biogas", "biomass", "gas", "geothermal", "oil"}
PIPELINE_UTILITIES = {"gas", "heating", "pipeline"}
WATER_UTILITIES = {"water", "sewerage", "wastewater"}
PIPELINE_SUBSTANCES = {"gas", "hot_water", "oil", "sewage", "steam", "wastewater", "water"}
TRAFFIC_PROTECTION_BARRIERS = {"noise_barrier", "retaining_wall"}
PERIMETER_BARRIERS = {"fence", "gate"}
FLOOD_PROTECTION_MAN_MADE = {"dyke", "embankment"}
LOW_VALUE_SUBSTATIONS = {"minor_distribution", "kiosk", "transformer"}


def has_distinct_name(item):
    name = clean_value(item.get("name"))
    if not name:
        return False
    ref = clean_value(item.get("ref"))
    operator = clean_value(item.get("operator"))
    if operator and name.lower() == operator.lower():
        return False
    if ref and name.lower() == ref.lower():
        return False
    return True


def max_voltage(value):
    nums = [int(x) for x in re.findall(r"\d+", str(value or ""))]
    return max(nums) if nums else 0


def infer_infra_type(item):
    name = clean_value(item.get("name"), lower=True)
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
    leisure = clean_value(item.get("leisure"), lower=True)
    industrial = clean_value(item.get("industrial"), lower=True)
    building = clean_value(item.get("building"), lower=True)
    construction = clean_value(item.get("construction"), lower=True)
    historic = clean_value(item.get("historic"), lower=True)
    content = clean_value(item.get("content"), lower=True)
    location = clean_value(item.get("location"), lower=True)
    utility = clean_value(item.get("utility"), lower=True)
    shop = clean_value(item.get("shop"), lower=True)
    office = clean_value(item.get("office"), lower=True)
    healthcare = clean_value(item.get("healthcare"), lower=True)
    emergency = clean_value(item.get("emergency"), lower=True)
    public_transport = clean_value(item.get("public_transport"), lower=True)
    barrier = clean_value(item.get("barrier"), lower=True)
    tunnel = clean_value(item.get("tunnel"), lower=True)
    pipeline = clean_value(item.get("pipeline"), lower=True)
    substance = clean_value(item.get("substance"), lower=True)
    monitoring = clean_value(item.get("monitoring"), lower=True)
    monitoring_water_level = clean_value(item.get("monitoring_water_level"), lower=True)
    lock_tag = clean_value(item.get("lock_tag"), lower=True)
    embankment = clean_value(item.get("embankment"), lower=True)
    positive_lock = bool(lock_tag and lock_tag not in {"no", "false", "0"})
    roofish = (
        location == "roof" or
        building == "roof" or
        "dach" in name or
        "roof" in name
    )
    if generator_source == "solar" or plant_source == "solar":
        if roofish:
            return "solar_roof"
        return "solar"
    if generator_source == "wind" or plant_source == "wind":
        return "wind"
    if power == "storage" or generator_source in ENERGY_STORAGE_SOURCES or plant_source in ENERGY_STORAGE_SOURCES:
        return "energy_storage"
    if (
        amenity in MARINE_AMENITIES or
        leisure in MARINE_LEISURE or
        man_made in MARINE_MAN_MADE or
        waterway in MARINE_WATERWAYS or
        positive_lock or
        any(token in name for token in ("hafen", "marina", "schleuse", "anleger", "anlegestelle", "kai"))
    ):
        return "marine_infra"
    if barrier in PERIMETER_BARRIERS or any(token in name for token in ("zaun", "wildzaun", "schutzzaun", "perimeter")):
        return "perimeter_security"
    if "hydro" in f"{generator_source} {plant_source}" or "water" in f"{generator_source} {plant_source}" or waterway in {"dam", "weir"}:
        return "hydro"
    if generator_source in ENERGY_PLANT_SOURCES or plant_source in ENERGY_PLANT_SOURCES or power in {"plant", "generator"}:
        return "energy_plant"
    if landuse == "construction" or construction or building == "construction":
        return "construction"
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
    if amenity == "fuel":
        return "fuel"
    if man_made == "pipeline" or pipeline or utility in PIPELINE_UTILITIES or substance in {"gas", "oil", "hot_water", "steam"}:
        return "pipeline"
    if (
        man_made == "pumping_station" or
        amenity in WATER_UTILITY_AMENITIES or
        utility in WATER_UTILITIES or
        waterway == "lock_gate" or
        positive_lock or
        monitoring_water_level or
        ("water_level" in monitoring)
    ):
        return "water_utility"
    if landuse == "landfill" or amenity in WASTE_AMENITIES:
        return "waste"
    if landuse == "quarry":
        return "quarry"
    if man_made in FLOOD_PROTECTION_MAN_MADE or embankment:
        return "flood_protection"
    if barrier in TRAFFIC_PROTECTION_BARRIERS or tunnel:
        return "traffic_protection"
    if man_made == "water_tower" or (
        man_made == "storage_tank" and (
            "water" in content or
            "wasser" in content or
            "water" in name or
            "wasser" in name
        )
    ):
        return "water_tank"
    if man_made == "storage_tank":
        return "storage_tank"
    if man_made in {"tower", "mast", "communications_tower"}:
        return "telecom"
    if (
        building in PUBLIC_BUILDING_VALUES or
        amenity in PUBLIC_AMENITIES or
        healthcare or
        emergency in {"fire_service", "ambulance_station"} or
        office == "government" or
        public_transport in {"station", "platform"}
    ):
        return "public_building"
    if landuse == "industrial" or industrial or man_made in INDUSTRIAL_MAN_MADE or amenity in {"water_works", "wastewater_plant", "waste_transfer_station", "bus_station"} or shop in {"fuel", "car_repair"}:
        return "industrial"
    if landuse in INSPECTION_LANDUSE:
        return "industrial"
    if historic == "railway_station":
        return "rail"
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
        leisure,
        natural,
        water,
        building,
        material,
        construction,
        historic,
        content,
        healthcare,
        office,
        shop,
        public_transport,
        emergency,
        building_use,
        barrier,
        tunnel,
        pipeline,
        substance,
        monitoring,
        monitoring_water_level,
        lock_tag,
        embankment,
        recycling_type,
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
        "leisure": leisure,
        "natural": natural,
        "water": water,
        "building": building,
        "material": material,
        "construction": construction,
        "historic": historic,
        "content": content,
        "healthcare": healthcare,
        "office": office,
        "shop": shop,
        "public_transport": public_transport,
        "emergency": emergency,
        "building_use": building_use,
        "barrier": barrier,
        "tunnel": tunnel,
        "pipeline": pipeline,
        "substance": substance,
        "monitoring": monitoring,
        "monitoring_water_level": monitoring_water_level,
        "lock_tag": lock_tag,
        "embankment": embankment,
        "recycling_type": recycling_type,
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
    man_made = clean_value(item.get("man_made"), lower=True)
    if (not bridge or bridge == "no") and man_made != "bridge":
        return False
    if item.get("power") or item.get("generator_source") or item.get("plant_source"):
        return False
    railway = clean_value(item.get("railway"), lower=True)
    highway = clean_value(item.get("highway"), lower=True)
    if man_made == "bridge" and not railway and not highway:
        return not clean_value(item.get("name"))
    if railway in MAJOR_RAIL:
        return False
    if highway in DRIVABLE_HIGHWAY:
        return False
    return True


def is_solar_roof(item):
    if clean_value(item.get("infra_type"), lower=True) == "solar_roof":
        return True
    if clean_value(item.get("generator_source"), lower=True) != "solar" and clean_value(item.get("plant_source"), lower=True) != "solar":
        return False
    location = clean_value(item.get("location"), lower=True)
    building = clean_value(item.get("building"), lower=True)
    name = clean_value(item.get("name"), lower=True)
    return location == "roof" or building == "roof" or "dach" in name or "roof" in name


def is_prominent_solar_plant(item):
    if clean_value(item.get("infra_type"), lower=True) != "solar":
        return False
    if is_solar_roof(item):
        return False
    name = clean_value(item.get("name"), lower=True)
    power = clean_value(item.get("power"), lower=True)
    plant_source = clean_value(item.get("plant_source"), lower=True)
    sample_count = int(item.get("sample_count") or 0)
    return (
        "solarpark" in name or
        "solar farm" in name or
        power == "plant" or
        plant_source == "solar" or
        sample_count >= 12
    )


def is_low_value_power(item):
    power = clean_value(item.get("power"), lower=True)
    if power == "pole":
        return True
    substation = clean_value(item.get("substation"), lower=True)
    if power == "substation":
        voltage = max_voltage(item.get("voltage"))
        sample_count = int(item.get("sample_count") or 0)
        if substation in LOW_VALUE_SUBSTATIONS and voltage < 30000:
            return True
        if not substation and not has_distinct_name(item) and sample_count < 10 and voltage < 30000:
            return True
        return False
    if power != "transformer":
        return False
    transformer = clean_value(item.get("transformer"), lower=True)
    return not (has_distinct_name(item) or substation or transformer in {"main", "traction", "phase_angle_regulator"})


def is_plain_rail_track(item):
    railway = clean_value(item.get("railway"), lower=True)
    if railway not in MAJOR_RAIL:
        return False
    if clean_value(item.get("bridge"), lower=True) and clean_value(item.get("bridge"), lower=True) != "no":
        return False
    if clean_value(item.get("tunnel"), lower=True):
        return False
    return True


def is_low_value_rail(item):
    railway = clean_value(item.get("railway"), lower=True)
    if not railway:
        return False
    if is_plain_rail_track(item):
        return True
    if railway in {"platform"} and not clean_value(item.get("name")):
        return True
    return False


def is_low_value_infra(item):
    infra_type = clean_value(item.get("infra_type"), lower=True)
    if is_low_value_bridge(item):
        return True
    if is_solar_roof(item):
        return True
    if infra_type == "solar" and not is_prominent_solar_plant(item):
        return False
    if is_low_value_power(item):
        return True
    if is_low_value_rail(item):
        return True
    return False


def dedupe_features(features):
    features = [item for item in features if not is_low_value_infra(item)]
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


CLUSTER_CONFIG = {
    "solar": {"cell_nm": 0.65, "min_count": 3, "label": "Solarpark"},
    "construction": {"cell_nm": 0.40, "min_count": 2, "label": "Baustellenbereich"},
    "energy_plant": {"cell_nm": 0.45, "min_count": 3, "label": "Energieanlage"},
    "energy_storage": {"cell_nm": 0.35, "min_count": 2, "label": "Batterie-/Speicheranlage"},
    "flood_protection": {"cell_nm": 0.45, "min_count": 3, "label": "Schutzbauabschnitt"},
    "industrial": {"cell_nm": 0.45, "min_count": 4, "label": "Industrieareal"},
    "pipeline": {"cell_nm": 0.50, "min_count": 4, "label": "Pipeline-/Leitungsabschnitt"},
    "public_building": {"cell_nm": 0.35, "min_count": 3, "label": "Öffentlicher Gebäudebereich"},
    "power_grid": {"cell_nm": 0.35, "min_count": 8, "label": "Netztrassenabschnitt"},
    "quarry": {"cell_nm": 0.55, "min_count": 3, "label": "Steinbruch-/Kieswerkbereich"},
    "rail": {"cell_nm": 0.28, "min_count": 3, "label": "Bahninfrastruktur-Gruppe"},
    "traffic_protection": {"cell_nm": 0.45, "min_count": 3, "label": "Verkehrsschutzbau"},
    "marine_infra": {"cell_nm": 0.45, "min_count": 2, "label": "Hafen-/Schleusenbereich"},
    "perimeter_security": {"cell_nm": 0.35, "min_count": 4, "label": "Perimeterbereich"},
    "waste": {"cell_nm": 0.45, "min_count": 3, "label": "Entsorgungsanlage"},
    "water_utility": {"cell_nm": 0.45, "min_count": 3, "label": "Wasser-/Abwasseranlage"},
}
FEATURE_TYPE_CAPS = {
    "bridge": 900,
    "rail": 900,
    "power_grid": 650,
    "power_station": 650,
    "traffic_protection": 500,
    "marine_infra": 260,
    "perimeter_security": 420,
    "public_building": 500,
    "industrial": 700,
    "road": 700,
    "telecom": 650,
    "waste": 350,
    "water_utility": 350,
    "storage_tank": 300,
    "fuel": 250,
    "pipeline": 300,
    "construction": 350,
    "solar": 260,
    "wind": 300,
    "hydro": 350,
    "flood_protection": 300,
    "quarry": 220,
    "energy_plant": 220,
    "energy_storage": 160,
    "water_tank": 160,
    "infra": 250,
    "power": 160,
}
CLUSTER_TYPE_CAPS = {
    "rail": 260,
    "solar": 180,
    "power_grid": 160,
    "construction": 130,
    "industrial": 160,
    "traffic_protection": 130,
    "marine_infra": 80,
    "perimeter_security": 120,
    "public_building": 120,
    "pipeline": 110,
    "flood_protection": 100,
    "water_utility": 110,
    "waste": 100,
    "quarry": 80,
    "energy_plant": 80,
    "energy_storage": 50,
    "infra": 80,
}
FEATURE_TOTAL_CAP = 4800
CLUSTER_TOTAL_CAP = 650


def haversine_nm(a_lat, a_lon, b_lat, b_lon):
    r_nm = 3440.065
    lat1 = math.radians(float(a_lat))
    lat2 = math.radians(float(b_lat))
    d_lat = lat2 - lat1
    d_lon = math.radians(float(b_lon) - float(a_lon))
    h = math.sin(d_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(d_lon / 2) ** 2
    return 2 * r_nm * math.asin(min(1, math.sqrt(h)))


def clusterable_type(item):
    infra_type = clean_value(item.get("infra_type"), lower=True)
    railway = clean_value(item.get("railway"), lower=True)
    if infra_type == "rail" and railway not in RAIL_CLUSTER_TARGETS:
        return ""
    if infra_type == "solar" and is_solar_roof(item):
        return ""
    if infra_type in CLUSTER_CONFIG:
        return infra_type
    return ""


def useful_cluster_name(items, label):
    names = []
    for item in items:
        name = clean_value(item.get("name"))
        if not name:
            continue
        if re.fullmatch(r"[A-Z0-9;:_/\- ]{6,}", name, flags=re.IGNORECASE) and sum(ch.isdigit() for ch in name) >= 3:
            continue
        names.append(name)
    if not names:
        return label
    counts = {}
    for name in names:
        key = name.strip()
        counts[key] = counts.get(key, 0) + 1
    best = sorted(counts.items(), key=lambda kv: (-kv[1], len(kv[0]), kv[0]))[0][0]
    if best.lower().startswith(label.lower()):
        return best[:90]
    return f"{label}: {best}"[:90]


def make_cluster_entry(cluster_type, cell_key, items):
    cfg = CLUSTER_CONFIG[cluster_type]
    label = cfg["label"]
    if cluster_type == "rail":
        rail_counts = {}
        for item in items:
            tag = clean_value(item.get("railway"), lower=True)
            if tag:
                rail_counts[tag] = rail_counts.get(tag, 0) + 1
        dominant_rail = sorted(rail_counts.items(), key=lambda kv: (-kv[1], kv[0]))[0][0] if rail_counts else ""
        if dominant_rail == "switch":
            label = "Weichengruppe"
        elif dominant_rail == "signal":
            label = "Signalgruppe"
        elif dominant_rail in {"level_crossing", "crossing"}:
            label = "Bahnuebergangsgruppe"
        elif dominant_rail == "junction":
            label = "Bahnknoten"
    else:
        dominant_rail = ""
    lat = sum(float(item.get("lat", 0)) for item in items) / len(items)
    lon = sum(float(item.get("lon", 0)) for item in items) / len(items)
    radius_nm = max((haversine_nm(lat, lon, item.get("lat", lat), item.get("lon", lon)) for item in items), default=0)
    sample_names = []
    for item in items:
        name = clean_value(item.get("name"))
        if name and name not in sample_names:
            sample_names.append(name)
        if len(sample_names) >= 4:
            break
    entry = {
        "name": useful_cluster_name(items, label),
        "lat": round(lat, 6),
        "lon": round(lon, 6),
        "osm_kind": "cluster",
        "osm_id": f"{cluster_type}:{cell_key[0]}:{cell_key[1]}",
        "infra_type": cluster_type,
        "infra_cluster": True,
        "cluster_type": cluster_type,
        "cluster_count": len(items),
        "cluster_radius_nm": round(radius_nm, 2),
        "cluster_sample_names": " | ".join(sample_names)[:120],
        "sample_count": sum(int(item.get("sample_count") or 1) for item in items),
        "infra_enriched": True,
    }
    operators = sorted({clean_value(item.get("operator")) for item in items if clean_value(item.get("operator"))})
    if operators:
        entry["operator"] = operators[0][:120]
    if cluster_type == "solar":
        entry["generator_source"] = "solar"
    if cluster_type == "power_grid":
        entry["power"] = "line"
    if cluster_type == "rail":
        entry["railway"] = dominant_rail or "rail"
    if cluster_type == "construction":
        entry["landuse"] = "construction"
    if cluster_type == "energy_plant":
        entry["power"] = "plant"
    if cluster_type == "energy_storage":
        entry["power"] = "storage"
    if cluster_type == "pipeline":
        entry["man_made"] = "pipeline"
    if cluster_type == "water_utility":
        entry["utility"] = "water"
    if cluster_type == "waste":
        entry["amenity"] = "waste_transfer_station"
    if cluster_type == "quarry":
        entry["landuse"] = "quarry"
    if cluster_type == "flood_protection":
        entry["man_made"] = "dyke"
    if cluster_type == "traffic_protection":
        entry["barrier"] = "retaining_wall"
    if cluster_type == "marine_infra":
        entry["waterway"] = "dock"
        entry["leisure"] = "marina"
    if cluster_type == "perimeter_security":
        entry["barrier"] = "fence"
    return entry


def feature_priority(item):
    infra_type = clean_value(item.get("infra_type"), lower=True)
    railway = clean_value(item.get("railway"), lower=True)
    highway = clean_value(item.get("highway"), lower=True)
    power = clean_value(item.get("power"), lower=True)
    substation = clean_value(item.get("substation"), lower=True)
    bridge = clean_value(item.get("bridge"), lower=True)
    sample_count = int(item.get("sample_count") or 0)
    voltage = max_voltage(item.get("voltage"))
    score = 0
    if has_distinct_name(item):
        score += 14
    if clean_value(item.get("ref")):
        score += 5
    if clean_value(item.get("operator")):
        score += 2
    if sample_count:
        score += min(8, math.log2(max(1, sample_count)))
    if infra_type == "bridge":
        if highway in MAJOR_HIGHWAY:
            score += 9
        elif highway in DRIVABLE_HIGHWAY:
            score += 5
        if railway in MAJOR_RAIL:
            score += 8
        if bridge in {"viaduct", "aqueduct"}:
            score += 4
    elif infra_type == "rail":
        if railway in {"station", "halt", "signal_box"}:
            score += 10
        elif railway in {"switch", "level_crossing", "crossing", "junction"}:
            score += 7
        elif railway == "signal":
            score += 4
    elif infra_type == "power_station":
        if substation in {"transmission", "subtransmission", "distribution", "traction", "generation"}:
            score += 10
        if voltage >= 110000:
            score += 10
        elif voltage >= 30000:
            score += 6
        if power in {"switchgear", "converter", "compensator"}:
            score += 5
    elif infra_type == "solar":
        if is_prominent_solar_plant(item):
            score += 8
    elif infra_type == "marine_infra":
        if clean_value(item.get("waterway"), lower=True) == "lock_gate":
            score += 8
        elif clean_value(item.get("leisure"), lower=True) == "marina" or clean_value(item.get("amenity"), lower=True) == "ferry_terminal":
            score += 6
        else:
            score += 4
    elif infra_type == "perimeter_security":
        if clean_value(item.get("barrier"), lower=True) == "gate":
            score += 5
        else:
            score += 2
    elif infra_type in {"wind", "hydro", "construction", "pipeline", "water_utility", "waste", "quarry", "fuel"}:
        score += 4
    return score


def cap_by_type(items, caps, total_cap, type_key="infra_type"):
    grouped = {}
    for item in items:
        key = clean_value(item.get(type_key) or item.get("infra_type"), lower=True) or "infra"
        grouped.setdefault(key, []).append(item)
    capped = []
    for key, group in grouped.items():
        limit = int(caps.get(key, caps.get("infra", 250)))
        ranked = sorted(group, key=lambda item: (
            -feature_priority(item),
            clean_value(item.get("name"), lower=True),
            float(item.get("lat", 0)),
            float(item.get("lon", 0)),
        ))
        capped.extend(ranked[:limit])
    capped.sort(key=lambda item: (
        clean_value(item.get("infra_type"), lower=True),
        clean_value(item.get("name"), lower=True),
        float(item.get("lat", 0)),
        float(item.get("lon", 0)),
    ))
    if len(capped) <= total_cap:
        return capped
    return sorted(capped, key=lambda item: -feature_priority(item))[:total_cap]


def compact_infra_features(features):
    by_type = {}
    for idx, item in enumerate(features):
        ctype = clusterable_type(item)
        if not ctype:
            continue
        by_type.setdefault(ctype, []).append((idx, item))

    clustered_indexes = set()
    clusters = []
    for ctype, rows in sorted(by_type.items()):
        cfg = CLUSTER_CONFIG[ctype]
        min_count = int(cfg["min_count"])
        if len(rows) < min_count:
            continue
        rows = sorted(rows, key=lambda row: (
            float(row[1].get("lat", 0)),
            float(row[1].get("lon", 0)),
            clean_value(row[1].get("name"), lower=True),
        ))
        cell_deg = max(0.001, float(cfg["cell_nm"]) / 60.0)
        grid = {}
        row_cells = []
        for pos, (_, item) in enumerate(rows):
            lat = float(item.get("lat", 0))
            lon = float(item.get("lon", 0))
            cell_key = (math.floor(lat / cell_deg), math.floor(lon / cell_deg))
            row_cells.append(cell_key)
            grid.setdefault(cell_key, []).append(pos)

        assigned = set()
        for seed_pos, (_, seed) in enumerate(rows):
            if seed_pos in assigned:
                continue
            seed_lat = float(seed.get("lat", 0))
            seed_lon = float(seed.get("lon", 0))
            base_cell = row_cells[seed_pos]
            candidate_positions = []
            for d_lat in (-1, 0, 1):
                for d_lon in (-1, 0, 1):
                    candidate_positions.extend(grid.get((base_cell[0] + d_lat, base_cell[1] + d_lon), []))
            members = []
            for pos in sorted(set(candidate_positions)):
                if pos in assigned:
                    continue
                _, item = rows[pos]
                if haversine_nm(seed_lat, seed_lon, item.get("lat", seed_lat), item.get("lon", seed_lon)) <= float(cfg["cell_nm"]):
                    members.append(pos)
            if len(members) < min_count:
                continue
            cluster_rows = [rows[pos] for pos in members]
            indexes = [idx for idx, _ in cluster_rows]
            items = [item for _, item in cluster_rows]
            assigned.update(members)
            clustered_indexes.update(indexes)
            cluster_key = (round(seed_lat * 10000), round(seed_lon * 10000))
            clusters.append(make_cluster_entry(ctype, cluster_key, items))

    compacted = []
    for idx, item in enumerate(features):
        if idx in clustered_indexes:
            continue
        infra_type = clean_value(item.get("infra_type"), lower=True)
        if infra_type == "solar" and not is_prominent_solar_plant(item):
            continue
        if infra_type == "perimeter_security" and clean_value(item.get("barrier"), lower=True) == "fence" and not has_distinct_name(item):
            continue
        if is_low_value_infra(item):
            continue
        compacted.append(item)
    compacted.sort(key=lambda item: (
        clean_value(item.get("infra_type"), lower=True),
        clean_value(item.get("name"), lower=True),
        float(item.get("lat", 0)),
        float(item.get("lon", 0)),
    ))
    compacted = cap_by_type(compacted, FEATURE_TYPE_CAPS, FEATURE_TOTAL_CAP)
    clusters = cap_by_type(clusters, CLUSTER_TYPE_CAPS, CLUSTER_TOTAL_CAP, type_key="cluster_type")
    return compacted, clusters


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
        tags['power'] IN ('plant','generator','storage','substation','switchgear','converter','compensator','line','minor_line','cable')
        OR tags['generator:source'] IS NOT NULL
        OR tags['plant:source'] IS NOT NULL
        OR tags['generator:method'] IS NOT NULL
        OR tags['plant:method'] IS NOT NULL
        OR tags['substation'] IS NOT NULL
        OR tags['waterway'] IN ('dam','weir','lock_gate','dock')
        OR tags['lock'] IS NOT NULL
        OR tags['bridge'] IS NOT NULL
        OR tags['railway'] IN ('station','halt','signal_box','switch','signal','level_crossing','crossing','junction','buffer_stop')
        OR tags['landuse'] IN ('brownfield','commercial','construction','depot','industrial','landfill','quarry','retail')
        OR tags['construction'] IS NOT NULL
        OR tags['building'] IN ('civic','commercial','construction','hospital','industrial','public','retail','school','train_station','transportation','university','warehouse','railway')
        OR tags['building:use'] IN ('civic','commercial','education','government','healthcare','industrial','public','retail','transportation')
        OR tags['amenity'] IN ('bus_station','clinic','college','community_centre','courthouse','ferry_terminal','fire_station','fuel','hospital','kindergarten','police','post_office','recycling','school','townhall','university','waste_disposal','water_works','wastewater_plant','waste_transfer_station')
        OR tags['leisure'] IN ('marina')
        OR tags['shop'] IN ('fuel','car_repair')
        OR tags['office'] IN ('government')
        OR tags['healthcare'] IS NOT NULL
        OR tags['emergency'] IN ('fire_service','ambulance_station')
        OR tags['historic'] IN ('railway_station')
        OR tags['barrier'] IN ('gate','noise_barrier','retaining_wall')
        OR (tags['barrier'] = 'fence' AND (tags['name'] IS NOT NULL OR tags['operator'] IS NOT NULL OR tags['access'] IS NOT NULL))
        OR tags['embankment'] IS NOT NULL
        OR tags['tunnel'] IS NOT NULL
        OR tags['pipeline'] IS NOT NULL
        OR tags['utility'] IN ('gas','heating','pipeline','sewerage','wastewater','water')
        OR tags['substance'] IN ('gas','hot_water','oil','sewage','steam','wastewater','water')
        OR tags['monitoring:water_level'] IS NOT NULL
        OR tags['man_made'] IN ('bridge','communications_tower','dock','dyke','embankment','gasometer','jetty','mast','monitoring_station','pier','pipeline','pumping_station','quay','storage_tank','tower','water_tower','water_works','wastewater_plant','works','silo','chimney')
        OR regexp_matches(lower(COALESCE(tags['name'], '')), '(stellwerk|bahnwaerter|bahnw.rter|bahnuebergang|bahn.bergang|haltepunkt|pumpwerk|klaeranlage|kläranlage|wasserwerk|deich|laermschutz|l.rmschutz|hafen|marina|schleuse|anleger|anlegestelle|wildzaun|schutzzaun)')
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
      tags['leisure'] AS leisure,
      tags['natural'] AS natural,
      tags['water'] AS water,
      tags['building'] AS building,
      tags['material'] AS material,
      tags['construction'] AS construction,
      tags['historic'] AS historic,
      tags['content'] AS content,
      tags['healthcare'] AS healthcare,
      tags['office'] AS office,
      tags['shop'] AS shop,
      tags['public_transport'] AS public_transport,
      tags['emergency'] AS emergency,
      tags['building:use'] AS building_use,
      tags['barrier'] AS barrier,
      tags['tunnel'] AS tunnel,
      tags['pipeline'] AS pipeline,
      tags['substance'] AS substance,
      tags['monitoring'] AS monitoring,
      tags['monitoring:water_level'] AS monitoring_water_level,
      tags['lock'] AS lock_tag,
      tags['embankment'] AS embankment,
      tags['recycling_type'] AS recycling_type,
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
      wh.tags['leisure'] AS leisure,
      wh.tags['natural'] AS natural,
      wh.tags['water'] AS water,
      wh.tags['building'] AS building,
      wh.tags['material'] AS material,
      wh.tags['construction'] AS construction,
      wh.tags['historic'] AS historic,
      wh.tags['content'] AS content,
      wh.tags['healthcare'] AS healthcare,
      wh.tags['office'] AS office,
      wh.tags['shop'] AS shop,
      wh.tags['public_transport'] AS public_transport,
      wh.tags['emergency'] AS emergency,
      wh.tags['building:use'] AS building_use,
      wh.tags['barrier'] AS barrier,
      wh.tags['tunnel'] AS tunnel,
      wh.tags['pipeline'] AS pipeline,
      wh.tags['substance'] AS substance,
      wh.tags['monitoring'] AS monitoring,
      wh.tags['monitoring:water_level'] AS monitoring_water_level,
      wh.tags['lock'] AS lock_tag,
      wh.tags['embankment'] AS embankment,
      wh.tags['recycling_type'] AS recycling_type,
      COUNT(*) AS sample_count
    FROM way_hits wh
    JOIN UNNEST(wh.refs) AS r(ref_id) ON TRUE
    JOIN bbox_nodes bn ON bn.id = r.ref_id
    GROUP BY
      1,2,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,
      37,38,39,40,41,42,43,44,45,46,47,48,49
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
        tags['power'] IN ('plant','generator','storage','substation','switchgear','converter','compensator','line','minor_line','cable')
        OR tags['generator:source'] IS NOT NULL
        OR tags['plant:source'] IS NOT NULL
        OR tags['generator:method'] IS NOT NULL
        OR tags['plant:method'] IS NOT NULL
        OR tags['substation'] IS NOT NULL
        OR tags['waterway'] IN ('dam','weir','lock_gate','dock')
        OR tags['lock'] IS NOT NULL
        OR tags['bridge'] IS NOT NULL
        OR tags['railway'] IN ('station','halt','signal_box','switch','signal','level_crossing','crossing','junction','buffer_stop')
        OR tags['landuse'] IN ('brownfield','commercial','construction','depot','industrial','landfill','quarry','retail')
        OR tags['construction'] IS NOT NULL
        OR tags['building'] IN ('civic','commercial','construction','hospital','industrial','public','retail','school','train_station','transportation','university','warehouse','railway')
        OR tags['building:use'] IN ('civic','commercial','education','government','healthcare','industrial','public','retail','transportation')
        OR tags['amenity'] IN ('bus_station','clinic','college','community_centre','courthouse','ferry_terminal','fire_station','fuel','hospital','kindergarten','police','post_office','recycling','school','townhall','university','waste_disposal','water_works','wastewater_plant','waste_transfer_station')
        OR tags['leisure'] IN ('marina')
        OR tags['shop'] IN ('fuel','car_repair')
        OR tags['office'] IN ('government')
        OR tags['healthcare'] IS NOT NULL
        OR tags['emergency'] IN ('fire_service','ambulance_station')
        OR tags['historic'] IN ('railway_station')
        OR tags['barrier'] IN ('gate','noise_barrier','retaining_wall')
        OR (tags['barrier'] = 'fence' AND (tags['name'] IS NOT NULL OR tags['operator'] IS NOT NULL OR tags['access'] IS NOT NULL))
        OR tags['embankment'] IS NOT NULL
        OR tags['tunnel'] IS NOT NULL
        OR tags['pipeline'] IS NOT NULL
        OR tags['utility'] IN ('gas','heating','pipeline','sewerage','wastewater','water')
        OR tags['substance'] IN ('gas','hot_water','oil','sewage','steam','wastewater','water')
        OR tags['monitoring:water_level'] IS NOT NULL
        OR tags['man_made'] IN ('bridge','communications_tower','dock','dyke','embankment','gasometer','jetty','mast','monitoring_station','pier','pipeline','pumping_station','quay','storage_tank','tower','water_tower','water_works','wastewater_plant','works','silo','chimney')
        OR regexp_matches(lower(COALESCE(tags['name'], '')), '(stellwerk|bahnwaerter|bahnw.rter|bahnuebergang|bahn.bergang|haltepunkt|pumpwerk|klaeranlage|kläranlage|wasserwerk|deich|laermschutz|l.rmschutz|hafen|marina|schleuse|anleger|anlegestelle|wildzaun|schutzzaun)')
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
      tags['leisure'] AS leisure,
      tags['natural'] AS natural,
      tags['water'] AS water,
      tags['building'] AS building,
      tags['material'] AS material,
      tags['construction'] AS construction,
      tags['historic'] AS historic,
      tags['content'] AS content,
      tags['healthcare'] AS healthcare,
      tags['office'] AS office,
      tags['shop'] AS shop,
      tags['public_transport'] AS public_transport,
      tags['emergency'] AS emergency,
      tags['building:use'] AS building_use,
      tags['barrier'] AS barrier,
      tags['tunnel'] AS tunnel,
      tags['pipeline'] AS pipeline,
      tags['substance'] AS substance,
      tags['monitoring'] AS monitoring,
      tags['monitoring:water_level'] AS monitoring_water_level,
      tags['lock'] AS lock_tag,
      tags['embankment'] AS embankment,
      tags['recycling_type'] AS recycling_type,
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
      wh.tags['leisure'] AS leisure,
      wh.tags['natural'] AS natural,
      wh.tags['water'] AS water,
      wh.tags['building'] AS building,
      wh.tags['material'] AS material,
      wh.tags['construction'] AS construction,
      wh.tags['historic'] AS historic,
      wh.tags['content'] AS content,
      wh.tags['healthcare'] AS healthcare,
      wh.tags['office'] AS office,
      wh.tags['shop'] AS shop,
      wh.tags['public_transport'] AS public_transport,
      wh.tags['emergency'] AS emergency,
      wh.tags['building:use'] AS building_use,
      wh.tags['barrier'] AS barrier,
      wh.tags['tunnel'] AS tunnel,
      wh.tags['pipeline'] AS pipeline,
      wh.tags['substance'] AS substance,
      wh.tags['monitoring'] AS monitoring,
      wh.tags['monitoring:water_level'] AS monitoring_water_level,
      wh.tags['lock'] AS lock_tag,
      wh.tags['embankment'] AS embankment,
      wh.tags['recycling_type'] AS recycling_type,
      COUNT(*) AS sample_count
    FROM way_hits wh
    JOIN UNNEST(wh.refs) AS r(ref_id) ON TRUE
    JOIN bbox_nodes bn ON bn.id = r.ref_id AND bn.tile = wh.tile
    GROUP BY
      1,2,3,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,
      21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,
      37,38,39,40,41,42,43,44,45,46,47,48,49,50
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
    compact_poi, clusters = compact_infra_features(poi)
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
        "counts": {"poi": len(compact_poi), "rawPoi": len(poi), "clusters": len(clusters)},
        "poi": compact_poi,
        "infra": {
            "poi": compact_poi,
            "clusters": clusters,
        },
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
    configure_duckdb(con)

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
