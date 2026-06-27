import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const EXPECTED_SOURCE_HASH =
  'c272098089d78c5cd9fd9f24ff50ee8acf8d932c55f2d55fc10adb6c8998966b';

const sourcePath = resolve(process.argv[2] ?? '/tmp/CarConcept.glb');
const outputPath = resolve(process.argv[3] ?? 'public/models/vehicle.glb');

const align4 = (value) => (value + 3) & ~3;

function parseGlb(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.byteLength < 20 ||
    view.getUint32(0, true) !== GLB_MAGIC ||
    view.getUint32(4, true) !== 2 ||
    view.getUint32(8, true) !== bytes.byteLength
  ) {
    throw new Error('Source is not a valid glTF 2.0 binary container.');
  }

  let json;
  let bin;
  for (let offset = 12; offset < bytes.byteLength; ) {
    const length = view.getUint32(offset, true);
    const type = view.getUint32(offset + 4, true);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    if (type === JSON_CHUNK) {
      json = JSON.parse(new TextDecoder().decode(data).replace(/[\0 ]+$/u, ''));
    } else if (type === BIN_CHUNK) {
      bin = Buffer.from(data);
    }
    offset += 8 + length;
  }

  if (!json || !bin) {
    throw new Error('Source GLB must contain JSON and BIN chunks.');
  }
  return { json, bin };
}

function readScalarAccessor(json, bin, accessorIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  const componentBytes = { 5121: 1, 5123: 2, 5125: 4 }[accessor.componentType];
  if (accessor.type !== 'SCALAR' || !componentBytes) {
    throw new Error(
      `Accessor ${accessorIndex} is not a supported index accessor.`,
    );
  }

  const stride = bufferView.byteStride ?? componentBytes;
  const start = (bufferView.byteOffset ?? 0) + (accessor.byteOffset ?? 0);
  const data = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
  return Array.from({ length: accessor.count }, (_, index) => {
    const offset = start + index * stride;
    if (accessor.componentType === 5121) return data.getUint8(offset);
    if (accessor.componentType === 5123) return data.getUint16(offset, true);
    return data.getUint32(offset, true);
  });
}

function readPositionX(json, bin, accessorIndex, vertexIndex) {
  const accessor = json.accessors[accessorIndex];
  const bufferView = json.bufferViews[accessor.bufferView];
  if (accessor.type !== 'VEC3' || accessor.componentType !== 5126) {
    throw new Error('Rear POSITION accessor must be float VEC3.');
  }
  const stride = bufferView.byteStride ?? 12;
  const offset =
    (bufferView.byteOffset ?? 0) +
    (accessor.byteOffset ?? 0) +
    vertexIndex * stride;
  return new DataView(bin.buffer, bin.byteOffset, bin.byteLength).getFloat32(
    offset,
    true,
  );
}

function encodeIndices(indices, componentType) {
  const componentBytes = { 5121: 1, 5123: 2, 5125: 4 }[componentType];
  if (!componentBytes) throw new Error('Unsupported index component type.');
  const output = Buffer.alloc(indices.length * componentBytes);
  indices.forEach((value, index) => {
    const offset = index * componentBytes;
    if (componentType === 5121) output.writeUInt8(value, offset);
    else if (componentType === 5123) output.writeUInt16LE(value, offset);
    else output.writeUInt32LE(value, offset);
  });
  return output;
}

function appendIndexAccessor(json, chunks, originalAccessor, indices, name) {
  const encoded = encodeIndices(indices, originalAccessor.componentType);
  const currentLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const alignedOffset = align4(currentLength);
  if (alignedOffset > currentLength) {
    chunks.push(Buffer.alloc(alignedOffset - currentLength));
  }
  chunks.push(encoded);

  const bufferViewIndex = json.bufferViews.length;
  json.bufferViews.push({
    buffer: 0,
    byteOffset: alignedOffset,
    byteLength: encoded.length,
    target: 34963,
    name: `${name}_indices`,
  });

  const accessorIndex = json.accessors.length;
  json.accessors.push({
    bufferView: bufferViewIndex,
    byteOffset: 0,
    componentType: originalAccessor.componentType,
    count: indices.length,
    min: [Math.min(...indices)],
    max: [Math.max(...indices)],
    type: 'SCALAR',
    name: `${name}_indices`,
  });
  return accessorIndex;
}

