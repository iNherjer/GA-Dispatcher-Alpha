"""Create the editable Blender source and raw MSFS glTF source for the round hangar.

Run with Blender 4.5+:
  blender --background --python tools/create-round-hangar.py
"""

from pathlib import Path
import json
import math
import shutil
import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parent.parent
ASSET_ROOT = ROOT / "Homebase-Asset-Publisher-Data" / "source" / "SimObjects" / "Misc" / "VFRHomebaseRoundHangar"
MODEL_ROOT = ASSET_ROOT / "model"
ASSET_LIBRARY_ROOT = ROOT / "asset-library" / "VFRHomebaseRoundHangar"
BLEND_ROOT = ASSET_LIBRARY_ROOT / "editable-source"
PREVIEW_ROOT = ASSET_LIBRARY_ROOT / "previews"
LEGACY_BLEND_ROOT = ROOT / "blender-models"
GLTF_PATH = MODEL_ROOT / "HomebaseRoundHangar_LOD00.gltf"
MODEL_XML_PATH = MODEL_ROOT / "HomebaseRoundHangar.xml"
BLEND_PATH = BLEND_ROOT / "HomebaseRoundHangar.blend"
LEGACY_BLEND_PATH = LEGACY_BLEND_ROOT / "HomebaseRoundHangar.blend"
OPEN_PREVIEW = PREVIEW_ROOT / "HomebaseRoundHangar-open.png"
CLOSED_PREVIEW = PREVIEW_ROOT / "HomebaseRoundHangar-closed.png"
COLLISION_ROOT = ROOT / "Homebase-Asset-Publisher-Data" / "source" / "ModelLib" / "VFRHomebaseRoundHangarCollision"
COLLISION_GLTF_PATH = COLLISION_ROOT / "HomebaseRoundHangarCollision_LOD00.gltf"
COLLISION_XML_PATH = COLLISION_ROOT / "HomebaseRoundHangarCollision.xml"
COLLISION_MODEL_GUID = "{B90D5EAB-0F9C-4A2A-9917-F57D81E3A24C}"

RADIUS = 12.0
WALL_HEIGHT = 6.65
DOOR_OPEN_DEGREES = 120.0
DOOR_ANIMATION_FRAMES = 100
DOOR_DURATION_SECONDS = 5.0
GRADE_Z = 0.0
BELOW_GRADE_EXTENSION = 1.5


def configure_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.length_unit = "METERS"
    scene.unit_settings.scale_length = 1.0
    scene.render.engine = "BLENDER_EEVEE_NEXT"
    scene.render.fps = int(DOOR_ANIMATION_FRAMES / DOOR_DURATION_SECONDS)
    scene.frame_start = 0
    scene.frame_end = DOOR_ANIMATION_FRAMES
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 860
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    if scene.world is None:
        scene.world = bpy.data.worlds.new("RoundHangarWorld")
    scene.world.color = (0.035, 0.045, 0.06)
    scene["homebase_asset_key"] = "roundHangar"
    scene["msfs_container_title"] = "VFR Multitool Homebase Round Hangar"
    scene["homebase_units"] = "meters"
    scene["round_hangar_door_control"] = "L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND (0=open, 1=closed)"
    scene["round_hangar_door_duration_ms"] = int(DOOR_DURATION_SECONDS * 1000)
    scene["round_hangar_light_control"] = "L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND (0=on, 1=off)"
    scene["round_hangar_collision_model_guid"] = COLLISION_MODEL_GUID
    scene["round_hangar_has_floor"] = False
    scene["round_hangar_below_grade_extension_m"] = BELOW_GRADE_EXTENSION
    scene["round_hangar_collision_scope"] = "walls-and-columns-only"
    return scene


def collection(name):
    result = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(result)
    return result


def move_to_collection(obj, target):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    target.objects.link(obj)
    return obj


def material(name, color, metallic=0.0, roughness=0.55, emission=None):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    result.diffuse_color = (*color, 1.0)
    node = result.node_tree.nodes.get("Principled BSDF")
    node.inputs["Base Color"].default_value = (*color, 1.0)
    node.inputs["Metallic"].default_value = metallic
    node.inputs["Roughness"].default_value = roughness
    if emission:
        emission_color, strength = emission
        color_input = node.inputs.get("Emission Color") or node.inputs.get("Emission")
        strength_input = node.inputs.get("Emission Strength")
        if color_input:
            color_input.default_value = (*emission_color, 1.0)
        if strength_input:
            strength_input.default_value = strength
    return result


