# Headless Blender: convert Verde Vision USDZ scans to geometry-only GLBs
# for the website's ghost-glass 3D showcase. Strips materials/textures
# (the web shader supplies the look), recenters to bottom-center origin,
# and normalizes height to 1.0 so the viewer needs no per-model tuning.
#
# Run: /Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/usdz_to_glb.py
import bpy
import os
import sys

RK = "/Users/gavinbush/Verde-Vision/Test/Packages/RealityKitContent/Sources/RealityKitContent/RealityKitContent.rkassets"
OUT = "/Users/gavinbush/Verde-Vision-Website/assets/models"
MODELS = [
    ("AgaveAmericana.usdz", "agave-americana.glb"),
    ("TotemPole.usdz", "totem-pole.glb"),
    ("GoldenBarrel.usdz", "golden-barrel.glb"),
    ("SaguaroSpear.usdz", "saguaro-spear.glb"),
    ("AgaveTruncata.usdz", "agave-truncata.glb"),
    ("Firebarrel.usdz", "fire-barrel.glb"),
    ("MexicanFencePost.usdz", "mexican-fence-post.glb"),
    ("ArgentineToothpick.usdz", "argentine-toothpick.glb"),
]

os.makedirs(OUT, exist_ok=True)

# Keep web payloads light: decimate anything above this triangle budget.
TRI_BUDGET = 16000


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for datum in list(block):
            if datum.users == 0:
                block.remove(datum)


def convert(src, dst):
    clear_scene()
    bpy.ops.wm.usd_import(filepath=src)

    meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
    if not meshes:
        print(f"!! no mesh in {src}", file=sys.stderr)
        return False

    bpy.ops.object.select_all(action="DESELECT")
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    # USD import hangs the y-up→z-up correction on a parent Xform;
    # transform_apply only bakes the LOCAL matrix, so always unparent
    # (keeping world transform) first or the export comes out tipped 90°.
    bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM")
    if len(meshes) > 1:
        bpy.ops.object.join()
    obj = bpy.context.view_layer.objects.active
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    obj.data.materials.clear()

    tris = sum(len(p.vertices) - 2 for p in obj.data.polygons)
    if tris > TRI_BUDGET:
        mod = obj.modifiers.new("dec", "DECIMATE")
        mod.ratio = TRI_BUDGET / tris
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier="dec")

    # Recenter: origin at bottom-center, normalize height to 1.0.
    xs = [v.co.x for v in obj.data.vertices]
    ys = [v.co.y for v in obj.data.vertices]
    zs = [v.co.z for v in obj.data.vertices]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    z0, z1 = min(zs), max(zs)
    h = max(z1 - z0, 1e-6)
    for v in obj.data.vertices:
        v.co.x = (v.co.x - cx) / h
        v.co.y = (v.co.y - cy) / h
        v.co.z = (v.co.z - z0) / h

    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=dst,
        use_selection=True,
        export_format="GLB",
        export_materials="NONE",
        export_normals=True,
        export_texcoords=False,
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_skins=False,
        export_morph=False,
    )
    print(f"OK {os.path.basename(src)} -> {os.path.basename(dst)} ({tris} tris in)")
    return True


ok = True
for src_name, dst_name in MODELS:
    src = os.path.join(RK, src_name)
    if not os.path.exists(src):
        print(f"!! missing {src}", file=sys.stderr)
        ok = False
        continue
    try:
        ok = convert(src, os.path.join(OUT, dst_name)) and ok
    except Exception as e:  # keep going; report at end
        print(f"!! failed {src_name}: {e}", file=sys.stderr)
        ok = False

sys.exit(0 if ok else 1)