function encodeGlb(json, bin) {
  json.buffers[0].byteLength = bin.length;
  const jsonBytes = Buffer.from(JSON.stringify(json));
  const paddedJsonLength = align4(jsonBytes.length);
  const paddedBinLength = align4(bin.length);
  const totalLength = 12 + 8 + paddedJsonLength + 8 + paddedBinLength;
  const output = Buffer.alloc(totalLength);

  output.writeUInt32LE(GLB_MAGIC, 0);
  output.writeUInt32LE(2, 4);
  output.writeUInt32LE(totalLength, 8);
  output.writeUInt32LE(paddedJsonLength, 12);
  output.writeUInt32LE(JSON_CHUNK, 16);
  jsonBytes.copy(output, 20);
  output.fill(0x20, 20 + jsonBytes.length, 20 + paddedJsonLength);

  const binHeader = 20 + paddedJsonLength;
  output.writeUInt32LE(paddedBinLength, binHeader);
  output.writeUInt32LE(BIN_CHUNK, binHeader + 4);
  bin.copy(output, binHeader + 8);
  return output;
}

const source = await readFile(sourcePath);
const sourceHash = createHash('sha256').update(source).digest('hex');
if (sourceHash !== EXPECTED_SOURCE_HASH) {
  throw new Error(
    `Unexpected source hash ${sourceHash}; expected ${EXPECTED_SOURCE_HASH}.`,
  );
}

const { json, bin } = parseGlb(source);
const frontLeftNode = json.nodes[78];
const frontRightNode = json.nodes[57];
const rearNode = json.nodes[37];
const rearParent = json.nodes[34];
if (
  frontLeftNode.name !== 'BodyDoorLWindow' ||
  frontRightNode.name !== 'BodyDoorRWindow' ||
  rearNode.name !== 'BodyWindowsRearSides' ||
  rearNode.mesh !== 35 ||
  !rearParent.children?.includes(37)
) {
  throw new Error(
    'Source model node layout does not match the approved asset.',
  );
}

frontLeftNode.name = 'window_front_left';
frontRightNode.name = 'window_front_right';

const rearMesh = json.meshes[rearNode.mesh];
if (rearMesh.primitives.length !== 1) {
  throw new Error('Expected one rear-window primitive.');
}
const rearPrimitive = rearMesh.primitives[0];
const originalIndexAccessor = json.accessors[rearPrimitive.indices];
const indices = readScalarAccessor(json, bin, rearPrimitive.indices);
if (indices.length % 3 !== 0 || (rearPrimitive.mode ?? 4) !== 4) {
  throw new Error('Rear window must contain indexed triangles.');
}

const leftIndices = [];
const rightIndices = [];
for (let index = 0; index < indices.length; index += 3) {
  const triangle = indices.slice(index, index + 3);
  const x = triangle.map((vertex) =>
    readPositionX(json, bin, rearPrimitive.attributes.POSITION, vertex),
  );
  if (x.every((value) => value > 0)) leftIndices.push(...triangle);
  else if (x.every((value) => value < 0)) rightIndices.push(...triangle);
  else {
    throw new Error(`Rear triangle ${index / 3} crosses the vehicle midline.`);
  }
}
if (leftIndices.length === 0 || rightIndices.length === 0) {
  throw new Error('Rear window split produced an empty side.');
}

const binChunks = [bin];
const leftAccessor = appendIndexAccessor(
  json,
  binChunks,
  originalIndexAccessor,
  leftIndices,
  'window_rear_left',
);
const rightAccessor = appendIndexAccessor(
  json,
  binChunks,
  originalIndexAccessor,
  rightIndices,
  'window_rear_right',
);

rearMesh.name = 'window_rear_left';
rearMesh.primitives = [{ ...rearPrimitive, indices: leftAccessor }];
rearNode.name = 'window_rear_left';

const rightMeshIndex = json.meshes.length;
json.meshes.push({
  ...rearMesh,
  name: 'window_rear_right',
  primitives: [{ ...rearPrimitive, indices: rightAccessor }],
});
const rightNodeIndex = json.nodes.length;
json.nodes.push({
  ...structuredClone(rearNode),
  name: 'window_rear_right',
  mesh: rightMeshIndex,
});
const rearChildPosition = rearParent.children.indexOf(37);
rearParent.children.splice(rearChildPosition + 1, 0, rightNodeIndex);

json.asset.extras = {
  ...(json.asset.extras ?? {}),
  neocabinAdaptation: {
    sourceSha256: EXPECTED_SOURCE_HASH,
    description:
      'Front windows renamed and combined rear-side glass split by local POSITION.x into independently controllable left and right meshes.',
    rearTriangleCounts: {
      left: leftIndices.length / 3,
      right: rightIndices.length / 3,
    },
  },
};

const output = encodeGlb(json, Buffer.concat(binChunks));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, output);

console.log(`Wrote ${outputPath}`);
console.log(`Source SHA-256: ${sourceHash}`);
console.log(
  `Rear triangles: left=${leftIndices.length / 3}, right=${rightIndices.length / 3}`,
);
console.log(`Output bytes: ${output.length}`);
