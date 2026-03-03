export const PART_PALETTE = [
  '#E8654A', '#4A90D9', '#5EBD73', '#F5A623', '#9B59B6',
  '#1ABC9C', '#E67E22', '#3498DB', '#E74C6B', '#2ECC71',
  '#F39C12', '#8E44AD', '#16A085', '#D35400', '#2980B9',
];

export const SHEET_PRESETS = [
  { label: '4×8', w: 96, h: 48 },
  { label: '4×4', w: 48, h: 48 },
  { label: '5×5', w: 60, h: 60 },
  { label: '2×4', w: 48, h: 24 },
  { label: 'Custom', w: 96, h: 48, custom: true },
];

export const DEFAULTS = {
  kerf: 0.125,
  spacing: 0.25,
  minUtilization: 85,
  thicknessThreshold: 1.5,
};

export const UNIT_FACTORS = {
  in: 1,
  mm: 25.4,
  cm: 2.54,
};

// Demo: Writing Desk kit — 15 bodies (dimensions in inches)
export const DEMO_BODIES_RAW = [
  { name: 'Desktop',        w: 48, h: 24, t: 0.75 },
  { name: 'Side Panel L',   w: 28, h: 24, t: 0.75 },
  { name: 'Side Panel R',   w: 28, h: 24, t: 0.75 },
  { name: 'Back Panel',     w: 46, h: 10, t: 0.75 },
  { name: 'Shelf',          w: 44, h: 16, t: 0.75 },
  { name: 'Drawer Front A', w: 20, h: 6,  t: 0.75 },
  { name: 'Drawer Front B', w: 20, h: 6,  t: 0.75 },
  { name: 'Drawer Side 1',  w: 15, h: 5,  t: 0.5  },
  { name: 'Drawer Side 2',  w: 15, h: 5,  t: 0.5  },
  { name: 'Drawer Side 3',  w: 15, h: 5,  t: 0.5  },
  { name: 'Drawer Side 4',  w: 15, h: 5,  t: 0.5  },
  { name: 'Drawer Bottom A',w: 19, h: 14, t: 0.5  },
  { name: 'Drawer Bottom B',w: 19, h: 14, t: 0.5  },
  { name: 'Dowel Jig',      w: 3,  h: 3,  t: 3.0  },
  { name: 'Handle',         w: 4,  h: 1,  t: 1.0  },
];
