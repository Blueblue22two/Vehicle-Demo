import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Box3, Matrix4, Quaternion, Vector3 } from 'three';

const MODEL_PATH = new URL('../public/models/vehicle.glb', import.meta.url);
const MAX_BYTES = 15 * 1024 * 1024;
const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const WINDOW_NODES = [
  'window_front_left',
  'window_front_right',
  'window_rear_left',
  'window_rear_right',
];
const COMPONENT_BYTES = {
  5120: 1,
  5121: 1,
  5122: 2,
  5123: 2,
  5125: 4,
  5126: 4,
};
const TYPE_COMPONENTS = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
  MAT2: 4,
  MAT3: 9,
  MAT4: 16,
};

const invariant = (condition, message) => {
  if (!condition) throw new Error(message);
};

function parseGlb(bytes) {
  invariant(
    bytes.length < MAX_BYTES,
    `Model must be smaller than ${MAX_BYTES} bytes.`,
  );
  invariant(bytes.length >= 20, 'GLB is too short.');
  const data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  invariant(data.getUint32(0, true) === GLB_MAGIC, 'Invalid GLB magic.');
  invariant(data.getUint32(4, true) === 2, 'GLB version must be 2.');
  invariant(
    data.getUint32(8, true) === bytes.length,
    'GLB declared length does not match file size.',
  );

  const chunks = [];
  for (let offset = 12; offset < bytes.length; ) {
    invariant(offset + 8 <= bytes.length, 'Truncated GLB chunk header.');
    const length = data.getUint32(offset, true);
    const type = data.getUint32(offset + 4, true);
    invariant(length % 4 === 0, 'GLB chunk is not 4-byte aligned.');
    invariant(
      offset + 8 + length <= bytes.length,
      'GLB chunk exceeds file bounds.',
    );
    chunks.push({
      type,
      data: bytes.subarray(offset + 8, offset + 8 + length),
    });
    offset += 8 + length;
    invariant(
      offset <= bytes.length,
      'GLB chunk traversal exceeded file bounds.',
    );
  }

  invariant(
    chunks.length === 2,
    'GLB must contain exactly JSON and BIN chunks.',
  );
  invariant(chunks[0].type === JSON_CHUNK, 'The first GLB chunk must be JSON.');
  invariant(chunks[1].type === BIN_CHUNK, 'The second GLB chunk must be BIN.');
  const json = JSON.parse(
    new TextDecoder().decode(chunks[0].data).replace(/[\0 ]+$/u, ''),
  );
  return { json, bin: chunks[1].data };
}

function validateStorage(json, bin) {
  invariant(json.asset?.version === '2.0', 'glTF asset version must be 2.0.');
  invariant(
    json.asset?.extras?.neocabinAdaptation?.sourceSha256 ===
      'c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b',
    'NeoCabin source provenance metadata is missing.',
  );
  invariant(
    json.buffers?.length === 1,
    'Exactly one embedded buffer is required.',
  );
  invariant(
    json.buffers[0].byteLength <= bin.length &&
      bin.length - json.buffers[0].byteLength <= 3,
    'BIN chunk length does not match buffer byteLength.',
  );

  json.bufferViews.forEach((bufferView, index) => {
    invariant(
      bufferView.buffer === 0,
      `bufferView ${index} must use buffer 0.`,
    );
    const start = bufferView.byteOffset ?? 0;
    invariant(
      start >= 0 &&
        bufferView.byteLength >= 0 &&
        start + bufferView.byteLength <= json.buffers[0].byteLength,
      `bufferView ${index} exceeds buffer bounds.`,
    );
  });

  json.accessors.forEach((accessor, index) => {
    const componentBytes = COMPONENT_BYTES[accessor.componentType];
    const componentCount = TYPE_COMPONENTS[accessor.type];
    invariant(
      componentBytes && componentCount,
      `Accessor ${index} has an invalid type.`,
    );
    invariant(
      Number.isInteger(accessor.count) && accessor.count >= 0,
      `Accessor ${index} has an invalid count.`,
    );
    invariant(
      Number.isInteger(accessor.bufferView),
      `Accessor ${index} needs a bufferView.`,
    );
    const bufferView = json.bufferViews[accessor.bufferView];
    invariant(bufferView, `Accessor ${index} references a missing bufferView.`);
    const elementBytes = componentBytes * componentCount;
    const stride = bufferView.byteStride ?? elementBytes;
    invariant(
      stride >= elementBytes,
      `Accessor ${index} has an invalid stride.`,
    );
    const localStart = accessor.byteOffset ?? 0;
    const localEnd =
      accessor.count === 0
        ? localStart
        : localStart + stride * (accessor.count - 1) + elementBytes;
    invariant(
      localStart >= 0 && localEnd <= bufferView.byteLength,
      `Accessor ${index} exceeds its bufferView.`,
    );
  });
}