def point(angle, radius, z):
    return (radius * math.sin(angle), -radius * math.cos(angle), z)


def mesh_object(name, vertices, faces, mat, target):
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    target.objects.link(obj)
    return obj


def arc_shell(name, start_deg, end_deg, outer_radius, thickness, bottom, top, segments, corrugations, mat, target):
    vertices = []
    faces = []
    start = math.radians(start_deg)
    end = math.radians(end_deg)
    for index in range(segments + 1):
        fraction = index / segments
        angle = start + (end - start) * fraction
        corrugation = math.sin(fraction * math.tau * corrugations) * 0.055
        outer = outer_radius + corrugation
        inner = outer - thickness
        vertices.extend([
            point(angle, outer, bottom), point(angle, outer, top),
            point(angle, inner, bottom), point(angle, inner, top)
        ])
    for index in range(segments):
        a = index * 4
        b = (index + 1) * 4
        faces.extend([
            (a, b, b + 1, a + 1),
            (a + 2, a + 3, b + 3, b + 2),
            (a + 1, b + 1, b + 3, a + 3),
            (a, a + 2, b + 2, b)
        ])
    return mesh_object(name, vertices, faces, mat, target)


def annular_box(name, start_deg, end_deg, outer_radius, inner_radius, z0, z1, segments, mat, target):
    vertices = []
    faces = []
    start = math.radians(start_deg)
    end = math.radians(end_deg)
    for index in range(segments + 1):
        angle = start + (end - start) * index / segments
        vertices.extend([
            point(angle, outer_radius, z0), point(angle, outer_radius, z1),
            point(angle, inner_radius, z0), point(angle, inner_radius, z1)
        ])
    for index in range(segments):
        a = index * 4
        b = (index + 1) * 4
        faces.extend([(a, b, b + 1, a + 1), (a + 2, a + 3, b + 3, b),
                      (a + 1, b + 1, b + 3, a + 3), (a, a + 2, b + 2, b)])
    return mesh_object(name, vertices, faces, mat, target)


