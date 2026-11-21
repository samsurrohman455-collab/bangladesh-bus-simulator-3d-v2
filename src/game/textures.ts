import * as THREE from 'three';
import { LiveryConfig } from './types';

function configureColorTexture(canvas: HTMLCanvasElement, maxAnisotropy: number, repeat = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  if (repeat) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
  }
  tex.needsUpdate = true;
  return tex;
}

export function createRoadAsphaltTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep black Bangladeshi bituminous pitch asphalt
  ctx.fillStyle = '#0d0f12';
  ctx.fillRect(0, 0, 1024, 1024);

  // Subtle weathered edge transition along outer curb
  const leftDust = ctx.createLinearGradient(0, 0, 68, 0);
  leftDust.addColorStop(0, 'rgba(38, 34, 30, 0.35)');
  leftDust.addColorStop(1, 'rgba(38, 34, 30, 0)');
  ctx.fillStyle = leftDust;
  ctx.fillRect(0, 0, 68, 1024);

  const rightDust = ctx.createLinearGradient(956, 0, 1024, 0);
  rightDust.addColorStop(0, 'rgba(38, 34, 30, 0)');
  rightDust.addColorStop(1, 'rgba(38, 34, 30, 0.35)');
  ctx.fillStyle = rightDust;
  ctx.fillRect(956, 0, 68, 1024);

  // Dark tar-patch repairs
  ctx.fillStyle = 'rgba(5, 6, 8, 0.55)';
  ctx.fillRect(150, 140, 220, 130);
  ctx.fillRect(610, 580, 250, 160);
  ctx.fillRect(190, 760, 170, 95);

  // Tire-wear tracks on left & right lanes
  const leftTrack = ctx.createLinearGradient(140, 0, 440, 0);
  leftTrack.addColorStop(0, 'rgba(4,5,7,0)');
  leftTrack.addColorStop(0.5, 'rgba(3,4,6,0.45)');
  leftTrack.addColorStop(1, 'rgba(4,5,7,0)');
  ctx.fillStyle = leftTrack;
  ctx.fillRect(120, 0, 340, 1024);

  const rightTrack = ctx.createLinearGradient(584, 0, 884, 0);
  rightTrack.addColorStop(0, 'rgba(4,5,7,0)');
  rightTrack.addColorStop(0.5, 'rgba(3,4,6,0.45)');
  rightTrack.addColorStop(1, 'rgba(4,5,7,0)');
  ctx.fillStyle = rightTrack;
  ctx.fillRect(560, 0, 340, 1024);

  // Fine dark mineral aggregate grain
  for (let i = 0; i < 15000; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 1024;
    const shade = 10 + Math.floor(Math.random() * 18);
    ctx.fillStyle = `rgb(${shade},${shade + 1},${shade + 3})`;
    ctx.fillRect(x, y, 2.2, 2.2);
  }

  // Outer solid white highway edge lines (slightly weathered)
  ctx.fillStyle = '#e5e7eb';
  ctx.fillRect(36, 0, 18, 1024);
  ctx.fillRect(970, 0, 18, 1024);

  // Center yellow dashed highway divider + reflective cat's-eye studs
  ctx.fillStyle = '#facc15';
  for (let y = 32; y < 1024; y += 256) {
    ctx.fillRect(500, y, 22, 144);
    ctx.fillStyle = '#fde047';
    ctx.fillRect(505, y + 190, 12, 12);
    ctx.fillStyle = '#facc15';
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(1, 1);
  return tex;
}

