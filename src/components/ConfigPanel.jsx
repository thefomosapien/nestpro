import { useState } from 'react';
import { SHEET_PRESETS, UNIT_FACTORS } from '../utils/constants.js';

const fmt = (v, unit) => (v * (UNIT_FACTORS[unit] ?? 1)).toFixed(unit === 'in' ? 3 : 1);

/**
 * Group bodies with identical dimensions (within tolerance).
 */
function groupBodies(bodies, tol = 0.05) {
  const used = new Set();
  const groups = [];

  for (const body of bodies) {
    if (used.has(body.id)) continue;
    const similar = bodies.filter(b =>
      !used.has(b.id) &&
      Math.abs(b.w - body.w) < tol &&
      Math.abs(b.h - body.h) < tol &&
      Math.abs(b.thickness - body.thickness) < tol
    );
    similar.forEach(b => used.add(b.id));
    groups.push({ ...body, qty: similar.length });
  }

  return groups;
}

export default function ConfigPanel({ bodies, config, onChange, unit }) {
  const [customW, setCustomW] = useState(config.preset?.w ?? 96);
  const [customH, setCustomH] = useState(config.preset?.h ?? 48);

  const checkedBodies = bodies.filter(b => b.checked);
  const groups = groupBodies(checkedBodies);
  const uf = UNIT_FACTORS[unit] ?? 1;
  const fmtIn = (v) => fmt(v, unit);

  const handlePreset = (preset) => {
    if (preset.custom) {
      onChange({ ...config, preset: { ...preset, w: customW, h: customH } });
    } else {
      onChange({ ...config, preset });
    }
  };

  const handleCustom = (axis, val) => {
    const num = parseFloat(val) || 0;
    if (axis === 'w') setCustomW(num);
    else setCustomH(num);
    if (config.preset?.custom) {
      onChange({
        ...config,
        preset: { ...config.preset, [axis]: num },
      });
    }
  };

  return (
    <div className="configure-layout">
      {/* ── Left: Parts preview ──────────────────────── */}
      <div className="parts-panel">
        <div className="panel-header">
          <div className="panel-title">Nesting Parts</div>
          <div className="panel-subtitle">
            {groups.length} unique · {checkedBodies.length} total pieces
          </div>
        </div>

        <div className="parts-list">
          {groups.length === 0 && (
            <div style={{ padding: '20px 16px', fontSize: 11, color: 'var(--text-dim)', textAlign: 'center' }}>
              No sheet parts selected.<br />Go back to Step 1 and check some bodies.
            </div>
          )}
          {groups.map((g, i) => (
            <div key={g.id} className="part-group-item">
              <div
                className="part-swatch"
                style={{ background: g.color }}
              >
                {g.qty > 1 && (
                  <span style={{ color: 'rgba(0,0,0,0.6)', fontSize: 9, fontWeight: 800 }}>
                    ×{g.qty}
                  </span>
                )}
              </div>

              <div className="part-group-info">
                <div className="part-group-name">{g.name}</div>
                <div className="part-group-dims">
                  {fmtIn(g.w)} × {fmtIn(g.h)} × {fmtIn(g.thickness)} {unit}
                </div>
              </div>

              <div className="part-qty-badge">×{g.qty}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Settings ──────────────────────────── */}
      <div className="settings-panel">

        {/* Sheet size */}
        <div className="settings-section">
          <div className="settings-section-title">Sheet Size</div>

          <div className="preset-grid">
            {SHEET_PRESETS.filter(p => !p.custom).map(preset => (
              <button
                key={preset.label}
                className={`preset-btn${config.preset?.label === preset.label ? ' active' : ''}`}
                onClick={() => handlePreset(preset)}
              >
                <span className="preset-label">{preset.label}</span>
                <span className="preset-dims">{preset.w}" × {preset.h}"</span>
              </button>
            ))}

            <button
              className={`preset-btn${config.preset?.custom ? ' active' : ''}`}
              onClick={() => handlePreset({ label: 'Custom', custom: true, w: customW, h: customH })}
            >
              <span className="preset-label">Custom</span>
              <span className="preset-dims">{customW}" × {customH}"</span>
            </button>
          </div>

          {/* Custom dimensions */}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <div className="form-row">
              <span className="form-label" style={{ width: 'auto', marginRight: 6 }}>W</span>
              <input
                className="form-input"
                type="number"
                min="6" max="240" step="0.5"
                value={customW}
                onChange={(e) => handleCustom('w', e.target.value)}
                style={{ width: 80 }}
              />
              <span className="form-unit">in</span>
            </div>
            <div className="form-row">
              <span className="form-label" style={{ width: 'auto', marginRight: 6 }}>H</span>
              <input
                className="form-input"
                type="number"
                min="6" max="240" step="0.5"
                value={customH}
                onChange={(e) => handleCustom('h', e.target.value)}
                style={{ width: 80 }}
              />
              <span className="form-unit">in</span>
            </div>
          </div>
        </div>

        {/* Cut settings */}
        <div className="settings-section">
          <div className="settings-section-title">Cut Settings</div>

          <div className="form-row">
            <span className="form-label">Kerf width</span>
            <input
              className="form-input"
              type="number" min="0" max="1" step="0.0625"
              value={config.kerf}
              onChange={(e) => onChange({ ...config, kerf: parseFloat(e.target.value) || 0 })}
            />
            <span className="form-unit">in</span>
          </div>

          <div className="form-row">
            <span className="form-label">Part spacing</span>
            <input
              className="form-input"
              type="number" min="0" max="2" step="0.0625"
              value={config.spacing}
              onChange={(e) => onChange({ ...config, spacing: parseFloat(e.target.value) || 0 })}
            />
            <span className="form-unit">in</span>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.6 }}>
            Total gap between parts: {((config.kerf || 0) + (config.spacing || 0)).toFixed(4)}"
          </div>
        </div>

        {/* Optimisation */}
        <div className="settings-section">
          <div className="settings-section-title">Optimisation</div>

          <div className="form-row form-row-full">
            <span className="form-label">
              Min. sheet utilisation: <strong style={{ color: 'var(--accent)' }}>{config.minUtilization}%</strong>
            </span>
            <input
              className="slider"
              type="range" min="0" max="100" step="5"
              value={config.minUtilization}
              onChange={(e) => onChange({ ...config, minUtilization: parseInt(e.target.value) })}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-dim)' }}>
              <span>0%</span>
              <span style={{ color: 'var(--text-dim)' }}>Sheets below this threshold will be redistributed</span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Summary */}
        {groups.length > 0 && (
          <div className="settings-section">
            <div className="settings-section-title">Estimate</div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.8 }}>
              <div>
                Parts area:{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {groups.reduce((s, g) => s + g.w * g.h * g.qty, 0).toFixed(1)} in²
                </strong>
              </div>
              <div>
                Sheet area:{' '}
                <strong style={{ color: 'var(--text)' }}>
                  {((config.preset?.w ?? 96) * (config.preset?.h ?? 48)).toFixed(0)} in²
                </strong>
              </div>
              <div>
                Min. sheets (100% util.):{' '}
                <strong style={{ color: 'var(--accent)' }}>
                  {Math.ceil(
                    groups.reduce((s, g) => s + g.w * g.h * g.qty, 0) /
                    ((config.preset?.w ?? 96) * (config.preset?.h ?? 48))
                  )}
                </strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
