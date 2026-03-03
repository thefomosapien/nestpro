import { computeBBox } from '../utils/three-helpers.js';

/**
 * Parse STL file (ArrayBuffer) → array of body objects.
 * Handles ASCII multi-body and binary single-body STL.
 */
export async function parseSTL(buffer) {
  const bytes = new Uint8Array(buffer);

  // Heuristic: if the header text starts with "solid", attempt ASCII parse
  const headerText = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 256));
  if (headerText.trimStart().toLowerCase().startsWith('solid')) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
    const bodies = parseSTLASCII(text);
    if (bodies.length > 0) return bodies;
  }

  // Binary fallback
  return [parseSTLBinary(buffer)];
}

function parseSTLASCII(text) {
  const bodies = [];
  // Match each solid...endsolid block
  const solidRe = /solid\s*(.*?)\r?\n([\s\S]*?)endsolid(?:\s+\S*)?/g;
  let m;

  while ((m = solidRe.exec(text)) !== null) {
    const name = m[1].trim() || 'Body';
    const block = m[2];
    const positions = [];
    const normals = [];

    // Match each facet
    const facetRe =
      /facet\s+normal\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+outer\s+loop\s+vertex\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+vertex\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+vertex\s+([\S]+)\s+([\S]+)\s+([\S]+)/g;
    let f;
    while ((f = facetRe.exec(block)) !== null) {
      const [, nx, ny, nz, x0, y0, z0, x1, y1, z1, x2, y2, z2] = f.map(Number);
      positions.push(x0, y0, z0, x1, y1, z1, x2, y2, z2);
      normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    }

    if (positions.length > 0) {
      bodies.push(buildBody(name, new Float32Array(positions), new Float32Array(normals), null));
    }
  }

  return bodies;
}

function parseSTLBinary(buffer) {
  const view = new DataView(buffer);
  // Header bytes 0-79; triangle count at byte 80
  const rawHeader = new Uint8Array(buffer, 0, 80);
  const name = new TextDecoder().decode(rawHeader).replace(/\0/g, '').trim() || 'STL Body';
  const triCount = view.getUint32(80, true);

  const positions = new Float32Array(triCount * 9);
  const normals = new Float32Array(triCount * 9);

  let offset = 84;
  for (let i = 0; i < triCount; i++) {
    const nx = view.getFloat32(offset, true);
    const ny = view.getFloat32(offset + 4, true);
    const nz = view.getFloat32(offset + 8, true);
    offset += 12;

    for (let v = 0; v < 3; v++) {
      const base = i * 9 + v * 3;
      positions[base]     = view.getFloat32(offset, true);
      positions[base + 1] = view.getFloat32(offset + 4, true);
      positions[base + 2] = view.getFloat32(offset + 8, true);
      normals[base]     = nx;
      normals[base + 1] = ny;
      normals[base + 2] = nz;
      offset += 12;
    }
    offset += 2; // attribute byte count
  }

  return buildBody(name, positions, normals, null);
}

function buildBody(name, positions, normals, indices) {
  const bb = computeBBox(positions);
  // Sort dims largest-first → w ≥ h ≥ thickness
  const dims = [bb.sizeX, bb.sizeY, bb.sizeZ].sort((a, b) => b - a);

  return {
    name,
    positions,
    normals,
    indices,
    w: dims[0],
    h: dims[1],
    thickness: dims[2],
    bbox: bb,
  };
}
