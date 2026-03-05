import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { setupLighting, addGridFloor } from '../utils/three-helpers.js';

/**
 * Reusable Three.js viewport.
 *
 * Props:
 *   buildScene(scene, THREE, camera, spherical) → cleanup fn | void
 *   style — extra CSS for the container div
 *   label — optional overlay label (top-left)
 */
export default function Viewport3D({ buildScene, style, label }) {
  const mountRef = useRef(null);
  // Use a ref for buildScene to avoid full teardown on every render
  const buildSceneRef = useRef(buildScene);
  buildSceneRef.current = buildScene;

  // Track whether we need to rebuild (buildScene identity changed)
  const prevBuildScene = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    // ── Renderer ────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth || 600, mount.clientHeight || 400);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x1A1A22);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    // ── Scene ────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1A1A22, 0.006);

    // ── Camera ───────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      55,
      (mount.clientWidth || 600) / (mount.clientHeight || 400),
      0.05,
      2000
    );

    // ── Lighting ─────────────────────────────────────────────
    const cleanupLights = setupLighting(scene);
    const cleanupGrid   = addGridFloor(scene);

    // ── Orbit (manual spherical) ─────────────────────────────
    const sph    = new THREE.Spherical(30, Math.PI / 3.5, Math.PI / 5);
    const target = new THREE.Vector3(0, 0, 0);

    function updateCamera() {
      camera.position.setFromSpherical(sph).add(target);
      camera.lookAt(target);
    }
    updateCamera();

    // Mouse / touch orbit
    let dragging = false;
    let lastX = 0, lastY = 0;
    let lastTouchDist = 0;

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const onMouseMove = (e) => {
      if (!dragging) return;
      const dx = (e.clientX - lastX) * 0.012;
      const dy = (e.clientY - lastY) * 0.012;
      sph.theta -= dx;
      sph.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dy));
      lastX = e.clientX; lastY = e.clientY;
      updateCamera();
    };
    const onMouseUp   = () => { dragging = false; };
    const onWheel     = (e) => {
      e.preventDefault();
      sph.radius = Math.max(1, Math.min(800, sph.radius * (1 + e.deltaY * 0.0008)));
      updateCamera();
    };

    // Touch pan + pinch
    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        dragging = true;
        lastX = e.touches[0].clientX;
        lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };
    const onTouchMove = (e) => {
      e.preventDefault();
      if (e.touches.length === 1 && dragging) {
        const dx = (e.touches[0].clientX - lastX) * 0.012;
        const dy = (e.touches[0].clientY - lastY) * 0.012;
        sph.theta -= dx;
        sph.phi    = Math.max(0.05, Math.min(Math.PI - 0.05, sph.phi - dy));
        lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
        updateCamera();
      } else if (e.touches.length === 2) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        sph.radius = Math.max(1, Math.min(800, sph.radius * (lastTouchDist / d)));
        lastTouchDist = d;
        updateCamera();
      }
    };
    const onTouchEnd = () => { dragging = false; };

    mount.addEventListener('mousedown',  onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup',   onMouseUp);
    mount.addEventListener('wheel',      onWheel, { passive: false });
    mount.addEventListener('touchstart', onTouchStart, { passive: true });
    mount.addEventListener('touchmove',  onTouchMove, { passive: false });
    mount.addEventListener('touchend',   onTouchEnd);

    // ── Build user scene ─────────────────────────────────────
    let userCleanup = null;

    function rebuildScene() {
      if (userCleanup) {
        userCleanup();
        userCleanup = null;
      }
      if (buildSceneRef.current) {
        userCleanup = buildSceneRef.current(scene, THREE, camera, sph, target, updateCamera);
        // After building, auto-fit camera to scene content
        autoFit(scene, sph, target, updateCamera);
      }
    }

    rebuildScene();

    // ── Resize observer ──────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w > 0 && h > 0) {
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
    });
    ro.observe(mount);

    // ── Animation loop ───────────────────────────────────────
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    // ── Cleanup ──────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      mount.removeEventListener('mousedown',  onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup',   onMouseUp);
      mount.removeEventListener('wheel',      onWheel);
      mount.removeEventListener('touchstart', onTouchStart);
      mount.removeEventListener('touchmove',  onTouchMove);
      mount.removeEventListener('touchend',   onTouchEnd);
      if (userCleanup) userCleanup();
      cleanupLights();
      cleanupGrid();
      scene.traverse(obj => {
        obj.geometry?.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildScene]); // Rebuild Three.js scene whenever buildScene identity changes

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', position: 'relative', cursor: 'grab', ...style }}
    >
      {label && <div className="viewport-label">{label}</div>}
      <div className="viewport-hint">
        Drag to orbit · Scroll to zoom
      </div>
    </div>
  );
}

/**
 * Auto-fit camera distance/target to all meshes in the scene.
 */
function autoFit(scene, sph, target, updateCamera) {
  const box = new THREE.Box3();
  scene.traverse(obj => {
    if (obj.isMesh && !obj.isLineSegments) {
      box.expandByObject(obj);
    }
  });

  if (!box.isEmpty()) {
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    target.copy(center);
    sph.radius = maxDim * 1.8;
    updateCamera();
  }
}