def cube(name, location, scale, mat, target, bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Softened_edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 2
    return move_to_collection(obj, target)


def cylinder(name, radius, depth, location, mat, target, vertices=64):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return move_to_collection(obj, target)


def set_camera(camera, position, look_at):
    camera.location = position
    direction = Vector(look_at) - camera.location
    camera.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


def add_preview_lighting(preview):
    bpy.ops.object.light_add(type='AREA', location=(0, -18, 17))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 1700
    key.data.shape = 'DISK'
    key.data.size = 10
    set_camera(key, key.location, (0, 0, 2.5))
    move_to_collection(key, preview)
    bpy.ops.object.light_add(type='AREA', location=(15, 7, 10))
    fill = bpy.context.object
    fill.name = "Preview_Fill_Light"
    fill.data.energy = 1050
    fill.data.size = 8
    set_camera(fill, fill.location, (0, 0, 3.0))
    move_to_collection(fill, preview)


def build_hangar(asset):
    corrugated = material("Corrugated_Grey", (0.34, 0.37, 0.40), metallic=0.72, roughness=0.44)
    roof = material("Roof_Smooth_Grey", (0.30, 0.33, 0.36), metallic=0.65, roughness=0.38)
    interior = material("Interior_Warm_Grey", (0.19, 0.21, 0.23), metallic=0.25, roughness=0.68)
    rail = material("Door_Rail", (0.10, 0.11, 0.12), metallic=0.86, roughness=0.32)
    # The emissive mesh and the real downward light share the same LVar in model XML.
    light_mat = material("Lights", (1.0, 0.63, 0.20), metallic=0.0, roughness=0.25, emission=((1.0, 0.42, 0.08), 1.0))

    # No artificial floor or apron: the simulator terrain remains fully exposed.
    # Wall, columns and door extend below grade to hide gaps on uneven terrain.
    below_grade = GRADE_Z - BELOW_GRADE_EXTENSION
    wall_top = GRADE_Z + WALL_HEIGHT
    extended_height = wall_top - below_grade
    extended_center = (wall_top + below_grade) / 2
    arc_shell("RoundHangarWall", 60, 300, RADIUS, 0.18, below_grade, wall_top, 144, 34, corrugated, asset)
    annular_box("RoundHangarRoof", 0, 360, 12.34, 0.0, wall_top, wall_top + 0.32, 128, roof, asset)
    annular_box("RoundHangarRoofLip", 0, 360, 12.50, 12.14, wall_top - 0.02, wall_top + 0.45, 128, roof, asset)
    annular_box("RoundHangarDoorRail", -62, 184, 12.48, 12.35, wall_top - 0.24, wall_top - 0.10, 144, rail, asset)

    for degrees in (-60, 60, 120, 180, 240, 300):
        angle = math.radians(degrees)
        x, y, _ = point(angle, 11.85, extended_center)
        post = cube(f"RoundHangarColumn_{degrees}", (x, y, extended_center), (0.16, 0.16, extended_height / 2), rail, asset, 0.025)
        post.rotation_euler[2] = -angle
    for degrees in (105, 150, 210, 255):
        angle = math.radians(degrees)
        x, y, _ = point(angle, 9.8, wall_top - 0.45)
        beam = cube(f"RoundHangarRoofBeam_{degrees}", (x, y, wall_top - 0.45), (2.25, 0.13, 0.13), interior, asset, 0.02)
        beam.rotation_euler[2] = -angle

    door = arc_shell("RoundHangarDoor", -60, 60, 12.34, 0.14, below_grade, wall_top - 0.28, 96, 25, corrugated, asset)
    door.rotation_mode = 'XYZ'
    door["msfs_animation_name"] = "RoundHangarDoor"
    door["homebase_default_state"] = "open"
    door["homebase_control_lvar"] = "L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND"
    door.rotation_euler[2] = math.radians(DOOR_OPEN_DEGREES)
    door.keyframe_insert(data_path='rotation_euler', index=2, frame=0)
    door.rotation_euler[2] = 0.0
    door.keyframe_insert(data_path='rotation_euler', index=2, frame=DOOR_ANIMATION_FRAMES)
    action = door.animation_data.action
    action.name = "RoundHangarDoor"
    for curve in action.fcurves:
        for point_data in curve.keyframe_points:
            point_data.interpolation = 'LINEAR'
    door.rotation_euler[2] = math.radians(DOOR_OPEN_DEGREES)

    # Shallow ceiling fixture: housing stays above the lens and the actual light
    # sits clearly below both meshes, so the model cannot mask its downward beam.
    cylinder("RoundHangarLampHousing", 0.46, 0.10, (0, 1.0, wall_top - 0.18), rail, asset, 48)
    cylinder("RoundHangarLamp", 0.38, 0.055, (0, 1.0, wall_top - 0.27), light_mat, asset, 48)
    bpy.ops.object.light_add(type='AREA', location=(0, 1.0, wall_top - 0.48))
    lamp_light = bpy.context.object
    lamp_light.name = "RoundHangarLampLight"
    lamp_light.data.energy = 4200
    lamp_light.data.color = (1.0, 0.72, 0.48)
    lamp_light.data.shape = 'DISK'
    lamp_light.data.size = 1.7
    # Blender lights emit along local -Z. Keep the default rotation so the
    # fixture emits toward the hangar floor instead of back into the roof.
    lamp_light.rotation_euler[0] = 0.0
    lamp_light["msfs_light_role"] = "hangar_interior"
    lamp_light["msfs_light_type"] = "advancedLight"
    lamp_light["msfs_light_intensity_cd"] = 4200.0
    lamp_light["msfs_light_shape_type"] = "disc"
    lamp_light["msfs_light_source_radius_cm"] = 85.0
    lamp_light["msfs_light_inner_angle_deg"] = 80.0
    lamp_light["msfs_light_outer_angle_deg"] = 140.0
    lamp_light["msfs_channel_exterior"] = True
    lamp_light["msfs_channel_interior"] = True
    lamp_light["homebase_control_lvar"] = "L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND"
    move_to_collection(lamp_light, asset)
    return door


def build_collision(collision):
    wall_material = material("Collision_Wall_Invisible", (0.85, 0.12, 0.05), roughness=1.0)
    below_grade = GRADE_Z - BELOW_GRADE_EXTENSION
    extended_height = WALL_HEIGHT - below_grade
    extended_center = (WALL_HEIGHT + below_grade) / 2
    arc_shell("RoundHangarWallCollider", 60, 300, 12.08, 0.34, below_grade, WALL_HEIGHT, 72, 0, wall_material, collision)
    for degrees in (-60, 60, 120, 180, 240, 300):
        angle = math.radians(degrees)
        x, y, _ = point(angle, 11.85, extended_center)
        post = cube(f"RoundHangarColumnCollider_{degrees}", (x, y, extended_center), (0.20, 0.20, extended_height / 2), wall_material, collision)
        post.rotation_euler[2] = -angle


def render_previews(scene, door, preview):
    bpy.ops.object.camera_add(location=(25, -28, 17))
    camera = bpy.context.object
    camera.name = "Preview_Camera"
    camera.data.lens = 47
    set_camera(camera, camera.location, (0, 0, 3.0))
    move_to_collection(camera, preview)
    scene.camera = camera
    add_preview_lighting(preview)
    scene.frame_set(0)
    scene.render.filepath = str(OPEN_PREVIEW)
    bpy.ops.render.render(write_still=True)
    scene.frame_set(DOOR_ANIMATION_FRAMES)
    scene.render.filepath = str(CLOSED_PREVIEW)
    bpy.ops.render.render(write_still=True)
    scene.frame_set(0)


def export_collection(target, filepath, animations):
    bpy.ops.object.select_all(action='DESELECT')
    for obj in target.objects:
        obj.select_set(True)
    if target.objects:
        bpy.context.view_layer.objects.active = next(iter(target.objects))
    bpy.ops.export_scene.gltf(
        filepath=str(filepath),
        export_format='GLTF_SEPARATE',
        use_selection=True,
        export_apply=True,
        export_animations=animations,
        export_force_sampling=True,
        export_animation_mode='ACTIONS',
        export_nla_strips=False,
        export_lights=False,
        export_cameras=False,
        export_yup=True
    )


def export_asset(asset):
    export_collection(asset, GLTF_PATH, True)
    # Blender's generic KHR_lights_punctual output is rejected by the MSFS
    # Package Tool. Add the equivalent MSFS 2024 Advanced Light extension,
    # using the official exporter field names and a downward-facing disc source.
    document = json.loads(GLTF_PATH.read_text(encoding="utf-8"))
    light_definition = {
        "name": "RoundHangarLampLight",
        "translation": [0.0, WALL_HEIGHT - 0.48, -1.0],
        # Blender local -Z converted to glTF Y-up: downward toward -Y.
        "rotation": [0.7071068, 0.0, 0.0, 0.7071068],
        "extensions": {
            "ASOBO_advanced_light": {
                "color": [1.0, 0.72, 0.48],
                "intensity": 4200.0,
                "shape_type": 3,
                "source_radius": 85.0,
                "inner_cone_angle": 80.0,
                "outer_cone_angle": 140.0,
                "channel_exterior": True,
                "channel_interior": True,
                "flare_enabled": False,
            }
        },
    }
    if "ASOBO_advanced_light" not in document.setdefault("extensionsUsed", []):
        document["extensionsUsed"].append("ASOBO_advanced_light")
    nodes = document.setdefault("nodes", [])
    light_indices = [index for index, node in enumerate(nodes) if node.get("name") == "RoundHangarLampLight"]
    if light_indices:
        nodes[light_indices[0]] = light_definition
        for duplicate in reversed(light_indices[1:]):
            nodes.pop(duplicate)
    else:
        nodes.append(light_definition)
        document["scenes"][document.get("scene", 0)].setdefault("nodes", []).append(len(nodes) - 1)
    GLTF_PATH.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")


def export_collision(collision):
    COLLISION_ROOT.mkdir(parents=True, exist_ok=True)
    export_collection(collision, COLLISION_GLTF_PATH, False)
    document = json.loads(COLLISION_GLTF_PATH.read_text(encoding="utf-8"))
    for entry in document.get("materials", []):
        tags = ["Collision"]
        if entry.get("name") == "Collision_Ground_Invisible":
            tags.append("Ground")
        entry.setdefault("extensions", {})["ASOBO_material_invisible"] = {"enabled": True}
        entry["extensions"]["ASOBO_tags"] = {"tags": tags}
    for extension in ("ASOBO_material_invisible", "ASOBO_tags"):
        if extension not in document.setdefault("extensionsUsed", []):
            document["extensionsUsed"].append(extension)
    COLLISION_GLTF_PATH.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    COLLISION_XML_PATH.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        f'<ModelInfo version="1.1" name="HomebaseRoundHangarCollision" guid="{COLLISION_MODEL_GUID}">\n'
        '  <LODS>\n'
        '    <LOD ModelFile="HomebaseRoundHangarCollision_LOD00.gltf" MinSize="0.0000"/>\n'
        '  </LODS>\n'
        '</ModelInfo>\n',
        encoding="utf-8"
    )