function validateMeshReferences(json) {
  json.meshes.forEach((mesh, meshIndex) => {
    invariant(
      Array.isArray(mesh.primitives) && mesh.primitives.length > 0,
      `Mesh ${meshIndex} has no primitives.`,
    );
    mesh.primitives.forEach((primitive, primitiveIndex) => {
      const label = `Mesh ${meshIndex} primitive ${primitiveIndex}`;
      invariant(
        primitive.attributes && Object.keys(primitive.attributes).length > 0,
        `${label} has no attributes.`,
      );
      Object.values(primitive.attributes).forEach((accessorIndex) =>
        invariant(
          Number.isInteger(accessorIndex) && json.accessors[accessorIndex],
          `${label} references a missing attribute accessor.`,
        ),
      );
      if (primitive.indices !== undefined) {
        invariant(
          Number.isInteger(primitive.indices) &&
            json.accessors[primitive.indices],
          `${label} references a missing index accessor.`,
        );
      }
      if (primitive.material !== undefined) {
        invariant(
          Number.isInteger(primitive.material) &&
            json.materials[primitive.material],
          `${label} references a missing material.`,
        );
      }
    });
  });
}

function readComponent(data, offset, componentType) {
  if (componentType === 5120) return data.getInt8(offset);
  if (componentType === 5121) return data.getUint8(offset);
  if (componentType === 5122) return data.getInt16(offset, true);
  if (componentType === 5123) return data.getUint16(offset, true);
  if (componentType === 5125) return data.getUint32(offset, true);
  return data.getFloat32(offset, true);
}

function readAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const componentBytes = COMPONENT_BYTES[accessor.componentType];
  const componentCount = TYPE_COMPONENTS[accessor.type];
  const elementBytes = componentBytes * componentCount;
  const stride = bufferView.byteStride ?? elementBytes;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  return Array.from({ length: accessor.count }, (_, elementIndex) =>
    Array.from({ length: componentCount }, (_, componentIndex) =>
      readComponent(
        data,
        start + elementIndex * stride + componentIndex * componentBytes,
        accessor.componentType,
      ),
    ),
  );
}

function validatePrimitive(json, bin, primitive, label) {
  invariant((primitive.mode ?? 4) === 4, `${label} must use triangle mode.`);
  invariant(
    Number.isInteger(primitive.attributes?.POSITION),
    `${label} needs POSITION.`,
  );
  invariant(Number.isInteger(primitive.indices), `${label} must be indexed.`);
  const positionAccessor = json.accessors[primitive.attributes.POSITION];
  const indexAccessor = json.accessors[primitive.indices];
  invariant(
    positionAccessor?.type === 'VEC3',
    `${label} POSITION must be VEC3.`,
  );
  invariant(
    indexAccessor?.type === 'SCALAR',
    `${label} indices must be SCALAR.`,
  );
  invariant(
    indexAccessor.count % 3 === 0,
    `${label} index count must form triangles.`,
  );

  const positions = readAccessor(json, bin, primitive.attributes.POSITION);
  const indices = readAccessor(json, bin, primitive.indices).map(
    ([value]) => value,
  );
  invariant(
    positions.length > 0 && positions.flat().every(Number.isFinite),
    `${label} POSITION contains invalid values.`,
  );
  const localBox = new Box3();
  positions.forEach(([x, y, z]) =>
    localBox.expandByPoint(new Vector3(x, y, z)),
  );
  const size = localBox.getSize(new Vector3());
  invariant(size.lengthSq() > 0, `${label} POSITION bounds are empty.`);
  invariant(
    indices.every(
      (index) =>
        Number.isInteger(index) && index >= 0 && index < positions.length,
    ),
    `${label} contains an out-of-range index.`,
  );
  return { positions, indices, localBox, triangles: indices.length / 3 };
}

function nodeMatrix(node) {
  if (node.matrix) return new Matrix4().fromArray(node.matrix);
  return new Matrix4().compose(
    new Vector3().fromArray(node.translation ?? [0, 0, 0]),
    new Quaternion().fromArray(node.rotation ?? [0, 0, 0, 1]),
    new Vector3().fromArray(node.scale ?? [1, 1, 1]),
  );
}

function expandWithTransformedBox(target, source, matrix) {
  for (const x of [source.min.x, source.max.x]) {
    for (const y of [source.min.y, source.max.y]) {
      for (const z of [source.min.z, source.max.z]) {
        target.expandByPoint(new Vector3(x, y, z).applyMatrix4(matrix));
      }
    }
  }
}

