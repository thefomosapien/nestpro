import { UNIT_FACTORS, DEFAULTS } from '../utils/constants.js';

const fmt = (val, unit) => {
  const f = UNIT_FACTORS[unit] ?? 1;
  return (val * f).toFixed(unit === 'in' ? 3 : 1);
};

export default function BodyList({
  bodies,
  selectedId,
  unit,
  onSelect,
  onToggle,
  onToggleAll,
  onUnit,
  thicknessThreshold = DEFAULTS.thicknessThreshold,
}) {
  const sheetCount    = bodies.filter(b => b.isSheet).length;
  const checkedCount  = bodies.filter(b => b.checked).length;
  const allChecked    = bodies.length > 0 && checkedCount === bodies.length;
  const someChecked   = checkedCount > 0 && !allChecked;

  const selectSheetParts = () => {
    bodies.forEach(b => onToggle(b.id, b.isSheet));
  };

  return (
    <div className="sidebar">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="sidebar-header">
        <div className="sidebar-title" style={{ fontFamily: 'var(--sans)' }}>
          Bodies
          <span style={{ marginLeft: 8, fontFamily: 'var(--mono)', fontWeight: 400, fontSize: 10, color: 'var(--text-dim)' }}>
            {bodies.length} total · {checkedCount} selected
          </span>
        </div>

        {/* Selection controls */}
        <div className="sidebar-controls">
          <button className="btn btn-sm btn-ghost" onClick={() => onToggleAll(true)}>All</button>
          <button className="btn btn-sm btn-ghost" onClick={() => onToggleAll(false)}>None</button>
          <button className="btn btn-sm btn-ghost" onClick={selectSheetParts}>
            Sheet parts
          </button>
        </div>

        {/* Unit selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>Unit:</span>
          {['in', 'mm', 'cm'].map(u => (
            <button
              key={u}
              className={`btn btn-sm ${unit === u ? 'btn-accent' : 'btn-ghost'}`}
              style={{ padding: '3px 8px', fontSize: 10 }}
              onClick={() => onUnit(u)}
            >
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body list ──────────────────────────────────── */}
      <div className="body-list">
        {bodies.length === 0 && (
          <div style={{ padding: '20px 14px', color: 'var(--text-dim)', fontSize: 11, textAlign: 'center' }}>
            No bodies loaded.<br />Drop a file or load the demo.
          </div>
        )}

        {bodies.map(body => {
          const dims = `${fmt(body.w, unit)} × ${fmt(body.h, unit)} × ${fmt(body.thickness, unit)} ${unit}`;

          return (
            <div
              key={body.id}
              className={`body-item${selectedId === body.id ? ' selected' : ''}`}
              onClick={(e) => {
                // Only select on row click (not checkbox)
                if (e.target.type !== 'checkbox') onSelect(body.id);
              }}
            >
              <input
                className="body-cb"
                type="checkbox"
                checked={body.checked}
                onChange={(e) => { e.stopPropagation(); onToggle(body.id, e.target.checked); }}
              />

              <div
                className="body-color-dot"
                style={{ background: body.color }}
              />

              <div className="body-info">
                <div className="body-name">{body.name}</div>
                <div className="body-dims">{dims}</div>
              </div>

              <span className={`body-badge ${body.isSheet ? 'badge-sheet' : 'badge-hw'}`}>
                {body.isSheet ? 'sheet' : 'hw'}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Footer stats ───────────────────────────────── */}
      {bodies.length > 0 && (
        <div style={{
          padding: '8px 14px',
          borderTop: '1px solid var(--border-dim)',
          fontSize: 10,
          color: 'var(--text-dim)',
          flexShrink: 0,
        }}>
          <span style={{ color: '#5EBD73' }}>{sheetCount} sheet</span>
          {' · '}
          <span style={{ color: '#9B59B6' }}>{bodies.length - sheetCount} hardware</span>
          {' · thickness ≤ '}
          {fmt(thicknessThreshold, unit)}{unit}
        </div>
      )}
    </div>
  );
}
