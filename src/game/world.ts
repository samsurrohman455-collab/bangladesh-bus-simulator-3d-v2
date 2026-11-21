import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { buildRiverAndBridgeSystem } from './riverBridgeBuilder';
import { buildBangladeshiRoadSystem } from './roadBuilder';
import {
  createBambooClusterTexture,
  createBananaLeafTexture,
  createKrishnachuraClusterTexture,
  createLampPoolTexture,
  createLeafClusterTexture,
  createPaddyFieldTexture,
  createPalmFrondTexture,
  createSignBoardTexture,
  createTreeBarkTexture,
} from './textures';
import { RouteConfig, RouteId, RouteStop } from './types';
import { buildUrbanAndRuralBuildings } from './urbanNatureBuilder';
import {
  getRiverBridgeZones,
  getRoadSlopeAngle,
  getRoadY,
  getUrbanZones,
  isInsideBridgeApproach,
  isInsideRiverSpan,
  isInsideUrbanZone,
} from './worldHelpers';

export {
  getRiverBridgeZones,
  getRoadSlopeAngle,
  getRoadY,
  getUrbanZones,
  isInsideBridgeApproach,
  isInsideRiverSpan,
  isInsideUrbanZone,
};

export interface SpeedBreakerZone {
  z: number;
  x: number;
}

export interface TollBarrierRig {
  stop: RouteStop;
  armPivot: THREE.Group;
  paid: boolean;
  openProgress: number;
}

export interface StreetLampSpec {
  x: number;
  y: number;
  z: number;
}

export interface WorldBuildResult {
  group: THREE.Group;
  speedBreakers: SpeedBreakerZone[];
  tollBarriers: TollBarrierRig[];
  streetLampPositions: StreetLampSpec[];
  setLampActivation: (factor: number) => void;
  setWeatherSurface: (rainFactor: number) => void;
  updateDynamicProps: (delta: number, busZ: number) => void;
  dispose: () => void;
}

export function getRoadX(z: number): number {
  return Math.sin(z * 0.0022) * 24 + Math.sin(z * 0.0062) * 8.5;
}

export function getRoadTangentAngle(z: number): number {
  const dz = 0.5;
  const dx = getRoadX(z + dz) - getRoadX(z - dz);
  return Math.atan2(dx, 2 * dz);
}

interface LandInterval {
  zStart: number; // Less negative
  zEnd: number; // More negative
}

function getLandIntervals(startZ: number, endZ: number, routeId: RouteId, riverPad = 0): LandInterval[] {
  const bridges = [...getRiverBridgeZones(routeId)].sort((a, b) => b.zRiverStart - a.zRiverStart);
  const intervals: LandInterval[] = [];
  let cursor = startZ;

  for (const b of bridges) {
    const cutStart = b.zRiverStart + riverPad;
    const cutEnd = b.zRiverEnd - riverPad;
    if (cursor > cutStart) {
      intervals.push({ zStart: cursor, zEnd: cutStart });
    }
    cursor = Math.min(cursor, cutEnd);
  }
  if (cursor > endZ) {
    intervals.push({ zStart: cursor, zEnd: endZ });
  }
  return intervals;
}

function createVillageShop(
  titleBn: string,
  subText: string,
  awningHex: string,
  maxAnisotropy: number,
  shopLampMat: THREE.MeshStandardMaterial
): THREE.Group {
  const shop = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.BoxGeometry(5.6, 0.35, 4.2),
    new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 })
  );
  base.position.y = 0.175;
  base.receiveShadow = true;
  shop.add(base);

  const walls = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 2.5, 3.6),
    new THREE.MeshStandardMaterial({ color: 0xd6b88d, roughness: 0.85 })
  );
  walls.position.y = 1.6;
  walls.castShadow = true;
  walls.receiveShadow = true;
  shop.add(walls);

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(6.0, 0.14, 4.4),
    new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.55, metalness: 0.55 })
  );
  roof.position.set(0, 3.05, 0);
  roof.rotation.x = 0.12;
  roof.castShadow = true;
  shop.add(roof);

  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(5.4, 0.08, 1.3),
    new THREE.MeshStandardMaterial({ color: awningHex, roughness: 0.7 })
  );
  awning.position.set(0, 2.32, 2.2);
  awning.rotation.x = 0.28;
  shop.add(awning);

  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), shopLampMat);
  bulb.position.set(0, 2.08, 2.35);
  shop.add(bulb);

  const bench = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.45, 0.55),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
  );
  bench.position.set(-1.1, 0.55, 2.25);
  shop.add(bench);

  const signTex = createSignBoardTexture(titleBn, subText, '#fef3c7', '#1e293b', awningHex, maxAnisotropy);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 1.1),
    new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5 })
  );
  sign.position.set(0, 3.55, 1.85);
  shop.add(sign);

  return shop;
}

function createWaitingPerson(shirtColor: number, lungiColor: number): THREE.Group {
  const person = new THREE.Group();
  const legs = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.18, 0.82, 8),
    new THREE.MeshStandardMaterial({ color: lungiColor, roughness: 0.85 })
  );
  legs.position.y = 0.41;
  legs.castShadow = true;

  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.16, 0.62, 8),
    new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.8 })
  );
  torso.position.y = 1.12;
  torso.castShadow = true;

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 10),
    new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.75 })
  );
  head.position.y = 1.56;
  head.castShadow = true;

  person.add(legs, torso, head);
  return person;
}

