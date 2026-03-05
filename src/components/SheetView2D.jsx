import { useState, useRef, useCallback } from 'react';
import { UNIT_FACTORS } from '../utils/constants.js';

const GRID_IN = 12; // major grid every 12 inches

export default function SheetView2D({ sheet, unit = 'in' }) {
  const [hovered, setHovered] = useState(null);
  const [tooltip, setTooltip] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  if (!sheet) {
    return (
      <div className="sheet-view-svg">
        <div className="empty-state">
          <div className="empty-icon">📐</div>
          <div className="empty-title">No sheet selected</div>
        </div>
      </div>
    );
  }

  const { placed, sheetW, sheetH, utilization } = sheet;
  const uf = UNIT_FACTORS[unit] ?? 1;
  const fmt = (v) => (v * uf).toFixed(unit === 'in' ? 2 : 1);

  // Compute SVG dimensions to fit the container
  // We'll use a viewBox and let SVG handle scaling
  const PAD   = 20; // SVG units padding
  const vbW   = sheetW + PAD * 2;
  const vbH   = sheetH + PAD * 2;

  // Grid lines
  const gridLines = [];
  for (let x = 0; x <= sheetW; x += GRID_IN) {
    gridLines.push(
      <line key={`gx${x}`} x1={PAD + x} y1={PAD} x2={PAD + x} y2={PAD + sheetH}
        stroke="rgba(0,0,0,0.2)" strokeWidth={x === 0 || x === sheetW ? 0.8 : 0.4} />
    );
  }
  for (let y = 0; y <= sheetH; y += GRID_IN) {
    gridLines.push(
      <line key={`gy${y}`} x1={PAD} y1={PAD + y} x2={PAD + sheetW} y2={PAD + y}
        stroke="rgba(0,0,0,0.2)" strokeWidth={y === 0 || y === sheetH ? 0.8 : 0.4} />
    );
  }

  // Ruler ticks (major every 12", minor every 6")
  const rulers = [];
  for (let x = 0; x <= sheetW; x += 6) {
    const isMajor = x % 12 === 0;
    rulers.push(
      <line key={`rx${x}`} x1={PAD + x} y1={PAD - (isMajor ? 5 : 3)} x2={PAD + x} y2={PAD}
        stroke="#999" strokeWidth={0.5} />
    );
    if (isMajor) {
      rulers.push(
        <text key={`rtx${x}`} x={PAD + x} y={PAD - 7} textAnchor="middle"
          fontSize={3} fill="#888" fontFamily="monospace">{x}"</text>
      );
    }
  }
  for (let y = 0; y <= sheetH; y += 6) {
    const isMajor = y % 12 === 0;
    rulers.push(
      <line key={`ry${y}`} x1={PAD - (isMajor ? 5 : 3)} y1={PAD + y} x2={PAD} y2={PAD + y}
        stroke="#999" strokeWidth={0.5} />
    );
    if (isMajor && y > 0) {
      rulers.push(
        <text key={`rty${y}`} x={PAD - 7} y={PAD + y + 1} textAnchor="middle"
          fontSize={3} fill="#888" fontFamily="monospace"
          transform={`rotate(-90, ${PAD - 7}, ${PAD + y + 1})`}>{y}"</text>
      );
    }
  }

  const handleMouseMove = useCallback((e) => {
    setTooltip({ x: e.clientX + 12, y: e.clientY + 12 });
  }, []);

  const utilPct = Math.round(utilization * 100);
  const utilColor = utilPct >= 85 ? '#5EBD73' : utilPct >= 65 ? '#F5A623' : '#E74C6B';

  return (
    <div className="sheet-view-svg" ref={containerRef} onMouseMove={handleMouseMove}>
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        width="100%"
        height="100%"
        style={{ display: 'block', maxHeight: '100%', maxWidth: '100%' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Plywood grain texture approximation */}
          <pattern id="grain" patternUnits="userSpaceOnUse" width="6" height="1">
            <rect width="6" height="1" fill="#C8A06A" />
            <rect x="0" y="0" width="6" height="0.3" fill="#B8905A" opacity="0.4" />
          </pattern>
        </defs>

        {/* Sheet background — plywood colour */}
        <rect
          x={PAD} y={PAD}
          width={sheetW} height={sheetH}
          fill="url(#grain)"
          stroke="#8B6914"
          strokeWidth={1}
        />
        <rect
          x={PAD} y={PAD}
          width={sheetW} height={sheetH}
          fill="#C09050"
          opacity={0.3}
        />

        {/* Grid */}
        {gridLines}

        {/* Rulers */}
        {rulers}

        {/* Parts */}
        {placed.map((part) => {
          const isHov = hovered?.id === part.id;
          return (
            <g
              key={part.id + part.x + part.y}
              onMouseEnter={() => setHovered(part)}
              onMouseLeave={() => setHovered(null)}
            >
              <rect
                x={PAD + part.x}
                y={PAD + part.y}
                width={part.placedW}
                height={part.placedH}
                fill={part.color}
                opacity={isHov ? 1 : 0.9}
                stroke={isHov ? '#fff' : 'rgba(0,0,0,0.6)'}
                strokeWidth={isHov ? 0.8 : 0.4}
                rx={0.3}
                style={{ cursor: 'crosshair', transition: 'opacity 0.1s' }}
              />
              {/* Label — only show if part is large enough */}
              {part.placedW > 6 && part.placedH > 3 && (
                <text
                  x={PAD + part.x + part.placedW / 2}
                  y={PAD + part.y + part.placedH / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(4, part.placedW / 8, part.placedH / 2.5)}
                  fill="#fff"
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={0.15}
                  fontFamily="monospace"
                  fontWeight="600"
                  pointerEvents="none"
                >
                  {part.rotated ? '↺ ' : ''}{part.name}
                </text>
              )}
            </g>
          );
        })}

        {/* Sheet outline */}
        <rect
          x={PAD} y={PAD}
          width={sheetW} height={sheetH}
          fill="none"
          stroke="#8B6914"
          strokeWidth={0.8}
        />

        {/* Utilisation badge */}
        <rect x={PAD + sheetW - 26} y={PAD + 2} width={24} height={10} rx={2}
          fill="rgba(0,0,0,0.7)" />
        <text
          x={PAD + sheetW - 14} y={PAD + 8.5}
          textAnchor="middle" dominantBaseline="middle"
          fontSize={4.5} fill={utilColor} fontFamily="monospace" fontWeight="700"
        >
          {utilPct}% used
        </text>

        {/* Dimensions label */}
        <text x={PAD} y={PAD + sheetH + 8} fontSize={3.5} fill="#AAA"
          fontFamily="monospace">
          {fmt(sheetW)}{unit} × {fmt(sheetH)}{unit}
        </text>
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="tooltip"
          style={{ left: tooltip.x, top: tooltip.y, position: 'fixed' }}
        >
          <div className="tooltip-name" style={{ color: hovered.color }}>{hovered.name}</div>
          <div className="tooltip-dim">
            {fmt(hovered.placedW)} × {fmt(hovered.placedH)} {unit}
            {hovered.rotated ? ' (rotated)' : ''}
          </div>
          <div className="tooltip-dim" style={{ marginTop: 3, color: 'var(--text-dim)' }}>
            @ ({fmt(hovered.x)}, {fmt(hovered.y)})
          </div>
          <div className="tooltip-dim">t = {fmt(hovered.thickness)} {unit}</div>
        </div>
      )}
    </div>
  );
}
