import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createConcreteBridgeTexture,
  createRiverSandTexture,
  createRiverWaterTexture,
  createSignBoardTexture,
} from './textures';
import { RouteId } from './types';
import { getRiverBridgeZones, getRoadY, RiverBridgeSpec } from './worldHelpers';

export interface BridgeLampPlacement {
  x: number;
  y: number;
  z: number;
  rotY: number;
  poleX: number;
  poleY: number;
  poleZ: number;
}

interface FloatingBoat {
  group: THREE.Group;
  baseX: number;
  baseZ: number;
  driftRange: number;
  speed: number;
  phase: number;
}

export interface RiverBridgeBuildResult {
  group: THREE.Group;
  lampPlacements: BridgeLampPlacement[];
  update: (delta: number, elapsed: number) => void;
  dispose: () => void;
}

function toMergeable(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const nonIdx = g.index ? g.toNonIndexed() : g.clone();
  g.dispose();
  return nonIdx;
}

function buildExtrudedBridgeStrip(
  zStart: number,
  zEnd: number,
  stepM: number,
  leftOffset: number,
  rightOffset: number,
  topOffsetY: number,
  bottomOffsetY: number,
  routeId: RouteId,
  getRoadX: (z: number) => number,
  getRoadTangentAngle: (z: number) => number,
  uvRepeatPerMeter = 0.08
): THREE.BufferGeometry {
  const totalLen = Math.max(1, zStart - zEnd);
  const segZ = Math.max(4, Math.ceil(totalLen / stepM));

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  // 4 corners per slice: 0=top-left, 1=top-right, 2=bot-right, 3=bot-left
  for (let i = 0; i <= segZ; i++) {
    const t = i / segZ;
    const z = zStart - t * totalLen;
    const cx = getRoadX(z);
    const cy = getRoadY(z, routeId);
    const angle = getRoadTangentAngle(z);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const lx = cx + cosA * leftOffset;
    const lz = z - sinA * leftOffset;
    const rx = cx + cosA * rightOffset;
    const rz = z - sinA * rightOffset;

    const topY = cy + topOffsetY;
    const botY = cy + bottomOffsetY;

    positions.push(
      lx, topY, lz, // 0
      rx, topY, rz, // 1
      rx, botY, rz, // 2
      lx, botY, lz  // 3
    );

    const vCoord = t * totalLen * uvRepeatPerMeter;
    uvs.push(0, vCoord, 1, vCoord, 1, vCoord + 0.35, 0, vCoord + 0.35);
  }

  for (let i = 0; i < segZ; i++) {
    const row = i * 4;
    const next = (i + 1) * 4;
    // Top face
    indices.push(row + 0, next + 0, row + 1, row + 1, next + 0, next + 1);
    // Right face
    indices.push(row + 1, next + 1, row + 2, row + 2, next + 1, next + 2);
    // Left face
    indices.push(row + 3, next + 3, row + 0, row + 0, next + 3, next + 0);
    // Bottom face
    indices.push(row + 2, next + 2, row + 3, row + 3, next + 2, next + 3);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function buildCurvedRibbonPlane(
  zStart: number,
  zEnd: number,
  stepM: number,
  leftOffset: number,
  rightOffset: number,
  offsetY: number,
  routeId: RouteId,
  getRoadX: (z: number) => number,
  getRoadTangentAngle: (z: number) => number,
  uvTileU = 1,
  uvTilePerM = 0.25
): THREE.BufferGeometry {
  const totalLen = Math.max(1, zStart - zEnd);
  const segZ = Math.max(4, Math.ceil(totalLen / stepM));

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= segZ; i++) {
    const t = i / segZ;
    const z = zStart - t * totalLen;
    const cx = getRoadX(z);
    const cy = getRoadY(z, routeId) + offsetY;
    const angle = getRoadTangentAngle(z);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    positions.push(
      cx + cosA * leftOffset, cy, z - sinA * leftOffset,
      cx + cosA * rightOffset, cy, z - sinA * rightOffset
    );
    normals.push(0, 1, 0, 0, 1, 0);
    uvs.push(0, t * totalLen * uvTilePerM, uvTileU, t * totalLen * uvTilePerM);
  }

  for (let i = 0; i < segZ; i++) {
    const a = i * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createBangladeshiNouka(
  hullMat: THREE.Material,
  canopyMat: THREE.Material,
  woodMat: THREE.Material,
  isTrawler: boolean
): THREE.Group {
  const boat = new THREE.Group();
  const len = isTrawler ? 13.5 : 8.2;
  const wid = isTrawler ? 3.2 : 1.75;

  // Tapered boat hull
  const hull = new THREE.Mesh(new THREE.BoxGeometry(wid, 0.72, len * 0.68), hullMat);
  hull.position.y = 0.28;
  hull.castShadow = true;

  const bow = new THREE.Mesh(new THREE.ConeGeometry(wid * 0.48, len * 0.24, 4), hullMat);
  bow.rotation.x = Math.PI / 2;
  bow.rotation.y = Math.PI / 4;
  bow.position.set(0, 0.36, -len * 0.44);

  const stern = new THREE.Mesh(new THREE.ConeGeometry(wid * 0.46, len * 0.2, 4), hullMat);
  stern.rotation.x = -Math.PI / 2;
  stern.rotation.y = Math.PI / 4;
  stern.position.set(0, 0.36, len * 0.42);

  // Signature Bangladeshi arched bamboo/tin Chhai canopy (নৌকার ছই)
  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(wid * 0.48, wid * 0.48, len * 0.42, 8, 1, false, 0, Math.PI),
    canopyMat
  );
  canopy.rotation.z = Math.PI / 2;
  canopy.rotation.y = Math.PI / 2;
  canopy.position.set(0, 0.68, isTrawler ? 0.6 : 0.2);
  canopy.castShadow = true;

  // Bow wooden oar/mast pole
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, isTrawler ? 3.4 : 2.1, 6), woodMat);
  mast.position.set(0.18, isTrawler ? 1.8 : 1.15, -len * 0.18);

  boat.add(hull, bow, stern, canopy, mast);
  return boat;
}