export function buildBangladeshiWorld(
  route: RouteConfig,
  maxAnisotropy: number
): WorldBuildResult {
  const group = new THREE.Group();
  const speedBreakers: SpeedBreakerZone[] = [];
  const tollBarriers: TollBarrierRig[] = [];
  const streetLampPositions: StreetLampSpec[] = [];
  let elapsedSec = 0;

  const shopLampMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.06,
    roughness: 0.3,
  });
  const canopyLightMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    emissive: 0xfef08a,
    emissiveIntensity: 0.15,
    roughness: 0.25,
  });

  const roadWidth = 12.6;
  const shoulderExtra = 2.6;

  // 1. Segmented Vast Lush Green Paddy Field Ground Planes (cut cleanly around river crossings!)
  const landStartZ = 350;
  const landEndZ = -(route.totalLengthM + 350);
  const landIntervals = getLandIntervals(landStartZ, landEndZ, route.id, 18);
  const paddyTex = createPaddyFieldTexture(maxAnisotropy);
  const groundMat = new THREE.MeshStandardMaterial({
    map: paddyTex,
    roughness: 0.94,
    metalness: 0.02,
  });
  const groundGeos: THREE.BufferGeometry[] = [];

  for (const iv of landIntervals) {
    const spanLen = iv.zStart - iv.zEnd;
    if (spanLen <= 4) continue;
    const gGeo = new THREE.PlaneGeometry(540, spanLen);
    gGeo.rotateX(-Math.PI / 2);
    // Scale UVs proportionally so paddy plot sizes stay uniform across segments
    const uv = gGeo.attributes.uv;
    const yScale = spanLen / (route.totalLengthM + 700);
    for (let i = 0; i < uv.count; i++) {
      uv.setY(i, uv.getY(i) * yScale);
    }
    const gMesh = new THREE.Mesh(gGeo, groundMat);
    gMesh.position.set(0, -0.34, (iv.zStart + iv.zEnd) * 0.5);
    gMesh.receiveShadow = true;
    groundGeos.push(gGeo);
    group.add(gMesh);
  }

  // 2. Multi-Zone Bangladeshi Road Surfaces, Shoulders, Drainage Ditches, Markings & Repair Zones
  const roadSystem = buildBangladeshiRoadSystem(
    route,
    roadWidth,
    shoulderExtra,
    maxAnisotropy,
    getRoadX,
    getRoadTangentAngle,
    getRiverBridgeZones(route.id)
  );
  group.add(roadSystem.group);

  // 2a. Iconic Real Jamuna Multipurpose Bridge & Wide Flowing Jamuna River (plus Meghna/Bhairab crossings)
  const riverBridgeResult = buildRiverAndBridgeSystem(
    route.id,
    roadWidth,
    maxAnisotropy,
    getRoadX,
    getRoadTangentAngle
  );
  group.add(riverBridgeResult.group);

  // 2b. Realistic Bangladeshi Cities, Towns & Rural Village Tin-Shed Homesteads
  const urbanRuralResult = buildUrbanAndRuralBuildings(
    route,
    roadWidth,
    maxAnisotropy,
    getRoadX,
    getRoadTangentAngle
  );
  group.add(urbanRuralResult.group);

  // 2c. Shimmering Roadside Canals & Water-Hyacinth Ponds (খাল / পুকুর / বিল ও কচুরিপানা) on rural segments
  const canalMat = new THREE.MeshStandardMaterial({
    color: 0x24594e,
    roughness: 0.14,
    metalness: 0.36,
  });
  const canalGeo = new THREE.PlaneGeometry(7.5, 110);
  canalGeo.rotateX(-Math.PI / 2);
  for (let z = -280; z >= -(route.totalLengthM - 200); z -= 440) {
    if (isInsideBridgeApproach(z, route.id, 65) || isInsideUrbanZone(z, route.id)) continue;
    const side = (Math.abs(z) / 440) % 2 === 0 ? -1 : 1;
    const cx = getRoadX(z);
    const angle = getRoadTangentAngle(z);
    const canal = new THREE.Mesh(canalGeo, canalMat);
    canal.position.set(cx + side * 16.5, -0.29, z);
    canal.rotation.y = angle;
    canal.receiveShadow = true;
    group.add(canal);
  }

  // Water-hyacinth (কচুরিপানা) green mat clusters & earthen pond banks in rural wetlands
  const hyacinthSpecs: { x: number; z: number; sx: number; sz: number; rotY: number }[] = [];
  const kilnSpecs: { x: number; z: number; rotY: number; scale: number }[] = [];
  const hillMoundSpecs: { x: number; z: number; rx: number; ry: number; rz: number }[] = [];

  for (let z = -220; z >= -(route.totalLengthM - 220); z -= 290) {
    if (isInsideBridgeApproach(z, route.id, 55) || isInsideUrbanZone(z, route.id)) continue;
    const seed = Math.abs(Math.round(z));
    const side = seed % 2 === 0 ? -1 : 1;
    const cx = getRoadX(z);
    // Water-hyacinth floating mats inside canals/low-lying ditches
    for (let h = 0; h < 3; h++) {
      hyacinthSpecs.push({
        x: cx + side * (15.0 + (h - 1) * 1.4),
        z: z - 24 + h * 22,
        sx: 2.2 + ((seed + h) % 3) * 0.7,
        sz: 3.1 + ((seed + h) % 2) * 1.1,
        rotY: (seed + h) * 0.9,
      });
    }
    // Traditional Bangladeshi brick kilns (ইটের ভাটা) in outer paddy plains
    if (seed % 580 < 290 && z < -450) {
      const kilnSide = -side;
      kilnSpecs.push({
        x: cx + kilnSide * (56 + (seed % 26)),
        z: z - 20,
        rotY: (seed % 6) * 0.5,
        scale: 0.9 + (seed % 3) * 0.14,
      });
    }
    // Regional tea hills (Sylhet), coastal hills (Cox's Bazar), or Sal forest mounds (Mymensingh)
    if (route.id === 'sylhet' && z < -1100) {
      hillMoundSpecs.push({
        x: cx + side * (36 + (seed % 20)),
        z: z - 10,
        rx: 22 + (seed % 9),
        ry: 6.5 + (seed % 5),
        rz: 28 + (seed % 11),
      });
    } else if (route.id === 'coxsbazar' && z < -2700) {
      hillMoundSpecs.push({
        x: cx + side * (42 + (seed % 22)),
        z: z - 15,
        rx: 26 + (seed % 10),
        ry: 9.5 + (seed % 6),
        rz: 34 + (seed % 12),
      });
    }
  }

  const hyacinthGeo = new THREE.CylinderGeometry(1.0, 1.1, 0.12, 9);
  const hyacinthMat = new THREE.MeshStandardMaterial({ color: 0x3f7d20, roughness: 0.88 });
  const hyacinthInst = new THREE.InstancedMesh(hyacinthGeo, hyacinthMat, Math.max(1, hyacinthSpecs.length));
  hyacinthInst.visible = hyacinthSpecs.length > 0;
  {
    const hDummy = new THREE.Object3D();
    const hCol = new THREE.Color();
    for (let i = 0; i < hyacinthSpecs.length; i++) {
      const hs = hyacinthSpecs[i];
      hDummy.position.set(hs.x, -0.26, hs.z);
      hDummy.rotation.set(0, hs.rotY, 0);
      hDummy.scale.set(hs.sx, 1, hs.sz);
      hDummy.updateMatrix();
      hyacinthInst.setMatrixAt(i, hDummy.matrix);
      hCol.setHSL(0.26 + (i % 3) * 0.02, 0.52, 0.31 + (i % 4) * 0.03);
      hyacinthInst.setColorAt(i, hCol);
    }
    hyacinthInst.instanceMatrix.needsUpdate = true;
    if (hyacinthInst.instanceColor) hyacinthInst.instanceColor.needsUpdate = true;
    hyacinthInst.computeBoundingSphere();
    group.add(hyacinthInst);
  }

  // Brick kiln (ইটের ভাটা) instanced chimney + oven mound
  const kilnChimneyGeo = new THREE.CylinderGeometry(0.95, 2.25, 22, 10);
  kilnChimneyGeo.translate(0, 11, 0);
  const kilnMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.92 });
  const kilnBaseGeo = new THREE.CylinderGeometry(8.5, 11.0, 3.2, 12);
  kilnBaseGeo.translate(0, 1.4, 0);
  const kilnBaseMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.95 });
  const kilnChimneys = new THREE.InstancedMesh(kilnChimneyGeo, kilnMat, Math.max(1, kilnSpecs.length));
  const kilnBases = new THREE.InstancedMesh(kilnBaseGeo, kilnBaseMat, Math.max(1, kilnSpecs.length));
  kilnChimneys.visible = kilnSpecs.length > 0;
  kilnBases.visible = kilnSpecs.length > 0;
  {
    const kDummy = new THREE.Object3D();
    for (let i = 0; i < kilnSpecs.length; i++) {
      const ks = kilnSpecs[i];
      kDummy.position.set(ks.x, -0.34, ks.z);
      kDummy.rotation.set(0, ks.rotY, 0);
      kDummy.scale.set(ks.scale, ks.scale, ks.scale);
      kDummy.updateMatrix();
      kilnChimneys.setMatrixAt(i, kDummy.matrix);
      kilnBases.setMatrixAt(i, kDummy.matrix);
    }
    kilnChimneys.instanceMatrix.needsUpdate = true;
    kilnBases.instanceMatrix.needsUpdate = true;
    kilnChimneys.computeBoundingSphere();
    kilnBases.computeBoundingSphere();
    group.add(kilnBases, kilnChimneys);
  }

  // Regional lush green tea-garden hills / Chattogram hillocks (টিলা ও পাহাড়)
  const hillGeo = new THREE.SphereGeometry(1, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5);
  const hillMat = new THREE.MeshStandardMaterial({
    color: route.id === 'sylhet' ? 0x2f6e27 : 0x2b5d2b,
    roughness: 0.92,
  });
  const hillInst = new THREE.InstancedMesh(hillGeo, hillMat, Math.max(1, hillMoundSpecs.length));
  hillInst.visible = hillMoundSpecs.length > 0;
  {
    const mDummy = new THREE.Object3D();
    const mCol = new THREE.Color();
    for (let i = 0; i < hillMoundSpecs.length; i++) {
      const hm = hillMoundSpecs[i];
      mDummy.position.set(hm.x, -0.4, hm.z);
      mDummy.rotation.set(0, (i * 0.7) % Math.PI, 0);
      mDummy.scale.set(hm.rx, hm.ry, hm.rz);
      mDummy.updateMatrix();
      hillInst.setMatrixAt(i, mDummy.matrix);
      mCol.setHSL(route.id === 'sylhet' ? 0.28 : 0.3, 0.48, 0.28 + (i % 3) * 0.04);
      hillInst.setColorAt(i, mCol);
    }
    hillInst.instanceMatrix.needsUpdate = true;
    if (hillInst.instanceColor) hillInst.instanceColor.needsUpdate = true;
    hillInst.computeBoundingSphere();
    group.add(hillInst);
  }

  // 3. Realistic Bangladeshi Trees & Foliage (Coconut Palms, Mango/Banyan, Krishnachura, Bamboo, Banana)
  const toMergeable = (g: THREE.BufferGeometry): THREE.BufferGeometry => {
    const nonIdx = g.index ? g.toNonIndexed() : g.clone();
    g.dispose();
    return nonIdx;
  };

  // 3a. Curved Coconut/Palm Trunk + 11-Frond Arching Crown
  const buildRealisticPalmTrunkGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    const segs = 6;
    const totalH = 9.4;
    const segH = totalH / segs;
    let curX = 0;
    let curY = 0;
    for (let s = 0; s < segs; s++) {
      const t0 = s / segs;
      const t1 = (s + 1) / segs;
      const rBot = THREE.MathUtils.lerp(s === 0 ? 0.34 : 0.25, 0.14, t0);
      const rTop = THREE.MathUtils.lerp(0.25, 0.13, t1);
      const tilt = 0.04 + t0 * 0.14;
      const seg = new THREE.CylinderGeometry(rTop, rBot, segH + 0.08, 8, 1);
      seg.translate(0, segH * 0.5, 0);
      seg.rotateZ(-tilt);
      seg.translate(curX, curY, 0);
      parts.push(toMergeable(seg));
      curX += Math.sin(tilt) * segH;
      curY += Math.cos(tilt) * segH;
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  const buildRealisticPalmCrownGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    const hubX = 0.82;
    const hubY = 9.25;
    const makeFrond = (yaw: number, pitchOut: number, length: number, width: number, droop: number) => {
      const frond = new THREE.PlaneGeometry(width, length, 1, 7);
      frond.translate(0, length * 0.5, 0);
      const pos = frond.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const py = pos.getY(v);
        const t = py / length;
        const reach = t * length * Math.cos(pitchOut);
        const rise = t * length * Math.sin(pitchOut) - droop * t * t;
        pos.setY(v, rise);
        pos.setZ(v, reach);
      }
      frond.computeVertexNormals();
      frond.rotateY(yaw);
      frond.translate(hubX, hubY, 0);
      return toMergeable(frond);
    };

    for (let f = 0; f < 7; f++) {
      const yaw = (f / 7) * Math.PI * 2 + (f % 2) * 0.14;
      parts.push(makeFrond(yaw, 0.42 + (f % 2) * 0.1, 4.1, 1.45, 2.25));
    }
    for (let f = 0; f < 4; f++) {
      const yaw = (f / 4) * Math.PI * 2 + 0.35;
      parts.push(makeFrond(yaw, 0.88, 3.3, 1.25, 1.35));
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  // 3b. Branched Gnarled Bangladeshi Shade Tree (Mango / Koroi / Krishnachura)
  const buildRealisticShadeTrunkGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    const rootFlare = new THREE.CylinderGeometry(0.42, 0.68, 0.9, 8);
    rootFlare.translate(0, 0.45, 0);
    parts.push(toMergeable(rootFlare));

    const trunk = new THREE.CylinderGeometry(0.3, 0.44, 3.4, 8);
    trunk.translate(0, 2.0, 0);
    trunk.rotateZ(0.05);
    parts.push(toMergeable(trunk));

    const limbs = [
      { yaw: 0.2, tilt: 0.62, len: 2.8, r0: 0.22, r1: 0.1 },
      { yaw: 1.85, tilt: 0.56, len: 2.9, r0: 0.21, r1: 0.1 },
      { yaw: 3.45, tilt: 0.65, len: 2.7, r0: 0.2, r1: 0.09 },
      { yaw: 5.0, tilt: 0.52, len: 2.6, r0: 0.19, r1: 0.09 },
    ];
    for (const lb of limbs) {
      const branch = new THREE.CylinderGeometry(lb.r1, lb.r0, lb.len, 6);
      branch.translate(0, lb.len * 0.5, 0);
      branch.rotateZ(lb.tilt);
      branch.rotateY(lb.yaw);
      branch.translate(-0.14, 3.25, 0);
      parts.push(toMergeable(branch));
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  const buildRealisticShadeCanopyGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    const clusterCenters = [
      [0, 6.2, 0, 3.5],
      [1.8, 5.1, 0.5, 3.1],
      [-1.9, 5.0, -0.4, 3.1],
      [0.4, 5.2, 1.8, 3.0],
      [-0.5, 5.1, -1.8, 3.0],
      [1.1, 5.9, -1.2, 2.8],
      [-1.2, 5.8, 1.2, 2.8],
    ];
    for (let c = 0; c < clusterCenters.length; c++) {
      const [cx, cy, cz, sz] = clusterCenters[c];
      for (let k = 0; k < 3; k++) {
        const card = new THREE.PlaneGeometry(sz, sz);
        card.rotateY(c * 0.7 + k * (Math.PI / 3));
        card.rotateX((k === 2 ? 1.15 : 0.32) * (k % 2 === 0 ? 1 : -1));
        card.translate(cx, cy, cz);
        parts.push(toMergeable(card));
      }
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  // 3c. Bamboo Clump Culms & Feathery Crown (বাঁশঝাড়)
  const buildBambooClumpCulmGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    for (let b = 0; b < 5; b++) {
      const a = (b / 5) * Math.PI * 2;
      const culm = new THREE.CylinderGeometry(0.055, 0.085, 8.6, 6);
      culm.translate(0, 4.3, 0);
      culm.rotateZ(0.14 + (b % 2) * 0.06);
      culm.rotateY(a);
      culm.translate(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
      parts.push(toMergeable(culm));
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  const buildBambooCanopyGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    for (let c = 0; c < 4; c++) {
      const a = (c / 4) * Math.PI * 2 + 0.4;
      const card = new THREE.PlaneGeometry(4.2, 4.2);
      card.rotateY(a);
      card.rotateX(0.35);
      card.translate(Math.cos(a) * 0.9, 6.9 + (c % 2) * 0.8, Math.sin(a) * 0.9);
      parts.push(toMergeable(card));
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  const barkTex = createTreeBarkTexture(maxAnisotropy);
  const palmFrondTex = createPalmFrondTexture(maxAnisotropy);
  const leafClusterTex = createLeafClusterTexture(maxAnisotropy);
  const krishnachuraTex = createKrishnachuraClusterTexture(maxAnisotropy);
  const bambooTex = createBambooClusterTexture(maxAnisotropy);

  const dummy = new THREE.Object3D();
  const colorVar = new THREE.Color();

  // Helper to filter out river water / approach banks & urban sidewalks
  const getValidTreeOffset = (z: number, baseMin: number, spread: number, seed: number): number => {
    const urban = isInsideUrbanZone(z, route.id);
    // In cities, push trees behind sidewalks/near alleys so buildings aren't hidden behind jungle
    const minDist = urban ? roadWidth * 0.5 + 3.8 : baseMin;
    const maxSpan = urban ? 4.5 : spread;
    return minDist + (Math.sin(seed * 17.3) * 0.5 + 0.5) * maxSpan;
  };

  // Palms (extra lush in southern delta Barishal/Khulna/Cox's Bazar)
  const palmCount =
    route.id === 'barishal' || route.id === 'khulna' || route.id === 'coxsbazar' ? 340 : 290;
  const palmSpecs: { x: number; z: number; s: number; rotY: number; lean: number; i: number }[] = [];
  for (let i = 0; i < palmCount; i++) {
    const z = 80 - (i / palmCount) * (route.totalLengthM + 200);
    if (isInsideRiverSpan(z, route.id, 18)) continue;
    const side = i % 2 === 0 ? -1 : 1;
    const distFromRoad = getValidTreeOffset(z, 10.5, 50, i);
    const x = getRoadX(z) + side * distFromRoad;
    const s = 0.84 + ((i * 37) % 100) * 0.0032;
    palmSpecs.push({ x, z, s, rotY: (i * 1.7) % (Math.PI * 2), lean: Math.sin(i) * 0.04, i });
  }

  const trunkGeo = buildRealisticPalmTrunkGeo();
  const trunkMat = new THREE.MeshStandardMaterial({ map: barkTex, roughness: 0.94 });
  const palmTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmSpecs.length);
  palmTrunks.castShadow = true;

  const crownGeo = buildRealisticPalmCrownGeo();
  const crownMat = new THREE.MeshStandardMaterial({
    map: palmFrondTex,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.74,
  });
  const palmDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: palmFrondTex,
    alphaTest: 0.36,
  });
  const palmCrowns = new THREE.InstancedMesh(crownGeo, crownMat, palmSpecs.length);
  palmCrowns.castShadow = true;
  palmCrowns.customDepthMaterial = palmDepthMat;

  for (let idx = 0; idx < palmSpecs.length; idx++) {
    const p = palmSpecs[idx];
    dummy.position.set(p.x, -0.25, p.z);
    dummy.rotation.set(p.lean, p.rotY, 0);
    dummy.scale.set(p.s, p.s, p.s);
    dummy.updateMatrix();
    palmTrunks.setMatrixAt(idx, dummy.matrix);
    palmCrowns.setMatrixAt(idx, dummy.matrix);
    colorVar.setHSL(0.27 + (p.i % 5) * 0.015, 0.25, 0.88 + (p.i % 4) * 0.04);
    palmCrowns.setColorAt(idx, colorVar);
  }
  palmTrunks.instanceMatrix.needsUpdate = true;
  palmCrowns.instanceMatrix.needsUpdate = true;
  if (palmCrowns.instanceColor) palmCrowns.instanceColor.needsUpdate = true;
  palmTrunks.computeBoundingSphere();
  palmCrowns.computeBoundingSphere();

  // Mango / Koroi Shade Trees + Vibrant Krishnachura Trees + Highway Avenue Painted-Trunk Trees
  const shadeCount = route.id === 'rajshahi' || route.id === 'mymensingh' ? 290 : 245;
  const shadeSpecs: { x: number; z: number; s: number; rotY: number; i: number; avenuePainted: boolean }[] = [];
  const krishnaSpecs: { x: number; z: number; s: number; rotY: number; i: number }[] = [];

  // Iconic Bangladeshi highway avenue shade trees close to the shoulders with white-and-red painted trunks
  for (let z = -120; z >= -(route.totalLengthM - 120); z -= 48) {
    if (isInsideBridgeApproach(z, route.id, 18) || isInsideUrbanZone(z, route.id)) continue;
    if (route.stops.some((s) => Math.abs(s.z - z) < 32)) continue;
    const idx = Math.abs(Math.round(z / 48));
    const side = idx % 2 === 0 ? -1 : 1;
    const angle = getRoadTangentAngle(z);
    const lat = side * (roadWidth * 0.5 + 4.9 + (idx % 3) * 0.65);
    const x = getRoadX(z) + Math.cos(angle) * lat;
    const pz = z - Math.sin(angle) * lat;
    const s = 0.94 + (idx % 4) * 0.07;
    shadeSpecs.push({ x, z: pz, s, rotY: (idx * 1.37) % (Math.PI * 2), i: idx, avenuePainted: true });
  }

  for (let i = 0; i < shadeCount; i++) {
    const z = 60 - (i / shadeCount) * (route.totalLengthM + 180);
    if (isInsideRiverSpan(z, route.id, 18)) continue;
    const urban = isInsideUrbanZone(z, route.id);
    if (urban && i % 3 !== 0) continue; // Keep urban views cleaner around shops/buildings
    const side = i % 2 === 0 ? 1 : -1;
    const distFromRoad = urban ? roadWidth * 0.5 + 4.4 : 14 + ((i * 53) % 72);
    const x = getRoadX(z) + side * distFromRoad;
    const s = 0.82 + ((i * 29) % 45) * 0.011;
    const entry = { x, z, s, rotY: (i * 2.1) % (Math.PI * 2), i, avenuePainted: false };
    if (i % 5 === 0) {
      krishnaSpecs.push(entry);
    } else {
      shadeSpecs.push(entry);
    }
  }

  const shadeTrunkGeo = buildRealisticShadeTrunkGeo();
  const shadeTrunks = new THREE.InstancedMesh(shadeTrunkGeo, trunkMat, shadeSpecs.length);
  shadeTrunks.castShadow = true;

  const canopyGeo = buildRealisticShadeCanopyGeo();
  const canopyMat = new THREE.MeshStandardMaterial({
    map: leafClusterTex,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.82,
  });
  const shadeDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: leafClusterTex,
    alphaTest: 0.4,
  });
  const shadeCanopies = new THREE.InstancedMesh(canopyGeo, canopyMat, shadeSpecs.length);
  shadeCanopies.castShadow = true;
  shadeCanopies.customDepthMaterial = shadeDepthMat;

  // White-and-red painted trunk collars (বাংলাদেশের মহাসড়কের গাছের গোড়ায় সাদা-লাল রঙ)
  const avenueTrees = shadeSpecs.filter((s) => s.avenuePainted);
  const treeCollarWhiteGeo = new THREE.CylinderGeometry(0.39, 0.48, 0.82, 8);
  treeCollarWhiteGeo.translate(0, 0.92, 0);
  const treeCollarWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
  const treeCollarWhite = new THREE.InstancedMesh(
    treeCollarWhiteGeo,
    treeCollarWhiteMat,
    Math.max(1, avenueTrees.length)
  );
  treeCollarWhite.visible = avenueTrees.length > 0;

  const treeCollarRedGeo = new THREE.CylinderGeometry(0.41, 0.44, 0.28, 8);
  treeCollarRedGeo.translate(0, 0.92, 0);
  const treeCollarRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.78 });
  const treeCollarRed = new THREE.InstancedMesh(
    treeCollarRedGeo,
    treeCollarRedMat,
    Math.max(1, avenueTrees.length)
  );
  treeCollarRed.visible = avenueTrees.length > 0;

  let avIdx = 0;
  for (let idx = 0; idx < shadeSpecs.length; idx++) {
    const t = shadeSpecs[idx];
    dummy.position.set(t.x, -0.25, t.z);
    dummy.rotation.set(0, t.rotY, 0);
    dummy.scale.set(t.s, t.s, t.s);
    dummy.updateMatrix();
    shadeTrunks.setMatrixAt(idx, dummy.matrix);
    shadeCanopies.setMatrixAt(idx, dummy.matrix);
    if (t.avenuePainted && avIdx < avenueTrees.length) {
      treeCollarWhite.setMatrixAt(avIdx, dummy.matrix);
      treeCollarRed.setMatrixAt(avIdx, dummy.matrix);
      avIdx++;
    }
    colorVar.setHSL(0.28 + (t.i % 6) * 0.015, 0.22, 0.85 + (t.i % 5) * 0.04);
    shadeCanopies.setColorAt(idx, colorVar);
  }
  shadeTrunks.instanceMatrix.needsUpdate = true;
  shadeCanopies.instanceMatrix.needsUpdate = true;
  if (shadeCanopies.instanceColor) shadeCanopies.instanceColor.needsUpdate = true;
  shadeTrunks.computeBoundingSphere();
  shadeCanopies.computeBoundingSphere();
  treeCollarWhite.instanceMatrix.needsUpdate = true;
  treeCollarRed.instanceMatrix.needsUpdate = true;
  treeCollarWhite.computeBoundingSphere();
  treeCollarRed.computeBoundingSphere();

  // Fiery Krishnachura Highway Blossom Trees (কৃষ্ণচূড়া)
  const krishnaTrunks = new THREE.InstancedMesh(shadeTrunkGeo, trunkMat, Math.max(1, krishnaSpecs.length));
  krishnaTrunks.castShadow = true;
  const krishnaMat = new THREE.MeshStandardMaterial({
    map: krishnachuraTex,
    alphaTest: 0.4,
    side: THREE.DoubleSide,
    roughness: 0.8,
  });
  const krishnaDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking,
    map: krishnachuraTex,
    alphaTest: 0.4,
  });
  const krishnaCanopies = new THREE.InstancedMesh(canopyGeo, krishnaMat, Math.max(1, krishnaSpecs.length));
  krishnaCanopies.castShadow = true;
  krishnaCanopies.customDepthMaterial = krishnaDepthMat;

  for (let idx = 0; idx < krishnaSpecs.length; idx++) {
    const k = krishnaSpecs[idx];
    dummy.position.set(k.x, -0.25, k.z);
    dummy.rotation.set(0, k.rotY, 0);
    dummy.scale.set(k.s, k.s, k.s);
    dummy.updateMatrix();
    krishnaTrunks.setMatrixAt(idx, dummy.matrix);
    krishnaCanopies.setMatrixAt(idx, dummy.matrix);
  }
  krishnaTrunks.instanceMatrix.needsUpdate = true;
  krishnaCanopies.instanceMatrix.needsUpdate = true;
  krishnaTrunks.computeBoundingSphere();
  krishnaCanopies.computeBoundingSphere();

  // Lush Bangladeshi Bamboo Groves (বাঁশঝাড়)
  const bambooSpecs: { x: number; z: number; s: number; rotY: number }[] = [];
  for (let i = 0; i < 85; i++) {
    const z = -180 - (i / 85) * (route.totalLengthM - 240);
    if (isInsideRiverSpan(z, route.id, 22) || isInsideUrbanZone(z, route.id)) continue;
    const side = i % 2 === 0 ? -1 : 1;
    const dist = 16 + ((i * 41) % 34);
    bambooSpecs.push({ x: getRoadX(z) + side * dist, z, s: 0.88 + (i % 4) * 0.1, rotY: i * 1.4 });
  }
  const bambooCulmGeo = buildBambooClumpCulmGeo();
  const bambooCulmMat = new THREE.MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.72 });
  const bambooCulms = new THREE.InstancedMesh(bambooCulmGeo, bambooCulmMat, Math.max(1, bambooSpecs.length));
  const bambooLeafGeo = buildBambooCanopyGeo();
  const bambooLeafMat = new THREE.MeshStandardMaterial({
    map: bambooTex,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.78,
  });
  const bambooLeaves = new THREE.InstancedMesh(bambooLeafGeo, bambooLeafMat, Math.max(1, bambooSpecs.length));
  for (let idx = 0; idx < bambooSpecs.length; idx++) {
    const bm = bambooSpecs[idx];
    dummy.position.set(bm.x, -0.34, bm.z);
    dummy.rotation.set(0, bm.rotY, 0);
    dummy.scale.set(bm.s, bm.s, bm.s);
    dummy.updateMatrix();
    bambooCulms.setMatrixAt(idx, dummy.matrix);
    bambooLeaves.setMatrixAt(idx, dummy.matrix);
  }
  bambooCulms.instanceMatrix.needsUpdate = true;
  bambooLeaves.instanceMatrix.needsUpdate = true;
  bambooCulms.computeBoundingSphere();
  bambooLeaves.computeBoundingSphere();

  group.add(
    palmTrunks,
    palmCrowns,
    shadeTrunks,
    shadeCanopies,
    treeCollarWhite,
    treeCollarRed,
    krishnaTrunks,
    krishnaCanopies,
    bambooCulms,
    bambooLeaves
  );

  // 4. Bangladeshi White-and-Black Concrete Road Guard Pillars & Electric Poles (skip bridges!)
  const guidePlacements: { x: number; y: number; z: number; angle: number }[] = [];
  const totalGuidePairs = Math.floor(route.totalLengthM / 28);
  for (let pairIdx = 0; pairIdx < totalGuidePairs; pairIdx++) {
    const z = 40 - pairIdx * 28;
    if (isInsideBridgeApproach(z, route.id, 4)) continue;
    const cx = getRoadX(z);
    const angle = getRoadTangentAngle(z);
    for (const side of [-1, 1] as const) {
      const offset = side * (roadWidth * 0.5 + 1.05);
      guidePlacements.push({
        x: cx + Math.cos(angle) * offset,
        y: -0.02,
        z: z - Math.sin(angle) * offset,
        angle,
      });
    }
  }

  const guidePostGeo = new THREE.CylinderGeometry(0.11, 0.13, 0.88, 8);
  guidePostGeo.translate(0, 0.44, 0);
  const guidePostMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const guidePosts = new THREE.InstancedMesh(guidePostGeo, guidePostMat, Math.max(1, guidePlacements.length));

  const reflectorGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.24, 8);
  reflectorGeo.translate(0, 0.76, 0);
  const reflectorMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.7 });
  const guideReflectors = new THREE.InstancedMesh(reflectorGeo, reflectorMat, Math.max(1, guidePlacements.length));

  for (let i = 0; i < guidePlacements.length; i++) {
    const gp = guidePlacements[i];
    dummy.position.set(gp.x, gp.y, gp.z);
    dummy.rotation.set(0, gp.angle, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    guidePosts.setMatrixAt(i, dummy.matrix);
    guideReflectors.setMatrixAt(i, dummy.matrix);
  }
  guidePosts.instanceMatrix.needsUpdate = true;
  guideReflectors.instanceMatrix.needsUpdate = true;
  guidePosts.computeBoundingSphere();
  guideReflectors.computeBoundingSphere();
  group.add(guidePosts, guideReflectors);

  // 4a-extra. Concrete Rural Electric Poles (বিদ্যুতের খুঁটি) & Overhead Sagging Wires
  const poleSpecs: { x: number; z: number; angle: number }[] = [];
  const rawPoleCount = Math.floor(route.totalLengthM / 80);
  for (let i = 0; i < rawPoleCount; i++) {
    const z = 20 - i * 80;
    if (isInsideBridgeApproach(z, route.id, 10)) continue;
    const cx = getRoadX(z);
    const angle = getRoadTangentAngle(z);
    const offset = roadWidth * 0.5 + 3.4;
    poleSpecs.push({ x: cx + Math.cos(angle) * offset, z: z - Math.sin(angle) * offset, angle });
  }
  const electricPoleGeo = new THREE.CylinderGeometry(0.1, 0.16, 7.6, 8);
  electricPoleGeo.translate(0, 3.8, 0);
  const electricPoleMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 });
  const electricPoles = new THREE.InstancedMesh(electricPoleGeo, electricPoleMat, Math.max(1, poleSpecs.length));

  const crossArmGeo = new THREE.BoxGeometry(1.4, 0.1, 0.1);
  crossArmGeo.translate(0, 7.1, 0);
  const electricArms = new THREE.InstancedMesh(crossArmGeo, electricPoleMat, Math.max(1, poleSpecs.length));

  for (let i = 0; i < poleSpecs.length; i++) {
    const ep = poleSpecs[i];
    dummy.position.set(ep.x, -0.18, ep.z);
    dummy.rotation.set(0, ep.angle, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    electricPoles.setMatrixAt(i, dummy.matrix);
    electricArms.setMatrixAt(i, dummy.matrix);
  }
  electricPoles.instanceMatrix.needsUpdate = true;
  electricArms.instanceMatrix.needsUpdate = true;
  electricPoles.computeBoundingSphere();
  electricArms.computeBoundingSphere();
  group.add(electricPoles, electricArms);

  // Overhead catenary rural power wires spanning consecutive concrete poles
  const wireVerts: number[] = [];
  for (let i = 0; i < poleSpecs.length - 1; i++) {
    const a = poleSpecs[i];
    const b = poleSpecs[i + 1];
    if (Math.abs(a.z - b.z) > 105) continue; // Don't string wires across river bridges
    for (const armSide of [-0.52, 0.52]) {
      const ax = a.x + Math.cos(a.angle) * armSide;
      const az = a.z - Math.sin(a.angle) * armSide;
      const bx = b.x + Math.cos(b.angle) * armSide;
      const bz = b.z - Math.sin(b.angle) * armSide;
      const mx = (ax + bx) * 0.5;
      const mz = (az + bz) * 0.5;
      wireVerts.push(ax, 6.95, az, mx, 6.22, mz);
      wireVerts.push(mx, 6.22, mz, bx, 6.95, bz);
    }
  }
  const powerWireGeo = new THREE.BufferGeometry();
  powerWireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wireVerts, 3));
  const powerWireMat = new THREE.LineBasicMaterial({ color: 0x1e293b, transparent: true, opacity: 0.72 });
  const powerWires = new THREE.LineSegments(powerWireGeo, powerWireMat);
  group.add(powerWires);

  // 4a-lamps: Instanced Highway + Bridge Gooseneck Street Lamps + Warm Ground Pools
  const lampPoolTex = createLampPoolTexture(maxAnisotropy);
  const lampTransforms: { poleX: number; poleY: number; poleZ: number; rotY: number; x: number; y: number; z: number }[] = [];

  for (let z = -30; z >= -(route.totalLengthM + 80); z -= 105) {
    if (isInsideBridgeApproach(z, route.id, 8)) continue;
    const side = lampTransforms.length % 2 === 0 ? -1 : 1;
    const cx = getRoadX(z);
    const angle = getRoadTangentAngle(z);
    const offset = side * (roadWidth * 0.5 + 1.45);
    const poleX = cx + Math.cos(angle) * offset;
    const poleZ = z - Math.sin(angle) * offset;
    const rotY = angle + (side === 1 ? Math.PI : 0);
    lampTransforms.push({
      poleX,
      poleY: 0,
      poleZ,
      rotY,
      x: poleX + Math.cos(rotY) * 1.82,
      y: 5.9,
      z: poleZ - Math.sin(rotY) * 1.82,
    });
  }
  for (const stop of route.stops) {
    for (const dz of [9, -9]) {
      const z = stop.z + dz;
      const cx = getRoadX(z);
      const cy = getRoadY(z, route.id);
      const angle = getRoadTangentAngle(z);
      const offset = -(roadWidth * 0.5 + 1.45);
      const poleX = cx + Math.cos(angle) * offset;
      const poleZ = z - Math.sin(angle) * offset;
      lampTransforms.push({
        poleX,
        poleY: cy,
        poleZ,
        rotY: angle,
        x: poleX + Math.cos(angle) * 1.82,
        y: cy + 5.9,
        z: poleZ - Math.sin(angle) * 1.82,
      });
    }
  }
  for (const blp of riverBridgeResult.lampPlacements) {
    lampTransforms.push(blp);
  }

  const buildLampPoleGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    const shaft = new THREE.CylinderGeometry(0.085, 0.125, 6.2, 8);
    shaft.translate(0, 3.1, 0);
    parts.push(toMergeable(shaft));

    const baseFlange = new THREE.CylinderGeometry(0.22, 0.25, 0.28, 8);
    baseFlange.translate(0, 0.14, 0);
    parts.push(toMergeable(baseFlange));

    const arm = new THREE.CylinderGeometry(0.055, 0.075, 1.9, 7);
    arm.rotateZ(-Math.PI / 2 + 0.18);
    arm.translate(0.92, 6.26, 0);
    parts.push(toMergeable(arm));

    const hood = new THREE.BoxGeometry(0.62, 0.14, 0.34);
    hood.translate(1.82, 6.42, 0);
    parts.push(toMergeable(hood));

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  const lampPoleGeo = buildLampPoleGeo();
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.65, roughness: 0.35 });
  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampTransforms.length);

  const lampBulbGeo = new THREE.BoxGeometry(0.46, 0.08, 0.24);
  lampBulbGeo.translate(1.82, 6.32, 0);
  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.08,
    roughness: 0.25,
  });
  const lampBulbs = new THREE.InstancedMesh(lampBulbGeo, lampBulbMat, lampTransforms.length);

  const lampPoolGeo = new THREE.PlaneGeometry(14.5, 14.5);
  lampPoolGeo.rotateX(-Math.PI / 2);
  lampPoolGeo.translate(2.2, 0.042, 0);
  const lampPoolMat = new THREE.MeshBasicMaterial({
    map: lampPoolTex,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const lampPools = new THREE.InstancedMesh(lampPoolGeo, lampPoolMat, lampTransforms.length);
  lampPools.renderOrder = 1;
  lampPools.visible = false;

  for (let i = 0; i < lampTransforms.length; i++) {
    const lp = lampTransforms[i];
    dummy.position.set(lp.poleX, lp.poleY, lp.poleZ);
    dummy.rotation.set(0, lp.rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);
    lampBulbs.setMatrixAt(i, dummy.matrix);

    // Keep ground light pool flush on the road deck even if pole base sits on a bridge parapet
    dummy.position.y = getRoadY(lp.poleZ, route.id);
    dummy.updateMatrix();
    lampPools.setMatrixAt(i, dummy.matrix);

    streetLampPositions.push({ x: lp.x, y: lp.y, z: lp.z });
  }
  lampPoles.instanceMatrix.needsUpdate = true;
  lampBulbs.instanceMatrix.needsUpdate = true;
  lampPools.instanceMatrix.needsUpdate = true;
  lampPoles.computeBoundingSphere();
  lampBulbs.computeBoundingSphere();
  lampPools.computeBoundingSphere();
  group.add(lampPoles, lampBulbs, lampPools);

  // Banana Tree Clusters (কলা গাছ)
  const bananaLeafTex = createBananaLeafTexture(maxAnisotropy);
  const bananaSpecs: { x: number; z: number; rotY: number; s: number }[] = [];
  for (let i = 0; i < 165; i++) {
    const z = 40 - (i / 165) * route.totalLengthM;
    if (isInsideRiverSpan(z, route.id, 18) || isInsideUrbanZone(z, route.id)) continue;
    const side = i % 2 === 0 ? -1 : 1;
    const dist = 10.8 + ((i * 19) % 12);
    const cx = getRoadX(z);
    bananaSpecs.push({ x: cx + side * dist, z, rotY: (i * 1.9) % (Math.PI * 2), s: 0.85 + ((i * 13) % 30) * 0.01 });
  }
  const bananaStemGeo = new THREE.CylinderGeometry(0.11, 0.16, 2.5, 7);
  bananaStemGeo.translate(0, 1.25, 0);
  const bananaStemMat = new THREE.MeshStandardMaterial({ color: 0x5c7c29, roughness: 0.84 });
  const bananaStems = new THREE.InstancedMesh(bananaStemGeo, bananaStemMat, Math.max(1, bananaSpecs.length));

  const buildBananaCrownGeo = (): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];
    for (let f = 0; f < 6; f++) {
      const leaf = new THREE.PlaneGeometry(0.95, 2.35, 1, 5);
      leaf.translate(0, 1.175, 0);
      const pos = leaf.attributes.position;
      const pitchOut = 0.48 + (f % 2) * 0.28;
      for (let v = 0; v < pos.count; v++) {
        const py = pos.getY(v);
        const t = py / 2.35;
        const reach = t * 2.35 * Math.cos(pitchOut);
        const rise = t * 2.35 * Math.sin(pitchOut) - 0.95 * t * t;
        pos.setY(v, rise);
        pos.setZ(v, reach);
      }
      leaf.computeVertexNormals();
      leaf.rotateY((f / 6) * Math.PI * 2 + (f % 2) * 0.25);
      leaf.translate(0, 2.38, 0);
      parts.push(toMergeable(leaf));
    }
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  const bananaLeafGeo = buildBananaCrownGeo();
  const bananaLeafMat = new THREE.MeshStandardMaterial({
    map: bananaLeafTex,
    alphaTest: 0.36,
    side: THREE.DoubleSide,
    roughness: 0.72,
  });
  const bananaLeaves = new THREE.InstancedMesh(bananaLeafGeo, bananaLeafMat, Math.max(1, bananaSpecs.length));

  for (let i = 0; i < bananaSpecs.length; i++) {
    const b = bananaSpecs[i];
    dummy.position.set(b.x, -0.34, b.z);
    dummy.rotation.set(0, b.rotY, 0);
    dummy.scale.set(b.s, b.s, b.s);
    dummy.updateMatrix();
    bananaStems.setMatrixAt(i, dummy.matrix);
    bananaLeaves.setMatrixAt(i, dummy.matrix);
  }
  bananaStems.instanceMatrix.needsUpdate = true;
  bananaLeaves.instanceMatrix.needsUpdate = true;
  bananaStems.computeBoundingSphere();
  bananaLeaves.computeBoundingSphere();
  group.add(bananaStems, bananaLeaves);

  // Bangladeshi White-and-Black Highway Culvert Parapets (ছোট কালভার্ট) — skip river & urban zones
  const culvertWallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.8 });
  const culvertStripeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
  for (let z = -700; z >= -(route.totalLengthM - 300); z -= 720) {
    if (isInsideBridgeApproach(z, route.id, 30) || isInsideUrbanZone(z, route.id)) continue;
    const cx = getRoadX(z);
    const angle = getRoadTangentAngle(z);
    const culvert = new THREE.Group();
    culvert.position.set(cx, 0, z);
    culvert.rotation.y = angle;
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 10.5), culvertWallMat);
      wall.position.set(side * (roadWidth * 0.5 + 1.4), 0.45, 0);
      wall.castShadow = true;
      culvert.add(wall);
      for (let sz = -4; sz <= 4; sz += 2) {
        const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.92, 0.75), culvertStripeMat);
        stripe.position.set(side * (roadWidth * 0.5 + 1.4), 0.45, sz);
        culvert.add(stripe);
      }
    }
    group.add(culvert);
  }

  // 4b. Bengali Kilometer Milestones every 250m (sitting cleanly at getRoadY!)
  const DEST_SHORT_MAP: Record<RouteId, string> = {
    panchagarh: 'পঞ্চগড়',
    coxsbazar: 'কক্সবাজার',
    sylhet: 'সিলেট',
    khulna: 'খুলনা',
    barishal: 'কুয়াকাটা',
    rajshahi: 'রাজশাহী',
    mymensingh: 'ময়মনসিংহ',
  };
  const destShort = DEST_SHORT_MAP[route.id];
  const totalKmScaled = route.realKm;
  const milestonePostMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.75 });
  const milestoneTopMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.65 });

  for (let z = -200; z >= -(route.totalLengthM - 200); z -= 250) {
    if (isInsideBridgeApproach(z, route.id, 10)) continue;
    const progress = Math.abs(z) / route.totalLengthM;
    const kmLeft = Math.max(1, Math.round(totalKmScaled * (1 - progress)));
    const cx = getRoadX(z);
    const cy = getRoadY(z, route.id);
    const angle = getRoadTangentAngle(z);

    const postGroup = new THREE.Group();
    postGroup.position.set(cx - Math.cos(angle) * 7.5, cy, z + Math.sin(angle) * 7.5);
    postGroup.rotation.y = angle;

    const stone = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.3, 0.35), milestonePostMat);
    stone.position.y = 0.65;
    stone.castShadow = true;

    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.32, 0.38), milestoneTopMat);
    cap.position.y = 1.24;

    const tex = createSignBoardTexture(destShort, `${kmLeft} কি.মি.`, '#fef08a', '#111827', '#111827', maxAnisotropy);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(0.88, 0.85),
      new THREE.MeshBasicMaterial({ map: tex })
    );
    face.position.set(0, 0.72, 0.185);
    postGroup.add(stone, cap, face);
    group.add(postGroup);
  }

  // 4c. Overhead Highway Direction Gantry Signboards across all 7 Bangladesh routes
  const GANTRY_MAP: Record<RouteId, { z: number; title: string; sub: string }[]> = {
    panchagarh: [
      { z: -480, title: 'যমুনা সেতু · বগুড়া · রংপুর', sub: 'N5 উত্তরবঙ্গ মহাসড়ক · ঢাকা থেকে যাত্রা' },
      { z: -2450, title: 'রংপুর · ভাউলাগঞ্জ · পঞ্চগড় ↑', sub: 'বগুড়া অতিক্রম · উত্তরবঙ্গ হাইওয়ে' },
      { z: -3680, title: 'ভাউলাগঞ্জ বাজার ↔ পঞ্চগড়', sub: 'দেবীগঞ্জ · পঞ্চগড় সদর' },
    ],
    coxsbazar: [
      { z: -640, title: 'মেঘনা সেতু · কুমিল্লা · চট্টগ্রাম', sub: 'N1 ঢাকা–চট্টগ্রাম মহাসড়ক' },
      { z: -3150, title: 'চট্টগ্রাম · কক্সবাজার মেরিন ড্রাইভ ↑', sub: 'গতিসীমা ৮০ কি.মি./ঘন্টা' },
    ],
    sylhet: [
      { z: -620, title: 'ভৈরব সেতু · শায়েস্তাগঞ্জ · সিলেট', sub: 'N2 সিলেট–চা বাগান মহাসড়ক' },
      { z: -2920, title: 'শ্রীমঙ্গল · সিলেট কদমতলী ↑', sub: 'সুরমা উপত্যকা · বাম লেন ব্যবহার করুন' },
    ],
    khulna: [
      { z: -520, title: 'পদ্মা সেতু · ভাঙ্গা এক্সপ্রেসওয়ে', sub: 'N8/N7 দক্ষিণ-পশ্চিম মহাসড়ক · মাওয়া' },
      { z: -2950, title: 'যশোর · সোনাডাঙ্গা · খুলনা ↑', sub: 'নওয়াপাড়া · সুন্দরবন করিডোর' },
    ],
    barishal: [
      { z: -520, title: 'পদ্মা সেতু · বরিশাল · কুয়াকাটা', sub: 'N8 দক্ষিণাঞ্চল উপকূলীয় মহাসড়ক' },
      { z: -3120, title: 'পটুয়াখালী · লেবুখালী পায়রা সেতু · কুয়াকাটা ↑', sub: 'সাগরকন্যা কুয়াকাটা সৈকত' },
    ],
    rajshahi: [
      { z: -560, title: 'যমুনা সেতু · সিরাজগঞ্জ · রাজশাহী', sub: 'N6 পদ্মা পাড়ের আমের শহর মহাসড়ক' },
      { z: -2520, title: 'নাটোর · বানেশ্বর আম বাজার · রাজশাহী ↑', sub: 'শিরোইল বাস টার্মিনাল' },
    ],
    mymensingh: [
      { z: -540, title: 'গাজীপুর · ভাওয়াল গড় · ময়মনসিংহ', sub: 'N3 উত্তর-মধ্য মহাসড়ক' },
      { z: -2600, title: 'ত্রিশাল · ব্রহ্মপুত্র সেতু · ময়মনসিংহ ↑', sub: 'মাসকান্দা কেন্দ্রীয় বাস টার্মিনাল' },
    ],
  };
  const gantrySpecs = GANTRY_MAP[route.id];

  const steelMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.3 });
  for (const gs of gantrySpecs) {
    const cx = getRoadX(gs.z);
    const cy = getRoadY(gs.z, route.id);
    const angle = getRoadTangentAngle(gs.z);
    const gantry = new THREE.Group();
    gantry.position.set(cx, cy, gs.z);
    gantry.rotation.y = angle;

    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.4, 8), steelMat);
    legL.position.set(-7.4, 3.2, 0);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.4, 8), steelMat);
    legR.position.set(7.4, 3.2, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(15.4, 0.36, 0.36), steelMat);
    beam.position.set(0, 6.2, 0);

    const gTex = createSignBoardTexture(gs.title, gs.sub, '#065f46', '#ffffff', '#e2e8f0', maxAnisotropy);
    const gBoard = new THREE.Mesh(
      new THREE.BoxGeometry(8.8, 1.85, 0.18),
      new THREE.MeshBasicMaterial({ map: gTex })
    );
    gBoard.position.set(0, 5.7, 0.22);

    gantry.add(legL, legR, beam, gBoard);
    group.add(gantry);
  }

  // 5. Village Shops & Highway Tea Stalls (skip bridge approaches)
  const shopNames = [
    { bn: 'আল্লাহর দান চা স্টল', sub: 'গরম চা · বিস্কুট', color: '#dc2626' },
    { bn: 'হোটেল হাইওয়ে ইন', sub: 'ভাত · মাছ · পরোটা', color: '#0284c7' },
    { bn: 'ভাই ভাই ভ্যারাইটিজ', sub: 'বিকাশ · ফ্লেক্সিলোড', color: '#059669' },
    { bn: 'বিসমিল্লাহ মটরস', sub: 'টায়ার ও ব্রেক সার্ভিস', color: '#d97706' },
  ];

  for (let i = 0; i < 12; i++) {
    const z = -290 - i * 335;
    if (isInsideBridgeApproach(z, route.id, 35)) continue;
    if (route.stops.some((s) => Math.abs(s.z - z) < 30)) continue;
    const cx = getRoadX(z);
    const angle = getRoadTangentAngle(z);
    const side = i % 2 === 0 ? -1 : 1;
    const shopCfg = shopNames[i % shopNames.length];
    const shop = createVillageShop(shopCfg.bn, shopCfg.sub, shopCfg.color, maxAnisotropy, shopLampMat);
    shop.position.set(cx + side * 12.2, 0, z);
    shop.rotation.y = angle + (side === -1 ? Math.PI / 2 : -Math.PI / 2);
    group.add(shop);
  }

  // 6. Speed Breakers (never on bridges!)
  const breakerMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.75 });
  const breakerStripeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.85 });
  const breakerZList = [-560, -1890, -2580, -3280, -3960];

  for (const bz of breakerZList) {
    if (Math.abs(bz) > route.totalLengthM - 150) continue;
    if (isInsideBridgeApproach(bz, route.id, 35)) continue;
    const cx = getRoadX(bz);
    const angle = getRoadTangentAngle(bz);
    speedBreakers.push({ z: bz, x: cx });

    const sbGroup = new THREE.Group();
    sbGroup.position.set(cx, 0.02, bz);
    sbGroup.rotation.y = angle;

    const hump = new THREE.Mesh(new THREE.BoxGeometry(roadWidth - 0.6, 0.16, 1.3), breakerMat);
    hump.position.y = 0.06;
    sbGroup.add(hump);

    for (let sx = -5; sx <= 5; sx += 2) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.17, 1.32), breakerStripeMat);
      stripe.position.set(sx, 0.065, 0);
      sbGroup.add(stripe);
    }
    group.add(sbGroup);

    const wz = bz + 45;
    const wCx = getRoadX(wz);
    const wAngle = getRoadTangentAngle(wz);
    const signPost = new THREE.Group();
    signPost.position.set(wCx - 7.1, 0, wz);
    signPost.rotation.y = wAngle;

    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 })
    );
    pole.position.y = 1.25;
    const signTex = createSignBoardTexture('সামনে স্পিড ব্রেকার', 'গতি ৪০ কি.মি.', '#facc15', '#111827', '#dc2626', maxAnisotropy);
    const board = new THREE.Mesh(
      new THREE.BoxGeometry(1.9, 1.0, 0.08),
      new THREE.MeshBasicMaterial({ map: signTex })
    );
    board.position.y = 2.45;
    signPost.add(pole, board);
    group.add(signPost);
  }

  // 7. Route Stops: Bus Terminals, Highway Stands, Fuel/CNG Station, and Toll Plaza
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.75 });

  for (const stop of route.stops) {
    const cx = getRoadX(stop.z);
    const cy = getRoadY(stop.z, route.id);
    const angle = getRoadTangentAngle(stop.z);
    const stopGroup = new THREE.Group();
    stopGroup.position.set(cx, cy, stop.z);
    stopGroup.rotation.y = angle;

    if (stop.type === 'terminal') {
      const pL = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.2, 1.2), concreteMat);
      pL.position.set(-8.0, 3.1, 0);
      pL.castShadow = true;
      const pR = new THREE.Mesh(new THREE.BoxGeometry(0.9, 6.2, 1.2), concreteMat);
      pR.position.set(8.0, 3.1, 0);
      pR.castShadow = true;

      const archBeam = new THREE.Mesh(
        new THREE.BoxGeometry(17.4, 1.8, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45 })
      );
      archBeam.position.set(0, 6.2, 0);
      archBeam.castShadow = true;

      const bannerTex = createSignBoardTexture(stop.banglaName, stop.name, '#064e3b', '#fde047', '#f59e0b', maxAnisotropy);
      const bannerFront = new THREE.Mesh(
        new THREE.PlaneGeometry(14.5, 1.45),
        new THREE.MeshBasicMaterial({ map: bannerTex })
      );
      bannerFront.position.set(0, 6.2, 0.72);
      stopGroup.add(pL, pR, archBeam, bannerFront);

      const bayZone = new THREE.Mesh(
        new THREE.PlaneGeometry(4.4, 15.0),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.34, depthWrite: false })
      );
      bayZone.rotation.x = -Math.PI / 2;
      bayZone.position.set(-3.4, 0.048, 0);
      stopGroup.add(bayZone);

      for (let p = 0; p < 5; p++) {
        const person = createWaitingPerson(
          [0xe11d48, 0x2563eb, 0xf59e0b, 0x10b981, 0xf8fafc][p],
          [0x1e293b, 0x0f766e, 0x7c2d12, 0x312e81, 0x374151][p]
        );
        person.position.set(-7.3, 0, -4 + p * 2.1);
        person.rotation.y = Math.PI / 2;
        stopGroup.add(person);
      }
    } else if (stop.type === 'stand') {
      const shedRoof = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.16, 10.5),
        new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.55 })
      );
      shedRoof.position.set(-8.8, 3.0, 0);
      shedRoof.castShadow = true;

      const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.25, 2.9, 10.2), concreteMat);
      backWall.position.set(-10.2, 1.45, 0);

      const signTex = createSignBoardTexture(stop.banglaName, 'যাত্রী ওঠানামা · BAY', '#0c4a6e', '#ffffff', '#38bdf8', maxAnisotropy);
      const board = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, 1.2),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      board.position.set(-7.15, 3.3, 0);
      board.rotation.y = Math.PI / 2;

      const bayZone = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 13.5),
        new THREE.MeshBasicMaterial({ color: 0x22c55e, transparent: true, opacity: 0.32, depthWrite: false })
      );
      bayZone.rotation.x = -Math.PI / 2;
      bayZone.position.set(-3.4, 0.048, 0);

      stopGroup.add(shedRoof, backWall, board, bayZone);

      for (let p = 0; p < 4; p++) {
        const person = createWaitingPerson(
          [0xf97316, 0xec4899, 0x14b8a6, 0x6366f1][p],
          [0x1e293b, 0x451a03, 0x064e3b, 0x334155][p]
        );
        person.position.set(-7.5, 0, -3 + p * 2.0);
        person.rotation.y = Math.PI / 2;
        stopGroup.add(person);
      }
    } else if (stop.type === 'fuel') {
      const forecourt = new THREE.Mesh(
        new THREE.BoxGeometry(11.5, 0.08, 24.0),
        new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88 })
      );
      forecourt.position.set(-10.2, 0.02, 0);
      forecourt.receiveShadow = true;

      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(8.8, 0.45, 17.5),
        new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.42 })
      );
      canopy.position.set(-10.4, 4.7, 0);
      canopy.castShadow = true;

      const canopyTrim = new THREE.Mesh(
        new THREE.BoxGeometry(8.92, 0.18, 17.62),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.35 })
      );
      canopyTrim.position.set(-10.4, 4.98, 0);

      const canopyGlowStrip = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.08, 14.5), canopyLightMat);
      canopyGlowStrip.position.set(-10.4, 4.44, 0);
      stopGroup.add(canopyGlowStrip);

      for (const cz of [-5.6, 5.6]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.58, 4.7, 0.58), concreteMat);
        col.position.set(-8.1, 2.35, cz);
        col.castShadow = true;
        const bollard = new THREE.Mesh(
          new THREE.CylinderGeometry(0.16, 0.18, 0.9, 10),
          new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
        );
        bollard.position.set(-7.4, 0.45, cz);
        stopGroup.add(col, bollard);
      }

      const island = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.28, 10.5), concreteMat);
      island.position.set(-8.2, 0.14, 0);
      stopGroup.add(island);

      const pumpConfigs = [
        { z: -3.2, color: 0xdc2626 },
        { z: 0, color: 0x059669 },
        { z: 3.2, color: 0x0284c7 },
      ];
      for (const pc of pumpConfigs) {
        const dispenser = new THREE.Mesh(
          new THREE.BoxGeometry(0.88, 1.9, 0.72),
          new THREE.MeshStandardMaterial({ color: pc.color, roughness: 0.4 })
        );
        dispenser.position.set(-8.2, 1.15, pc.z);
        dispenser.castShadow = true;

        const screen = new THREE.Mesh(
          new THREE.PlaneGeometry(0.56, 0.36),
          new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x38bdf8, emissiveIntensity: 0.55 })
        );
        screen.position.set(-7.75, 1.48, pc.z);
        screen.rotation.y = Math.PI / 2;

        const hose = new THREE.Mesh(
          new THREE.CylinderGeometry(0.03, 0.03, 1.15, 6),
          new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 })
        );
        hose.position.set(-7.75, 0.95, pc.z + 0.25);
        stopGroup.add(dispenser, screen, hose);
      }

      const office = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 3.1, 6.5),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.75 })
      );
      office.position.set(-14.2, 1.55, 0);
      office.castShadow = true;

      const signTex = createSignBoardTexture(
        stop.banglaName,
        'পেট্রোল · ডিজেল · অকটেন · CNG',
        '#7f1d1d',
        '#fde047',
        '#ffffff',
        maxAnisotropy
      );
      const fascia = new THREE.Mesh(
        new THREE.PlaneGeometry(15.2, 1.35),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      fascia.position.set(-5.98, 4.72, 0);
      fascia.rotation.y = Math.PI / 2;

      const fuelBay = new THREE.Mesh(
        new THREE.PlaneGeometry(5.2, 16.0),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.38, depthWrite: false })
      );
      fuelBay.rotation.x = -Math.PI / 2;
      fuelBay.position.set(-4.2, 0.048, 0);

      stopGroup.add(forecourt, canopy, canopyTrim, office, fascia, fuelBay);

      const advZ = stop.z + 150;
      if (!isInsideBridgeApproach(advZ, route.id, 10)) {
        const advCx = getRoadX(advZ);
        const advAngle = getRoadTangentAngle(advZ);
        const advGroup = new THREE.Group();
        advGroup.position.set(advCx - Math.cos(advAngle) * 7.4, getRoadY(advZ, route.id), advZ + Math.sin(advAngle) * 7.4);
        advGroup.rotation.y = advAngle;
        const advPole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.7, 8), steelMat);
        advPole.position.y = 1.35;
        const advTex = createSignBoardTexture('সামনে পেট্রোল পাম্প', 'PETROL PUMP · 150m', '#0284c7', '#ffffff', '#facc15', maxAnisotropy);
        const advBoard = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.25, 0.08), new THREE.MeshBasicMaterial({ map: advTex }));
        advBoard.position.y = 2.65;
        advGroup.add(advPole, advBoard);
        group.add(advGroup);
      }
    } else if (stop.type === 'toll') {
      const canopy = new THREE.Mesh(
        new THREE.BoxGeometry(17.2, 1.2, 5.6),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.45 })
      );
      canopy.position.set(0, 5.4, 0);
      canopy.castShadow = true;

      const boothL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.2, 3.6), concreteMat);
      boothL.position.set(-6.4, 1.6, 0);
      const boothMid = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 3.6), concreteMat);
      boothMid.position.set(0, 1.6, 0);
      const boothR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.2, 3.6), concreteMat);
      boothR.position.set(6.4, 1.6, 0);

      const tollTex = createSignBoardTexture(
        stop.banglaName,
        `বাস টোল ৳${stop.tollFee ?? 250} · ধীরে চলুন`,
        '#172554',
        '#facc15',
        '#38bdf8',
        maxAnisotropy
      );
      const tollSign = new THREE.Mesh(
        new THREE.PlaneGeometry(13.5, 1.3),
        new THREE.MeshBasicMaterial({ map: tollTex })
      );
      tollSign.position.set(0, 5.45, 2.82);

      const armPivot = new THREE.Group();
      armPivot.position.set(-5.6, 1.25, 1.6);
      const armBar = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 })
      );
      armBar.position.x = 2.4;
      armPivot.add(armBar);

      tollBarriers.push({ stop, armPivot, paid: false, openProgress: 0 });
      stopGroup.add(canopy, boothL, boothMid, boothR, tollSign, armPivot);
    }

    group.add(stopGroup);
  }

  return {
    group,
    speedBreakers,
    tollBarriers,
    streetLampPositions,
    setLampActivation(factor: number) {
      const f = THREE.MathUtils.clamp(factor, 0, 1);
      lampBulbMat.emissiveIntensity = 0.08 + f * 3.4;
      lampBulbMat.color.setHex(f > 0.15 ? 0xfef3c7 : 0x94a3b8);
      lampPoolMat.opacity = f * 0.42;
      lampPools.visible = f > 0.04;
      shopLampMat.emissiveIntensity = 0.06 + f * 2.8;
      canopyLightMat.emissiveIntensity = 0.15 + f * 2.6;
    },
    setWeatherSurface(rainFactor: number) {
      roadSystem.setWeatherSurface(rainFactor);
    },
    updateDynamicProps(delta: number, busZ: number) {
      elapsedSec += delta;
      riverBridgeResult.update(delta, elapsedSec);
      for (const tb of tollBarriers) {
        const dist = Math.abs(busZ - tb.stop.z);
        const targetOpen = tb.paid || dist < 18 ? 1 : 0;
        tb.openProgress = THREE.MathUtils.damp(tb.openProgress, targetOpen, 4.5, delta);
        tb.armPivot.rotation.z = tb.openProgress * (Math.PI * 0.44);
      }
    },
    dispose() {
      paddyTex.dispose();
      groundGeos.forEach((g) => g.dispose());
      groundMat.dispose();
      roadSystem.dispose();
      riverBridgeResult.dispose();
      urbanRuralResult.dispose();
      canalGeo.dispose();
      canalMat.dispose();
      hyacinthGeo.dispose();
      hyacinthMat.dispose();
      kilnChimneyGeo.dispose();
      kilnMat.dispose();
      kilnBaseGeo.dispose();
      kilnBaseMat.dispose();
      hillGeo.dispose();
      hillMat.dispose();
      trunkGeo.dispose();
      trunkMat.dispose();
      crownGeo.dispose();
      crownMat.dispose();
      palmDepthMat.dispose();
      shadeTrunkGeo.dispose();
      canopyGeo.dispose();
      canopyMat.dispose();
      shadeDepthMat.dispose();
      treeCollarWhiteGeo.dispose();
      treeCollarWhiteMat.dispose();
      treeCollarRedGeo.dispose();
      treeCollarRedMat.dispose();
      krishnaMat.dispose();
      krishnaDepthMat.dispose();
      bambooCulmGeo.dispose();
      bambooCulmMat.dispose();
      bambooLeafGeo.dispose();
      bambooLeafMat.dispose();
      barkTex.dispose();
      palmFrondTex.dispose();
      leafClusterTex.dispose();
      krishnachuraTex.dispose();
      bambooTex.dispose();
      guidePostGeo.dispose();
      guidePostMat.dispose();
      reflectorGeo.dispose();
      reflectorMat.dispose();
      electricPoleGeo.dispose();
      electricPoleMat.dispose();
      crossArmGeo.dispose();
      powerWireGeo.dispose();
      powerWireMat.dispose();
      lampPoleGeo.dispose();
      lampPoleMat.dispose();
      lampBulbGeo.dispose();
      lampBulbMat.dispose();
      lampPoolGeo.dispose();
      lampPoolMat.dispose();
      lampPoolTex.dispose();
      shopLampMat.dispose();
      canopyLightMat.dispose();
      bananaStemGeo.dispose();
      bananaStemMat.dispose();
      bananaLeafGeo.dispose();
      bananaLeafMat.dispose();
      bananaLeafTex.dispose();
      culvertWallMat.dispose();
      culvertStripeMat.dispose();
      steelMat.dispose();
      breakerMat.dispose();
      breakerStripeMat.dispose();
      concreteMat.dispose();
    },
  };
}
