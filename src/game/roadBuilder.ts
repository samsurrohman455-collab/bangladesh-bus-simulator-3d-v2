import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  createDrainageEmbankmentTexture,
  createMuddyShoulderTexture,
  createPotholeDecalTexture,
  createRoadNormalMap,
  createRoadRoughnessMap,
  createRoadVariantTexture,
  createUrbanShoulderTexture,
  createZebraCrossingTexture,
  RoadSurfaceVariant,
} from './roadTextures';
import { createBrickShoulderTexture, createSignBoardTexture } from './textures';
import { RouteConfig } from './types';
import {
  getRepairZones,
  getRoadSlopeAngle,
  getRoadSurfaceVariantAt,
  getRoadY,
  getUrbanZones,
  isInsideBridgeApproach,
  isInsideUrbanZone,
} from './worldHelpers';

export interface RoadSystemResult {
  group: THREE.Group;
  setWeatherSurface: (rainFactor: number) => void;
  dispose: () => void;
}

interface LandInterval {
  zStart: number;
  zEnd: number;
}

const ROAD_VARIANTS: RoadSurfaceVariant[] = [
  'dhaka',
  'highway',
  'town',
  'market',
  'rural',
  'domar_local',
  'bridge',
  'concrete',
  'repair',
];

// Subtle vertex tint per variant to smooth tonal transitions across zones
const VARIANT_TINT: Record<RoadSurfaceVariant, [number, number, number]> = {
  dhaka: [0.96, 0.96, 0.97],
  highway: [0.98, 0.98, 0.98],
  town: [1.0, 0.99, 0.97],
  market: [1.01, 0.99, 0.95],
  rural: [1.01, 0.98, 0.94],
  domar_local: [1.02, 0.98, 0.92],
  bridge: [1.0, 1.0, 1.01],
  concrete: [1.0, 1.0, 0.99],
  repair: [1.01, 0.97, 0.92],
};

function getShoulderIntervals(
  startZ: number,
  endZ: number,
  bridges: { zApproachStart: number; zApproachEnd: number }[]
): LandInterval[] {
  const sorted = [...bridges].sort((a, b) => b.zApproachStart - a.zApproachStart);
  const intervals: LandInterval[] = [];
  let cursor = startZ;

  for (const b of sorted) {
    const cutStart = b.zApproachStart;
    const cutEnd = b.zApproachEnd;
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

function createRoadPbrMaterial(
  variant: RoadSurfaceVariant,
  albedoTex: THREE.CanvasTexture,
  normalTex: THREE.CanvasTexture,
  roughnessTex: THREE.CanvasTexture,
  sharedRainUniform: { value: number },
  isTransitionLayer = false
): THREE.MeshStandardMaterial {
  const dustBiasMap: Record<RoadSurfaceVariant, number> = {
    dhaka: 0.24,
    highway: 0.44,
    town: 0.58,
    market: 0.72,
    rural: 0.84,
    domar_local: 0.94,
    bridge: 0.2,
    concrete: 0.34,
    repair: 0.88,
  };

  const baseRoughnessMap: Record<RoadSurfaceVariant, number> = {
    dhaka: 0.86,
    highway: 0.88,
    town: 0.91,
    market: 0.93,
    rural: 0.94,
    domar_local: 0.96,
    bridge: 0.89,
    concrete: 0.92,
    repair: 0.96,
  };

  // Wet asphalt reflects subtly (0.36-0.50), avoiding mirror-like or plastic surfaces
  const wetMinRoughnessMap: Record<RoadSurfaceVariant, number> = {
    dhaka: 0.36,
    highway: 0.38,
    town: 0.41,
    market: 0.43,
    rural: 0.45,
    domar_local: 0.47,
    bridge: 0.4,
    concrete: 0.45,
    repair: 0.49,
  };

  const normalStrength =
    variant === 'rural' || variant === 'domar_local' || variant === 'repair'
      ? 0.92
      : variant === 'concrete' || variant === 'bridge'
        ? 0.56
        : 0.74;

  const mat = new THREE.MeshStandardMaterial({
    map: albedoTex,
    normalMap: normalTex,
    normalScale: new THREE.Vector2(normalStrength, normalStrength),
    roughnessMap: roughnessTex,
    roughness: baseRoughnessMap[variant],
    metalness: 0.02, // Strictly dielectric bitumen & crushed aggregate
    vertexColors: true,
    envMapIntensity: 0.22, // Subtle matte response in dry sun; lifted gently in rain
    ...(isTransitionLayer
      ? {
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
        }
      : {}),
  });

  const dustBias = dustBiasMap[variant];
  const wetMinRough = wetMinRoughnessMap[variant];
  const cacheMode = isTransitionLayer ? 'trans' : 'opaque';

  mat.customProgramCacheKey = () => `bd-road-pbr-v2-${variant}-${cacheMode}`;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRainFactor = sharedRainUniform;
    shader.uniforms.uDustBias = { value: dustBias };
    shader.uniforms.uWetMinRoughness = { value: wetMinRough };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRoadWorldPos;
        varying vec2 vRoadUv;
        ${isTransitionLayer ? 'attribute float aTransAlpha;\nvarying float vTransAlpha;' : ''}`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        vRoadUv = uv;
        ${isTransitionLayer ? 'vTransAlpha = aTransAlpha;' : ''}`
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRainFactor;
        uniform float uDustBias;
        uniform float uWetMinRoughness;
        varying vec3 vRoadWorldPos;
        varying vec2 vRoadUv;
        ${isTransitionLayer ? 'varying float vTransAlpha;' : ''}

        float bdRoadHash(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }
        float bdRoadNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          float a = bdRoadHash(i);
          float b = bdRoadHash(i + vec2(1.0, 0.0));
          float c = bdRoadHash(i + vec2(0.0, 1.0));
          float d = bdRoadHash(i + vec2(1.0, 1.0));
          return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
        }
        float bdRoadFbm(vec2 p) {
          return 0.62 * bdRoadNoise(p) + 0.38 * bdRoadNoise(p * 2.13 + vec2(5.7, 11.3));
        }`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float bdMacro = bdRoadFbm(vRoadWorldPos.xz * 0.038);
        float bdMid = bdRoadNoise(vRoadWorldPos.xz * 0.24);
        float bdMicro = bdRoadNoise(vRoadWorldPos.xz * 3.4);
        diffuseColor.rgb *= mix(0.89, 1.11, bdMacro * 0.56 + bdMid * 0.26 + bdMicro * 0.18);

        float bdEdge = smoothstep(0.30, 0.50, abs(vRoadUv.x - 0.5));
        float bdDryDust = bdEdge * uDustBias * (1.0 - uRainFactor * 0.72);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.43, 0.38, 0.30), bdDryDust * 0.42);

        float bdTrackL = exp(-pow((vRoadUv.x - 0.27) / 0.13, 2.0));
        float bdTrackR = exp(-pow((vRoadUv.x - 0.73) / 0.13, 2.0));
        float bdWetNoise = bdRoadFbm(vRoadWorldPos.xz * 0.085 + vec2(3.1, 8.7));
        float bdWetFilm = clamp(bdWetNoise * 0.68 + (bdTrackL + bdTrackR) * 0.42, 0.0, 1.0);
        diffuseColor.rgb *= mix(1.0, mix(0.75, 0.56, bdWetFilm), uRainFactor);
        ${
          isTransitionLayer
            ? `float bdFeather = (bdRoadNoise(vRoadWorldPos.xz * 0.35) - 0.5) * 0.24;
        diffuseColor.a *= clamp(vTransAlpha + bdFeather * (1.0 - abs(vTransAlpha * 2.0 - 1.0)), 0.0, 1.0);`
            : ''
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float bdEdgeR = smoothstep(0.30, 0.50, abs(vRoadUv.x - 0.5));
        float bdDryDustR = bdEdgeR * uDustBias * (1.0 - uRainFactor * 0.72);
        roughnessFactor = clamp(roughnessFactor + bdDryDustR * 0.08, 0.76, 0.98);

        float bdTrackLR = exp(-pow((vRoadUv.x - 0.27) / 0.13, 2.0));
        float bdTrackRR = exp(-pow((vRoadUv.x - 0.73) / 0.13, 2.0));
        float bdWetNoiseR = bdRoadFbm(vRoadWorldPos.xz * 0.085 + vec2(3.1, 8.7));
        float bdWetFilmR = clamp(bdWetNoiseR * 0.68 + (bdTrackLR + bdTrackRR) * 0.42, 0.0, 1.0);
        float bdWetTarget = mix(0.74, uWetMinRoughness, bdWetFilmR);
        roughnessFactor = clamp(mix(roughnessFactor, bdWetTarget, uRainFactor), 0.36, 0.98);`
      );
  };

  return mat;
}

