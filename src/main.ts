import '@fontsource/fusion-pixel-12px-proportional-sc';
import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from './config';
import { BattleScene } from './scenes/BattleScene';
import { BootScene } from './scenes/BootScene';
import { DollViewerScene } from './scenes/DollViewerScene';
import { MapScene } from './scenes/MapScene';

/** Largest integer zoom that fits the window, so pixels stay square and crisp. */
function computeZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT)));
}

async function boot(): Promise<void> {
  try {
    await document.fonts.load(`12px "${FONT_FAMILY}"`);
  } catch {
    // Font failed to load; Phaser falls back to the next family in the stack.
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    backgroundColor: '#0b0c10',
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom: computeZoom() },
    scene: [BootScene, MapScene, BattleScene, DollViewerScene],
  });

  window.addEventListener('resize', () => game.scale.setZoom(computeZoom()));
}

void boot();