function calculateModelBounds(json, bin) {
  const box = new Box3();
  const roots = new Set(json.scenes.flatMap((scene) => scene.nodes ?? []));

  const visit = (nodeIndex, parentMatrix, ancestry) => {
    invariant(!ancestry.has(nodeIndex), `Node cycle detected at ${nodeIndex}.`);
    const node = json.nodes[nodeIndex];
    invariant(node, `Missing node ${nodeIndex}.`);
    const world = new Matrix4().multiplyMatrices(
      parentMatrix,
      nodeMatrix(node),
    );
    if (Number.isInteger(node.mesh)) {
      const mesh = json.meshes[node.mesh];
      invariant(mesh, `Node ${nodeIndex} references a missing mesh.`);
      for (const primitive of mesh.primitives) {
        const accessor = json.accessors[primitive.attributes?.POSITION];
        if (accessor?.min?.length === 3 && accessor?.max?.length === 3) {
          invariant(
            [...accessor.min, ...accessor.max].every(Number.isFinite),
            `Mesh ${node.mesh} has non-finite POSITION bounds.`,
          );
          expandWithTransformedBox(
            box,
            new Box3(
              new Vector3().fromArray(accessor.min),
              new Vector3().fromArray(accessor.max),
            ),
            world,
          );
        } else {
          const { localBox } = validatePrimitive(
            json,
            bin,
            primitive,
            `mesh ${node.mesh}`,
          );
          expandWithTransformedBox(box, localBox, world);
        }
      }
    }
    const nextAncestry = new Set(ancestry).add(nodeIndex);
    for (const child of node.children ?? []) visit(child, world, nextAncestry);
  };

  for (const root of roots) visit(root, new Matrix4(), new Set());
  const size = box.getSize(new Vector3());
  invariant(
    !box.isEmpty() && [...box.min, ...box.max, ...size].every(Number.isFinite),
    'Overall model bounds are invalid.',
  );
  invariant(
    size.x > 0 && size.y > 0 && size.z > 0,
    'Overall model has zero volume.',
  );
  return { box, size };
}

function validateWindows(json, bin) {
  const summaries = [];
  const meshIndices = new Set();
  for (const name of WINDOW_NODES) {
    const matches = json.nodes
      .map((node, index) => ({ node, index }))
      .filter(({ node }) => node.name === name);
    invariant(matches.length === 1, `Expected exactly one node named ${name}.`);
    const { node, index } = matches[0];
    invariant(Number.isInteger(node.mesh), `${name} must reference a mesh.`);
    invariant(
      !meshIndices.has(node.mesh),
      `${name} must have an independent mesh.`,
    );
    meshIndices.add(node.mesh);
    const mesh = json.meshes[node.mesh];
    invariant(
      mesh?.primitives?.length === 1,
      `${name} must have one primitive.`,
    );
    const primitive = mesh.primitives[0];
    const material = json.materials[primitive.material];
    const hasTransmission =
      material?.extensions?.KHR_materials_transmission?.transmissionFactor > 0;
    const hasExplicitTransparency =
      material?.alphaMode === 'BLEND' ||
      (material?.pbrMetallicRoughness?.baseColorFactor?.[3] ?? 1) < 1;
    invariant(
      material?.name === 'Glass' &&
        (hasTransmission || hasExplicitTransparency),
      `${name} must retain an explicitly transparent Glass material.`,
    );
    const summary = validatePrimitive(json, bin, primitive, name);

    if (name === 'window_rear_left' || name === 'window_rear_right') {
      const expectedSign = name.endsWith('left') ? 1 : -1;
      for (let offset = 0; offset < summary.indices.length; offset += 3) {
        const triangle = summary.indices.slice(offset, offset + 3);
        invariant(
          triangle.every(
            (vertexIndex) =>
              Math.sign(summary.positions[vertexIndex][0]) === expectedSign,
          ),
          `${name} triangle ${offset / 3} crosses or occupies the wrong side of the midline.`,
        );
      }
    }

    summaries.push({ name, node: index, mesh: node.mesh, ...summary });
  }
  return summaries;
}

try {
  const bytes = await readFile(MODEL_PATH);
  const { json, bin } = parseGlb(bytes);
  validateStorage(json, bin);
  validateMeshReferences(json);
  const windows = validateWindows(json, bin);
  const { box, size } = calculateModelBounds(json, bin);
  const hash = createHash('sha256').update(bytes).digest('hex');

  console.log(`Vehicle model valid: ${bytes.length} bytes, SHA-256 ${hash}`);
  windows.forEach(({ name, node, mesh, triangles }) =>
    console.log(`${name}: node=${node}, mesh=${mesh}, triangles=${triangles}`),
  );
  console.log(
    `Bounds min=${box.min
      .toArray()
      .map((value) => value.toFixed(4))
      .join(',')} ` +
      `max=${box.max
        .toArray()
        .map((value) => value.toFixed(4))
        .join(',')} ` +
      `size=${size
        .toArray()
        .map((value) => value.toFixed(4))
        .join(',')} ` +
      `volume=${(size.x * size.y * size.z).toFixed(4)}`,
  );
} catch (error) {
  console.error(
    `Model validation failed: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 1;
}
