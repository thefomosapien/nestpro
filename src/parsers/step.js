/**
 * STEP / IGES parser using occt-import-js v0.0.23 (lazy-loaded from jsDelivr CDN).
 *
 * occt-import-js v0.0.23 returns pre-built typed arrays per mesh:
 *   mesh.attributes.position.array  — Float32Array (xyz per vertex)
 *   mesh.attributes.normal.array    — Float32Array (nxnynz per vertex)
 *   mesh.index.array                — Uint32Array  (triangle indices)
 *   mesh.color                      — { r, g, b } with 0-255 integers
 */

const CDN = 'https://cdn.jsdelivr.net/npm/occt-import-js@0.0.23/dist/';

let _module = null;
let _loading = null;

/**
 * Resolve the callable factory from whatever shape the CDN module exposes.
 * Dynamic import() of a UMD script can produce different wrappers depending
 * on the bundler and CDN — handle the common ones.
 */
function resolveFactory(mod) {
  if (typeof mod === 'function') return mod;
  if (typeof mod?.default === 'function') return mod.default;
  if (typeof mod?.default?.default === 'function') return mod.default.default;
  return null;
}

/**
 * Fallback: inject a classic <script> tag so the UMD global is set.
 */
function loadScript(url) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = url;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(s);
  });
}

export async function loadOcct(onStatus) {
  if (_module) return _module;
  if (_loading) return _loading;

  _loading = (async () => {
    onStatus?.('Loading OpenCASCADE WASM (~5 MB)…');

    // Try dynamic import first (works when the CDN serves a proper ESM wrapper)
    let initFn = null;
    try {
      const mod = await import(/* @vite-ignore */ CDN + 'occt-import-js.js');
      initFn = resolveFactory(mod);
    } catch {
      // Dynamic import failed — fall through to script-tag loader
    }

    // Fallback: load as a classic script so the UMD global is available
    if (!initFn) {
      await loadScript(CDN + 'occt-import-js.js');
      initFn = resolveFactory(window.occtimportjs ?? window.occtImportJs);
    }

    if (!initFn) {
      throw new Error(
        'Failed to load occt-import-js: the module did not export a callable initialiser.',
      );
    }

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

    const positions = mesh.attributes?.position?.array;
    if (!positions || positions.length === 0) continue;

    const normals = mesh.attributes?.normal?.array ?? null;
    const indices = mesh.index?.array ?? null;

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
      stepColor: mesh.color ?? null,
      positionUnit: 'mm',
    });
  }

  if (bodies.length === 0) {
    throw new Error('No valid mesh bodies found in file.');
  }

  return bodies;
}
