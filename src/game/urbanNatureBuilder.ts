import * as THREE from 'three';
import {
  createCityBuildingTexture,
  createSignBoardTexture,
  createVillageTinHouseTexture,
} from './textures';
import { RouteConfig } from './types';
import {
  getUrbanZones,
  isInsideBridgeApproach,
  isInsideUrbanZone,
} from './worldHelpers';

export interface UrbanNatureBuildResult {
  group: THREE.Group;
  dispose: () => void;
}

export function buildUrbanAndRuralBuildings(
  route: RouteConfig,
  roadWidth: number,
  maxAnisotropy: number,
  getRoadX: (z: number) => number,
  getRoadTangentAngle: (z: number) => number
): UrbanNatureBuildResult {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];

  // Shared materials for rooftops, water tanks, tin roofs, concrete curbs
  const roofParapetMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.86 });
  const tankBlueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.35, metalness: 0.15 });
  const tankBlackMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.45, metalness: 0.1 });
  const stairHouseMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.85 });
  const tinRoofRedMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.55, metalness: 0.45 });
  const tinRoofBlueMat = new THREE.MeshStandardMaterial({ color: 0x1e40af, roughness: 0.55, metalness: 0.45 });
  const tinRoofZincMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.5, metalness: 0.55 });
  const curbConcreteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.88 });
  const curbStripeMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 });

  mats.push(
    roofParapetMat,
    tankBlueMat,
    tankBlackMat,
    stairHouseMat,
    tinRoofRedMat,
    tinRoofBlueMat,
    tinRoofZincMat,
    curbConcreteMat,
    curbStripeMat
  );

  // 4 realistic Bangladeshi apartment / commercial tower facade variants
  const facadeConfigs = [
    { wall: '#e7d8c3', accent: '#c28b5b', floors: 5 }, // Warm cream & terracotta trim
    { wall: '#d8e2e8', accent: '#64748b', floors: 6 }, // Light grey/slate high-rise
    { wall: '#c96f55', accent: '#f1e5d1', floors: 4 }, // Bangladeshi red-brick plaster
    { wall: '#d6e5d8', accent: '#0f766e', floors: 5 }, // Mint-sage city commercial
  ];

  const facadeMats: THREE.MeshStandardMaterial[] = facadeConfigs.map((cfg) => {
    const tex = createCityBuildingTexture(cfg.wall, cfg.accent, cfg.floors, maxAnisotropy);
    texs.push(tex);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82 });
    mats.push(mat);
    return mat;
  });

  const tankGeo = new THREE.CylinderGeometry(0.75, 0.78, 1.35, 10);
  const parapetGeo = new THREE.BoxGeometry(1, 0.55, 1);
  const stairGeo = new THREE.BoxGeometry(2.6, 2.2, 2.4);
  geos.push(tankGeo, parapetGeo, stairGeo);

  // 1. Bangladeshi Cities & Towns around Terminals and Major Stops
  const urbanZones = getUrbanZones(route.id);

  // Check spacing from route stops so buildings don't overlap bus stands/pumps
  const nearStop = (z: number) => route.stops.some((s) => Math.abs(s.z - z) < 28);

  for (const uz of urbanZones) {
    const step = uz.density === 'metro' ? 18 : uz.density === 'city' ? 22 : 28;
    for (let z = uz.zStart; z >= uz.zEnd; z -= step) {
      if (isInsideBridgeApproach(z, route.id, 14) || nearStop(z)) continue;

      const cx = getRoadX(z);
      const ang = getRoadTangentAngle(z);
      const cosA = Math.cos(ang);
      const sinA = Math.sin(ang);

      for (const side of [-1, 1] as const) {
        // Avoid placing close buildings directly in front of left-side petrol pumps
        const seed = Math.abs(Math.round(z * 1.7 + side * 31));
        const bWidth = 9.5 + (seed % 4) * 1.6;
        const bDepth = 9.0 + ((seed >> 2) % 3) * 1.8;
        const floors =
          uz.density === 'metro'
            ? 4 + (seed % 3)
            : uz.density === 'city'
              ? 3 + (seed % 3)
              : 2 + (seed % 2);
        const bHeight = floors * 3.15;

        const distFromCenter = roadWidth * 0.5 + 8.5 + bWidth * 0.5 + (seed % 5) * 1.4;
        const bx = cx + cosA * side * distFromCenter;
        const bz = z - sinA * side * distFromCenter;

        const bGroup = new THREE.Group();
        bGroup.position.set(bx, -0.34, bz);
        bGroup.rotation.y = ang + (side === -1 ? Math.PI / 2 : -Math.PI / 2);

        const bodyGeo = new THREE.BoxGeometry(bWidth, bHeight, bDepth);
        geos.push(bodyGeo);
        const fMat = facadeMats[seed % facadeMats.length];
        const body = new THREE.Mesh(bodyGeo, fMat);
        body.position.y = bHeight * 0.5;
        body.castShadow = true;
        body.receiveShadow = true;
        bGroup.add(body);

        // Rooftop parapet slab + stairhead penthouse (চিলেকোঠা) + Gazi/Sera water tank
        const roofCap = new THREE.Mesh(parapetGeo, roofParapetMat);
        roofCap.scale.set(bWidth + 0.35, 1, bDepth + 0.35);
        roofCap.position.y = bHeight + 0.25;
        bGroup.add(roofCap);

        const stair = new THREE.Mesh(stairGeo, stairHouseMat);
        stair.position.set(-bWidth * 0.2, bHeight + 1.1, -bDepth * 0.15);
        bGroup.add(stair);

        const tank = new THREE.Mesh(tankGeo, seed % 3 === 0 ? tankBlackMat : tankBlueMat);
        tank.position.set(bWidth * 0.22, bHeight + 1.0, bDepth * 0.18);
        bGroup.add(tank);

        group.add(bGroup);

        // Second-row background city skyline towers in Metro/City zones
        if (uz.density !== 'town' && seed % 2 === 0) {
          const backDist = distFromCenter + 14.5 + (seed % 6);
          const bgX = cx + cosA * side * backDist;
          const bgZ = z - sinA * side * backDist;
          const bgH = (5 + (seed % 4)) * 3.1;
          const bgGeo = new THREE.BoxGeometry(11, bgH, 10.5);
          geos.push(bgGeo);
          const bgTower = new THREE.Mesh(bgGeo, facadeMats[(seed + 1) % facadeMats.length]);
          bgTower.position.set(bgX, bgH * 0.5 - 0.34, bgZ);
          bgTower.rotation.y = ang;
          group.add(bgTower);
        }
      }

      // Urban raised concrete sidewalk curbs along city highway shoulders
      const sidewalkL = new THREE.BoxGeometry(1.1, 0.24, step - 0.4);
      geos.push(sidewalkL);
      for (const side of [-1, 1] as const) {
        const sOff = side * (roadWidth * 0.5 + 2.7);
        const sw = new THREE.Mesh(
          sidewalkL,
          Math.abs(Math.round(z)) % (step * 2) === 0 ? curbConcreteMat : curbStripeMat
        );
        sw.position.set(cx + cosA * sOff, 0.08, z - sinA * sOff);
        sw.rotation.y = ang;
        group.add(sw);
      }
    }

    // Grand Urban City Welcome Arch Gantry
    if (uz.gateZ !== undefined && !nearStop(uz.gateZ)) {
      const gz = uz.gateZ;
      const gcx = getRoadX(gz);
      const gang = getRoadTangentAngle(gz);
      const gate = new THREE.Group();
      gate.position.set(gcx, 0, gz);
      gate.rotation.y = gang;

      const archColMat = new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.45 });
      mats.push(archColMat);

      const legGeo = new THREE.BoxGeometry(0.7, 6.4, 0.8);
      const beamGeo = new THREE.BoxGeometry(roadWidth + 3.2, 1.5, 0.9);
      geos.push(legGeo, beamGeo);

      const legL = new THREE.Mesh(legGeo, archColMat);
      legL.position.set(-(roadWidth * 0.5 + 1.1), 3.2, 0);
      const legR = new THREE.Mesh(legGeo, archColMat);
      legR.position.set(roadWidth * 0.5 + 1.1, 3.2, 0);
      const beam = new THREE.Mesh(beamGeo, archColMat);
      beam.position.set(0, 6.3, 0);

      const gTex = createSignBoardTexture(
        uz.cityNameBn,
        uz.citySubText,
        '#064e3b',
        '#ffffff',
        '#fbbf24',
        maxAnisotropy
      );
      texs.push(gTex);
      const gPlaneGeo = new THREE.PlaneGeometry(11.6, 1.25);
      const gPlaneMat = new THREE.MeshBasicMaterial({ map: gTex });
      geos.push(gPlaneGeo);
      mats.push(gPlaneMat);

      const board = new THREE.Mesh(gPlaneGeo, gPlaneMat);
      board.position.set(0, 6.3, 0.47);
      gate.add(legL, legR, beam, board);
      group.add(gate);
    }
  }

  // 2. Rural Bangladeshi Tin-Shed Village Homesteads (গ্রামের টিনের ঘর ও উঠান)
  const tinWallTex = createVillageTinHouseTexture(maxAnisotropy);
  texs.push(tinWallTex);
  const tinWallMat = new THREE.MeshStandardMaterial({ map: tinWallTex, roughness: 0.72 });
  const mudPlinthMat = new THREE.MeshStandardMaterial({ color: 0x7c6a54, roughness: 0.94 });
  mats.push(tinWallMat, mudPlinthMat);

  const plinthGeo = new THREE.BoxGeometry(7.6, 0.42, 5.4);
  const cottageBodyGeo = new THREE.BoxGeometry(6.8, 2.7, 4.4);
  const cottageRoofGeo = new THREE.ConeGeometry(4.65, 1.55, 4);
  cottageRoofGeo.rotateY(Math.PI / 4);
  geos.push(plinthGeo, cottageBodyGeo, cottageRoofGeo);

  for (let z = -310; z >= -(route.totalLengthM - 220); z -= 210) {
    if (isInsideBridgeApproach(z, route.id, 30) || isInsideUrbanZone(z, route.id) || nearStop(z)) {
      continue;
    }

    const idx = Math.abs(Math.round(z));
    const side = idx % 2 === 0 ? -1 : 1;
    const cx = getRoadX(z);
    const ang = getRoadTangentAngle(z);
    const dist = 21 + (idx % 14);
    const hx = cx + Math.cos(ang) * side * dist;
    const hz = z - Math.sin(ang) * side * dist;

    const homestead = new THREE.Group();
    homestead.position.set(hx, -0.34, hz);
    homestead.rotation.y = ang + (side === -1 ? Math.PI * 0.42 : -Math.PI * 0.42);

    const plinth = new THREE.Mesh(plinthGeo, mudPlinthMat);
    plinth.position.y = 0.21;
    plinth.receiveShadow = true;

    const body = new THREE.Mesh(cottageBodyGeo, tinWallMat);
    body.position.y = 1.77;
    body.castShadow = true;
    body.receiveShadow = true;

    const roofMat =
      idx % 3 === 0 ? tinRoofRedMat : idx % 3 === 1 ? tinRoofBlueMat : tinRoofZincMat;
    const roof = new THREE.Mesh(cottageRoofGeo, roofMat);
    roof.scale.set(1.18, 1.0, 0.82);
    roof.position.y = 3.85;
    roof.castShadow = true;

    homestead.add(plinth, body, roof);
    group.add(homestead);
  }

  return {
    group,
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
