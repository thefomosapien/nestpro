# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

- `npm install` — install dependencies
- `npm run dev` — start Vite dev server (http://localhost:5173)
- `npm run build` — production build to `dist/`
- `npm run preview` — preview production build

No test runner or linter is configured.

## Architecture

NestPro is a **CNC Plywood Nesting Optimizer** — a React + Vite single-page app that imports 3D CAD files, computes optimal part layouts on plywood sheets, and visualizes results in 2D/3D.

### 3-Step Workflow (managed in App.jsx)

1. **Import** — Drag-drop 3D files (.step/.stp/.iges/.igs/.stl/.obj), parse geometry, preview bodies, select which to nest
2. **Configure** — Set sheet dimensions, kerf width, spacing, utilization thresholds
3. **Results** — View optimized 2D SVG sheet layouts and 3D Three.js visualizations

### Key Directories

- **src/components/** — React UI components (file upload, body list, config panel, 2D/3D viewers)
- **src/engine/** — Nesting optimization: `optimizer.js` (multi-strategy optimization & redistribution across sheets), `packer.js` (guillotine bin-packing with BSSF heuristic)
- **src/parsers/** — File format parsers: STEP/IGES (via occt-import-js WASM from CDN), STL (ASCII & binary), OBJ
- **src/utils/** — Constants/presets (`constants.js`), Three.js geometry helpers (`three-helpers.js`)

### Important Conventions

- **Units**: All internal dimensions in inches. STEP/IGES files arrive in mm and are converted on import.
- **Thickness threshold**: Parts ≤ 1.5" are "sheet parts" for nesting; thicker items are treated as "hardware."
- **State management**: React hooks only (no Redux/Zustand). Props-based component communication.
- **3D rendering**: Three.js with manual orbit controls, shadow mapping, ACES Filmic tone mapping, edge outlines.
- **WASM dependency**: occt-import-js v0.0.23 loaded lazily from jsDelivr CDN for STEP/IGES parsing.
- **Styling**: Single `index.css` file with CSS custom properties (--bg, --accent, --text, etc.). Dark theme with accent orange (#E8654A).
- **Vite config**: Custom CORS headers (COEP/COOP) for SharedArrayBuffer support required by WASM.
- **Deployment**: Vercel (configured in vercel.json).
