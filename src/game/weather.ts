import * as THREE from 'three';

const RAIN_DROP_COUNT = 680;
const RAIN_BOX_W = 44;
const RAIN_BOX_H = 22;
const RAIN_BOX_D = 62;

const MIST_BANK_COUNT = 140;
const MIST_BOX_W = 54;
const MIST_BOX_H = 6.5;
const MIST_BOX_D = 78;

function createSoftMistTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(232, 240, 248, 0.55)');
  grad.addColorStop(0.45, 'rgba(216, 228, 240, 0.25)');
  grad.addColorStop(1, 'rgba(200, 214, 228, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class WeatherEffects {
  public readonly group = new THREE.Group();

  private readonly rainLines: THREE.LineSegments;
  private readonly rainGeo: THREE.BufferGeometry;
  private readonly rainMat: THREE.LineBasicMaterial;
  private readonly rainPositions: Float32Array;
  private readonly rainSpeeds: Float32Array;

  private readonly mistPoints: THREE.Points;
  private readonly mistGeo: THREE.BufferGeometry;
  private readonly mistMat: THREE.PointsMaterial;
  private readonly mistTex: THREE.CanvasTexture;
  private readonly mistPositions: Float32Array;
  private readonly mistDrifts: Float32Array;

  constructor() {
    // 1. Falling rain streak volume (2 vertices per raindrop)
    this.rainPositions = new Float32Array(RAIN_DROP_COUNT * 2 * 3);
    this.rainSpeeds = new Float32Array(RAIN_DROP_COUNT);

    for (let i = 0; i < RAIN_DROP_COUNT; i++) {
      const rx = (Math.random() - 0.5) * RAIN_BOX_W;
      const ry = Math.random() * RAIN_BOX_H;
      const rz = (Math.random() - 0.5) * RAIN_BOX_D - 16;
      const speed = 22 + Math.random() * 10;
      this.rainSpeeds[i] = speed;

      const idx = i * 6;
      this.rainPositions[idx] = rx;
      this.rainPositions[idx + 1] = ry;
      this.rainPositions[idx + 2] = rz;
      this.rainPositions[idx + 3] = rx + 0.08;
      this.rainPositions[idx + 4] = ry + 0.72;
      this.rainPositions[idx + 5] = rz;
    }

    this.rainGeo = new THREE.BufferGeometry();
    const rainAttr = new THREE.BufferAttribute(this.rainPositions, 3);
    rainAttr.setUsage(THREE.DynamicDrawUsage);
    this.rainGeo.setAttribute('position', rainAttr);

    this.rainMat = new THREE.LineBasicMaterial({
      color: 0xd0e6ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.rainLines = new THREE.LineSegments(this.rainGeo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;

    // 2. Low-lying highway mist / fog banks
    this.mistPositions = new Float32Array(MIST_BANK_COUNT * 3);
    this.mistDrifts = new Float32Array(MIST_BANK_COUNT);

    for (let i = 0; i < MIST_BANK_COUNT; i++) {
      this.mistPositions[i * 3] = (Math.random() - 0.5) * MIST_BOX_W;
      this.mistPositions[i * 3 + 1] = 0.7 + Math.random() * MIST_BOX_H;
      this.mistPositions[i * 3 + 2] = (Math.random() - 0.5) * MIST_BOX_D - 24;
      this.mistDrifts[i] = (Math.random() - 0.5) * 2.4;
    }

    this.mistGeo = new THREE.BufferGeometry();
    const mistAttr = new THREE.BufferAttribute(this.mistPositions, 3);
    mistAttr.setUsage(THREE.DynamicDrawUsage);
    this.mistGeo.setAttribute('position', mistAttr);

    this.mistTex = createSoftMistTexture();
    this.mistMat = new THREE.PointsMaterial({
      map: this.mistTex,
      color: 0xdbe6f0,
      size: 15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });

    this.mistPoints = new THREE.Points(this.mistGeo, this.mistMat);
    this.mistPoints.frustumCulled = false;
    this.mistPoints.visible = false;

    this.group.add(this.rainLines, this.mistPoints);
  }

  public update(
    delta: number,
    busPos: THREE.Vector3,
    speedMps: number,
    rainFactor: number,
    fogFactor: number,
    nightFactor: number
  ): void {
    // Update rain streaks
    if (rainFactor > 0.02) {
      this.rainLines.visible = true;
      this.rainMat.opacity = THREE.MathUtils.clamp(rainFactor * (0.48 - nightFactor * 0.12), 0, 0.52);
      this.rainMat.color.setHex(nightFactor > 0.45 ? 0x9fc2e8 : 0xd6eaff);

      const minX = busPos.x - RAIN_BOX_W * 0.5;
      const maxX = busPos.x + RAIN_BOX_W * 0.5;
      const minZ = busPos.z - 16 - RAIN_BOX_D * 0.5;
      const maxZ = busPos.z - 16 + RAIN_BOX_D * 0.5;
      const windVx = -3.4;
      const stretchY = 0.65 + rainFactor * 0.4;
      const stretchZ = THREE.MathUtils.clamp(speedMps * 0.028, -0.45, 0.85);

      for (let i = 0; i < RAIN_DROP_COUNT; i++) {
        const idx = i * 6;
        let x = this.rainPositions[idx] + windVx * delta;
        let y = this.rainPositions[idx + 1] - this.rainSpeeds[i] * delta;
        let z = this.rainPositions[idx + 2];

        if (y < 0.05) {
          y += RAIN_BOX_H;
          x = busPos.x + (Math.random() - 0.5) * RAIN_BOX_W;
          z = busPos.z - 16 + (Math.random() - 0.5) * RAIN_BOX_D;
        }
        if (x < minX) x += RAIN_BOX_W;
        else if (x > maxX) x -= RAIN_BOX_W;
        if (z < minZ) z += RAIN_BOX_D;
        else if (z > maxZ) z -= RAIN_BOX_D;

        this.rainPositions[idx] = x;
        this.rainPositions[idx + 1] = y;
        this.rainPositions[idx + 2] = z;
        this.rainPositions[idx + 3] = x + 0.11;
        this.rainPositions[idx + 4] = y + stretchY;
        this.rainPositions[idx + 5] = z + stretchZ;
      }
      this.rainGeo.attributes.position.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }

    // Update drifting mist banks
    if (fogFactor > 0.02) {
      this.mistPoints.visible = true;
      this.mistMat.opacity = THREE.MathUtils.clamp(fogFactor * (0.28 - nightFactor * 0.11), 0, 0.3);
      this.mistMat.color.setHex(nightFactor > 0.5 ? 0x6c8099 : 0xdfe9f2);

      const minX = busPos.x - MIST_BOX_W * 0.5;
      const maxX = busPos.x + MIST_BOX_W * 0.5;
      const minZ = busPos.z - 24 - MIST_BOX_D * 0.5;
      const maxZ = busPos.z - 24 + MIST_BOX_D * 0.5;

      for (let i = 0; i < MIST_BANK_COUNT; i++) {
        const idx = i * 3;
        let x = this.mistPositions[idx] + this.mistDrifts[i] * delta;
        let z = this.mistPositions[idx + 2];

        if (x < minX) x += MIST_BOX_W;
        else if (x > maxX) x -= MIST_BOX_W;
        if (z < minZ) z += MIST_BOX_D;
        else if (z > maxZ) z -= MIST_BOX_D;

        this.mistPositions[idx] = x;
        this.mistPositions[idx + 2] = z;
      }
      this.mistGeo.attributes.position.needsUpdate = true;
    } else {
      this.mistPoints.visible = false;
    }
  }

  public dispose(): void {
    this.rainGeo.dispose();
    this.rainMat.dispose();
    this.mistGeo.dispose();
    this.mistMat.dispose();
    this.mistTex.dispose();
  }
}
