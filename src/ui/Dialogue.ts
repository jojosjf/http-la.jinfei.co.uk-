import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../config';
import { TEXT_STYLE } from './Hud';

/** Who says a line, already resolved by the scene: display name (null = narration) and portrait texture. */
export interface Speaker {
  name: string | null;
  /** Texture key; `scale` 1 for 64x64 dialogue portraits, 2 for 32x32 map icons. */
  portrait: { key: string; scale: number; flip?: boolean } | null;
  team: 'player' | 'enemy' | null;
}

export interface SpokenLine {
  speaker: Speaker;
  text: string;
  /** Called when the line appears (the map pans to the speaker). */
  focus?: () => void;
}

const DEPTH = 1200;
const BOX_H = 82;
const CHARS_PER_TICK = 1;
const TICK_MS = 28;

/**
 * Bottom-of-screen dialogue box with portrait, name plate and typewriter text.
 * Confirm finishes the line / advances; cancel skips the rest of the conversation.
 */
export class Dialogue {
  private readonly root: Phaser.GameObjects.Container;
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly more: Phaser.GameObjects.Text;
  private portrait: Phaser.GameObjects.Image | null = null;
  private lines: SpokenLine[] = [];
  private index = 0;
  private shown = 0;
  private timer: Phaser.Time.TimerEvent | null = null;
  private done: (() => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    const y = GAME_HEIGHT - 16 - BOX_H - 2;
    this.frame = scene.add.graphics();
    this.nameText = scene.add.text(0, 0, '', { ...TEXT_STYLE, color: '#ffd60a' });
    this.bodyText = scene.add.text(0, 0, '', { ...TEXT_STYLE, wordWrap: { width: 380, useAdvancedWrap: true } }).setLineSpacing(3);
    this.more = scene.add.text(GAME_WIDTH - 22, BOX_H - 16, '▼', { ...TEXT_STYLE, color: '#ffd60a' });
    scene.tweens.add({ targets: this.more, alpha: { from: 1, to: 0.2 }, duration: 400, yoyo: true, repeat: -1 });
    this.root = scene.add.container(4, y, [this.frame, this.nameText, this.bodyText, this.more]).setDepth(DEPTH).setVisible(false);
    this.root.setScrollFactor(0, 0, true);
  }

  get active(): boolean {
    return this.done !== null;
  }

  /** Shows the lines one after another; resolves once the last one is dismissed. */
  play(lines: SpokenLine[]): Promise<void> {
    if (lines.length === 0) return Promise.resolve();
    this.finish();
    this.lines = lines;
    this.index = 0;
    this.root.setVisible(true);
    return new Promise((resolve) => {
      this.done = resolve;
      this.showLine();
    });
  }

  /** Confirm: complete the typing, or go to the next line. */
  advance(): void {
    if (!this.active) return;
    const text = this.lines[this.index].text;
    if (this.shown < [...text].length) {
      this.shown = [...text].length;
      this.bodyText.setText(text);
      this.more.setVisible(true);
      return;
    }
    this.index++;
    if (this.index >= this.lines.length) this.finish();
    else this.showLine();
  }

  /** Cancel: skip the rest of this conversation. */
  skip(): void {
    if (this.active) this.finish();
  }

  private showLine(): void {
    const { speaker, text, focus } = this.lines[this.index];
    focus?.();
    const w = GAME_WIDTH - 8;
    const g = this.frame;
    g.clear();
    g.fillStyle(0x0e1730, 0.95);
    g.fillRect(0, 0, w, BOX_H);
    g.lineStyle(1, 0xe8eef8, 1);
    g.strokeRect(0.5, 0.5, w - 1, BOX_H - 1);
    g.lineStyle(1, speaker.team === 'enemy' ? 0xa83a3a : 0x4d6aa8, 1);
    g.strokeRect(1.5, 1.5, w - 3, BOX_H - 3);

    this.portrait?.destroy();
    this.portrait = null;
    let tx = 10;
    if (speaker.portrait) {
      g.fillStyle(speaker.team === 'enemy' ? 0x5a1f24 : 0x1b2a52, 1);
      g.fillRect(7, 8, 66, 66);
      g.lineStyle(1, 0xe8eef8, 1);
      g.strokeRect(6.5, 7.5, 67, 67);
      const p = speaker.portrait;
      this.portrait = this.scene.add.image(8 + 32, 9 + 32, p.key).setScale(p.scale).setFlipX(!!p.flip);
      this.root.addAt(this.portrait, 1);
      tx = 82;
    }
    this.nameText.setPosition(tx, 6).setText(speaker.name ?? '').setVisible(!!speaker.name);
    this.bodyText
      .setPosition(tx, speaker.name ? 22 : 12)
      .setColor(speaker.name ? '#ffffff' : '#e8dcb8')
      .setWordWrapWidth(w - tx - 22, true)
      .setText('');
    this.more.setVisible(false);
    this.shown = 0;
    this.timer?.remove();
    const chars = [...text];
    this.timer = this.scene.time.addEvent({
      delay: TICK_MS,
      repeat: chars.length,
      callback: () => {
        this.shown = Math.min(chars.length, this.shown + CHARS_PER_TICK);
        this.bodyText.setText(chars.slice(0, this.shown).join(''));
        if (this.shown >= chars.length) this.more.setVisible(true);
      },
    });
  }

  private finish(): void {
    this.timer?.remove();
    this.timer = null;
    this.portrait?.destroy();
    this.portrait = null;
    this.root.setVisible(false);
    const done = this.done;
    this.done = null;
    done?.();
  }
}