def write_model_xml():
    MODEL_XML_PATH.write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<ModelInfo version="1.1" name="HomebaseRoundHangar" guid="{d75a2a92-0e48-4ea1-8f75-9f036cdd0d39}">\n'
        '  <LODS>\n'
        '    <LOD ModelFile="HomebaseRoundHangar_LOD00.gltf" MinSize="0.0000"/>\n'
        '  </LODS>\n'
        '  <Animation name="RoundHangarDoor" guid="{5f0ac5e6-6f0e-4df1-824e-64b7fd4e6b3f}" type="Standard"/>\n'
        '  <Behaviors>\n'
        '    <Include ModelBehaviorFile="Asobo\\Generic.xml"/>\n'
        '    <Component ID="RoundHangarDoor" Node="RoundHangarDoor">\n'
        '      <UseTemplate Name="ASOBO_GT_Anim_Code">\n'
        '        <ANIM_NAME>RoundHangarDoor</ANIM_NAME>\n'
        '        <ANIM_CODE>(L:VFR_HOMEBASE_ROUND_HANGAR_DOOR_COMMAND, number) 0.5 &gt; if{ 100 } els{ 0 }</ANIM_CODE>\n'
        '        <ANIM_LENGTH>100</ANIM_LENGTH>\n'
        '        <ANIM_LAG>20</ANIM_LAG>\n'
        '      </UseTemplate>\n'
        '    </Component>\n'
        '    <Component ID="RoundHangarLampEmissive" Node="RoundHangarLamp">\n'
        '      <UseTemplate Name="ASOBO_GT_Emissive_Gauge">\n'
        '        <EMISSIVE_CODE>(L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND, number) 0.5 &lt;</EMISSIVE_CODE>\n'
        '      </UseTemplate>\n'
        '    </Component>\n'
        '    <Component ID="RoundHangarLampLight" Node="RoundHangarLampLight">\n'
        '      <UseTemplate Name="ASOBO_GT_Visibility_Code">\n'
        '        <VISIBILITY_CODE>(L:VFR_HOMEBASE_ROUND_HANGAR_LIGHT_COMMAND, number) 0.5 &lt;</VISIBILITY_CODE>\n'
        '      </UseTemplate>\n'
        '    </Component>\n'
        '  </Behaviors>\n'
        '</ModelInfo>\n',
        encoding="utf-8"
    )


def main():
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    BLEND_ROOT.mkdir(parents=True, exist_ok=True)
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    LEGACY_BLEND_ROOT.mkdir(parents=True, exist_ok=True)
    COLLISION_ROOT.mkdir(parents=True, exist_ok=True)
    scene = configure_scene()
    asset = collection("HomebaseRoundHangar")
    collision = collection("HomebaseRoundHangarCollision")
    collision.hide_render = True
    preview = collection("PreviewOnly")
    door = build_hangar(asset)
    build_collision(collision)
    render_previews(scene, door, preview)
    scene.frame_set(0)
    bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH), check_existing=False)
    shutil.copy2(BLEND_PATH, LEGACY_BLEND_PATH)
    shutil.copy2(OPEN_PREVIEW, LEGACY_BLEND_ROOT / OPEN_PREVIEW.name)
    shutil.copy2(CLOSED_PREVIEW, LEGACY_BLEND_ROOT / CLOSED_PREVIEW.name)
    write_model_xml()
    export_asset(asset)
    export_collision(collision)
    print(f"SAVED {BLEND_PATH}")
    print(f"EXPORTED {GLTF_PATH}")
    print(f"EXPORTED {COLLISION_GLTF_PATH}")


if __name__ == '__main__':
    main()
