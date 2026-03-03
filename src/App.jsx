import { useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';

import FileDropZone, { buildDemoBodies }  from './components/FileDropZone.jsx';
import BodyList    from './components/BodyList.jsx';
import Viewport3D  from './components/Viewport3D.jsx';
import SheetView2D from './components/SheetView2D.jsx';
import ConfigPanel from './components/ConfigPanel.jsx';

import { optimizeSheets } from './engine/optimizer.js';
import { buildBufferGeometry, generateBoxGeometry, addMeshWithEdges } from './utils/three-helpers.js';
import { DEFAULTS, SHEET_PRESETS, DEMO_BODIES_RAW, PART_PALETTE } from './utils/constants.js';

const STEPS = ['Import', 'Configure', 'Results'];

/* ── Plywood material colours ── */
const PLYWOOD_COLOR  = 0xC8A96E;
const PLYWOOD_EDGE   = 0x8B6914;
const SHEET_ROUGHNESS = 0.85;

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [step,        setStep]        = useState(0);
  const [bodies,      setBodies]      = useState([]);
  const [selectedId,  setSelectedId]  = useState(null);
  const [unit,        setUnit]        = useState('in');
  const [isDemo,      setIsDemo]      = useState(false);
  const [computing,   setComputing]   = useState(false);

  const [config, setConfig] = useState({
    preset:         SHEET_PRESETS[0],
    kerf:           DEFAULTS.kerf,
    spacing:        DEFAULTS.spacing,
    minUtilization: DEFAULTS.minUtilization,
  });

  const [results, setResults] = useState(null);    // { sheets, unplaced }
  const [view3D,  setView3D]  = useState(false);   // 2D / 3D toggle
  const [sheetIdx, setSheetIdx] = useState(0);

  // ── Body management ─────────────────────────────────────────────────────────

  const handleBodiesLoaded = useCallback((newBodies) => {
    setBodies(prev => {
      const next = [...prev];
      for (const b of newBodies) {
        if (!next.find(x => x.id === b.id)) next.push(b);
      }
      return next;
    });
    setIsDemo(false);
    if (newBodies.length > 0) setSelectedId(newBodies[0].id);
  }, []);

  const handleToggle = useCallback((id, checked) => {
    setBodies(prev => prev.map(b => b.id === id ? { ...b, checked } : b));
  }, []);

  const handleToggleAll = useCallback((checked) => {
    setBodies(prev => prev.map(b => ({ ...b, checked })));
  }, []);

  const loadDemo = useCallback(() => {
    const demo = buildDemoBodies(DEMO_BODIES_RAW);
    setBodies(demo);
    setSelectedId(demo[0].id);
    setIsDemo(true);
    setResults(null);
  }, []);

  const clearAll = useCallback(() => {
    setBodies([]);
    setSelectedId(null);
    setResults(null);
    setIsDemo(false);
    setStep(0);
  }, []);

  // ── Compute nesting ──────────────────────────────────────────────────────────

  const runNesting = useCallback(() => {
    const parts = bodies
      .filter(b => b.checked)
      .map(b => ({
        id:        b.id,
        name:      b.name,
        w:         b.w,
        h:         b.h,
        thickness: b.thickness,
        color:     b.color,
      }));

    if (parts.length === 0) return;

    setComputing(true);
    // Run in next tick so React can render the loading state
    setTimeout(() => {
      try {
        const { sheets, unplaced } = optimizeSheets(
          parts,
          config.preset.w,
          config.preset.h,
          config.kerf,
          config.spacing,
          config.minUtilization
        );
        setResults({ sheets, unplaced });
        setSheetIdx(0);
        setStep(2);
      } catch (e) {
        console.error('Nesting error:', e);
      } finally {
        setComputing(false);
      }
    }, 20);
  }, [bodies, config]);

  // ── 3D build-scene callbacks ─────────────────────────────────────────────────

  /** Step 1 — show selected body (Fusion 360 style with STEP file colors) */
  const buildBodyScene = useCallback((scene) => {
    const body = bodies.find(b => b.id === selectedId);
    if (!body) return;

    const geo = buildBufferGeometry(body.positions, body.normals, body.indices);

    // Centre geometry
    geo.computeBoundingBox();
    const centre = new THREE.Vector3();
    geo.boundingBox.getCenter(centre);
    geo.translate(-centre.x, -centre.y, -centre.z);

    // Use the original STEP color when available, otherwise neutral grey
    const color = body.stepColor
      ? new THREE.Color(body.stepColor.r / 255, body.stepColor.g / 255, body.stepColor.b / 255)
      : new THREE.Color(0xB0B0B0);

    return addMeshWithEdges(scene, geo, color, { fusionStyle: true });
  }, [bodies, selectedId]);

  /** Step 3 — 3D sheet+parts view */
  const buildResultsScene = useCallback((scene) => {
    if (!results || !results.sheets[sheetIdx]) return;

    const sheet = results.sheets[sheetIdx];
    const { sheetW, sheetH } = sheet;

    const cleanups = [];

    // Sheet base (plywood slab)
    const sheetGeo = buildBufferGeometry(
      ...flatArraysFromBox(sheetW, sheetH, 0.75),
      null
    );
    sheetGeo.translate(sheetW / 2, 0, sheetH / 2);
    const sheetMat = new THREE.MeshPhysicalMaterial({
      color: PLYWOOD_COLOR,
      roughness: SHEET_ROUGHNESS,
      metalness: 0.02,
    });
    const sheetMesh = new THREE.Mesh(sheetGeo, sheetMat);
    sheetMesh.receiveShadow = true;
    sheetMesh.position.y = -0.375; // half thickness down
    scene.add(sheetMesh);
    cleanups.push(() => { scene.remove(sheetMesh); sheetGeo.dispose(); sheetMat.dispose(); });

    // Parts
    for (const part of sheet.placed) {
      const t = Math.max(part.thickness, 0.25); // minimum visual thickness
      const partW = part.placedW;
      const partH = part.placedH;

      const { positions, normals } = generateBoxGeometry(partW, t, partH);
      const geo = buildBufferGeometry(positions, normals, null);

      // Centre the box then offset to position
      geo.translate(partW / 2 + part.x, t / 2, partH / 2 + part.y);

      const cleanup = addMeshWithEdges(scene, geo, part.color);
      cleanups.push(cleanup);
    }

    // Floor plane below sheet
    const floorGeo = new THREE.PlaneGeometry(sheetW * 2, sheetH * 2);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(sheetW / 2, -0.76, sheetH / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    cleanups.push(() => { scene.remove(floor); floorGeo.dispose(); floorMat.dispose(); });

    return () => cleanups.forEach(fn => fn?.());
  }, [results, sheetIdx]);

  // ── Derived data for results sidebar ────────────────────────────────────────

  const resultStats = useMemo(() => {
    if (!results) return null;
    const { sheets, unplaced } = results;
    const totalParts = sheets.reduce((s, sh) => s + sh.placed.length, 0);
    const avgUtil = sheets.length
      ? Math.round(sheets.reduce((s, sh) => s + sh.utilization, 0) / sheets.length * 100)
      : 0;
    return {
      sheetCount: sheets.length,
      totalParts,
      unplaced: unplaced.length,
      avgUtil,
    };
  }, [results]);

  /** Unique parts in current sheet for the legend */
  const legendParts = useMemo(() => {
    if (!results) return [];
    const seen = new Map();
    for (const sh of results.sheets) {
      for (const p of sh.placed) {
        if (!seen.has(p.name)) seen.set(p.name, p.color);
      }
    }
    return [...seen.entries()].map(([name, color]) => ({ name, color }));
  }, [results]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const selectedBody = bodies.find(b => b.id === selectedId);
  const checkedCount = bodies.filter(b => b.checked).length;

  return (
    <div className="app">
      {/* ── Header ──────────────────────────────────────────── */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">N</div>
          <div>
            <div>NestPro</div>
            <div className="logo-sub">CNC Nesting Optimizer</div>
          </div>
        </div>

        {/* Step indicator */}
        <div className="steps">
          {STEPS.map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
              <div
                className={`step-item${i === step ? ' active' : ''}${i < step ? ' done clickable' : ''}${i > step ? '' : ''}`}
                onClick={() => {
                  if (i < step) setStep(i);
                  if (i === 1 && step === 0 && bodies.length > 0) setStep(1);
                }}
              >
                <div className="step-num">
                  {i < step ? '✓' : i + 1}
                </div>
                <span className="step-label">{label}</span>
              </div>
              {i < STEPS.length - 1 && <div className="step-arrow">›</div>}
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="header-actions">
          {step === 0 && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={loadDemo}>
                ◆ Demo
              </button>
              {bodies.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={clearAll}>
                  ✕ Clear
                </button>
              )}
              <button
                className="btn btn-accent btn-sm"
                disabled={checkedCount === 0}
                onClick={() => setStep(1)}
              >
                Configure → ({checkedCount})
              </button>
            </>
          )}

          {step === 1 && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep(0)}>
                ← Import
              </button>
              <button
                className="btn btn-accent btn-sm"
                disabled={checkedCount === 0 || computing}
                onClick={runNesting}
              >
                {computing ? '⟳ Computing…' : '▶ Run Nesting'}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>
                ← Configure
              </button>
              <button className="btn btn-ghost btn-sm" onClick={runNesting}>
                ↺ Re-run
              </button>
            </>
          )}
        </div>
      </header>

      {/* ── Step content ─────────────────────────────────────── */}
      <div className="step-content">

        {/* ══ STEP 0: Import ══════════════════════════════════ */}
        {step === 0 && (
          <div className="import-layout">
            {/* Body sidebar */}
            <BodyList
              bodies={bodies}
              selectedId={selectedId}
              unit={unit}
              onSelect={setSelectedId}
              onToggle={handleToggle}
              onToggleAll={handleToggleAll}
              onUnit={setUnit}
            />

            {/* Main area */}
            <div className="import-main">
              {isDemo && (
                <div className="demo-banner">
                  ◆ Demo mode — Writing Desk kit (15 bodies). Click any body to preview, check parts to nest.
                </div>
              )}

              {/* Show 3D preview when a body is selected, else drop zone */}
              {selectedBody ? (
                <div className="viewport-wrap" style={{ flex: 1 }}>
                  <div className="viewport-label">
                    {selectedBody.name} — {selectedBody.w.toFixed(2)}" × {selectedBody.h.toFixed(2)}" × {selectedBody.thickness.toFixed(3)}"
                    &nbsp;
                    <span className={selectedBody.isSheet ? 'tag tag-sheet' : 'tag tag-hw'}>
                      {selectedBody.isSheet ? 'Sheet Part' : 'Hardware'}
                    </span>
                  </div>
                  <Viewport3D buildScene={buildBodyScene} />
                </div>
              ) : (
                <FileDropZone onBodiesLoaded={handleBodiesLoaded} />
              )}

              {/* Bottom toolbar */}
              {bodies.length > 0 && (
                <div className="import-toolbar">
                  <span className="import-toolbar-info">
                    {bodies.length} bodies loaded · {checkedCount} selected for nesting
                  </span>
                  {selectedBody && (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setSelectedId(null)}
                    >
                      ← Drop another file
                    </button>
                  )}
                  <button
                    className="btn btn-accent btn-sm"
                    disabled={checkedCount === 0}
                    onClick={() => setStep(1)}
                  >
                    Configure → ({checkedCount} parts)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ STEP 1: Configure ═══════════════════════════════ */}
        {step === 1 && (
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
            <ConfigPanel
              bodies={bodies}
              config={config}
              onChange={setConfig}
              unit={unit}
            />
            {computing && (
              <div className="loading-overlay">
                <div className="spinner" />
                <div>Running nesting algorithm…</div>
              </div>
            )}
          </div>
        )}

        {/* ══ STEP 2: Results ═════════════════════════════════ */}
        {step === 2 && results && (
          <div className="results-layout">
            {/* ── Results sidebar ─────────────────────────── */}
            <div className="results-sidebar">

              {/* Stats */}
              <div className="stats-block">
                <div className="panel-title" style={{ marginBottom: 10, fontFamily: 'var(--sans)' }}>Summary</div>
                <div className="stat-row">
                  <span className="stat-label">Sheets used</span>
                  <span className="stat-value accent">{resultStats.sheetCount}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Parts placed</span>
                  <span className="stat-value green">{resultStats.totalParts}</span>
                </div>
                {resultStats.unplaced > 0 && (
                  <div className="stat-row">
                    <span className="stat-label">Unplaced</span>
                    <span className="stat-value red">{resultStats.unplaced}</span>
                  </div>
                )}
                <div className="stat-row">
                  <span className="stat-label">Avg. utilisation</span>
                  <span
                    className="stat-value"
                    style={{ color: resultStats.avgUtil >= 85 ? '#5EBD73' : resultStats.avgUtil >= 65 ? '#F5A623' : '#E74C6B' }}
                  >
                    {resultStats.avgUtil}%
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Sheet size</span>
                  <span className="stat-value" style={{ fontSize: 11 }}>
                    {config.preset.w}"×{config.preset.h}"
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-label">Kerf + gap</span>
                  <span className="stat-value" style={{ fontSize: 11 }}>
                    {(config.kerf + config.spacing).toFixed(4)}"
                  </span>
                </div>
              </div>

              {/* Sheet tabs */}
              <div style={{ padding: '8px 16px 4px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-dim)', fontWeight: 600, flexShrink: 0 }}>
                Sheets
              </div>
              <div className="sheet-tabs">
                {results.sheets.map((sh, i) => {
                  const pct = Math.round(sh.utilization * 100);
                  const utilColor = pct >= 85 ? '#5EBD73' : pct >= 65 ? '#F5A623' : '#E74C6B';
                  return (
                    <div
                      key={i}
                      className={`sheet-tab${sheetIdx === i ? ' active' : ''}`}
                      onClick={() => { setSheetIdx(i); setView3D(false); }}
                    >
                      <span className="sheet-tab-num">#{i + 1}</span>
                      <div className="sheet-tab-info">
                        <div className="sheet-tab-dims">{sh.placed.length} parts</div>
                        <div className="sheet-tab-util">{pct}% utilised</div>
                        <div className="util-bar">
                          <div className="util-fill" style={{ width: `${pct}%`, background: utilColor }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Unplaced warning */}
              {results.unplaced.length > 0 && (
                <div className="unplaced-warn">
                  ⚠ {results.unplaced.length} part{results.unplaced.length > 1 ? 's' : ''} didn't fit:&nbsp;
                  {results.unplaced.map(p => p.name).join(', ')}
                </div>
              )}

              {/* Legend */}
              <div className="legend">
                <div className="legend-title">Parts</div>
                <div className="legend-items">
                  {legendParts.map(p => (
                    <div key={p.name} className="legend-item">
                      <div className="legend-dot" style={{ background: p.color }} />
                      <span>{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Results main viewport ───────────────────── */}
            <div className="results-main">
              <div className="results-toolbar">
                <div className="view-toggle">
                  <button
                    className={`view-toggle-btn${!view3D ? ' active' : ''}`}
                    onClick={() => setView3D(false)}
                  >
                    2D SVG
                  </button>
                  <button
                    className={`view-toggle-btn${view3D ? ' active' : ''}`}
                    onClick={() => setView3D(true)}
                  >
                    3D View
                  </button>
                </div>

                <span style={{ fontSize: 11, color: 'var(--text-dim)', marginLeft: 8 }}>
                  Sheet #{sheetIdx + 1} — {config.preset.w}" × {config.preset.h}"
                </span>

                <div style={{ flex: 1 }} />

                {/* Sheet navigation */}
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={sheetIdx === 0}
                  onClick={() => setSheetIdx(i => i - 1)}
                >← Prev</button>
                <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                  {sheetIdx + 1} / {results.sheets.length}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={sheetIdx >= results.sheets.length - 1}
                  onClick={() => setSheetIdx(i => i + 1)}
                >Next →</button>
              </div>

              <div className="results-viewport">
                {!view3D ? (
                  <SheetView2D
                    sheet={results.sheets[sheetIdx]}
                    unit={unit}
                  />
                ) : (
                  <Viewport3D
                    buildScene={buildResultsScene}
                    label={`Sheet #${sheetIdx + 1} — 3D view`}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* No results yet on step 2 */}
        {step === 2 && !results && (
          <div className="empty-state" style={{ flex: 1 }}>
            <div className="empty-icon">⚙</div>
            <div className="empty-title">No results yet</div>
            <div className="empty-sub">Go to Configure and click Run Nesting.</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate flat position/normal arrays for a box (no indices).
 * Returns [positions, normals] — used to avoid importing inside callback.
 */
function flatArraysFromBox(w, h, d) {
  const { positions, normals } = generateBoxGeometry(w, d, h); // note axis swap
  return [positions, normals];
}
