/**
 * 境界 = names for level ranges (no extra rules). Lv1–9 炼气一层…九层, then every 10 levels
 * a major realm split into 初期 / 中期 / 后期.
 */
const MAJOR = ['筑基', '金丹', '元婴', '化神', '炼虚', '合体', '大乘', '渡劫'] as const;
const DIGITS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

export function realmName(level: number): string {
  const lv = Math.max(1, Math.floor(level));
  if (lv <= 9) return `炼气${DIGITS[lv - 1]}层`;
  const i = Math.min(MAJOR.length - 1, Math.floor((lv - 10) / 10));
  if (lv >= 10 + MAJOR.length * 10) return `${MAJOR[MAJOR.length - 1]}圆满`;
  const within = (lv - 10) % 10;
  return `${MAJOR[i]}${within < 3 ? '初期' : within < 7 ? '中期' : '后期'}`;
}