export function buildBangladeshiRoadSystem(
  route: RouteConfig,
  roadWidth: number,
  shoulderExtra: number,
  maxAnisotropy: number,
  getRoadX: (z: number) => number,
  getRoadTangentAngle: (z: number) => number,
  bridges: { zApproachStart: number; zApproachEnd: number; zRiverStart: number; zRiverEnd: number }[]
): RoadSystemResult {
  const group = new THREE.Group();
  const geos: THREE.BufferGeometry[] = [];
  const mats: THREE.Material[] = [];
  const texs: THREE.Texture[] = [];

  const sharedRainUniform = { value: 0 };

  // 1. Shared Linear Normal & Roughness Data Maps + 9 Authentic Road Albedo Variants
  const normalMap = createRoadNormalMap(maxAnisotropy);
  const roughnessMap = createRoadRoughnessMap(maxAnisotropy);
  texs.push(normalMap, roughnessMap);

  const variantMaterials: THREE.MeshStandardMaterial[] = [];
  const transMaterials: THREE.MeshStandardMaterial[] = [];
  const variantIndexMap = new Map<RoadSurfaceVariant, number>();
  ROAD_VARIANTS.forEach((v, idx) => {
    variantIndexMap.set(v, idx);
    const tex = createRoadVariantTexture(v, maxAnisotropy);
    texs.push(tex);
    const mat = createRoadPbrMaterial(v, tex, normalMap, roughnessMap, sharedRainUniform, false);
    const tMat = createRoadPbrMaterial(v, tex, normalMap, roughnessMap, sharedRainUniform, true);
    mats.push(mat, tMat);
    variantMaterials.push(mat);
    transMaterials.push(tMat);
  });

  // 2. Unified Continuous Multi-Zone Curved Road Ribbon (5 cross-section cols for crown & rural unevenness)
  const startZ = 140;
  const endZ = -(route.totalLengthM + 260);
  const totalZ = startZ - endZ;
  const stepZ = 2.5;
  const segZ = Math.ceil(totalZ / stepZ);
  const cols = 5;
  const uCoords = [0, 0.25, 0.5, 0.75, 1.0];
  const crownHeights = [0.0, 0.012, 0.018, 0.012, 0.0];

  const getUnevenOffset = (z: number, vType: RoadSurfaceVariant, interiorWeight: number, phaseShift: number) => {
    const roughAmp =
      vType === 'domar_local'
        ? 0.022
        : vType === 'rural'
          ? 0.016
          : vType === 'repair'
            ? 0.018
            : vType === 'market'
              ? 0.008
              : 0;
    return (
      roughAmp *
      interiorWeight *
      (Math.sin(z * 0.28 + phaseShift) * 0.65 + Math.cos(z * 0.67 - phaseShift * 0.7) * 0.35)
    );
  };

  const rowVariants: RoadSurfaceVariant[] = [];
  for (let i = 0; i <= segZ; i++) {
    const z = startZ - (i / segZ) * totalZ;
    rowVariants.push(getRoadSurfaceVariantAt(z, route.id, route.stops));
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const colors: number[] = [];

  const halfW = roadWidth * 0.5;
  for (let i = 0; i <= segZ; i++) {
    const t = i / segZ;
    const z = startZ - t * totalZ;
    const cx = getRoadX(z);
    const cy = getRoadY(z, route.id);
    const angle = getRoadTangentAngle(z);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const vCur = rowVariants[i];
    const vPrev = rowVariants[Math.max(0, i - 5)];
    const vNext = rowVariants[Math.min(segZ, i + 5)];
    const cCur = VARIANT_TINT[vCur];
    const cPrev = VARIANT_TINT[vPrev];
    const cNext = VARIANT_TINT[vNext];

    const rTint = (cCur[0] * 2 + cPrev[0] + cNext[0]) * 0.25;
    const gTint = (cCur[1] * 2 + cPrev[1] + cNext[1]) * 0.25;
    const bTint = (cCur[2] * 2 + cPrev[2] + cNext[2]) * 0.25;

    for (let c = 0; c < cols; c++) {
      const u = uCoords[c];
      const lat = (u - 0.5) * roadWidth;
      const px = cx + cosA * lat;
      const pz = z - sinA * lat;

      const interiorWeight = c === 0 || c === cols - 1 ? 0 : 1;
      const uneven = getUnevenOffset(z, vCur, interiorWeight, c * 1.1);

      positions.push(px, cy + 0.015 + crownHeights[c] + uneven, pz);
      normals.push(0, 1, 0);
      uvs.push(u, t * (totalZ / 16));

      const edgeFactor = c === 0 || c === cols - 1 ? 0.94 : 1.0;
      colors.push(rTint * edgeFactor, gTint * edgeFactor, bTint * (edgeFactor * 0.98));
    }
  }

  const groupedIndices: number[][] = ROAD_VARIANTS.map(() => []);
  for (let i = 0; i < segZ; i++) {
    const segVariant = rowVariants[i];
    const matIdx = variantIndexMap.get(segVariant) ?? 1;
    const bucket = groupedIndices[matIdx];
    const r0 = i * cols;
    const r1 = (i + 1) * cols;
    for (let c = 0; c < cols - 1; c++) {
      const a = r0 + c;
      const b = a + 1;
      const d0 = r1 + c;
      const d1 = d0 + 1;
      bucket.push(a, d0, b, b, d0, d1);
    }
  }

  const finalIndices: number[] = [];
  const roadGeo = new THREE.BufferGeometry();
  let cursor = 0;
  for (let mIdx = 0; mIdx < ROAD_VARIANTS.length; mIdx++) {
    const arr = groupedIndices[mIdx];
    if (arr.length === 0) continue;
    for (let k = 0; k < arr.length; k++) finalIndices.push(arr[k]);
    roadGeo.addGroup(cursor, arr.length, mIdx);
    cursor += arr.length;
  }

  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  roadGeo.setIndex(finalIndices);
  roadGeo.computeVertexNormals();
  roadGeo.computeTangents();
  geos.push(roadGeo);

  const roadMesh = new THREE.Mesh(roadGeo, variantMaterials);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  // 2b. Seamless Feathered Crossfade Aprons across Every Zone Material Boundary
  const transPos: number[] = [];
  const transNorm: number[] = [];
  const transUv: number[] = [];
  const transColor: number[] = [];
  const transAlpha: number[] = [];
  const transBuckets: number[][] = ROAD_VARIANTS.map(() => []);

  let tVertOffset = 0;
  const blendRows = 6; // 6 * 2.5m = 15m smooth organic feathered transition
  for (let i = 1; i < segZ - blendRows; i++) {
    const prevVar = rowVariants[i - 1];
    const nextVar = rowVariants[i];
    if (prevVar === nextVar) continue;

    // Fade outgoing `prevVar` from alpha 1.0 -> 0.0 over rows [i .. i + blendRows]
    const outMatIdx = variantIndexMap.get(prevVar) ?? 1;
    const bucket = transBuckets[outMatIdx];

    for (let r = 0; r <= blendRows; r++) {
      const rowIdx = i + r;
      const alphaVal = 1 - r / blendRows;
      for (let c = 0; c < cols; c++) {
        const srcV = rowIdx * cols + c;
        transPos.push(positions[srcV * 3], positions[srcV * 3 + 1] + 0.001, positions[srcV * 3 + 2]);
        transNorm.push(0, 1, 0);
        transUv.push(uvs[srcV * 2], uvs[srcV * 2 + 1]);
        transColor.push(colors[srcV * 3], colors[srcV * 3 + 1], colors[srcV * 3 + 2]);
        transAlpha.push(alphaVal);
      }
    }

    for (let r = 0; r < blendRows; r++) {
      const r0 = tVertOffset + r * cols;
      const r1 = r0 + cols;
      for (let c = 0; c < cols - 1; c++) {
        const a = r0 + c;
        const b = a + 1;
        const d0 = r1 + c;
        const d1 = d0 + 1;
        bucket.push(a, d0, b, b, d0, d1);
      }
    }
    tVertOffset += (blendRows + 1) * cols;
  }

  if (transPos.length > 0) {
    const transIndices: number[] = [];
    const transGeo = new THREE.BufferGeometry();
    let tCursor = 0;
    for (let mIdx = 0; mIdx < ROAD_VARIANTS.length; mIdx++) {
      const arr = transBuckets[mIdx];
      if (arr.length === 0) continue;
      for (let k = 0; k < arr.length; k++) transIndices.push(arr[k]);
      transGeo.addGroup(tCursor, arr.length, mIdx);
      tCursor += arr.length;
    }
    transGeo.setAttribute('position', new THREE.Float32BufferAttribute(transPos, 3));
    transGeo.setAttribute('normal', new THREE.Float32BufferAttribute(transNorm, 3));
    transGeo.setAttribute('uv', new THREE.Float32BufferAttribute(transUv, 2));
    transGeo.setAttribute('color', new THREE.Float32BufferAttribute(transColor, 3));
    transGeo.setAttribute('aTransAlpha', new THREE.Float32BufferAttribute(transAlpha, 1));
    transGeo.setIndex(transIndices);
    transGeo.computeVertexNormals();
    transGeo.computeTangents();
    geos.push(transGeo);

    const transMesh = new THREE.Mesh(transGeo, transMaterials);
    transMesh.receiveShadow = true;
    transMesh.renderOrder = 1;
    group.add(transMesh);
  }

  // 3. Separate Left & Right Sloped Shoulders (Urban Concrete Curbside, Brick HBB, Muddy Rural Verge)
  const shoulderIntervals = getShoulderIntervals(startZ, endZ, bridges);
  const brickTex = createBrickShoulderTexture(maxAnisotropy);
  const muddyTex = createMuddyShoulderTexture(maxAnisotropy);
  const urbanShoulderTex = createUrbanShoulderTexture(maxAnisotropy);
  texs.push(brickTex, muddyTex, urbanShoulderTex);

  const brickShoulderMat = new THREE.MeshStandardMaterial({
    map: brickTex,
    roughness: 0.92,
    metalness: 0.01,
    envMapIntensity: 0.25,
  });
  const muddyShoulderMat = new THREE.MeshStandardMaterial({
    map: muddyTex,
    roughness: 0.94,
    metalness: 0.01,
    envMapIntensity: 0.22,
  });
  const urbanShoulderMat = new THREE.MeshStandardMaterial({
    map: urbanShoulderTex,
    roughness: 0.88,
    metalness: 0.02,
    envMapIntensity: 0.28,
  });
  mats.push(brickShoulderMat, muddyShoulderMat, urbanShoulderMat);

  const urbanParts: THREE.BufferGeometry[] = [];
  const brickParts: THREE.BufferGeometry[] = [];
  const muddyParts: THREE.BufferGeometry[] = [];

  for (const iv of shoulderIntervals) {
    const spanLen = iv.zStart - iv.zEnd;
    if (spanLen <= 4) continue;
    const sStep = 8;
    const sCount = Math.max(2, Math.floor(spanLen / sStep));
    const sliceLen = spanLen / sCount;

    for (let s = 0; s < sCount; s++) {
      const z0 = iv.zStart - s * sliceLen;
      const z1 = z0 - sliceLen;
      const zMid = (z0 + z1) * 0.5;
      const vType = getRoadSurfaceVariantAt(zMid, route.id, route.stops);

      const sOuter =
        vType === 'domar_local' || vType === 'rural'
          ? halfW + shoulderExtra + 0.55
          : halfW + shoulderExtra;
      const sInner = halfW - 0.08;

      const sPos: number[] = [];
      const sNorm: number[] = [];
      const sUv: number[] = [];
      // Left shoulder quad (0,1,4,5) & Right shoulder quad (2,3,6,7)
      const sIdx: number[] = [0, 4, 1, 1, 4, 5, 2, 6, 3, 3, 6, 7];

      for (const [rowIdx, z] of [
        [0, z0],
        [1, z1],
      ] as const) {
        const cx = getRoadX(z);
        const angle = getRoadTangentAngle(z);
        const cosA = Math.cos(angle);
        const sinA = Math.sin(angle);
        const vUv = rowIdx * (sliceLen / 6);

        // Left side: outer (-X) -> inner (-X)
        sPos.push(cx - cosA * sOuter, -0.025, z + sinA * sOuter);
        sPos.push(cx - cosA * sInner, 0.013, z + sinA * sInner);
        // Right side: inner (+X) -> outer (+X)
        sPos.push(cx + cosA * sInner, 0.013, z - sinA * sInner);
        sPos.push(cx + cosA * sOuter, -0.025, z - sinA * sOuter);

        sNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
        // U = 0 right next to asphalt edge -> U = 1 out at drainage verge
        sUv.push(1, vUv, 0, vUv, 0, vUv, 1, vUv);
      }

      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(sNorm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(sUv, 2));
      g.setIndex(sIdx);
      g.computeVertexNormals();
      const nonIdx = g.toNonIndexed();
      g.dispose();

      if (vType === 'dhaka' || vType === 'town' || vType === 'concrete') {
        urbanParts.push(nonIdx);
      } else if (vType === 'rural' || vType === 'domar_local') {
        muddyParts.push(nonIdx);
      } else {
        brickParts.push(nonIdx);
      }
    }
  }

  for (const [parts, mat] of [
    [urbanParts, urbanShoulderMat],
    [brickParts, brickShoulderMat],
    [muddyParts, muddyShoulderMat],
  ] as const) {
    if (parts.length === 0) continue;
    const merged = mergeGeometries(parts, false);
    parts.forEach((p) => p.dispose());
    geos.push(merged);
    const m = new THREE.Mesh(merged, mat);
    m.receiveShadow = true;
    group.add(m);
  }

  // 3b. Subtle Concrete Curbstones along Dhaka & City Zones (leaving fuel stations clear)
  const curbGeo = new THREE.BoxGeometry(0.16, 0.09, 3.6);
  geos.push(curbGeo);
  const curbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xb6bac0, roughness: 0.86, metalness: 0.02 });
  const curbDarkMat = new THREE.MeshStandardMaterial({ color: 0x4b4f55, roughness: 0.88, metalness: 0.02 });
  mats.push(curbWhiteMat, curbDarkMat);

  const curbWhiteTransforms: { x: number; z: number; yaw: number }[] = [];
  const curbDarkTransforms: { x: number; z: number; yaw: number }[] = [];
  for (const uz of getUrbanZones(route.id)) {
    if (uz.density === 'town') continue;
    for (let z = uz.zStart; z >= uz.zEnd; z -= 4.0) {
      if (isInsideBridgeApproach(z, route.id, 10)) continue;
      if (route.stops.some((s) => s.type === 'fuel' && Math.abs(s.z - z) < 28)) continue;
      const cx = getRoadX(z);
      const yaw = getRoadTangentAngle(z);
      const cosA = Math.cos(yaw);
      const sinA = Math.sin(yaw);
      const isWhite = Math.abs(Math.round(z / 4)) % 2 === 0;
      const bucket = isWhite ? curbWhiteTransforms : curbDarkTransforms;
      for (const side of [-1, 1] as const) {
        const lat = side * (halfW + 0.08);
        bucket.push({
          x: cx + cosA * lat,
          z: z - sinA * lat,
          yaw,
        });
      }
    }
  }

  for (const [list, mat] of [
    [curbWhiteTransforms, curbWhiteMat],
    [curbDarkTransforms, curbDarkMat],
  ] as const) {
    if (list.length === 0) continue;
    const inst = new THREE.InstancedMesh(curbGeo, mat, list.length);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < list.length; i++) {
      dummy.position.set(list[i].x, 0.03, list[i].z);
      dummy.rotation.set(0, list[i].yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
    }
    inst.instanceMatrix.needsUpdate = true;
    inst.computeBoundingSphere();
    inst.receiveShadow = true;
    group.add(inst);
  }

  // 4. Sloped Embankment + Small Roadside Drainage Ditches (নর্দমা / ড্রেন)
  const ditchTex = createDrainageEmbankmentTexture(maxAnisotropy);
  texs.push(ditchTex);
  const embankmentMat = new THREE.MeshStandardMaterial({
    map: ditchTex,
    roughness: 0.94,
    metalness: 0.01,
    envMapIntensity: 0.2,
  });
  mats.push(embankmentMat);

  const innerEdge = halfW + shoulderExtra;
  const ditchTrough = innerEdge + 2.25;
  const outerEdge = innerEdge + 4.35;
  const embParts: THREE.BufferGeometry[] = [];

  for (const iv of shoulderIntervals) {
    const spanLen = iv.zStart - iv.zEnd;
    if (spanLen <= 4) continue;
    const segs = Math.max(2, Math.floor(spanLen / 12));
    const ePos: number[] = [];
    const eNorm: number[] = [];
    const eUv: number[] = [];
    const eIdx: number[] = [];

    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const z = iv.zStart - t * spanLen;
      const cx = getRoadX(z);
      const angle = getRoadTangentAngle(z);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);
      const urban = isInsideUrbanZone(z, route.id) !== null;
      const ditchDepth = urban ? -0.26 : -0.46;

      ePos.push(cx - cosA * outerEdge, -0.34, z + sinA * outerEdge);
      ePos.push(cx - cosA * ditchTrough, ditchDepth, z + sinA * ditchTrough);
      ePos.push(cx - cosA * innerEdge, -0.025, z + sinA * innerEdge);

      ePos.push(cx + cosA * innerEdge, -0.025, z - sinA * innerEdge);
      ePos.push(cx + cosA * ditchTrough, ditchDepth, z - sinA * ditchTrough);
      ePos.push(cx + cosA * outerEdge, -0.34, z - sinA * outerEdge);

      eNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
      const vCoord = t * (spanLen / 10);
      eUv.push(0, vCoord, 0.45, vCoord, 1, vCoord, 1, vCoord, 0.45, vCoord, 0, vCoord);
    }

    for (let i = 0; i < segs; i++) {
      const r = i * 6;
      const n = (i + 1) * 6;
      eIdx.push(r + 0, n + 0, r + 1, r + 1, n + 0, n + 1);
      eIdx.push(r + 1, n + 1, r + 2, r + 2, n + 1, n + 2);
      eIdx.push(r + 3, n + 3, r + 4, r + 4, n + 3, n + 4);
      eIdx.push(r + 4, n + 4, r + 5, r + 5, n + 4, n + 5);
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(ePos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(eNorm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(eUv, 2));
    g.setIndex(eIdx);
    g.computeVertexNormals();
    const nonIdx = g.toNonIndexed();
    g.dispose();
    embParts.push(nonIdx);
  }

  if (embParts.length > 0) {
    const mergedEmb = mergeGeometries(embParts, false);
    embParts.forEach((p) => p.dispose());
    geos.push(mergedEmb);
    const embMesh = new THREE.Mesh(mergedEmb, embankmentMat);
    embMesh.receiveShadow = true;
    group.add(embMesh);
  }

  // 5. Painted On-Road Markings: Flush Zebra Crossings + Stop Lines near Urban Zones & Stands
  const zebraStopTex = createZebraCrossingTexture(maxAnisotropy, true);
  const zebraOnlyTex = createZebraCrossingTexture(maxAnisotropy, false);
  texs.push(zebraStopTex, zebraOnlyTex);

  const zebraStopMat = new THREE.MeshStandardMaterial({
    map: zebraStopTex,
    transparent: true,
    roughness: 0.88,
    metalness: 0.0,
    envMapIntensity: 0.22,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const zebraOnlyMat = new THREE.MeshStandardMaterial({
    map: zebraOnlyTex,
    transparent: true,
    roughness: 0.9,
    metalness: 0.0,
    envMapIntensity: 0.22,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  mats.push(zebraStopMat, zebraOnlyMat);

  const zebraGeo = new THREE.PlaneGeometry(roadWidth - 0.6, 5.2, 4, 1);
  zebraGeo.rotateX(-Math.PI / 2);
  const zPosAttr = zebraGeo.attributes.position;
  for (let i = 0; i < zPosAttr.count; i++) {
    const px = zPosAttr.getX(i);
    const normX = THREE.MathUtils.clamp(px / halfW, -1, 1);
    const crownY = 0.018 * (1 - normX * normX);
    zPosAttr.setY(i, crownY);
  }
  zebraGeo.computeVertexNormals();
  geos.push(zebraGeo);

  const crossingZs: { z: number; withStop: boolean }[] = [];
  for (const uz of getUrbanZones(route.id)) {
    if (uz.gateZ !== undefined) {
      crossingZs.push({ z: uz.gateZ + 12, withStop: true });
    }
    const midZ = Math.round((uz.zStart + uz.zEnd) * 0.5);
    if (!isInsideBridgeApproach(midZ, route.id, 12)) {
      crossingZs.push({ z: midZ, withStop: uz.density !== 'town' });
    }
  }
  for (const stop of route.stops) {
    if (stop.type === 'stand' || stop.type === 'toll') {
      crossingZs.push({ z: stop.z + 24, withStop: true });
    }
  }

  for (const cr of crossingZs) {
    if (isInsideBridgeApproach(cr.z, route.id, 6)) continue;
    const cx = getRoadX(cr.z);
    const cy = getRoadY(cr.z, route.id);
    const yaw = getRoadTangentAngle(cr.z);
    const pitch = getRoadSlopeAngle(cr.z, route.id);
    const zMesh = new THREE.Mesh(zebraGeo, cr.withStop ? zebraStopMat : zebraOnlyMat);
    zMesh.position.set(cx, cy + 0.016, cr.z);
    zMesh.rotation.order = 'YXZ';
    zMesh.rotation.set(pitch, yaw, 0);
    zMesh.receiveShadow = true;
    group.add(zMesh);
  }

  // 6. Realistic Potholes (Flush on Rural, Domar/Tunirhat Local, Market & Repair Sections Only)
  const potholeTex = createPotholeDecalTexture(maxAnisotropy);
  texs.push(potholeTex);
  const potholeMat = new THREE.MeshStandardMaterial({
    map: potholeTex,
    transparent: true,
    roughness: 0.95,
    metalness: 0.0,
    envMapIntensity: 0.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  mats.push(potholeMat);

  const potholeGeo = new THREE.PlaneGeometry(1.85, 2.2);
  potholeGeo.rotateX(-Math.PI / 2);
  geos.push(potholeGeo);

  const potholeTransforms: { x: number; y: number; z: number; yaw: number; pitch: number; sx: number; sz: number }[] = [];
  for (let z = -340; z >= -(route.totalLengthM - 160); z -= 64) {
    if (isInsideBridgeApproach(z, route.id, 15)) continue;
    if (route.stops.some((s) => Math.abs(s.z - z) < 34)) continue;
    const vType = getRoadSurfaceVariantAt(z, route.id, route.stops);
    if (vType !== 'rural' && vType !== 'domar_local' && vType !== 'repair' && vType !== 'market') {
      continue;
    }
    const seed = Math.abs(Math.round(z * 1.37));
    if (vType === 'market' && seed % 3 !== 0) continue;
    if (vType === 'rural' && seed % 2 !== 0) continue;

    const sideSign = seed % 2 === 0 ? -1 : 1;
    const latOff = sideSign * (1.3 + (seed % 5) * 0.58);
    const normLat = Math.abs(latOff) / halfW;
    const crownAtLat = 0.018 * (1 - normLat * normLat);
    const unevenAtZ = getUnevenOffset(z, vType, 0.85, 2.2);
    const cx = getRoadX(z);
    const cy = getRoadY(z, route.id);
    const yaw = getRoadTangentAngle(z);
    const pitch = getRoadSlopeAngle(z, route.id);
    potholeTransforms.push({
      x: cx + Math.cos(yaw) * latOff,
      y: cy + 0.0165 + crownAtLat + Math.max(0, unevenAtZ),
      z: z - Math.sin(yaw) * latOff,
      yaw: yaw + ((seed % 7) - 3) * 0.25,
      pitch,
      sx: 0.72 + (seed % 4) * 0.22,
      sz: 0.75 + (seed % 3) * 0.28,
    });
  }

  if (potholeTransforms.length > 0) {
    const pInst = new THREE.InstancedMesh(potholeGeo, potholeMat, potholeTransforms.length);
    const pDummy = new THREE.Object3D();
    for (let i = 0; i < potholeTransforms.length; i++) {
      const pt = potholeTransforms[i];
      pDummy.position.set(pt.x, pt.y, pt.z);
      pDummy.rotation.order = 'YXZ';
      pDummy.rotation.set(pt.pitch, pt.yaw, 0);
      pDummy.scale.set(pt.sx, 1, pt.sz);
      pDummy.updateMatrix();
      pInst.setMatrixAt(i, pDummy.matrix);
    }
    pInst.instanceMatrix.needsUpdate = true;
    pInst.computeBoundingSphere();
    group.add(pInst);
  }

  // 7. Bridge Expansion Joint Plates (on Jamuna / Meghna / Bhairab Decks)
  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x3b4046,
    roughness: 0.56,
    metalness: 0.58,
  });
  mats.push(jointMat);
  const jointGeo = new THREE.BoxGeometry(roadWidth - 0.15, 0.02, 0.24, 4, 1, 1);
  const jPosAttr = jointGeo.attributes.position;
  for (let i = 0; i < jPosAttr.count; i++) {
    const px = jPosAttr.getX(i);
    const normX = THREE.MathUtils.clamp(px / halfW, -1, 1);
    jPosAttr.setY(i, jPosAttr.getY(i) + 0.018 * (1 - normX * normX));
  }
  jointGeo.computeVertexNormals();
  geos.push(jointGeo);

  const jointPositions: { x: number; y: number; z: number; yaw: number; pitch: number }[] = [];
  for (const b of bridges) {
    for (let jz = b.zApproachStart - 16; jz >= b.zApproachEnd + 16; jz -= 26) {
      jointPositions.push({
        x: getRoadX(jz),
        y: getRoadY(jz, route.id) + 0.016,
        z: jz,
        yaw: getRoadTangentAngle(jz),
        pitch: getRoadSlopeAngle(jz, route.id),
      });
    }
  }
  if (jointPositions.length > 0) {
    const jInst = new THREE.InstancedMesh(jointGeo, jointMat, jointPositions.length);
    const jDummy = new THREE.Object3D();
    for (let i = 0; i < jointPositions.length; i++) {
      const jp = jointPositions[i];
      jDummy.position.set(jp.x, jp.y, jp.z);
      jDummy.rotation.order = 'YXZ';
      jDummy.rotation.set(jp.pitch, jp.yaw, 0);
      jDummy.scale.set(1, 1, 1);
      jDummy.updateMatrix();
      jInst.setMatrixAt(i, jDummy.matrix);
    }
    jInst.instanceMatrix.needsUpdate = true;
    jInst.computeBoundingSphere();
    group.add(jInst);
  }

  // 8. Road Construction & Repair Section Props (roadside gravel piles, barriers, warning signboards)
  const repairZones = getRepairZones(route.id);
  if (repairZones.length > 0) {
    const barrierRedMat = new THREE.MeshStandardMaterial({ color: 0xc2410c, roughness: 0.68 });
    const barrierWhiteMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
    const gravelHeapMat = new THREE.MeshStandardMaterial({ color: 0x7c4a3a, roughness: 0.96 });
    const workSignTex = createSignBoardTexture(
      'রাস্তার মেরামত কাজ চলছে',
      'ROAD REPAIR · SLOW DOWN',
      '#facc15',
      '#111827',
      '#dc2626',
      maxAnisotropy
    );
    const workSignMat = new THREE.MeshBasicMaterial({ map: workSignTex });
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.55, roughness: 0.45 });

    texs.push(workSignTex);
    mats.push(barrierRedMat, barrierWhiteMat, gravelHeapMat, workSignMat, poleMat);

    const bBoxGeo = new THREE.BoxGeometry(0.45, 0.78, 2.2);
    const heapGeo = new THREE.ConeGeometry(1.4, 0.85, 7);
    const sPoleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8);
    const sBoardGeo = new THREE.BoxGeometry(2.1, 1.05, 0.08);
    geos.push(bBoxGeo, heapGeo, sPoleGeo, sBoardGeo);

    for (const rz of repairZones) {
      const warnZ = rz.zStart + 32;
      const wCx = getRoadX(warnZ);
      const wAng = getRoadTangentAngle(warnZ);
      const signGroup = new THREE.Group();
      signGroup.position.set(wCx - Math.cos(wAng) * 7.2, getRoadY(warnZ, route.id), warnZ + Math.sin(wAng) * 7.2);
      signGroup.rotation.y = wAng;

      const pole = new THREE.Mesh(sPoleGeo, poleMat);
      pole.position.y = 1.25;
      const board = new THREE.Mesh(sBoardGeo, workSignMat);
      board.position.y = 2.45;
      signGroup.add(pole, board);
      group.add(signGroup);

      const span = rz.zStart - rz.zEnd;
      const count = 6;
      for (let k = 0; k < count; k++) {
        const bz = rz.zStart - (k + 0.5) * (span / count);
        const bcx = getRoadX(bz);
        const bAng = getRoadTangentAngle(bz);
        const side = k % 2 === 0 ? -1 : 1;
        const off = side * (halfW + 0.9);
        const bMesh = new THREE.Mesh(bBoxGeo, k % 2 === 0 ? barrierRedMat : barrierWhiteMat);
        bMesh.position.set(bcx + Math.cos(bAng) * off, getRoadY(bz, route.id) + 0.38, bz - Math.sin(bAng) * off);
        bMesh.rotation.y = bAng;
        bMesh.castShadow = true;
        group.add(bMesh);

        if (k % 2 === 1) {
          const hOff = side * (halfW + 2.1);
          const heap = new THREE.Mesh(heapGeo, gravelHeapMat);
          heap.position.set(bcx + Math.cos(bAng) * hOff, getRoadY(bz, route.id) + 0.35, bz - Math.sin(bAng) * hOff);
          heap.scale.set(1.2, 0.85, 1.8);
          heap.receiveShadow = true;
          group.add(heap);
        }
      }
    }
  }

  // 9. Roadside Grass Tufts growing along Rural / Town Shoulders & Drainage Edges
  const grassBladeGeo = new THREE.ConeGeometry(0.18, 0.42, 4);
  grassBladeGeo.translate(0, 0.21, 0);
  geos.push(grassBladeGeo);
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4b742c, roughness: 0.92 });
  mats.push(grassMat);

  const grassSpecs: { x: number; y: number; z: number; s: number; rot: number }[] = [];
  for (let z = 60; z >= -(route.totalLengthM + 120); z -= 14) {
    if (isInsideBridgeApproach(z, route.id, 6)) continue;
    const vType = getRoadSurfaceVariantAt(z, route.id, route.stops);
    if (vType === 'dhaka' || vType === 'concrete') continue;

    const cx = getRoadX(z);
    const angle = getRoadTangentAngle(z);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const seed = Math.abs(Math.round(z * 2.3));

    for (const side of [-1, 1] as const) {
      const dist = halfW + (vType === 'domar_local' || vType === 'rural' ? 0.85 : 2.15) + ((seed + side) % 3) * 0.45;
      grassSpecs.push({
        x: cx + cosA * side * dist,
        y: -0.05,
        z: z - sinA * side * dist,
        s: 0.75 + (seed % 5) * 0.14,
        rot: (seed % 6) * 0.55,
      });
    }
  }

  if (grassSpecs.length > 0) {
    const grassInst = new THREE.InstancedMesh(grassBladeGeo, grassMat, grassSpecs.length);
    const gDummy = new THREE.Object3D();
    const gCol = new THREE.Color();
    for (let i = 0; i < grassSpecs.length; i++) {
      const gs = grassSpecs[i];
      gDummy.position.set(gs.x, gs.y, gs.z);
      gDummy.rotation.set(0.08 * Math.sin(i), gs.rot, 0.08 * Math.cos(i));
      gDummy.scale.set(1.2 * gs.s, gs.s, 1.2 * gs.s);
      gDummy.updateMatrix();
      grassInst.setMatrixAt(i, gDummy.matrix);
      gCol.setHSL(0.24 + (i % 4) * 0.015, 0.42, 0.28 + (i % 5) * 0.025);
      grassInst.setColorAt(i, gCol);
    }
    grassInst.instanceMatrix.needsUpdate = true;
    if (grassInst.instanceColor) grassInst.instanceColor.needsUpdate = true;
    grassInst.computeBoundingSphere();
    group.add(grassInst);
  }

  return {
    group,
    setWeatherSurface(rainFactor: number) {
      const r = THREE.MathUtils.clamp(rainFactor, 0, 1);
      sharedRainUniform.value = r;
      // Matte dry asphalt (0.22) rising gently to subtle wet sheen (0.56) in rain (never mirror-like)
      const envInt = THREE.MathUtils.lerp(0.22, 0.56, r);
      for (const m of variantMaterials) m.envMapIntensity = envInt;
      for (const m of transMaterials) m.envMapIntensity = envInt;

      zebraStopMat.roughness = THREE.MathUtils.lerp(0.88, 0.48, r);
      zebraOnlyMat.roughness = THREE.MathUtils.lerp(0.9, 0.5, r);

      brickShoulderMat.roughness = THREE.MathUtils.lerp(0.92, 0.64, r);
      muddyShoulderMat.roughness = THREE.MathUtils.lerp(0.94, 0.56, r);
      urbanShoulderMat.roughness = THREE.MathUtils.lerp(0.88, 0.6, r);
      embankmentMat.roughness = THREE.MathUtils.lerp(0.94, 0.55, r);
    },
    dispose() {
      geos.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      texs.forEach((t) => t.dispose());
    },
  };
}
