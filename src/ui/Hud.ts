import Phaser from 'phaser';
import { FONT_FAMILY, GAME_HEIGHT, GAME_WIDTH } from '../config';

export const TEXT_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: `"${FONT_FAMILY}", sans-serif`,
  fontSize: '12px',
  fontStyle: 'bold',
  color: '#ffffff',
  resolution: 1,
  shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true, stroke: false },
};
const DISABLED = '#8a8a8a';
const HUD_DEPTH = 1000;

export interface MenuItem {
  label: string;
  enabled: boolean;
}

export interface MenuOptions {
  x: number;
  y: number;
  width?: number;
  onSelect(index: number): void;
  onChange?(index: number): void;
}

export interface Menu {
  readonly index: number;
  move(delta: number): void;
  confirm(): void;
  destroy(): void;
}

export interface UnitInfo {
  name: string;
  /** Realm and/or faction line, e.g. 炼气五层 · 太素剑阁. */
  sub: string;
  team: 'player' | 'enemy';
  hp: number;
  maxHp: number;
  en: number;
  maxEn: number;
  morale: number;
  sp: number;
  maxSp: number;
  /** Active 神通 labels. */
  spirits: string[];
}

export interface TerrainInfo {
  name: string;
  evade: number;
  defense: number;
  x: number;
  y: number;
}

export interface PreviewSide {
  name: string;
  /** Weapon name, or the defender's reaction label (防御 / 回避). */
  action: string;
  hit: number | null;
  damage: number | null;
  crit: number | null;
  hp: number;
  maxHp: number;
}

function drawBox(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.clear();
  g.fillStyle(0x0e1730, 0.94);
  g.fillRect(0, 0, w, h);
  g.fillStyle(0x1b2a52, 1);
  g.fillRect(2, 2, w - 4, 3);
  g.lineStyle(1, 0xe8eef8, 1);
  g.strokeRect(0.5, 0.5, w - 1, h - 1);
  g.lineStyle(1, 0x4d6aa8, 1);
  g.strokeRect(1.5, 1.5, w - 3, h - 3);
}

/** A boxed text panel that stays fixed on screen. */
class Panel {
  readonly root: Phaser.GameObjects.Container;
  private readonly text: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number) {
    const bg = scene.add.graphics();
    drawBox(bg, w, h);
    this.text = scene.add.text(5, 3, '', TEXT_STYLE).setLineSpacing(2);
    this.root = scene.add.container(x, y, [bg, this.text]).setDepth(HUD_DEPTH);
    this.root.setScrollFactor(0, 0, true);
  }

  set(text: string): this {
    this.text.setText(text);
    return this;
  }

  show(v: boolean): this {
    this.root.setVisible(v);
    return this;
  }

  at(x: number, y: number): this {
    this.root.setPosition(x, y);
    return this;
  }
}

const SIDE_W = 170;

export class Hud {
  private readonly terrainPanel: Panel;
  private readonly unitPanel: Panel;
  private readonly turnText: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly preview: { root: Phaser.GameObjects.Container; left: Phaser.GameObjects.Text; right: Phaser.GameObjects.Text };
  private readonly bannerRoot: Phaser.GameObjects.Container;
  private readonly bannerText: Phaser.GameObjects.Text;
  private menuRoot: Phaser.GameObjects.Container | null = null;
  private bannerTimer: Phaser.Time.TimerEvent | null = null;
  /** Resolves the banner currently showing (called early when a newer banner replaces it). */
  private bannerDone: (() => void) | null = null;

  constructor(private readonly scene: Phaser.Scene) {
    this.terrainPanel = new Panel(scene, 4, 4, SIDE_W, 40);
    this.unitPanel = new Panel(scene, 4, 48, SIDE_W, 92).show(false);

    const hintBg = scene.add.graphics().setScrollFactor(0).setDepth(HUD_DEPTH);
    hintBg.fillStyle(0x000000, 0.6);
    hintBg.fillRect(0, GAME_HEIGHT - 16, GAME_WIDTH, 16);
    this.hint = scene.add
      .text(4, GAME_HEIGHT - 14, '', { ...TEXT_STYLE, color: '#cfd8dc' })
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);
    this.turnText = scene.add
      .text(GAME_WIDTH - 4, GAME_HEIGHT - 14, '', { ...TEXT_STYLE, color: '#ffd60a' })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(HUD_DEPTH);

