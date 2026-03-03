/**
 * STEP / IGES parser using occt-import-js v0.0.23 (lazy-loaded from jsDelivr CDN).
 *
 * occt-import-js returns indexed meshes per body:
 *   mesh.index.position_count  — number of vertices
 *   mesh.index.index_count     — number of indices
 *   mesh.index.CopyPositionAttributes(Float32Array) — fills xyz per vertex
 *   mesh.index.CopyNormalAttributes(Float32Array)   — fills nxnynz per vertex
 *   mesh.index.CopyIndexAttributes(Uint32Array)     — fills triangle indices
 */

const CDN = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/';

let _module = null;
let _loading = null;

export async function loadOcct(onStatus) {
  if (_module) return _module;
  if (_loading) return _loading;

  _loading = (async () => {
    onStatus?.('Loading OpenCASCADE WASM (~5 MB)…');

    // Dynamic import from CDN — @vite-ignore prevents Vite bundling it
    const mod = await import(/* @vite-ignore */ CDN + 'occt-import-js.js');
    const initFn = mod.default ?? mod;

    onStatus?.('Initialising WASM module…');
    const oc = await initFn({
      locateFile: (path) => CDN + path,
    });

    _module = oc;
    onStatus?.('WASM ready');
    return oc;
  })().catch(err => {
    _loading = null; // allow retry
    throw err;
  });

  return _loading;
}

/**
 * Parse a STEP or IGES file from an ArrayBuffer.
 * Returns array of body objects (dimensions in inches, geometry in mm).
 */
export async function parseSTEP(buffer, isIGES = false, onStatus) {
  const oc = await loadOcct(onStatus);

  onStatus?.(`Parsing ${isIGES ? 'IGES' : 'STEP'} geometry…`);

  const data = new Uint8Array(buffer);
  const result = isIGES
    ? oc.ReadIgesFile(data, null)
    : oc.ReadStepFile(data, null);

  if (!result?.success) {
    throw new Error(`Failed to parse ${isIGES ? 'IGES' : 'STEP'} — file may be corrupt or unsupported.`);
  }

  const bodies = [];
  const MM_TO_IN = 1 / 25.4;

  for (let mi = 0; mi < result.meshes.length; mi++) {
    const mesh = result.meshes[mi];
    const idx = mesh.index;
    if (!idx || idx.position_count === 0) continue;

    const positions = new Float32Array(idx.position_count * 3);
    const normals   = new Float32Array(idx.position_count * 3);
    const indices   = new Uint32Array(idx.index_count);

    idx.CopyPositionAttributes(positions);
    idx.CopyNormalAttributes(normals);
    idx.CopyIndexAttributes(indices);

    // Compute bounding box (in mm)
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i], y = positions[i + 1], z = positions[i + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    // Convert to inches for the nesting engine
    const dims = [
      (maxX - minX) * MM_TO_IN,
      (maxY - minY) * MM_TO_IN,
      (maxZ - minZ) * MM_TO_IN,
    ].sort((a, b) => b - a);

    const bbox = {
      minX, maxX, minY, maxY, minZ, maxZ,
      cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, cz: (minZ + maxZ) / 2,
      sizeX: maxX - minX, sizeY: maxY - minY, sizeZ: maxZ - minZ,
    };

    bodies.push({
      name: mesh.name?.trim() || `Body ${mi + 1}`,
      positions,
      normals,
      indices,
      w: dims[0],
      h: dims[1],
      thickness: dims[2],
      bbox,
      // flag so Viewport3D knows to scale positions (mm → display)
      positionUnit: 'mm',
    });
  }

  if (bodies.length === 0) {
    throw new Error('No valid mesh bodies found in file.');
  }

  return bodies;
}
