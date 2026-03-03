import { computeBBox } from '../utils/three-helpers.js';

/**
 * Parse OBJ text → array of body objects.
 * Supports multiple objects/groups (o/g commands).
 */
export async function parseOBJ(text) {
  const lines = text.split(/\r?\n/);

  const verts  = [];  // flat: x,y,z,...
  const vnorms = [];  // flat: nx,ny,nz,...
  const objects = [];
  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const parts = line.split(/\s+/);
    const cmd = parts[0];

    if (cmd === 'v') {
      verts.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (cmd === 'vn') {
      vnorms.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
    } else if (cmd === 'o' || cmd === 'g') {
      if (cur && cur.faces.length > 0) objects.push(cur);
      cur = { name: parts.slice(1).join(' ') || 'Object', faces: [] };
    } else if (cmd === 'f') {
      if (!cur) cur = { name: 'Object', faces: [] };
      // Each token: v, v/vt, v/vt/vn, v//vn
      const fv = parts.slice(1).map(tok => {
        const [vi, , vni] = tok.split('/');
        return {
          vi: (parseInt(vi) - 1),
          vni: vni ? parseInt(vni) - 1 : -1,
        };
      });
      // Fan triangulation
      for (let i = 1; i < fv.length - 1; i++) {
        cur.faces.push([fv[0], fv[i], fv[i + 1]]);
      }
    }
  }

  if (cur && cur.faces.length > 0) objects.push(cur);

  // If no named groups, treat all as one body
  if (objects.length === 0) return [];

  return objects.map(obj => buildOBJBody(obj, verts, vnorms));
}

function buildOBJBody(obj, verts, vnorms) {
  const positions = [];
  const normals = [];
  const hasNormals = vnorms.length > 0;

  for (const [v0, v1, v2] of obj.faces) {
    for (const { vi, vni } of [v0, v1, v2]) {
      positions.push(verts[vi * 3], verts[vi * 3 + 1], verts[vi * 3 + 2]);
      if (hasNormals && vni >= 0) {
        normals.push(vnorms[vni * 3], vnorms[vni * 3 + 1], vnorms[vni * 3 + 2]);
      } else {
        normals.push(0, 1, 0);
      }
    }
  }

  const posArr  = new Float32Array(positions);
  const normArr = new Float32Array(normals);
  const bb = computeBBox(posArr);
  const dims = [bb.sizeX, bb.sizeY, bb.sizeZ].sort((a, b) => b - a);

  return {
    name: obj.name,
    positions: posArr,
    normals: normArr,
    indices: null,
    w: dims[0],
    h: dims[1],
    thickness: dims[2],
    bbox: bb,
  };
}