export function createBrickShoulderTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Base Bangladeshi terracotta brick-soling + sandy soil shoulder
  ctx.fillStyle = '#8b5a3c';
  ctx.fillRect(0, 0, 512, 512);

  // Brick pattern rows (reddish clay bricks mixed with dust)
  const brickCols = ['#9e4c32', '#8f432b', '#a8573b', '#7d4b34', '#945238'];
  const bw = 32;
  const bh = 16;
  for (let row = 0; row < 512 / bh; row++) {
    const offset = (row % 2) * (bw / 2);
    for (let col = -1; col < 512 / bw + 1; col++) {
      ctx.fillStyle = brickCols[(row * 7 + col * 3 + 10) % brickCols.length];
      ctx.fillRect(col * bw + offset + 1, row * bh + 1, bw - 2, bh - 2);
    }
  }

  // Sandy dust & grass tufts along outer shoulder edge
  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle = Math.random() > 0.35 ? 'rgba(165, 134, 96, 0.32)' : 'rgba(62, 102, 42, 0.25)';
    ctx.fillRect(x, y, 3, 3);
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(1, 1);
  return tex;
}

export function createPaddyFieldTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#386628';
  ctx.fillRect(0, 0, 512, 512);

  // Authentic rural Bangladesh agricultural patchwork: emerald rice, golden ripe paddy & bright mustard (সরিষা) plots
  const plotCols = [
    '#4c8732',
    '#5c9939',
    '#3e7529',
    '#6aa33b',
    '#477d2e',
    '#74a83b',
    '#8ca332',
    '#518a35',
  ];
  const cell = 128;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const idx = (r * 3 + c * 5) % plotCols.length;
      ctx.fillStyle = plotCols[idx];
      ctx.fillRect(c * cell + 5, r * cell + 5, cell - 10, cell - 10);

      // Subtle crop row striations
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      for (let s = 10; s < cell - 12; s += 7) {
        ctx.fillRect(c * cell + 7, r * cell + s, cell - 14, 2);
      }

      // Mustard (সরিষা) & water-sheen glints on occasional plots
      if ((r === 1 && c === 2) || (r === 3 && c === 0)) {
        ctx.fillStyle = 'rgba(234, 179, 8, 0.24)';
        ctx.fillRect(c * cell + 8, r * cell + 8, cell - 16, cell - 16);
      }
    }
  }

  // Earthen mud bund borders (আইল)
  ctx.strokeStyle = '#5f5338';
  ctx.lineWidth = 6;
  for (let i = 0; i <= 4; i++) {
    ctx.beginPath();
    ctx.moveTo(i * cell, 0);
    ctx.lineTo(i * cell, 512);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * cell);
    ctx.lineTo(512, i * cell);
    ctx.stroke();
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(22, 180);
  return tex;
}

