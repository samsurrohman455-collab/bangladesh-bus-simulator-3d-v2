import * as THREE from 'three';

export type RoadSurfaceVariant =
  | 'dhaka'
  | 'highway'
  | 'town'
  | 'market'
  | 'rural'
  | 'domar_local'
  | 'bridge'
  | 'concrete'
  | 'repair';

// Deterministic seeded PRNG (Mulberry32) so textures never flicker
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Fast tileable 2D value noise (periodic over `period x period`)
function createPeriodicNoiseSampler(period: number, seed: number): (u: number, v: number) => number {
  const rand = mulberry32(seed);
  const grid = new Float32Array(period * period);
  for (let i = 0; i < grid.length; i++) {
    grid[i] = rand();
  }
  return (u: number, v: number) => {
    const x = ((u % 1) + 1) % 1 * period;
    const y = ((v % 1) + 1) % 1 * period;
    const x0 = Math.floor(x) % period;
    const y0 = Math.floor(y) % period;
    const x1 = (x0 + 1) % period;
    const y1 = (y0 + 1) % period;
    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const a = grid[y0 * period + x0];
    const b = grid[y0 * period + x1];
    const c = grid[y1 * period + x0];
    const d = grid[y1 * period + x1];
    const top = a + (b - a) * sx;
    const bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
  };
}

function configureColorTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeat = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  } else {
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

function configureDataTexture(
  canvas: HTMLCanvasElement,
  maxAnisotropy: number,
  repeat = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

/**
 * Tileable 512x512 asphalt micro-aggregate heightfield converted into a crisp
 * tangent-space normal map (Linear / NoColorSpace) for grazing-angle realism.
 */
export function createRoadNormalMap(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const height = new Float32Array(size * size);
  const rand = mulberry32(84721);
  const macroN = createPeriodicNoiseSampler(16, 1104);
  const midN = createPeriodicNoiseSampler(48, 2208);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const idx = y * size + x;
      // Subtle tire-wear polishing along center of left/right lanes (~0.27 and ~0.73)
      const rutL = Math.exp(-Math.pow((u - 0.27) / 0.11, 2));
      const rutR = Math.exp(-Math.pow((u - 0.73) / 0.11, 2));
      const rutDip = -0.075 * (rutL + rutR);
      const grainStrength = 1.0 - 0.32 * (rutL + rutR);
      const m1 = macroN(u, v) - 0.5;
      const m2 = midN(u, v) - 0.5;
      const fine = rand() - 0.5;
      height[idx] = 0.5 + rutDip + m1 * 0.24 + (m2 * 0.34 + fine * 0.54) * grainStrength;
    }
  }

  // Gentle 3x3 smoothing pass for natural mineral stone facets instead of pixel harshness
  const smooth = new Float32Array(size * size);
  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) & (size - 1);
    const yp = (y + 1) & (size - 1);
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) & (size - 1);
      const xp = (x + 1) & (size - 1);
      const sum =
        height[ym * size + xm] +
        height[ym * size + x] +
        height[ym * size + xp] +
        height[y * size + xm] +
        height[y * size + x] * 2.2 +
        height[y * size + xp] +
        height[yp * size + xm] +
        height[yp * size + x] +
        height[yp * size + xp];
      smooth[y * size + x] = sum / 10.2;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const strength = 2.85;

  for (let y = 0; y < size; y++) {
    const ym = (y - 1 + size) & (size - 1);
    const yp = (y + 1) & (size - 1);
    for (let x = 0; x < size; x++) {
      const xm = (x - 1 + size) & (size - 1);
      const xp = (x + 1) & (size - 1);
      const dX = (smooth[y * size + xp] - smooth[y * size + xm]) * strength;
      const dY = (smooth[yp * size + x] - smooth[ym * size + x]) * strength;
      const invLen = 1 / Math.sqrt(dX * dX + dY * dY + 1);
      const nx = -dX * invLen;
      const ny = -dY * invLen;
      const nz = invLen;
      const p = (y * size + x) * 4;
      data[p] = Math.round((nx * 0.5 + 0.5) * 255);
      data[p + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[p + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return configureDataTexture(canvas, maxAnisotropy, true);
}

/**
 * Tileable 512x512 linear roughness variation map (NoColorSpace):
 * polished wheel paths slightly lower roughness (~0.72), dusty borders higher (~0.97).
 */
export function createRoadRoughnessMap(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const rand = mulberry32(31903);
  const macroN = createPeriodicNoiseSampler(14, 7102);

  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const rutL = Math.exp(-Math.pow((u - 0.27) / 0.11, 2));
      const rutR = Math.exp(-Math.pow((u - 0.73) / 0.11, 2));
      const edgeMask = Math.max(
        0,
        Math.min(1, (Math.abs(u - 0.5) - 0.36) / 0.14)
      );
      const m = macroN(u, v) - 0.5;
      const rBase = 226 - (rutL + rutR) * 34 + edgeMask * 24 + m * 28 + (rand() - 0.5) * 24;
      const clamped = Math.max(155, Math.min(252, Math.round(rBase)));
      const p = (y * size + x) * 4;
      data[p] = clamped;
      data[p + 1] = clamped;
      data[p + 2] = clamped;
      data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return configureDataTexture(canvas, maxAnisotropy, true);
}

function drawScuffedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  wearDensity: number,
  rand: () => number
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  if (wearDensity <= 0) return;
  const chips = Math.floor((w * h * wearDensity) / 28);
  for (let i = 0; i < chips; i++) {
    const cx = x + rand() * w;
    const cy = y + rand() * h;
    ctx.fillStyle = rand() > 0.35 ? 'rgba(66, 68, 72, 0.54)' : 'rgba(130, 118, 98, 0.32)';
    ctx.fillRect(cx, cy, 1.4 + rand() * 2.8, 1.4 + rand() * 3.8);
  }
}

function drawCrackBranch(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  len: number,
  angle: number,
  rand: () => number,
  alpha = 0.55
): void {
  ctx.strokeStyle = `rgba(34, 36, 39, ${alpha})`;
  ctx.lineWidth = 1.1 + rand() * 1.1;
  ctx.beginPath();
  let x = startX;
  let y = startY;
  ctx.moveTo(x, y);
  const steps = Math.max(4, Math.floor(len / 9));
  let curAngle = angle;
  for (let i = 0; i < steps; i++) {
    curAngle += (rand() - 0.5) * 0.72;
    x += Math.cos(curAngle) * 9;
    y += Math.sin(curAngle) * 9;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawBitumenPatch(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  fill: string,
  rand: () => number
): void {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + w - 7, y + 3);
  ctx.lineTo(x + w, y + h - 5);
  ctx.lineTo(x + 2, y + h);
  ctx.closePath();
  ctx.fill();

  // Thin bitumen tar seal outline around repaired edge
  ctx.strokeStyle = 'rgba(28, 30, 33, 0.58)';
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // Rolled aggregate stone chips inside patch
  for (let i = 0; i < 150; i++) {
    const gx = x + 3 + rand() * Math.max(4, w - 6);
    const gy = y + 3 + rand() * Math.max(4, h - 6);
    const s = 48 + Math.floor(rand() * 26);
    ctx.fillStyle = `rgba(${s},${s + 1},${s + 2},0.38)`;
    ctx.fillRect(gx, gy, 1.5, 1.5);
  }
  ctx.restore();
}

function drawTarSealSnake(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  len: number,
  baseAngle: number,
  rand: () => number
): void {
  ctx.save();
  ctx.strokeStyle = 'rgba(29, 31, 35, 0.62)';
  ctx.lineWidth = 3.2 + rand() * 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  let x = startX;
  let y = startY;
  ctx.moveTo(x, y);
  let ang = baseAngle;
  const steps = Math.max(5, Math.floor(len / 12));
  for (let i = 0; i < steps; i++) {
    ang += (rand() - 0.5) * 0.65;
    x += Math.cos(ang) * 12;
    y += Math.sin(ang) * 12;
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBrickEdging(
  ctx: CanvasRenderingContext2D,
  x: number,
  size: number,
  w: number,
  rand: () => number
): void {
  // Traditional Bangladeshi terracotta brick edging (ইটের বর্ডার) framing rural/local roads
  const brickH = 16;
  for (let y = 0; y < size; y += brickH) {
    const broken = rand() > 0.82;
    if (broken) {
      ctx.fillStyle = 'rgba(132, 114, 90, 0.85)';
      ctx.fillRect(x, y, w, brickH - 2);
      continue;
    }
    const r = 142 + Math.floor(rand() * 26);
    const g = 74 + Math.floor(rand() * 18);
    const b = 52 + Math.floor(rand() * 14);
    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.90)`;
    ctx.fillRect(x, y + 1, w, brickH - 3);
    ctx.fillStyle = 'rgba(72, 56, 44, 0.55)';
    ctx.fillRect(x, y + brickH - 2, w, 2);
  }
}

/**
 * Generates realistic, non-glossy, non-pure-black Bangladeshi road surface albedo textures
 * customized for Dhaka City, Highways, Towns, Markets, Rural Village, Domar/Tunirhat Local,
 * Bridges, RCC Concrete, and Road Repair sections.
 */
export function createRoadVariantTexture(
  variant: RoadSurfaceVariant,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const seed = variant
    .split('')
    .reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), 901);
  const rand = mulberry32(seed);
  const macroN = createPeriodicNoiseSampler(10, seed + 13);
  const midN = createPeriodicNoiseSampler(28, seed + 29);

  // Neutral natural charcoal / dark-grey / faded-grey Bangladeshi asphalt palettes
  const palette: Record<
    RoadSurfaceVariant,
    {
      rgb: [number, number, number];
      noiseAmp: number;
      speckAmp: number;
      warmBias: number;
      dustColor: string;
      dustWidth: number;
      patchColor: string;
      crackCount: number;
      tireAlpha: number;
      narrowFactor: number;
      brickEdging: boolean;
    }
  > = {
    dhaka: {
      rgb: [60, 62, 65],
      noiseAmp: 12,
      speckAmp: 16,
      warmBias: 2,
      dustColor: 'rgba(130, 118, 98, 0.34)',
      dustWidth: 32,
      patchColor: 'rgba(46, 48, 51, 0.72)',
      crackCount: 4,
      tireAlpha: 0.22,
      narrowFactor: 0,
      brickEdging: false,
    },
    highway: {
      rgb: [70, 72, 75],
      noiseAmp: 14,
      speckAmp: 18,
      warmBias: 3,
      dustColor: 'rgba(140, 124, 98, 0.48)',
      dustWidth: 52,
      patchColor: 'rgba(50, 52, 56, 0.68)',
      crackCount: 6,
      tireAlpha: 0.25,
      narrowFactor: 0,
      brickEdging: false,
    },
    town: {
      rgb: [90, 92, 94],
      noiseAmp: 16,
      speckAmp: 20,
      warmBias: 5,
      dustColor: 'rgba(148, 128, 98, 0.56)',
      dustWidth: 58,
      patchColor: 'rgba(60, 62, 66, 0.72)',
      crackCount: 9,
      tireAlpha: 0.22,
      narrowFactor: 0,
      brickEdging: false,
    },
    market: {
      rgb: [94, 91, 86],
      noiseAmp: 18,
      speckAmp: 22,
      warmBias: 9,
      dustColor: 'rgba(154, 132, 100, 0.68)',
      dustWidth: 78,
      patchColor: 'rgba(62, 63, 66, 0.74)',
      crackCount: 11,
      tireAlpha: 0.2,
      narrowFactor: 0.04,
      brickEdging: true,
    },
    rural: {
      rgb: [89, 90, 90],
      noiseAmp: 18,
      speckAmp: 22,
      warmBias: 8,
      dustColor: 'rgba(150, 126, 92, 0.78)',
      dustWidth: 102,
      patchColor: 'rgba(60, 62, 65, 0.76)',
      crackCount: 14,
      tireAlpha: 0.18,
      narrowFactor: 0.11,
      brickEdging: true,
    },
    domar_local: {
      rgb: [96, 95, 92],
      noiseAmp: 20,
      speckAmp: 24,
      warmBias: 11,
      dustColor: 'rgba(148, 122, 86, 0.88)',
      dustWidth: 130,
      patchColor: 'rgba(62, 63, 65, 0.78)',
      crackCount: 16,
      tireAlpha: 0.16,
      narrowFactor: 0.19,
      brickEdging: true,
    },
    bridge: {
      rgb: [101, 104, 109],
      noiseAmp: 12,
      speckAmp: 15,
      warmBias: 1,
      dustColor: 'rgba(136, 138, 140, 0.26)',
      dustWidth: 28,
      patchColor: 'rgba(82, 86, 92, 0.48)',
      crackCount: 2,
      tireAlpha: 0.18,
      narrowFactor: 0,
      brickEdging: false,
    },
    concrete: {
      rgb: [139, 141, 143],
      noiseAmp: 13,
      speckAmp: 14,
      warmBias: 4,
      dustColor: 'rgba(144, 128, 104, 0.36)',
      dustWidth: 36,
      patchColor: 'rgba(116, 118, 122, 0.48)',
      crackCount: 3,
      tireAlpha: 0.14,
      narrowFactor: 0,
      brickEdging: false,
    },
    repair: {
      rgb: [96, 89, 80],
      noiseAmp: 22,
      speckAmp: 28,
      warmBias: 14,
      dustColor: 'rgba(154, 124, 88, 0.84)',
      dustWidth: 96,
      patchColor: 'rgba(46, 48, 51, 0.84)',
      crackCount: 10,
      tireAlpha: 0.16,
      narrowFactor: 0.06,
      brickEdging: false,
    },
  };

  const cfg = palette[variant];

  // 1. Pixel-level organic multi-scale asphalt mineral base
  const baseImg = ctx.createImageData(size, size);
  const pxData = baseImg.data;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const m1 = macroN(u, v) - 0.5;
      const m2 = midN(u, v) - 0.5;
      const grit = (rand() - 0.5) * cfg.speckAmp;
      const delta = m1 * cfg.noiseAmp + m2 * (cfg.noiseAmp * 0.72) + grit;
      const warm = m1 > 0.1 ? cfg.warmBias * m1 : 0;

      const r = Math.max(30, Math.min(200, Math.round(cfg.rgb[0] + delta + warm)));
      const g = Math.max(30, Math.min(200, Math.round(cfg.rgb[1] + delta + warm * 0.5)));
      const b = Math.max(30, Math.min(200, Math.round(cfg.rgb[2] + delta - warm * 0.3)));

      const p = (y * size + x) * 4;
      pxData[p] = r;
      pxData[p + 1] = g;
      pxData[p + 2] = b;
      pxData[p + 3] = 255;
    }
  }
  ctx.putImageData(baseImg, 0, 0);

  // 2. Narrow rural/local sandy-earth verge + iconic Bangladeshi brick edging
  if (cfg.narrowFactor > 0) {
    const vergeW = Math.round(size * cfg.narrowFactor);

    const leftVerge = ctx.createLinearGradient(0, 0, vergeW + 24, 0);
    leftVerge.addColorStop(0, '#7c6a50');
    leftVerge.addColorStop(0.62, '#8b775b');
    leftVerge.addColorStop(1, 'rgba(139, 119, 91, 0)');
    ctx.fillStyle = leftVerge;
    ctx.fillRect(0, 0, vergeW + 24, size);

    const rightVerge = ctx.createLinearGradient(size - vergeW - 24, 0, size, 0);
    rightVerge.addColorStop(0, 'rgba(139, 119, 91, 0)');
    rightVerge.addColorStop(0.38, '#8b775b');
    rightVerge.addColorStop(1, '#7c6a50');
    ctx.fillStyle = rightVerge;
    ctx.fillRect(size - vergeW - 24, 0, vergeW + 24, size);

    if (cfg.brickEdging && vergeW >= 32) {
      drawBrickEdging(ctx, vergeW - 8, size, 13, rand);
      drawBrickEdging(ctx, size - vergeW - 5, size, 13, rand);
    }

    // Creeping village grass & scattered brick khoa chips along outer border
    for (let i = 0; i < 560; i++) {
      const sideLeft = i % 2 === 0;
      const gx = sideLeft ? rand() * (vergeW * 0.74) : size - rand() * (vergeW * 0.74);
      const gy = rand() * size;
      ctx.fillStyle =
        rand() > 0.75
          ? 'rgba(148, 80, 56, 0.42)'
          : rand() > 0.35
            ? 'rgba(76, 104, 44, 0.48)'
            : 'rgba(98, 118, 56, 0.36)';
      ctx.fillRect(gx, gy, 2 + rand() * 3.5, 2 + rand() * 3.5);
    }
  }

  // 3. Faded longitudinal tire-wear wheel paths
  const leftLaneCenter = variant === 'domar_local' ? 0.32 * size : 0.27 * size;
  const rightLaneCenter = variant === 'domar_local' ? 0.68 * size : 0.73 * size;
  for (const lx of [leftLaneCenter, rightLaneCenter]) {
    for (const wheelOff of [-32, 32]) {
      const cx = lx + wheelOff;
      const grad = ctx.createLinearGradient(cx - 26, 0, cx + 26, 0);
      grad.addColorStop(0, 'rgba(30, 32, 34, 0)');
      grad.addColorStop(0.5, `rgba(30, 32, 35, ${cfg.tireAlpha})`);
      grad.addColorStop(1, 'rgba(30, 32, 34, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 26, 0, 52, size);
    }
  }

  // 4. Road construction / repair scarification & red brick khoa gravel OR cold-mix patches
  if (variant === 'repair') {
    for (let i = 0; i < 3200; i++) {
      const x = rand() * size;
      const y = rand() * size;
      ctx.fillStyle =
        rand() > 0.6
          ? 'rgba(142, 78, 54, 0.48)'
          : 'rgba(134, 128, 118, 0.38)';
      ctx.fillRect(x, y, 2 + rand() * 3, 2 + rand() * 3);
    }
    drawBitumenPatch(ctx, 56, 48, 128, 92, cfg.patchColor, rand);
    drawBitumenPatch(ctx, 294, 212, 146, 118, cfg.patchColor, rand);
    drawBitumenPatch(ctx, 96, 355, 118, 86, cfg.patchColor, rand);
  } else if (variant !== 'bridge' && variant !== 'concrete') {
    const patchCount = variant === 'dhaka' ? 2 : variant === 'highway' ? 3 : 5;
    for (let p = 0; p < patchCount; p++) {
      const pw = 44 + rand() * 62;
      const ph = 34 + rand() * 54;
      const px = 64 + rand() * (size - 128 - pw);
      const py = 22 + rand() * (size - 44 - ph);
      drawBitumenPatch(ctx, px, py, pw, ph, cfg.patchColor, rand);
    }

    // Authentic Bangladeshi bitumen tar-sealed crack snakes on highways & rural roads
    const tarCount = variant === 'dhaka' ? 2 : variant === 'highway' ? 4 : 6;
    for (let t = 0; t < tarCount; t++) {
      const sx = 72 + rand() * (size - 144);
      const sy = 20 + rand() * (size - 40);
      drawTarSealSnake(ctx, sx, sy, 48 + rand() * 68, Math.PI * 0.5 + (rand() - 0.5) * 0.9, rand);
    }
  }

  // 5. Concrete RCC panel slab joints OR Bridge deck expansion seams
  if (variant === 'concrete') {
    ctx.strokeStyle = 'rgba(56, 58, 62, 0.56)';
    ctx.lineWidth = 3;
    for (let y = 0; y < size; y += 128) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    for (const x of [170, 342]) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
  } else if (variant === 'bridge') {
    for (let y = 64; y < size; y += 256) {
      ctx.fillStyle = 'rgba(42, 45, 50, 0.65)';
      ctx.fillRect(14, y - 3, size - 28, 6);
      ctx.fillStyle = 'rgba(154, 160, 168, 0.42)';
      ctx.fillRect(14, y - 1, size - 28, 2);
    }
  }

  // 6. Mild realistic cracks (scaled by road age & variant)
  for (let c = 0; c < cfg.crackCount; c++) {
    const sx = 64 + rand() * (size - 128);
    const sy = 16 + rand() * (size - 32);
    const ang = rand() > 0.45 ? Math.PI * 0.5 + (rand() - 0.5) * 0.72 : (rand() - 0.5) * 0.85;
    drawCrackBranch(ctx, sx, sy, 28 + rand() * 52, ang, rand, variant === 'dhaka' ? 0.34 : 0.54);
  }

  // 7. Natural dusty drift along outer road margins
  const leftDust = ctx.createLinearGradient(0, 0, cfg.dustWidth, 0);
  leftDust.addColorStop(0, cfg.dustColor);
  leftDust.addColorStop(1, 'rgba(130, 115, 92, 0)');
  ctx.fillStyle = leftDust;
  ctx.fillRect(0, 0, cfg.dustWidth, size);

  const rightDust = ctx.createLinearGradient(size - cfg.dustWidth, 0, size, 0);
  rightDust.addColorStop(0, 'rgba(130, 115, 92, 0)');
  rightDust.addColorStop(1, cfg.dustColor);
  ctx.fillStyle = rightDust;
  ctx.fillRect(size - cfg.dustWidth, 0, cfg.dustWidth, size);

  // 8. Authentic Bangladeshi weathered road markings (painted ON the asphalt)
  const edgePaintWear =
    variant === 'dhaka' || variant === 'highway' || variant === 'bridge'
      ? 0.14
      : variant === 'town' || variant === 'concrete'
        ? 0.32
        : 0.52;

  if (variant === 'dhaka') {
    drawScuffedRect(ctx, 18, 0, 9, size, 'rgba(222, 226, 230, 0.86)', 0.16, rand);
    drawScuffedRect(ctx, size - 27, 0, 9, size, 'rgba(222, 226, 230, 0.86)', 0.16, rand);
    drawScuffedRect(ctx, size * 0.5 - 7, 0, 5, size, 'rgba(224, 178, 54, 0.84)', 0.18, rand);
    drawScuffedRect(ctx, size * 0.5 + 2, 0, 5, size, 'rgba(224, 178, 54, 0.84)', 0.18, rand);
    for (let y = 16; y < size; y += 128) {
      drawScuffedRect(ctx, size * 0.25 - 3, y, 6, 62, 'rgba(218, 222, 226, 0.72)', 0.2, rand);
      drawScuffedRect(ctx, size * 0.75 - 3, y, 6, 62, 'rgba(218, 222, 226, 0.72)', 0.2, rand);
    }
  } else if (variant === 'highway') {
    drawScuffedRect(ctx, 18, 0, 9, size, 'rgba(222, 226, 230, 0.84)', 0.18, rand);
    drawScuffedRect(ctx, size - 27, 0, 9, size, 'rgba(222, 226, 230, 0.84)', 0.18, rand);
    for (let y = 18; y < size; y += 128) {
      drawScuffedRect(ctx, size * 0.5 - 5, y, 10, 72, 'rgba(226, 180, 54, 0.82)', 0.18, rand);
    }
  } else if (variant === 'bridge') {
    drawScuffedRect(ctx, 18, 0, 9, size, 'rgba(228, 232, 236, 0.86)', 0.12, rand);
    drawScuffedRect(ctx, size - 27, 0, 9, size, 'rgba(228, 232, 236, 0.86)', 0.12, rand);
    drawScuffedRect(ctx, size * 0.5 - 5, 0, 10, size, 'rgba(230, 184, 56, 0.84)', 0.14, rand);
  } else if (variant === 'town' || variant === 'market') {
    drawScuffedRect(ctx, 20, 0, 8, size, 'rgba(206, 210, 214, 0.60)', edgePaintWear, rand);
    drawScuffedRect(ctx, size - 28, 0, 8, size, 'rgba(206, 210, 214, 0.60)', edgePaintWear, rand);
    for (let y = 24; y < size; y += 128) {
      drawScuffedRect(ctx, size * 0.5 - 5, y, 10, 62, 'rgba(212, 170, 68, 0.66)', 0.36, rand);
    }
  } else if (variant === 'rural') {
    for (let y = 0; y < size; y += 64) {
      if ((y / 64) % 3 !== 1) {
        drawScuffedRect(ctx, 56, y, 7, 48, 'rgba(196, 198, 200, 0.42)', 0.56, rand);
        drawScuffedRect(ctx, size - 63, y, 7, 48, 'rgba(196, 198, 200, 0.42)', 0.56, rand);
      }
    }
    for (let y = 28; y < size; y += 128) {
      drawScuffedRect(ctx, size * 0.5 - 4, y, 8, 56, 'rgba(204, 198, 178, 0.52)', 0.5, rand);
    }
  } else if (variant === 'domar_local') {
    // Narrow regional road (Domar & Tunirhat): faded center dashes only, worn brick/earth verge
    for (let y = 30; y < size; y += 128) {
      drawScuffedRect(ctx, size * 0.5 - 4, y, 8, 48, 'rgba(198, 196, 190, 0.44)', 0.58, rand);
    }
  } else if (variant === 'concrete') {
    drawScuffedRect(ctx, 18, 0, 9, size, 'rgba(232, 234, 236, 0.66)', 0.26, rand);
    drawScuffedRect(ctx, size - 27, 0, 9, size, 'rgba(232, 234, 236, 0.66)', 0.26, rand);
    for (let y = 20; y < size; y += 128) {
      drawScuffedRect(ctx, size * 0.5 - 5, y, 10, 68, 'rgba(220, 178, 58, 0.7)', 0.28, rand);
    }
  } else if (variant === 'repair') {
    for (let y = 16; y < size; y += 96) {
      drawScuffedRect(ctx, 28, y, 8, 54, 'rgba(220, 152, 52, 0.64)', 0.36, rand);
      drawScuffedRect(ctx, size - 36, y, 8, 54, 'rgba(220, 152, 52, 0.64)', 0.36, rand);
    }
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(1, 1);
  return tex;
}

/**
 * Painted zebra crossing + optional solid white stop bar texture (transparent background)
 * weathered so underlying asphalt grain shows through cleanly.
 */
export function createZebraCrossingTexture(maxAnisotropy: number, includeStopLine = true): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(includeStopLine ? 5512 : 5519);

  ctx.clearRect(0, 0, 512, 256);

  const stripeCount = 8;
  const margin = 36;
  const usable = 512 - margin * 2;
  const step = usable / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    const sx = margin + i * step + 6;
    const sw = step - 14;
    ctx.fillStyle = 'rgba(224, 228, 232, 0.78)';
    ctx.fillRect(sx, 34, sw, 154);

    // Tire wear & asphalt stone texture bleeding through painted bars
    for (let w = 0; w < 140; w++) {
      const gx = sx + rand() * sw;
      const gy = 34 + rand() * 154;
      ctx.clearRect(gx, gy, 1.8 + rand() * 3.5, 2.5 + rand() * 5.5);
    }
  }

  if (includeStopLine) {
    ctx.fillStyle = 'rgba(228, 232, 236, 0.80)';
    ctx.fillRect(34, 214, 212, 24);
    for (let w = 0; w < 110; w++) {
      ctx.clearRect(34 + rand() * 212, 214 + rand() * 24, 2.5, 3);
    }
  }

  return configureColorTexture(canvas, maxAnisotropy, false);
}

/**
 * Realistic Bangladeshi road pothole decal with cracked grey bitumen rim and exposed
 * grey/red-brick khoa stone aggregate in the center.
 */
export function createPotholeDecalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(99104);

  ctx.clearRect(0, 0, 256, 256);

  const halo = ctx.createRadialGradient(128, 128, 34, 128, 128, 116);
  halo.addColorStop(0, 'rgba(34, 36, 39, 0.90)');
  halo.addColorStop(0.54, 'rgba(50, 52, 55, 0.74)');
  halo.addColorStop(0.82, 'rgba(116, 102, 84, 0.30)');
  halo.addColorStop(1, 'rgba(116, 102, 84, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(128, 128, 112, 92, 0.18, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(64, 120);
  ctx.bezierCurveTo(72, 72, 174, 68, 194, 118);
  ctx.bezierCurveTo(202, 168, 118, 194, 72, 164);
  ctx.closePath();
  ctx.fillStyle = '#4f4943';
  ctx.fill();
  ctx.clip();

  for (let i = 0; i < 420; i++) {
    const px = 58 + rand() * 140;
    const py = 64 + rand() * 130;
    ctx.fillStyle =
      rand() > 0.66
        ? 'rgba(142, 78, 54, 0.65)'
        : rand() > 0.34
          ? 'rgba(96, 92, 86, 0.70)'
          : 'rgba(34, 36, 39, 0.74)';
    ctx.fillRect(px, py, 2.5 + rand() * 4.5, 2.5 + rand() * 4);
  }
  ctx.restore();

  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + rand() * 0.4;
    drawCrackBranch(ctx, 128 + Math.cos(a) * 58, 128 + Math.sin(a) * 48, 28 + rand() * 24, a, rand, 0.65);
  }

  return configureColorTexture(canvas, maxAnisotropy, false);
}

/**
 * Per-side rural shoulder texture (U = 0 at asphalt edge -> U = 1 at outer verge/ditch):
 * dusty compacted earth, single soft wheel rut near pavement edge, and creeping grass outer border.
 */
export function createMuddyShoulderTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(44209);

  const base = ctx.createLinearGradient(0, 0, size, 0);
  base.addColorStop(0, '#857359'); // Dusty sand/gravel against asphalt
  base.addColorStop(0.32, '#735f47'); // Compacted muddy clay track
  base.addColorStop(0.7, '#64583f'); // Grass-soil blend
  base.addColorStop(1, '#4c5f34'); // Grassy ditch lip
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);

  // Subtle single soft wheel rut at ~28% from asphalt edge
  const track = ctx.createLinearGradient(100, 0, 200, 0);
  track.addColorStop(0, 'rgba(60, 48, 36, 0)');
  track.addColorStop(0.5, 'rgba(60, 48, 36, 0.42)');
  track.addColorStop(1, 'rgba(60, 48, 36, 0)');
  ctx.fillStyle = track;
  ctx.fillRect(100, 0, 100, size);

  for (let i = 0; i < 6500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const u = x / size;
    const r = rand();
    if (u > 0.48 && r > 0.62) {
      ctx.fillStyle = 'rgba(72, 104, 40, 0.44)';
    } else {
      ctx.fillStyle = r > 0.5 ? 'rgba(146, 126, 96, 0.30)' : 'rgba(78, 62, 44, 0.36)';
    }
    ctx.fillRect(x, y, 2 + rand() * 2.5, 2 + rand() * 3.5);
  }

  return configureColorTexture(canvas, maxAnisotropy, true);
}

/**
 * Per-side weathered urban concrete sidewalk & dusty curb edge texture for Dhaka & city zones
 * (U = 0 at road gutter -> U = 1 at outer sidewalk).
 */
export function createUrbanShoulderTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(61822);

  ctx.fillStyle = '#8b8f94';
  ctx.fillRect(0, 0, size, size);

  // Dusty gutter strip next to asphalt (u = 0..0.14)
  const gutter = ctx.createLinearGradient(0, 0, 74, 0);
  gutter.addColorStop(0, 'rgba(122, 110, 92, 0.72)');
  gutter.addColorStop(0.7, 'rgba(74, 76, 80, 0.48)');
  gutter.addColorStop(1, 'rgba(74, 76, 80, 0)');
  ctx.fillStyle = gutter;
  ctx.fillRect(0, 0, 74, size);

  // Concrete paver / slab seams
  ctx.strokeStyle = 'rgba(54, 56, 60, 0.45)';
  ctx.lineWidth = 3;
  for (let y = 0; y < size; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y);
    ctx.stroke();
  }
  for (let x = 96; x < size; x += 140) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, size);
    ctx.stroke();
  }

  for (let i = 0; i < 3600; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(156, 144, 124, 0.26)' : 'rgba(64, 66, 70, 0.24)';
    ctx.fillRect(x, y, 2, 2);
  }

  return configureColorTexture(canvas, maxAnisotropy, true);
}

/**
 * Roadside embankment + drainage ditch texture (earthy grass slope descending into a muddy storm ditch).
 */
export function createDrainageEmbankmentTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const rand = mulberry32(77315);

  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#3e5e2c'); // Grassy paddy edge
  grad.addColorStop(0.28, '#465239'); // Ditch bank weed/silt
  grad.addColorStop(0.46, '#39352a'); // Dark damp drainage ditch trough
  grad.addColorStop(0.66, '#4b5f35'); // Inner grassy slope
  grad.addColorStop(1, '#685f47'); // Grass-to-shoulder transition
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 5500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle =
      rand() > 0.55
        ? 'rgba(84, 118, 46, 0.34)'
        : rand() > 0.25
          ? 'rgba(54, 48, 38, 0.35)'
          : 'rgba(138, 120, 92, 0.25)';
    ctx.fillRect(x, y, 2.5, 3.5);
  }

  return configureColorTexture(canvas, maxAnisotropy, true);
}
