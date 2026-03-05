import * as THREE from 'three';

/**
 * Generate flat Float32Arrays for a box (12 triangles, no indices).
 * Returns { positions: Float32Array, normals: Float32Array }
 */
export function generateBoxGeometry(w, h, d) {
  const hw = w / 2, hh = h / 2, hd = d / 2;

  // Six faces: each face = 2 triangles = 6 vertices
  // [normal, quad vertices (v0,v1,v2,v3)] — triangles: (0,1,2) and (0,2,3)
  const faces = [
    { n: [1, 0, 0],  q: [[hw,hh,hd],[hw,-hh,hd],[hw,-hh,-hd],[hw,hh,-hd]]   },
    { n: [-1, 0, 0], q: [[-hw,hh,-hd],[-hw,-hh,-hd],[-hw,-hh,hd],[-hw,hh,hd]] },
    { n: [0, 1, 0],  q: [[-hw,hh,-hd],[hw,hh,-hd],[hw,hh,hd],[-hw,hh,hd]]   },
    { n: [0, -1, 0], q: [[-hw,-hh,hd],[hw,-hh,hd],[hw,-hh,-hd],[-hw,-hh,-hd]] },
    { n: [0, 0, 1],  q: [[-hw,-hh,hd],[hw,-hh,hd],[hw,hh,hd],[-hw,hh,hd]]   },
    { n: [0, 0, -1], q: [[hw,-hh,-hd],[-hw,-hh,-hd],[-hw,hh,-hd],[hw,hh,-hd]] },
  ];

  const positions = [];
  const normals = [];

  for (const { n, q } of faces) {
    for (const [i0, i1, i2] of [[0, 1, 2], [0, 2, 3]]) {
      for (const i of [i0, i1, i2]) {
        positions.push(...q[i]);
        normals.push(...n);
      }
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
  };
}

/**
 * Build a THREE.BufferGeometry from raw positions/normals/indices arrays.
 */
export function buildBufferGeometry(positions, normals, indices) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3));
  if (normals && normals.length > 0) {
    geo.setAttribute('normal', new THREE.BufferAttribute(normals.slice(), 3));
  }
  if (indices && indices.length > 0) {
    geo.setIndex(new THREE.BufferAttribute(indices.slice(), 1));
  }
  if (!normals || normals.length === 0) {
    geo.computeVertexNormals();
  }
  return geo;
}

/**
 * Compute axis-aligned bounding box from positions Float32Array.
 * Returns { minX, maxX, minY, maxY, minZ, maxZ, cx, cy, cz, sizeX, sizeY, sizeZ }
 */
export function computeBBox(positions) {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }

  return {
    minX, maxX, minY, maxY, minZ, maxZ,
    cx: (minX + maxX) / 2,
    cy: (minY + maxY) / 2,
    cz: (minZ + maxZ) / 2,
    sizeX: maxX - minX,
    sizeY: maxY - minY,
    sizeZ: maxZ - minZ,
  };
}

/**
 * Add a mesh + edge outline to scene.
 * Options:
 *   fusionStyle — opaque MeshStandardMaterial (Fusion 360 look) with subtle edges.
 * Returns cleanup fn.
 */
export function addMeshWithEdges(scene, geo, color, { fusionStyle = false } = {}) {
  let mat;
  if (fusionStyle) {
    mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: 0.55,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
  } else {
    mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(color),
      roughness: 0.72,
      metalness: 0.05,
      clearcoat: 0.15,
      clearcoatRoughness: 0.4,
    });
  }

  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const edgesGeo = new THREE.EdgesGeometry(geo, 20);
  const edgesMat = new THREE.LineBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: fusionStyle ? 0.1 : 0.3,
  });
  const edges = new THREE.LineSegments(edgesGeo, edgesMat);
  scene.add(edges);

  return () => {
    scene.remove(mesh);
    scene.remove(edges);
    geo.dispose();
    mat.dispose();
    edgesGeo.dispose();
    edgesMat.dispose();
  };
}

/**
 * Create scene lighting (ambient 0.4, directional 0.8 + shadow, fill 0.3).
 */
export function setupLighting(scene) {
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(20, 40, 20);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.1;
  dir.shadow.camera.far = 300;
  dir.shadow.camera.left = -80;
  dir.shadow.camera.right = 80;
  dir.shadow.camera.top = 80;
  dir.shadow.camera.bottom = -80;
  dir.shadow.bias = -0.0005;
  scene.add(dir);

  const fill = new THREE.DirectionalLight(0x8899CC, 0.3);
  fill.position.set(-15, 10, -15);
  scene.add(fill);

  return () => {
    scene.remove(ambient);
    scene.remove(dir);
    scene.remove(fill);
  };
}

/**
 * Create a grid floor.
 */
export function addGridFloor(scene) {
  const grid = new THREE.GridHelper(400, 80, 0x2A2A34, 0x1E1E26);
  grid.position.y = -0.01;
  scene.add(grid);
  return () => {
    scene.remove(grid);
    grid.geometry.dispose();
    grid.material.dispose();
  };
}
