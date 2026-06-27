# Vehicle Model Attribution

`vehicle.glb` is adapted from **CarConcept**, created by Eric Chadwick of Darmstadt Graphics Group GmbH and distributed in KhronosGroup's glTF Sample Assets collection under the [Creative Commons Attribution 4.0 International license](https://creativecommons.org/licenses/by/4.0/).

- Official model page: <https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept>
- Official raw source: <https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/CarConcept/glTF-Binary/CarConcept.glb>
- Download mirror used: <https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Assets@main/Models/CarConcept/glTF-Binary/CarConcept.glb>
- Original SHA-256: `c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b`
- Adapted `vehicle.glb` SHA-256: `a203a0c3638fd7b2f0a8e5e6a1f905de533922a10352c1bc084a951cada4e567`
- Adapted `vehicle.glb` size: `11,788,024` bytes
- Original copyright metadata remains embedded in the GLB.

## NeoCabin modifications

The reproducible `scripts/adapt-vehicle-model.mjs` process renames the two independent front-window nodes and splits the combined rear-side glass triangles by local `POSITION.x`. This creates four independently transformable meshes named `window_front_left`, `window_front_right`, `window_rear_left`, and `window_rear_right`. Original geometry attributes, PBR Glass material, textures, node transform, and glTF extensions are retained; adaptation metadata is stored in `asset.extras`.

Any product demo or redistribution must retain this attribution and the CC BY 4.0 license notice. The adaptation and NeoCabin demo are not endorsed by Khronos Group, Eric Chadwick, or Darmstadt Graphics Group GmbH. Khronos names and logos remain subject to the [Khronos trademark guidelines](https://www.khronos.org/legal/trademarks/); this license does not grant trademark rights.