export function createBusLiveryTexture(livery: LiveryConfig, routeLabel: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Rich metallic coach paint base across lower side body
  ctx.fillStyle = livery.primaryHex;
  ctx.fillRect(0, 0, 1024, 256);

  // Upper white/cream beltline stripe right beneath the windows
  ctx.fillStyle = livery.roofHex;
  ctx.fillRect(0, 0, 1024, 46);

  // Dynamic sweeping Paribahan wave across the lower skirt
  ctx.fillStyle = livery.secondaryHex;
  ctx.beginPath();
  ctx.moveTo(0, 56);
  ctx.bezierCurveTo(320, 108, 620, 18, 1024, 68);
  ctx.lineTo(1024, 114);
  ctx.bezierCurveTo(640, 62, 320, 152, 0, 98);
  ctx.closePath();
  ctx.fill();

  // Thin gold/contrast pinstripe
  ctx.fillStyle = livery.accentHex;
  ctx.fillRect(0, 156, 1024, 6);

  // Operator branding in Bengali & English
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 44px "Hind Siliguri", "Outfit", sans-serif';
  ctx.fillText(livery.banglaName, 58, 134);

  ctx.font = '800 26px "Outfit", sans-serif';
  ctx.fillStyle = livery.accentHex === '#1E293B' ? '#F8FAFC' : livery.accentHex;
  ctx.fillText(livery.name.toUpperCase(), 58, 208);

  // Coach model & route tag on rear quarter
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 22px "Outfit", sans-serif';
  ctx.fillText(`${livery.coachModel}  ·  ${routeLabel}`, 970, 206);
  ctx.textAlign = 'left';

  // Luggage bay compartment seam lines
  ctx.strokeStyle = 'rgba(0,0,0,0.34)';
  ctx.lineWidth = 3;
  for (let x = 230; x <= 790; x += 140) {
    ctx.strokeRect(x, 166, 132, 76);
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createLedBoardTexture(text: string, bgHex: string, fgHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 128);

  ctx.strokeStyle = fgHex;
  ctx.lineWidth = 4;
  ctx.strokeRect(6, 6, 500, 116);

  ctx.fillStyle = fgHex;
  ctx.font = '700 40px "Hind Siliguri", "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 66);

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createTruckArtTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Vibrant Bangladeshi truck-art base
  const grad = ctx.createLinearGradient(0, 0, 512, 256);
  grad.addColorStop(0, '#dc2626');
  grad.addColorStop(0.5, '#eab308');
  grad.addColorStop(1, '#16a34a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  // Ornamental scalloped border
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, 472, 216);

  // Stylized lotus & peacock folk medallions
  const drawFlower = (cx: number, cy: number, r: number, color: string) => {
    ctx.fillStyle = color;
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(a) * r * 0.55, cy + Math.sin(a) * r * 0.55, r * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#fde047';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  };

  drawFlower(92, 128, 44, '#ec4899');
  drawFlower(420, 128, 44, '#0ea5e9');

  // Center folk plaque
  ctx.fillStyle = '#1e1b4b';
  ctx.fillRect(156, 74, 200, 108);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 4;
  ctx.strokeRect(156, 74, 200, 108);

  ctx.fillStyle = '#facc15';
  ctx.font = '700 30px "Hind Siliguri", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('মা-বাবার দোয়া', 256, 120);
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 20px "Hind Siliguri", sans-serif';
  ctx.fillText('ধন্যবাদ · শুভ যাত্রা', 256, 158);

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createSignBoardTexture(
  line1: string,
  line2: string,
  bgHex: string,
  fgHex: string,
  borderHex: string,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, 512, 256);

  ctx.strokeStyle = borderHex;
  ctx.lineWidth = 12;
  ctx.strokeRect(10, 10, 492, 236);

  ctx.fillStyle = fgHex;
  ctx.textAlign = 'center';
  ctx.font = '700 44px "Hind Siliguri", "Outfit", sans-serif';
  ctx.fillText(line1, 256, 108);

  if (line2) {
    ctx.font = '600 32px "Hind Siliguri", "Outfit", sans-serif';
    ctx.fillText(line2, 256, 174);
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createGaugeFaceTexture(
  title: string,
  maxVal: number,
  step: number,
  redlineFrom: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#090d14';
  ctx.fillRect(0, 0, 256, 256);

  // Outer bezel ring
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.stroke();

  const startAngle = Math.PI * 0.75;
  const endAngle = Math.PI * 2.25;
  const totalTicks = maxVal / step;

  for (let i = 0; i <= totalTicks * 2; i++) {
    const t = i / (totalTicks * 2);
    const angle = startAngle + t * (endAngle - startAngle);
    const val = t * maxVal;
    const isMajor = i % 2 === 0;
    const rOuter = 104;
    const rInner = isMajor ? 86 : 94;

    ctx.strokeStyle = val >= redlineFrom ? '#ef4444' : '#e2e8f0';
    ctx.lineWidth = isMajor ? 3.5 : 1.5;
    ctx.beginPath();
    ctx.moveTo(128 + Math.cos(angle) * rInner, 128 + Math.sin(angle) * rInner);
    ctx.lineTo(128 + Math.cos(angle) * rOuter, 128 + Math.sin(angle) * rOuter);
    ctx.stroke();

    if (isMajor) {
      ctx.fillStyle = val >= redlineFrom ? '#f87171' : '#f8fafc';
      ctx.font = '700 16px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(Math.round(val)), 128 + Math.cos(angle) * 68, 128 + Math.sin(angle) * 68);
    }
  }

  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 15px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, 128, 178);

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 10, 64, 64, 62);
  grad.addColorStop(0, 'rgba(0,0,0,0.75)');
  grad.addColorStop(0.55, 'rgba(0,0,0,0.42)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export function createTreeBarkTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#5c4636';
  ctx.fillRect(0, 0, 256, 512);

  // Organic bark fissures & vertical ridges
  for (let i = 0; i < 480; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const h = 18 + Math.random() * 68;
    const w = 1.5 + Math.random() * 4.5;
    ctx.fillStyle = Math.random() > 0.45 ? 'rgba(42, 29, 20, 0.55)' : 'rgba(122, 98, 76, 0.35)';
    ctx.fillRect(x, y, w, h);
  }

  // Subtle horizontal growth rings (authentic for coconut/palm & tropical bark)
  for (let y = 12; y < 512; y += 22) {
    ctx.strokeStyle = 'rgba(34, 24, 18, 0.32)';
    ctx.lineWidth = 2 + Math.random() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y + (Math.random() - 0.5) * 4);
    ctx.bezierCurveTo(85, y + 3, 170, y - 3, 256, y + (Math.random() - 0.5) * 4);
    ctx.stroke();
  }

  // Faint green moss patches near base
  for (let i = 0; i < 120; i++) {
    ctx.fillStyle = 'rgba(64, 94, 42, 0.24)';
    ctx.beginPath();
    ctx.arc(Math.random() * 256, 320 + Math.random() * 192, 4 + Math.random() * 12, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(1, 2);
  return tex;
}

export function createPalmFrondTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 512);

  // Tapered central midrib spine (bottom y=506 up to tip y=14)
  ctx.strokeStyle = '#65a30d';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 508);
  ctx.lineTo(128, 18);
  ctx.stroke();

  // Paired serrated coconut palm leaflets along both sides of midrib
  const pairs = 30;
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1); // 0 = base, 1 = tip
    const y = 492 - t * 468;
    const envelope = Math.sin(Math.pow(t, 0.72) * Math.PI * 0.92 + 0.14);
    const len = 26 + envelope * 98;
    const droop = 18 + t * 24;
    const bladeW = 5 + (1 - t * 0.55) * 4.5;

    for (const side of [-1, 1]) {
      const tipX = 128 + side * len;
      const tipY = y - droop * 0.55 + (i % 3) * 2.5;
      const shades = ['#2e6f2b', '#3b8132', '#265c24', '#4d8f34'];
      ctx.fillStyle = shades[(i + (side > 0 ? 1 : 0)) % shades.length];

      ctx.beginPath();
      ctx.moveTo(128, y - bladeW * 0.45);
      ctx.quadraticCurveTo(128 + side * len * 0.52, y - droop * 0.65 - bladeW * 0.7, tipX, tipY);
      ctx.quadraticCurveTo(128 + side * len * 0.5, y - droop * 0.35 + bladeW * 0.6, 128, y + bladeW * 0.45);
      ctx.closePath();
      ctx.fill();
    }
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createLeafClusterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Subtle dark woody twigs at center
  ctx.strokeStyle = '#3f2e21';
  ctx.lineWidth = 4;
  for (let b = 0; b < 5; b++) {
    const a = (b / 5) * Math.PI * 2 + 0.3;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(a) * 68, 128 + Math.sin(a) * 68);
    ctx.stroke();
  }

  // Deterministic dense overlapping botanical leaves (mango / koroi / banyan foliage)
  const leafColors = ['#1b4d22', '#23632a', '#2d7a31', '#3b8c38', '#4b9e3f', '#1f5825'];
  for (let i = 0; i < 64; i++) {
    const angle = i * 2.399963; // golden angle phyllotaxis distribution
    const radius = Math.sqrt((i + 0.5) / 64) * 94;
    const cx = 128 + Math.cos(angle) * radius;
    const cy = 128 + Math.sin(angle) * radius;
    const rot = angle + ((i % 5) - 2) * 0.25;
    const lw = 14 + (i % 4) * 3.5;
    const lh = 26 + (i % 5) * 4;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = leafColors[i % leafColors.length];
    ctx.beginPath();
    ctx.moveTo(0, -lh * 0.55);
    ctx.quadraticCurveTo(lw * 0.65, -lh * 0.1, 0, lh * 0.55);
    ctx.quadraticCurveTo(-lw * 0.65, -lh * 0.1, 0, -lh * 0.55);
    ctx.fill();

    // Fine sunlit center leaf vein
    ctx.strokeStyle = 'rgba(190, 242, 100, 0.22)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -lh * 0.42);
    ctx.lineTo(0, lh * 0.42);
    ctx.stroke();
    ctx.restore();
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createBananaLeafTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 128, 256);

  // Broad paddle-shaped lush green banana leaf blade
  const grad = ctx.createLinearGradient(0, 0, 128, 256);
  grad.addColorStop(0, '#65a30d');
  grad.addColorStop(0.5, '#4d7c0f');
  grad.addColorStop(1, '#3f6212');
  ctx.fillStyle = grad;

  ctx.beginPath();
  ctx.moveTo(64, 248);
  ctx.bezierCurveTo(18, 200, 10, 75, 64, 10);
  ctx.bezierCurveTo(118, 75, 110, 200, 64, 248);
  ctx.closePath();
  ctx.fill();

  // Natural wind splits on banana leaf margins
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  for (const [sx, sy, sw, dir] of [[18, 86, 26, 1], [110, 122, 24, -1], [22, 158, 20, 1]]) {
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + dir * sw, sy + 5);
    ctx.lineTo(sx, sy + 9);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  // Pale central midrib & parallel veins
  ctx.strokeStyle = '#bef264';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(64, 250);
  ctx.lineTo(64, 16);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(190, 242, 100, 0.35)';
  ctx.lineWidth = 1.4;
  for (let y = 38; y < 225; y += 16) {
    ctx.beginPath();
    ctx.moveTo(64, y);
    ctx.lineTo(18, y - 8);
    ctx.moveTo(64, y);
    ctx.lineTo(110, y - 8);
    ctx.stroke();
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createLampPoolTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
  grad.addColorStop(0.35, 'rgba(251, 191, 36, 0.55)');
  grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.18)');
  grad.addColorStop(1, 'rgba(245, 158, 11, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createHeadlightBeamTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Vertical fade from vehicle nose (bottom y=256) forward along -Z (top y=0)
  const vGrad = ctx.createLinearGradient(0, 256, 0, 0);
  vGrad.addColorStop(0, 'rgba(254, 249, 195, 0.85)');
  vGrad.addColorStop(0.3, 'rgba(254, 240, 138, 0.45)');
  vGrad.addColorStop(0.75, 'rgba(253, 224, 71, 0.14)');
  vGrad.addColorStop(1, 'rgba(253, 224, 71, 0.0)');

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(46, 256);
  ctx.lineTo(82, 256);
  ctx.lineTo(126, 0);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = vGrad;
  ctx.fillRect(0, 0, 128, 256);
  ctx.restore();

  // Soft lateral feathering so edges melt cleanly onto dark asphalt
  ctx.globalCompositeOperation = 'destination-in';
  const hGrad = ctx.createLinearGradient(0, 0, 128, 0);
  hGrad.addColorStop(0, 'rgba(0,0,0,0)');
  hGrad.addColorStop(0.22, 'rgba(0,0,0,0.85)');
  hGrad.addColorStop(0.5, 'rgba(0,0,0,1)');
  hGrad.addColorStop(0.78, 'rgba(0,0,0,0.85)');
  hGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, 128, 256);
  ctx.globalCompositeOperation = 'source-over';

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createRiverWaterTexture(baseHex: string, maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Rich river current base (silty turquoise-teal for Jamuna / deep emerald-teal for Meghna)
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 512);

  // Flowing sediment eddies & sunlit water ripples (tileable along X and Y)
  for (let i = 0; i < 180; i++) {
    const x = (i * 73) % 512;
    const y = (i * 137) % 512;
    const w = 36 + (i % 5) * 18;
    const h = 4 + (i % 3) * 2.5;
    ctx.fillStyle =
      i % 3 === 0
        ? 'rgba(186, 230, 253, 0.14)'
        : i % 3 === 1
          ? 'rgba(15, 58, 66, 0.16)'
          : 'rgba(167, 243, 208, 0.10)';
    ctx.beginPath();
    ctx.ellipse(x, y, w * 0.5, h * 0.5, 0.08, 0, Math.PI * 2);
    ctx.fill();
  }

  // Fine shimmering current streaks
  ctx.strokeStyle = 'rgba(224, 242, 254, 0.18)';
  ctx.lineWidth = 1.5;
  for (let y = 14; y < 512; y += 24) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y + 6, 340, y - 6, 512, y);
    ctx.stroke();
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(14, 16);
  return tex;
}

