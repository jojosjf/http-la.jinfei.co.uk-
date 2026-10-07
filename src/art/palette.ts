/** Shared colour palette for the procedurally drawn map. Kept small and SNES-like. */
export const PAL = {
  outline: '#1b1f2a',
  shadow: 'rgba(10, 12, 20, 0.28)',
  grid: 'rgba(0, 0, 0, 0.16)',

  grass: { base: '#5f9c3b', alt: '#67a541', alt2: '#589437', dark: '#497f2e', light: '#80bb52', flower: '#f6d35b', flower2: '#f3f0e6' },
  forestFloor: { base: '#4d8631', alt: '#468029' },
  tree: { outline: '#1e4420', dark: '#2c6a2c', mid: '#3d8a38', light: '#5fae4a', trunk: '#5a3b1f', trunkDark: '#3d2713' },

  rock: { base: '#8d8166', light: '#b0a486', dark: '#6a5f49', outline: '#3f3728', snow: '#f2f4f7', snowShade: '#c8d1dd', grassFringe: '#5f9c3b' },

  dirt: { base: '#b8a884', light: '#cdbf9c', dark: '#8f8263', edge: '#6f6549', track: '#a39572' },
  bridge: { plank: '#9c6b3c', plankDark: '#7a5029', plankLight: '#b9834b', rail: '#4a2f17' },

  water: { base: '#3b7bc4', deep: '#2f68ad', shallow: '#4f8fd4', foam: '#9fd0f2', wave: '#86bdeb', waveDark: '#2b5f9e' },
  sand: { base: '#d6c38d', dark: '#b8a46f' },

  city: { paving: '#8c8a86', pavingDark: '#77756f', pavingLight: '#a3a19b', wall: ['#e8e2d4', '#ddd5c2', '#efe8da'], wallShade: ['#c4bba6', '#b8ae98', '#cfc6b2'], roof: '#3d4452', roofLight: '#56607a', roofDark: '#2a2f3a', pillar: '#a8322c', pillarDark: '#7a2420', door: '#5a2a1e', lattice: '#c9a66b', lantern: '#e0402c', lanternGlow: '#ffb35a' },

  base: { stone: '#a6a196', stoneDark: '#8e897e', stoneLight: '#bdb8ac', joint: '#7c776c', rail: '#d8d3c6', railDark: '#9a958a', pillar: '#b8342c', pillarDark: '#86241e', roof: '#2f4a3e', roofLight: '#46695a', roofDark: '#1f3129', gold: '#e2b84a', plaque: '#253a5a', altar: '#c8c2b2', altarDark: '#9c968a', rune: '#7ff0ff', runeDim: '#3aa8c0' },
} as const;
