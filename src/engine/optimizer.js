import { packAll, guillotinePack } from './packer.js';

/**
 * Run multiple sort strategies, pick the one with fewest sheets.
 * Then attempt redistribution: if any sheet < minUtil%, pull its parts
 * and try to fit them onto other sheets.
 *
 * @param {Array}  parts
 * @param {number} sheetW
 * @param {number} sheetH
 * @param {number} kerf
 * @param {number} spacing
 * @param {number} minUtil  — percent threshold, e.g. 85
 * @returns {{ sheets, unplaced }}
 */
export function optimizeSheets(parts, sheetW, sheetH, kerf, spacing, minUtil) {
  if (parts.length === 0) return { sheets: [], unplaced: [] };

  // --- Step 1: try four sort orders, keep the best result --------------------
  const strategies = [
    (a, b) => b.w * b.h - a.w * a.h,                             // area desc
    (a, b) => Math.max(b.w, b.h) - Math.max(a.w, a.h),          // max side desc
    (a, b) => b.h - a.h,                                          // height desc
    (a, b) => b.w - a.w,                                          // width desc
  ];

  let best = null;

  for (const cmp of strategies) {
    const sorted = [...parts].sort(cmp);
    const result = packAll(sorted, sheetW, sheetH, kerf, spacing);
    if (
      !best ||
      result.sheets.length < best.sheets.length ||
      (result.sheets.length === best.sheets.length &&
        totalUtil(result.sheets) > totalUtil(best.sheets))
    ) {
      best = result;
    }
  }

  // --- Step 2: redistribute low-utilisation sheets -------------------------
  const threshold = minUtil / 100;
  let sheets = best.sheets;

  // Limit iterations to avoid infinite loops
  for (let iter = 0; iter < 10; iter++) {
    // Find sheet with lowest utilisation below threshold
    let lowIdx = -1;
    let lowUtil = threshold;
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].utilization < lowUtil) {
        lowUtil = sheets[i].utilization;
        lowIdx = i;
      }
    }
    if (lowIdx === -1) break; // all sheets are above threshold

    const lowParts  = sheets[lowIdx].placed;
    const otherIdxs = sheets.map((_, i) => i).filter(i => i !== lowIdx);

    // Try to fit the low-util parts onto every other sheet one by one
    let redistributed = true;
    const remaining = [...lowParts];

    for (const si of otherIdxs) {
      if (remaining.length === 0) break;

      // Re-pack existing parts + the overflow candidates on that sheet
      const combined = [...sheets[si].placed, ...remaining].sort(
        (a, b) => b.w * b.h - a.w * a.h
      );
      const trial = guillotinePack(combined, sheetW, sheetH, kerf, spacing);

      if (trial.placed.length === combined.length) {
        // All fit — update that sheet
        sheets = sheets.map((s, i) => (i === si ? trial : s));
        remaining.length = 0;
      } else if (trial.placed.length > sheets[si].placed.length) {
        // Partial improvement
        sheets = sheets.map((s, i) => (i === si ? trial : s));
        remaining.splice(
          0,
          remaining.length,
          ...trial.unplaced.filter(p => lowParts.some(lp => lp.id === p.id))
        );
      }
    }

    if (remaining.length === 0) {
      // Successfully emptied the low-util sheet — remove it
      sheets = sheets.filter((_, i) => i !== lowIdx);
    } else {
      redistributed = false;
    }

    if (!redistributed) break;
  }

  return { sheets, unplaced: best.unplaced };
}

function totalUtil(sheets) {
  if (!sheets.length) return 0;
  return sheets.reduce((s, sh) => s + sh.utilization, 0) / sheets.length;
}