export function createRiverSandTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Alluvial golden-grey Jamuna river sand & silt (যমুনার চর)
  ctx.fillStyle = '#b8a582';
  ctx.fillRect(0, 0, 512, 512);

  for (let i = 0; i < 6500; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    ctx.fillStyle =
      Math.random() > 0.5
        ? 'rgba(148, 130, 96, 0.34)'
        : 'rgba(218, 203, 168, 0.28)';
    ctx.fillRect(x, y, 2.5, 2.5);
  }

  // Wind-rippled sand dune bands
  ctx.strokeStyle = 'rgba(130, 114, 84, 0.24)';
  ctx.lineWidth = 3;
  for (let y = 18; y < 512; y += 26) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(170, y - 5, 340, y + 5, 512, y);
    ctx.stroke();
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(16, 12);
  return tex;
}

export function createConcreteBridgeTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(0, 0, 256, 256);

  // Subtle formwork panel lines & weathered concrete grain
  for (let i = 0; i < 2400; i++) {
    const shade = 184 + Math.floor(Math.random() * 28);
    ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 9})`;
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
  }
  ctx.strokeStyle = 'rgba(71, 85, 105, 0.28)';
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
  }
  for (let x = 0; x < 256; x += 128) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 256);
    ctx.stroke();
  }

  const tex = configureColorTexture(canvas, maxAnisotropy, true);
  tex.repeat.set(2, 4);
  return tex;
}

export function createCityBuildingTexture(
  wallHex: string,
  accentHex: string,
  floors: number,
  maxAnisotropy: number
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Painted concrete/brick plaster body
  ctx.fillStyle = wallHex;
  ctx.fillRect(0, 0, 256, 512);

  // Subtle concrete grime & damp tropical weathering streaks
  const grime = ctx.createLinearGradient(0, 0, 0, 512);
  grime.addColorStop(0, 'rgba(15, 23, 42, 0.14)');
  grime.addColorStop(0.15, 'rgba(15, 23, 42, 0)');
  grime.addColorStop(0.85, 'rgba(15, 23, 42, 0.08)');
  grime.addColorStop(1, 'rgba(15, 23, 42, 0.25)');
  ctx.fillStyle = grime;
  ctx.fillRect(0, 0, 256, 512);

  const groundH = Math.round(512 / Math.max(2, floors));
  const upperFloors = Math.max(1, floors - 1);
  const floorH = (512 - groundH) / upperFloors;

  // Upper residential/commercial floors with recessed windows, steel grills & balconies
  for (let f = 0; f < upperFloors; f++) {
    const fy = f * floorH;

    // Horizontal concrete slab ledge
    ctx.fillStyle = accentHex;
    ctx.fillRect(0, fy + floorH - 7, 256, 7);

    // 3 window / balcony bays per floor
    for (let col = 0; col < 3; col++) {
      const wx = 18 + col * 78;
      const wy = fy + floorH * 0.22;
      const ww = 58;
      const wh = floorH * 0.56;

      // Dark tinted glass interior + warm lit room hints
      ctx.fillStyle = (f + col) % 4 === 1 ? '#fef08a' : '#1e293b';
      ctx.fillRect(wx, wy, ww, wh);

      // Window frame & Bengali iron grill bars
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(wx, wy, ww, wh);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.lineWidth = 1.2;
      for (let gx = wx + 14; gx < wx + ww; gx += 14) {
        ctx.beginPath();
        ctx.moveTo(gx, wy);
        ctx.lineTo(gx, wy + wh);
        ctx.stroke();
      }

      // Balcony railing on middle bay
      if (col === 1) {
        ctx.fillStyle = accentHex;
        ctx.fillRect(wx - 6, wy + wh * 0.58, ww + 12, wh * 0.44);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(wx - 4, wy + wh * 0.63, ww + 8, 3);
      }
    }
  }

  // Ground-floor Bangladeshi market shutter shops & colorful fascias
  const gy = 512 - groundH;
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, gy, 256, groundH);
  const fasciaColors = ['#047857', '#b91c1c', '#0369a1'];
  for (let col = 0; col < 3; col++) {
    const sx = 10 + col * 80;
    // Shop signage band
    ctx.fillStyle = fasciaColors[col % fasciaColors.length];
    ctx.fillRect(sx, gy + 6, 72, 20);
    // Corrugated steel shutter lines
    ctx.fillStyle = '#64748b';
    ctx.fillRect(sx + 2, gy + 28, 68, groundH - 32);
    ctx.fillStyle = '#475569';
    for (let sy = gy + 34; sy < 508; sy += 7) {
      ctx.fillRect(sx + 2, sy, 68, 2);
    }
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createVillageTinHouseTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;

  // Traditional Bangladeshi rural corrugated tin wall + bamboo/mud trim (টিনের ঘর)
  ctx.fillStyle = '#7c8b99';
  ctx.fillRect(0, 0, 256, 128);

  // Vertical corrugated tin ribs
  for (let x = 0; x < 256; x += 6) {
    ctx.fillStyle = x % 12 === 0 ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.16)';
    ctx.fillRect(x, 0, 3, 128);
  }

  // Wooden door & twin shuttered windows
  ctx.fillStyle = '#78350f';
  ctx.fillRect(108, 42, 40, 86);
  ctx.strokeStyle = '#fef3c7';
  ctx.lineWidth = 2;
  ctx.strokeRect(108, 42, 40, 86);

  for (const wx of [34, 184]) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(wx, 44, 38, 36);
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 3;
    ctx.strokeRect(wx, 44, 38, 36);
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createKrishnachuraClusterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  // Deep fern-green foliage base clusters
  const leafCols = ['#1b4d22', '#26682c', '#2f7a34'];
  for (let i = 0; i < 42; i++) {
    const angle = i * 2.399963;
    const radius = Math.sqrt((i + 0.4) / 42) * 90;
    const cx = 128 + Math.cos(angle) * radius;
    const cy = 128 + Math.sin(angle) * radius;
    ctx.fillStyle = leafCols[i % leafCols.length];
    ctx.beginPath();
    ctx.arc(cx, cy, 18 + (i % 4) * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // Iconic fiery crimson-orange Krishnachura (কৃষ্ণচূড়া) blossom sprays across top & edges
  const bloomCols = ['#dc2626', '#ef4444', '#f97316', '#ea580c', '#fbbf24'];
  for (let i = 0; i < 58; i++) {
    const angle = i * 2.399963 + 0.5;
    const radius = Math.sqrt((i + 0.3) / 58) * 96;
    const cx = 128 + Math.cos(angle) * radius;
    const cy = 122 + Math.sin(angle) * radius * 0.9;
    ctx.fillStyle = bloomCols[i % bloomCols.length];
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + (i % 5) * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureColorTexture(canvas, maxAnisotropy);
}

export function createBambooClusterTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, 256, 256);

  const bambooCols = ['#3f6212', '#4d7c0f', '#65a30d', '#365314', '#84cc16'];
  for (let i = 0; i < 74; i++) {
    const angle = i * 2.399963;
    const radius = Math.sqrt((i + 0.3) / 74) * 96;
    const cx = 128 + Math.cos(angle) * radius;
    const cy = 128 + Math.sin(angle) * radius;
    const rot = angle + ((i % 4) - 1.5) * 0.4;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = bambooCols[i % bambooCols.length];
    ctx.beginPath();
    ctx.ellipse(0, 0, 5, 22 + (i % 4) * 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return configureColorTexture(canvas, maxAnisotropy);
}


