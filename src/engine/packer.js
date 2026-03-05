/**
 * Guillotine bin-packing with Best Short-Side Fit (BSSF) + rotation.
 *
 * References: Jukka Jylänki, "A Thousand Ways to Pack the Bin" (2010)
 */

/**
 * Pack one batch of parts onto a single sheet.
 *
 * @param {Array}  parts   — [{id, name, w, h, thickness, color, ...}]  (inches)
 * @param {number} sheetW  — sheet width  (inches)
 * @param {number} sheetH  — sheet height (inches)
 * @param {number} kerf    — saw kerf width (inches)
 * @param {number} spacing — minimum gap between parts (inches)
 * @returns {{ placed, unplaced, utilization, sheetW, sheetH }}
 */
export function guillotinePack(parts, sheetW, sheetH, kerf, spacing) {
  const gap = kerf + spacing;

  // Use the caller's sort order — the optimizer passes different strategies.
  const sorted = [...parts];

  let freeRects = [{ x: 0, y: 0, w: sheetW, h: sheetH }];
  const placed  = [];
  const unplaced = [];

  for (const part of sorted) {
    let bestScore = Infinity;
    let bestFreeIdx = -1;
    let bestX = 0, bestY = 0;
    let bestPW = 0, bestPH = 0;
    let bestRotated = false;

    for (let i = 0; i < freeRects.length; i++) {
      const fr = freeRects[i];

      // Normal orientation
      if (part.w + gap <= fr.w + 1e-9 && part.h + gap <= fr.h + 1e-9) {
        const score = Math.min(fr.w - part.w - gap, fr.h - part.h - gap);
        if (score < bestScore) {
          bestScore = score;
          bestFreeIdx = i;
          bestX = fr.x; bestY = fr.y;
          bestPW = part.w; bestPH = part.h;
          bestRotated = false;
        }
      }

      // Rotated 90°
      if (part.h + gap <= fr.w + 1e-9 && part.w + gap <= fr.h + 1e-9) {
        const score = Math.min(fr.w - part.h - gap, fr.h - part.w - gap);
        if (score < bestScore) {
          bestScore = score;
          bestFreeIdx = i;
          bestX = fr.x; bestY = fr.y;
          bestPW = part.h; bestPH = part.w;
          bestRotated = true;
        }
      }
    }

    if (bestFreeIdx === -1) {
      unplaced.push(part);
      continue;
    }

    placed.push({
      ...part,
      x: bestX,
      y: bestY,
      rotated: bestRotated,
      placedW: bestPW,
      placedH: bestPH,
    });

    // Split the used free rectangle (guillotine horizontal-first split)
    const fr = freeRects[bestFreeIdx];
    const usedW = bestPW + gap;
    const usedH = bestPH + gap;

    freeRects.splice(bestFreeIdx, 1);

    // Right strip (same row height as placed part)
    if (fr.w - usedW > 1e-6) {
      freeRects.push({ x: bestX + usedW, y: bestY, w: fr.w - usedW, h: usedH });
    }
    // Top strip (full sheet width)
    if (fr.h - usedH > 1e-6) {
      freeRects.push({ x: fr.x, y: bestY + usedH, w: fr.w, h: fr.h - usedH });
    }
  }

  const sheetArea = sheetW * sheetH;
  const usedArea  = placed.reduce((s, p) => s + p.placedW * p.placedH, 0);

  return {
    placed,
    unplaced,
    utilization: sheetArea > 0 ? usedArea / sheetArea : 0,
    sheetW,
    sheetH,
  };
}

/**
 * Pack all parts across as many sheets as needed.
 *
 * @returns {{ sheets: Array, unplaced: Array }}
 *   sheets[i] = { placed, unplaced, utilization, sheetW, sheetH }
 */
export function packAll(parts, sheetW, sheetH, kerf, spacing) {
  let remaining = [...parts];
  const sheets  = [];

  while (remaining.length > 0) {
    const result = guillotinePack(remaining, sheetW, sheetH, kerf, spacing);
    if (result.placed.length === 0) break; // nothing fits — give up
    sheets.push(result);
    remaining = result.unplaced;
  }

  return { sheets, unplaced: remaining };
}