    const pw = 330;
    const ph = 78;
    const pbg = scene.add.graphics();
    drawBox(pbg, pw, ph);
    const left = scene.add.text(6, 4, '', TEXT_STYLE).setLineSpacing(2);
    const right = scene.add.text(pw / 2 + 10, 4, '', TEXT_STYLE).setLineSpacing(2);
    const vs = scene.add.text(pw / 2, ph / 2, 'VS', { ...TEXT_STYLE, color: '#ffd60a' }).setOrigin(0.5);
    const root = scene.add
      .container((GAME_WIDTH - pw) / 2, GAME_HEIGHT - ph - 18, [pbg, left, right, vs])
      .setDepth(HUD_DEPTH + 1)
      .setVisible(false);
    root.setScrollFactor(0, 0, true);
    this.preview = { root, left, right };

    const bbg = scene.add.graphics();
    bbg.fillStyle(0x000000, 0.75);
    bbg.fillRect(0, GAME_HEIGHT / 2 - 22, GAME_WIDTH, 44);
    this.bannerText = scene.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, '', { ...TEXT_STYLE, fontSize: '24px' })
      .setOrigin(0.5);
    this.bannerRoot = scene.add
      .container(0, 0, [bbg, this.bannerText])
      .setDepth(HUD_DEPTH + 2)
      .setVisible(false)
      .setAlpha(0);
    this.bannerRoot.setScrollFactor(0, 0, true);
  }

  setTurn(text: string): void {
    this.turnText.setText(text);
  }

  setHint(text: string): void {
    this.hint.setText(text);
  }

  /** Terrain + unit info for the tile under the cursor, placed on the side away from the cursor. */
  setCursorInfo(terrain: TerrainInfo, unit: UnitInfo | null, side: 'left' | 'right'): void {
    const x = side === 'left' ? 4 : GAME_WIDTH - SIDE_W - 4;
    this.terrainPanel.at(x, 4).set(
      `${terrain.name}  (${terrain.x},${terrain.y})\n回避${fmtSigned(terrain.evade)}%  防御${fmtSigned(terrain.defense)}%`,
    );
    if (!unit) {
      this.unitPanel.show(false);
      return;
    }
    const tag = unit.team === 'player' ? '我方' : '敌方';
    this.unitPanel
      .at(x, 48)
      .show(true)
      .set(
        `${unit.name}  [${tag}]\n${unit.sub}\n气血 ${unit.hp}/${unit.maxHp}\n灵力 ${unit.en}/${unit.maxEn}  战意 ${unit.morale}` +
          (unit.maxSp > 0 ? `\n神识 ${unit.sp}/${unit.maxSp}${unit.spirits.length ? '  ' + unit.spirits.join('·') : ''}` : ''),
      );
  }

  openMenu(items: MenuItem[], opts: MenuOptions): Menu {
    this.closeMenu();
    const scene = this.scene;
    const w = opts.width ?? 100;
    const lineH = 14;
    const h = items.length * lineH + 6;
    const bg = scene.add.graphics();
    drawBox(bg, w, h);
    const cursor = scene.add.text(4, 3, '>', TEXT_STYLE);
    const texts = items.map((it, i) =>
      scene.add.text(14, 3 + i * lineH, it.label, { ...TEXT_STYLE, color: it.enabled ? '#ffffff' : DISABLED }),
    );
    const x = Math.round(Math.max(2, Math.min(GAME_WIDTH - w - 2, opts.x)));
    const y = Math.round(Math.max(2, Math.min(GAME_HEIGHT - h - 18, opts.y)));
    const root = scene.add.container(x, y, [bg, cursor, ...texts]).setDepth(HUD_DEPTH + 3);
    root.setScrollFactor(0, 0, true);
    this.menuRoot = root;

    let index = Math.max(0, items.findIndex((i) => i.enabled));
    const place = (): void => {
      cursor.setY(3 + index * lineH);
    };
    place();
    opts.onChange?.(index);

    texts.forEach((t, i) => {
      t.setInteractive({ useHandCursor: true });
      t.on('pointerover', () => {
        index = i;
        place();
        opts.onChange?.(index);
      });
      t.on('pointerdown', () => {
        if (items[i].enabled) opts.onSelect(i);
      });
    });

    const destroy = (): void => {
      if (this.menuRoot === root) this.menuRoot = null;
      root.destroy(true);
    };
    return {
      get index() {
        return index;
      },
      destroy,
      move(delta: number) {
        const n = items.length;
        for (let k = 0; k < n; k++) {
          index = (index + delta + n) % n;
          if (items[index].enabled) break;
        }
        place();
        opts.onChange?.(index);
      },
      confirm() {
        if (items[index]?.enabled) opts.onSelect(index);
      },
    };
  }

  closeMenu(): void {
    if (this.menuRoot) {
      this.menuRoot.destroy(true);
      this.menuRoot = null;
    }
  }

  showPreview(att: PreviewSide, def: PreviewSide): void {
    this.preview.left.setText(fmtSide(att));
    this.preview.right.setText(fmtSide(def));
    this.preview.root.setVisible(true);
  }

  hidePreview(): void {
    this.preview.root.setVisible(false);
  }

  /** Stage-complete panel: title, summary lines and a footer; stays until the scene restarts. */
  showResult(title: string, lines: string[], footer: string): void {
    const scene = this.scene;
    const w = 300;
    const h = 52 + lines.length * 14 + 26;
    const bg = scene.add.graphics();
    drawBox(bg, w, h);
    bg.fillStyle(0xffd60a, 1);
    bg.fillRect(10, 26, w - 20, 1);
    const head = scene.add.text(w / 2, 8, title, { ...TEXT_STYLE, color: '#ffd60a' }).setOrigin(0.5, 0);
    const body = scene.add.text(14, 34, lines.join('\n'), TEXT_STYLE).setLineSpacing(2);
    const foot = scene.add.text(w / 2, h - 20, footer, { ...TEXT_STYLE, color: '#9ad0ff' }).setOrigin(0.5, 0);
    const root = scene.add
      .container(Math.round((GAME_WIDTH - w) / 2), Math.round((GAME_HEIGHT - 16 - h) / 2), [bg, head, body, foot])
      .setDepth(HUD_DEPTH + 4)
      .setAlpha(0);
    root.setScrollFactor(0, 0, true);
    scene.tweens.add({ targets: root, alpha: 1, duration: 250 });
  }

  /** Centre-screen banner: fade in, hold, fade out. Resolves when done (or immediately after fade-in when hold < 0). */
  banner(text: string, hold = 700): Promise<void> {
    // a newer banner replaces one still fading, so a stale fade-out can't hide it
    this.scene.tweens.killTweensOf(this.bannerRoot);
    this.bannerTimer?.remove(false);
    this.bannerTimer = null;
    this.bannerDone?.();
    this.bannerText.setText(text);
    this.bannerRoot.setVisible(true).setAlpha(0);
    return new Promise<void>((done) => {
      const resolve = (): void => {
        if (this.bannerDone === resolve) this.bannerDone = null;
        done();
      };
      this.bannerDone = resolve;
      this.scene.tweens.add({
        targets: this.bannerRoot,
        alpha: 1,
        duration: 150,
        onComplete: () => {
          if (hold < 0) {
            resolve();
            return;
          }
          this.bannerTimer = this.scene.time.delayedCall(hold, () => {
            this.bannerTimer = null;
            this.scene.tweens.add({
              targets: this.bannerRoot,
              alpha: 0,
              duration: 200,
              onComplete: () => {
                this.bannerRoot.setVisible(false);
                resolve();
              },
            });
          });
        },
      });
    });
  }
}

function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

function fmtSide(s: PreviewSide): string {
  const hit = s.hit === null ? '--' : `${s.hit}%`;
  const dmg = s.damage === null ? '--' : `${s.damage}`;
  const crit = s.crit === null ? '' : `  CT${s.crit}%`;
  return `${s.name}\n${s.action}\n命中 ${hit}${crit}\n伤害 ${dmg}  气血 ${s.hp}/${s.maxHp}`;
}
