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

  city: { asphalt: '#6a6b74', asphaltDark: '#5a5b63', sidewalk: '#9fa0aa', sidewalkDark: '#80818b', wall: ['#c3c3cc', '#b1aeb8', '#c9bfae', '#a9b2bc'], wallShade: ['#8e8e99', '#817e88', '#948b7a', '#79828c'], roof: '#4e4f59', roofAlt: '#7a4b4b', winLit: '#ffe38f', winDark: '#3a3b47', door: '#2f3038' },

  base: { concrete: '#9b9a8c', concreteDark: '#88877a', line: '#c9c8b9', hangar: '#7f8c7c', hangarLight: '#97a593', hangarDark: '#5f6b5d', door: '#3a423a', hazard: '#f2c744', hazardDark: '#2a2a2a', pad: '#8d8c80', padRing: '#e6e6dc', padH: '#ffffff', red: '#d84a3c' },
} as const;