export function buildRiverAndBridgeSystem(
  routeId: RouteId,
  roadWidth: number,
  maxAnisotropy: number,
  getRoadX: (z: number) => number,
  getRoadTangentAngle: (z: number) => number
): RiverBridgeBuildResult {
  const group = new THREE.Group();
  const lampPlacements: BridgeLampPlacement[] = [];
  const boats: FloatingBoat[] = [];
  const waterTextures: THREE.CanvasTexture[] = [];
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  const disposableTexs: THREE.Texture[] = [];

  const bridges: RiverBridgeSpec[] = getRiverBridgeZones(routeId);
  if (bridges.length === 0) {
    return {
      group,
      lampPlacements,
      update: () => {},
      dispose: () => {},
    };
  }

  const concreteTex = createConcreteBridgeTexture(maxAnisotropy);
  const sandTex = createRiverSandTexture(maxAnisotropy);
  disposableTexs.push(concreteTex, sandTex);

  const concreteDeckMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xdbe2ea,
    roughness: 0.78,
    metalness: 0.06,
  });
  const concretePierMat = new THREE.MeshStandardMaterial({
    map: concreteTex,
    color: 0xc2ccd8,
    roughness: 0.84,
    metalness: 0.05,
  });
  const caissonMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.9,
    metalness: 0.08,
  });
  const railSteelMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.34,
    metalness: 0.78,
  });
  const trussSteelMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.4,
    metalness: 0.72,
  });
  const sleeperMat = new THREE.MeshStandardMaterial({
    color: 0x453528,
    roughness: 0.92,
  });
  const ballastMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.96,
  });
  const medianHazardMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.65,
  });
  const sandMat = new THREE.MeshStandardMaterial({
    map: sandTex,
    roughness: 0.94,
    metalness: 0.02,
  });
  const kashfulMat = new THREE.MeshStandardMaterial({
    color: 0xf1f5f9,
    roughness: 0.85,
  });
  const boatHullMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.86 });
  const boatCanopyMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.82 });
  const boatTrawlerCanopyMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.7 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.88 });

  disposableMats.push(
    concreteDeckMat,
    concretePierMat,
    caissonMat,
    railSteelMat,
    trussSteelMat,
    sleeperMat,
    ballastMat,
    medianHazardMat,
    sandMat,
    kashfulMat,
    boatHullMat,
    boatCanopyMat,
    boatTrawlerCanopyMat,
    woodMat
  );

  // Shared pier geometry: massive caisson cap + flared twin V-columns supporting highway & rail deck
  const buildPierGeo = (deckSpanWidth: number, shiftX: number): THREE.BufferGeometry => {
    const parts: THREE.BufferGeometry[] = [];

    // River caisson pile cap sitting from underwater (-3.1m) up to +0.55m above water (-1.35m)
    const caisson = new THREE.CylinderGeometry(3.4, 3.8, 3.65, 8);
    caisson.scale(deckSpanWidth * 0.19, 1, 0.72);
    caisson.translate(shiftX, -1.28, 0);
    parts.push(toMergeable(caisson));

    // Twin flared pier columns rising from pile cap up to y=6.2m
    for (const side of [-1, 1]) {
      const col = new THREE.BoxGeometry(1.65, 6.9, 1.85);
      col.rotateZ(side * 0.09);
      col.translate(shiftX + side * (deckSpanWidth * 0.25), 3.3, 0);
      parts.push(toMergeable(col));
    }

    // Horizontal hammerhead pier cap beam
    const cap = new THREE.BoxGeometry(deckSpanWidth, 1.15, 2.35);
    cap.translate(shiftX, 6.25, 0);
    parts.push(toMergeable(cap));

    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    return merged;
  };

  for (const b of bridges) {
    const waterY = -1.35;
    const riverbedY = -2.65;
    const riverLen = b.zRiverStart - b.zRiverEnd + 44;
    const riverMidZ = (b.zRiverStart + b.zRiverEnd) * 0.5;
    const riverMidX = getRoadX(riverMidZ);

    // 1. Riverbed sandy floor (580m wide across river view)
    const bedGeo = new THREE.PlaneGeometry(580, riverLen);
    bedGeo.rotateX(-Math.PI / 2);
    const bedMesh = new THREE.Mesh(bedGeo, sandMat);
    bedMesh.position.set(riverMidX, riverbedY, riverMidZ);
    bedMesh.receiveShadow = true;
    disposableGeos.push(bedGeo);
    group.add(bedMesh);

    // 2. Smoothly sloped alluvial sandy riverbanks connecting green paddy ground (-0.34) down to riverbed (-2.65)
    for (const bank of [
      { zNear: b.zRiverStart + 20, zFar: b.zRiverStart - 22, yNear: -0.34, yFar: riverbedY },
      { zNear: b.zRiverEnd + 22, zFar: b.zRiverEnd - 20, yNear: riverbedY, yFar: -0.34 },
    ]) {
      const bankLen = bank.zNear - bank.zFar;
      const bankGeo = new THREE.PlaneGeometry(540, bankLen, 1, 6);
      bankGeo.rotateX(-Math.PI / 2);
      const pos = bankGeo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const localZ = pos.getZ(v); // +bankLen/2 = zNear, -bankLen/2 = zFar
        const t = THREE.MathUtils.clamp((bankLen * 0.5 - localZ) / bankLen, 0, 1);
        pos.setY(v, THREE.MathUtils.lerp(bank.yNear, bank.yFar, t));
      }
      bankGeo.computeVertexNormals();
      const bankMesh = new THREE.Mesh(bankGeo, sandMat);
      const midZ = (bank.zNear + bank.zFar) * 0.5;
      bankMesh.position.set(getRoadX(midZ), 0, midZ);
      bankMesh.receiveShadow = true;
      disposableGeos.push(bankGeo);
      group.add(bankMesh);
    }

    // 3. Animated River Water Surface (যমুনা নদী / মেঘনা নদী)
    const waterTex = createRiverWaterTexture(b.riverWaterHex, maxAnisotropy);
    waterTextures.push(waterTex);
    disposableTexs.push(waterTex);

    const waterMat = new THREE.MeshStandardMaterial({
      map: waterTex,
      roughness: 0.14,
      metalness: 0.42,
    });
    disposableMats.push(waterMat);

    const waterGeo = new THREE.PlaneGeometry(660, riverLen);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMesh = new THREE.Mesh(waterGeo, waterMat);
    waterMesh.position.set(riverMidX, waterY, riverMidZ);
    waterMesh.receiveShadow = true;
    disposableGeos.push(waterGeo);
    group.add(waterMesh);

    // 4. Alluvial Jamuna Char Sandbars (যমুনার চর) with wild Kashful plumes
    const charConfigs = b.isJamuna
      ? [
          { xOff: -72, zOff: 95, rx: 32, rz: 105 },
          { xOff: 84, zOff: -45, rx: 38, rz: 135 },
          { xOff: -98, zOff: -145, rx: 28, rz: 90 },
          { xOff: 128, zOff: 155, rx: 34, rz: 82 },
        ]
      : [
          { xOff: -68, zOff: 25, rx: 24, rz: 68 },
          { xOff: 78, zOff: -35, rx: 26, rz: 74 },
        ];

    const charGeo = new THREE.CylinderGeometry(0.82, 1.0, 1.15, 12);
    disposableGeos.push(charGeo);

    const kashPositions: THREE.Vector3[] = [];
    for (const cc of charConfigs) {
      const cz = riverMidZ + cc.zOff;
      const cx = getRoadX(cz) + cc.xOff;
      const charMesh = new THREE.Mesh(charGeo, sandMat);
      charMesh.scale.set(cc.rx, 1, cc.rz);
      charMesh.position.set(cx, waterY - 0.12, cz);
      charMesh.receiveShadow = true;
      group.add(charMesh);

      for (let k = 0; k < 22; k++) {
        const angle = k * 2.39996;
        const rad = Math.sqrt((k + 0.4) / 22) * 0.65;
        kashPositions.push(
          new THREE.Vector3(
            cx + Math.cos(angle) * cc.rx * rad,
            waterY + 0.42,
            cz + Math.sin(angle) * cc.rz * rad
          )
        );
      }
    }

    if (kashPositions.length > 0) {
      const plumeGeo = new THREE.ConeGeometry(0.24, 1.45, 5);
      plumeGeo.translate(0, 0.72, 0);
      disposableGeos.push(plumeGeo);
      const kashInst = new THREE.InstancedMesh(plumeGeo, kashfulMat, kashPositions.length);
      const dummy = new THREE.Object3D();
      for (let i = 0; i < kashPositions.length; i++) {
        dummy.position.copy(kashPositions[i]);
        dummy.rotation.set(0.08 * Math.sin(i), i * 1.1, 0.08 * Math.cos(i));
        dummy.scale.setScalar(0.8 + (i % 4) * 0.18);
        dummy.updateMatrix();
        kashInst.setMatrixAt(i, dummy.matrix);
      }
      kashInst.instanceMatrix.needsUpdate = true;
      kashInst.computeBoundingSphere();
      group.add(kashInst);
    }

    // 5. Floating Bangladeshi Nouka Boats & Cargo Trawlers on the River
    const boatCount = b.isJamuna ? 14 : 8;
    for (let i = 0; i < boatCount; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const zOff = ((i / boatCount) - 0.5) * (b.zRiverStart - b.zRiverEnd - 80);
      const bz = riverMidZ + zOff;
      const bx = getRoadX(bz) + side * (24 + ((i * 29) % 105));
      const isTrawler = i % 3 === 0;
      const boatGroup = createBangladeshiNouka(
        boatHullMat,
        isTrawler ? boatTrawlerCanopyMat : boatCanopyMat,
        woodMat,
        isTrawler
      );
      boatGroup.position.set(bx, waterY + 0.04, bz);
      boatGroup.rotation.y = (side > 0 ? 0.4 : -0.4) + (i % 4) * 0.5;
      group.add(boatGroup);
      boats.push({
        group: boatGroup,
        baseX: bx,
        baseZ: bz,
        driftRange: 10 + (i % 4) * 4,
        speed: 0.18 + (i % 5) * 0.05,
        phase: i * 1.37,
      });
    }

    // 6. Reinforced Concrete Box-Girder Bridge Deck & Parapets
    const halfDeckW = roadWidth * 0.5 + 1.35;
    const railExtraLeft = b.hasRailDeck ? -3.85 : 0;
    const soffitLeft = -halfDeckW + railExtraLeft;
    const soffitRight = halfDeckW;

    // Main structural concrete girder soffit under highway (+ rail deck if dual-purpose bridge)
    const soffitGeo = buildExtrudedBridgeStrip(
      b.zApproachStart,
      b.zApproachEnd,
      8,
      soffitLeft,
      soffitRight,
      -0.01,
      -1.55,
      routeId,
      getRoadX,
      getRoadTangentAngle
    );
    const soffitMesh = new THREE.Mesh(soffitGeo, concreteDeckMat);
    soffitMesh.castShadow = true;
    soffitMesh.receiveShadow = true;
    disposableGeos.push(soffitGeo);
    group.add(soffitMesh);

    // Outer New Jersey concrete crash barriers along both road edges
    const leftParapetGeo = buildExtrudedBridgeStrip(
      b.zApproachStart,
      b.zApproachEnd,
      8,
      -roadWidth * 0.5 - 0.55,
      -roadWidth * 0.5 - 0.06,
      1.02,
      -0.02,
      routeId,
      getRoadX,
      getRoadTangentAngle
    );
    const rightParapetGeo = buildExtrudedBridgeStrip(
      b.zApproachStart,
      b.zApproachEnd,
      8,
      roadWidth * 0.5 + 0.06,
      roadWidth * 0.5 + 0.55,
      1.02,
      -0.02,
      routeId,
      getRoadX,
      getRoadTangentAngle
    );
    const leftParapetMesh = new THREE.Mesh(leftParapetGeo, concreteDeckMat);
    const rightParapetMesh = new THREE.Mesh(rightParapetGeo, concreteDeckMat);
    leftParapetMesh.castShadow = true;
    rightParapetMesh.castShadow = true;
    disposableGeos.push(leftParapetGeo, rightParapetGeo);
    group.add(leftParapetMesh, rightParapetMesh);

    // Top steel guard handrails along both parapets
    const leftRailTopGeo = buildExtrudedBridgeStrip(
      b.zApproachStart,
      b.zApproachEnd,
      10,
      -roadWidth * 0.5 - 0.42,
      -roadWidth * 0.5 - 0.24,
      1.28,
      1.14,
      routeId,
      getRoadX,
      getRoadTangentAngle
    );
    const rightRailTopGeo = buildExtrudedBridgeStrip(
      b.zApproachStart,
      b.zApproachEnd,
      10,
      roadWidth * 0.5 + 0.24,
      roadWidth * 0.5 + 0.42,
      1.28,
      1.14,
      routeId,
      getRoadX,
      getRoadTangentAngle
    );
    const leftRailMesh = new THREE.Mesh(leftRailTopGeo, railSteelMat);
    const rightRailMesh = new THREE.Mesh(rightRailTopGeo, railSteelMat);
    disposableGeos.push(leftRailTopGeo, rightRailTopGeo);
    group.add(leftRailMesh, rightRailMesh);

    // Center concrete bridge median divider (low-profile safety barrier with reflective top cap)
    const centerDivGeo = buildExtrudedBridgeStrip(
      b.zRiverStart + 18,
      b.zRiverEnd - 18,
      8,
      -0.16,
      0.16,
      0.46,
      0.0,
      routeId,
      getRoadX,
      getRoadTangentAngle
    );
    const centerCapGeo = buildExtrudedBridgeStrip(
      b.zRiverStart + 18,
      b.zRiverEnd - 18,
      8,
      -0.14,
      0.14,
      0.52,
      0.46,
      routeId,
      getRoadX,
      getRoadTangentAngle
    );
    const centerDivMesh = new THREE.Mesh(centerDivGeo, concreteDeckMat);
    const centerCapMesh = new THREE.Mesh(centerCapGeo, medianHazardMat);
    disposableGeos.push(centerDivGeo, centerCapGeo);
    group.add(centerDivMesh, centerCapMesh);

    // 7. Signature Parallel Railway Track & Steel Truss on Jamuna / Bhairab Bridge
    if (b.hasRailDeck) {
      const railCenterOff = -(roadWidth * 0.5 + 2.75);

      // Crushed ballast bed
      const ballastGeo = buildCurvedRibbonPlane(
        b.zApproachStart,
        b.zApproachEnd,
        8,
        railCenterOff - 1.35,
        railCenterOff + 1.35,
        0.04,
        routeId,
        getRoadX,
        getRoadTangentAngle
      );
      const ballastMesh = new THREE.Mesh(ballastGeo, ballastMat);
      disposableGeos.push(ballastGeo);
      group.add(ballastMesh);

      // Twin gleaming continuous steel rails
      for (const rOff of [-0.68, 0.68]) {
        const steelRailGeo = buildExtrudedBridgeStrip(
          b.zApproachStart,
          b.zApproachEnd,
          10,
          railCenterOff + rOff - 0.06,
          railCenterOff + rOff + 0.06,
          0.22,
          0.08,
          routeId,
          getRoadX,
          getRoadTangentAngle
        );
        const steelRailMesh = new THREE.Mesh(steelRailGeo, railSteelMat);
        disposableGeos.push(steelRailGeo);
        group.add(steelRailMesh);
      }

      // Instanced railway sleepers (স্লিপার) along rail bed
      const sleeperStep = 1.45;
      const sleeperCount = Math.floor((b.zApproachStart - b.zApproachEnd) / sleeperStep);
      const sleeperGeo = new THREE.BoxGeometry(2.15, 0.09, 0.28);
      disposableGeos.push(sleeperGeo);
      const sleepers = new THREE.InstancedMesh(sleeperGeo, sleeperMat, sleeperCount);
      const sDummy = new THREE.Object3D();
      for (let i = 0; i < sleeperCount; i++) {
        const sz = b.zApproachStart - (i + 0.5) * sleeperStep;
        const scx = getRoadX(sz);
        const scy = getRoadY(sz, routeId);
        const sang = getRoadTangentAngle(sz);
        sDummy.position.set(
          scx + Math.cos(sang) * railCenterOff,
          scy + 0.08,
          sz - Math.sin(sang) * railCenterOff
        );
        sDummy.rotation.set(0, sang, 0);
        sDummy.updateMatrix();
        sleepers.setMatrixAt(i, sDummy.matrix);
      }
      sleepers.instanceMatrix.needsUpdate = true;
      sleepers.computeBoundingSphere();
      group.add(sleepers);

      // Overhead Warren-style Steel Truss Portals framing the Railway Side across the river
      const trussPortals = b.isJamuna ? 14 : 8;
      const portalParts: THREE.BufferGeometry[] = [];
      const pL = new THREE.BoxGeometry(0.26, 4.6, 0.28);
      pL.translate(-1.55, 2.3, 0);
      portalParts.push(toMergeable(pL));
      const pR = new THREE.BoxGeometry(0.26, 4.6, 0.28);
      pR.translate(1.55, 2.3, 0);
      portalParts.push(toMergeable(pR));
      const pTop = new THREE.BoxGeometry(3.4, 0.34, 0.32);
      pTop.translate(0, 4.55, 0);
      portalParts.push(toMergeable(pTop));
      const pBrace = new THREE.BoxGeometry(2.8, 0.16, 0.16);
      pBrace.rotateZ(0.45);
      pBrace.translate(0, 3.85, 0);
      portalParts.push(toMergeable(pBrace));

      const portalGeo = mergeGeometries(portalParts, false);
      portalParts.forEach((p) => p.dispose());
      disposableGeos.push(portalGeo);

      const portalInst = new THREE.InstancedMesh(portalGeo, trussSteelMat, trussPortals);
      for (let i = 0; i < trussPortals; i++) {
        const t = (i + 0.5) / trussPortals;
        const pz = THREE.MathUtils.lerp(b.zRiverStart, b.zRiverEnd, t);
        const pcx = getRoadX(pz);
        const pcy = getRoadY(pz, routeId);
        const pang = getRoadTangentAngle(pz);
        sDummy.position.set(
          pcx + Math.cos(pang) * railCenterOff,
          pcy,
          pz - Math.sin(pang) * railCenterOff
        );
        sDummy.rotation.set(0, pang, 0);
        sDummy.updateMatrix();
        portalInst.setMatrixAt(i, sDummy.matrix);
      }
      portalInst.instanceMatrix.needsUpdate = true;
      portalInst.computeBoundingSphere();
      group.add(portalInst);
    }

    // 8. Massive Flared Concrete Bridge Piers & Caissons (প্রতি ৪৪ মিটার পরপর)
    const pierDeckWidth = soffitRight - soffitLeft + 1.4;
    const pierShiftX = (soffitLeft + soffitRight) * 0.5;
    const pierGeo = buildPierGeo(pierDeckWidth, pierShiftX);
    disposableGeos.push(pierGeo);

    const pierZList: number[] = [];
    for (let pz = b.zApproachStart - 34; pz >= b.zApproachEnd + 34; pz -= 42) {
      if (getRoadY(pz, routeId) > 1.8) {
        pierZList.push(pz);
      }
    }
    if (pierZList.length > 0) {
      const pierInst = new THREE.InstancedMesh(pierGeo, concretePierMat, pierZList.length);
      const pDummy = new THREE.Object3D();
      for (let i = 0; i < pierZList.length; i++) {
        const pz = pierZList[i];
        const pcx = getRoadX(pz);
        const pang = getRoadTangentAngle(pz);
        const deckY = getRoadY(pz, routeId);
        // Scale pier vertically if deck has slight camber
        const yScale = Math.max(0.5, (deckY - 0.1) / 6.3);
        pDummy.position.set(pcx, 0, pz);
        pDummy.rotation.set(0, pang, 0);
        pDummy.scale.set(1, yScale, 1);
        pDummy.updateMatrix();
        pierInst.setMatrixAt(i, pDummy.matrix);
      }
      pierInst.instanceMatrix.needsUpdate = true;
      pierInst.computeBoundingSphere();
      group.add(pierInst);
    }

    // 9. Bridge Lamp Pole Coordinates (attached to right & left bridge parapets)
    for (let lz = b.zApproachStart - 22; lz >= b.zApproachEnd + 22; lz -= 44) {
      for (const side of [-1, 1] as const) {
        const lcx = getRoadX(lz);
        const lcy = getRoadY(lz, routeId) + 0.95;
        const lang = getRoadTangentAngle(lz);
        const off = side * (roadWidth * 0.5 + 0.34);
        const px = lcx + Math.cos(lang) * off;
        const pz = lz - Math.sin(lang) * off;
        const rotY = lang + (side === 1 ? Math.PI : 0);
        lampPlacements.push({
          poleX: px,
          poleY: lcy,
          poleZ: pz,
          rotY,
          x: px + Math.cos(rotY) * 1.82,
          y: lcy + 5.9,
          z: pz - Math.sin(rotY) * 1.82,
        });
      }
    }

    // 10. Grand Bridge Welcome Portal Arches + River Name Signboards
    const portalConfigs = [
      { z: b.zApproachStart - 8, label: b.bridgeNameBn, sub: b.bridgeSubText },
      { z: b.zRiverEnd + 10, label: b.bridgeNameBn, sub: 'শুভ যাত্রা · গতিসীমা ৬০ কি.মি./ঘন্টা' },
    ];
    for (const pc of portalConfigs) {
      const pcx = getRoadX(pc.z);
      const pcy = getRoadY(pc.z, routeId);
      const pang = getRoadTangentAngle(pc.z);
      const portal = new THREE.Group();
      portal.position.set(pcx, pcy, pc.z);
      portal.rotation.y = pang;

      const archMat = new THREE.MeshStandardMaterial({
        color: b.isJamuna ? 0x1e3a8a : 0x0f766e,
        roughness: 0.4,
        metalness: 0.35,
      });
      disposableMats.push(archMat);

      const legGeo = new THREE.BoxGeometry(0.65, 6.8, 0.75);
      const crossGeo = new THREE.BoxGeometry(roadWidth + 2.4, 1.55, 0.85);
      disposableGeos.push(legGeo, crossGeo);

      const legL = new THREE.Mesh(legGeo, archMat);
      legL.position.set(-(roadWidth * 0.5 + 0.45), 3.4, 0);
      const legR = new THREE.Mesh(legGeo, archMat);
      legR.position.set(roadWidth * 0.5 + 0.45, 3.4, 0);
      const cross = new THREE.Mesh(crossGeo, archMat);
      cross.position.set(0, 6.65, 0);

      const signTex = createSignBoardTexture(
        pc.label,
        pc.sub,
        b.isJamuna ? '#172554' : '#064e3b',
        '#fde047',
        '#38bdf8',
        maxAnisotropy
      );
      disposableTexs.push(signTex);
      const signGeo = new THREE.PlaneGeometry(12.2, 1.35);
      const signMat = new THREE.MeshBasicMaterial({ map: signTex });
      disposableGeos.push(signGeo);
      disposableMats.push(signMat);

      const signFront = new THREE.Mesh(signGeo, signMat);
      signFront.position.set(0, 6.65, 0.44);

      portal.add(legL, legR, cross, signFront);
      group.add(portal);
    }

    // Blue River Bank Marker Signboard right at water's edge
    const bankSignZ = b.zRiverStart - 12;
    const bsx = getRoadX(bankSignZ);
    const bsy = getRoadY(bankSignZ, routeId);
    const bsang = getRoadTangentAngle(bankSignZ);
    const bankBoardGroup = new THREE.Group();
    bankBoardGroup.position.set(
      bsx + Math.cos(bsang) * (roadWidth * 0.5 + 0.9),
      bsy + 0.9,
      bankSignZ - Math.sin(bsang) * (roadWidth * 0.5 + 0.9)
    );
    bankBoardGroup.rotation.y = bsang;

    const rPostGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 8);
    const rBoardGeo = new THREE.BoxGeometry(3.4, 1.35, 0.1);
    const rTex = createSignBoardTexture(b.riverNameBn, 'নদীর উপর সেতু', '#0369a1', '#ffffff', '#fde047', maxAnisotropy);
    const rBoardMat = new THREE.MeshBasicMaterial({ map: rTex });
    disposableGeos.push(rPostGeo, rBoardGeo);
    disposableTexs.push(rTex);
    disposableMats.push(rBoardMat);

    const rPost = new THREE.Mesh(rPostGeo, railSteelMat);
    rPost.position.y = 1.4;
    const rBoard = new THREE.Mesh(rBoardGeo, rBoardMat);
    rBoard.position.y = 2.65;
    bankBoardGroup.add(rPost, rBoard);
    group.add(bankBoardGroup);
  }

  return {
    group,
    lampPlacements,
    update(delta: number, elapsed: number) {
      for (const tex of waterTextures) {
        tex.offset.x = (tex.offset.x + delta * 0.036) % 1;
        tex.offset.y = (tex.offset.y + delta * 0.011) % 1;
      }
      for (const bt of boats) {
        const t = elapsed * bt.speed + bt.phase;
        bt.group.position.x = bt.baseX + Math.sin(t) * bt.driftRange;
        bt.group.position.z = bt.baseZ + Math.cos(t * 0.7) * 3.5;
        bt.group.rotation.z = Math.sin(elapsed * 1.9 + bt.phase) * 0.035;
        bt.group.rotation.x = Math.cos(elapsed * 1.4 + bt.phase) * 0.02;
      }
    },
    dispose() {
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
      disposableTexs.forEach((t) => t.dispose());
    },
  };
}
