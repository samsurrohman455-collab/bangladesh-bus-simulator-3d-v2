import * as THREE from 'three';
import { createContactShadowTexture, createHeadlightBeamTexture, createTruckArtTexture } from './textures';
import { RouteId, TrafficDensity } from './types';
import { getRoadSlopeAngle, getRoadTangentAngle, getRoadX, getRoadY, isInsideBridgeApproach } from './world';

export type TrafficKind = 'cng' | 'easybike' | 'truck' | 'localbus';

export interface TrafficVehicle {
  id: number;
  active: boolean;
  kind: TrafficKind;
  mesh: THREE.Group;
  z: number;
  laneOffset: number; // -3.1 = left lane (moving -Z), +3.1 = right lane (oncoming +Z)
  direction: -1 | 1; // -1 = heading -Z (same as player), +1 = heading +Z (oncoming)
  speedMps: number;
  baseSpeedMps: number;
  halfWidth: number;
  halfLength: number;
  wheels: THREE.Object3D[];
}

export interface CongestionNode {
  id: number;
  centerZ: number;
  halfSpanM: number;
  crawlSpeedMps: number;
  remainingSec: number;
  announced: boolean;
}

export interface CongestionStatus {
  active: boolean;
  distM: number | null;
  speedLimitKmh: number;
  justSpawned: boolean;
}

export interface PedestrianActor {
  mesh: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  z: number;
  sideOffset: number;
  walkDir: -1 | 1;
  phase: number;
}

interface VehicleLightMats {
  headlightMat: THREE.MeshStandardMaterial;
  taillightMat: THREE.MeshStandardMaterial;
  beamMat: THREE.MeshBasicMaterial;
}

function addShadowQuad(parent: THREE.Group, w: number, l: number, shadowTex: THREE.Texture): void {
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(w, l),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    })
  );
  quad.rotation.x = -Math.PI / 2;
  quad.position.y = 0.025;
  parent.add(quad);
}

function addBeamQuad(
  parent: THREE.Group,
  width: number,
  length: number,
  frontZ: number,
  beamMat: THREE.MeshBasicMaterial
): void {
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(width, length), beamMat);
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.045, frontZ - length * 0.5);
  beam.renderOrder = 2;
  parent.add(beam);
}

function createCngAutoRickshaw(
  shadowTex: THREE.Texture,
  lights: VehicleLightMats
): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const g = new THREE.Group();
  addShadowQuad(g, 1.7, 3.0, shadowTex);
  addBeamQuad(g, 2.7, 7.8, -1.18, lights.beamMat);

  const greenBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x047857, // Iconic Dhaka/Highway green CNG
    roughness: 0.35,
    metalness: 0.25,
    clearcoat: 0.6,
  });
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });

  // Lower body shell
  const rearTub = new THREE.Mesh(new THREE.BoxGeometry(1.32, 0.72, 1.55), greenBodyMat);
  rearTub.position.set(0, 0.58, 0.4);
  rearTub.castShadow = true;

  const frontNose = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.72, 0.9), greenBodyMat);
  frontNose.position.set(0, 0.56, -0.75);
  frontNose.castShadow = true;

  // Curved black vinyl hood canopy
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.68, 1.95), canopyMat);
  hood.position.set(0, 1.28, 0.15);
  hood.castShadow = true;

  // Windshield frame & glass
  const glass = new THREE.Mesh(
    new THREE.PlaneGeometry(0.88, 0.54),
    new THREE.MeshStandardMaterial({ color: 0x93c5fd, transparent: true, opacity: 0.5, roughness: 0.1 })
  );
  glass.position.set(0, 1.18, -0.84);
  glass.rotation.y = Math.PI;

  // Headlight + Rear Tail Lights + Yellow plate
  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), lights.headlightMat);
  hl.position.set(0, 0.65, -1.21);

  const tailGeo = new THREE.BoxGeometry(0.16, 0.1, 0.05);
  const tlL = new THREE.Mesh(tailGeo, lights.taillightMat);
  tlL.position.set(-0.5, 0.56, 1.18);
  const tlR = new THREE.Mesh(tailGeo, lights.taillightMat);
  tlR.position.set(0.5, 0.56, 1.18);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.04), plateMat);
  plate.position.set(0, 0.4, -1.21);

  // 3 wheels (1 front, 2 rear)
  const wGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.14, 14);
  wGeo.rotateZ(Math.PI / 2);
  const wF = new THREE.Mesh(wGeo, tireMat);
  wF.position.set(0, 0.24, -0.85);
  const wRL = new THREE.Mesh(wGeo, tireMat);
  wRL.position.set(-0.62, 0.24, 0.8);
  const wRR = new THREE.Mesh(wGeo, tireMat);
  wRR.position.set(0.62, 0.24, 0.8);

  g.add(rearTub, frontNose, hood, glass, hl, tlL, tlR, plate, wF, wRL, wRR);
  return { group: g, wheels: [wF, wRL, wRR] };
}

function createEasyBike(
  shadowTex: THREE.Texture,
  lights: VehicleLightMats
): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const g = new THREE.Group();
  addShadowQuad(g, 1.65, 3.1, shadowTex);
  addBeamQuad(g, 2.5, 7.2, -1.14, lights.beamMat);

  const blueMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4, metalness: 0.3 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88 });

  const deck = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.45, 2.35), blueMat);
  deck.position.set(0, 0.45, 0);
  deck.castShadow = true;

  const frontShield = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.72, 0.2), blueMat);
  frontShield.position.set(0, 0.9, -1.05);

  const hl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 10), lights.headlightMat);
  hl.position.set(0, 0.72, -1.16);

  const tailGeo = new THREE.BoxGeometry(0.16, 0.1, 0.05);
  const tlL = new THREE.Mesh(tailGeo, lights.taillightMat);
  tlL.position.set(-0.46, 0.56, 1.18);
  const tlR = new THREE.Mesh(tailGeo, lights.taillightMat);
  tlR.position.set(0.46, 0.56, 1.18);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.1, 2.4), roofMat);
  roof.position.set(0, 1.68, 0.05);
  roof.castShadow = true;

  // 4 thin canopy posts
  const postGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.05, 6);
  for (const [px, pz] of [[-0.55, -0.95], [0.55, -0.95], [-0.55, 1.05], [0.55, 1.05]]) {
    const post = new THREE.Mesh(postGeo, frameMat);
    post.position.set(px, 1.18, pz);
    g.add(post);
  }

  const wGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.14, 14);
  wGeo.rotateZ(Math.PI / 2);
  const wF = new THREE.Mesh(wGeo, tireMat);
  wF.position.set(0, 0.22, -0.95);
  const wRL = new THREE.Mesh(wGeo, tireMat);
  wRL.position.set(-0.6, 0.22, 0.85);
  const wRR = new THREE.Mesh(wGeo, tireMat);
  wRR.position.set(0.6, 0.22, 0.85);

  g.add(deck, frontShield, hl, tlL, tlR, roof, wF, wRL, wRR);
  return { group: g, wheels: [wF, wRL, wRR] };
}

function createBangladeshiTruck(
  truckArtTex: THREE.Texture,
  shadowTex: THREE.Texture,
  lights: VehicleLightMats
): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const g = new THREE.Group();
  addShadowQuad(g, 2.9, 8.2, shadowTex);
  addBeamQuad(g, 4.4, 13.5, -3.6, lights.beamMat);

  const cabMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.35, metalness: 0.3 });
  const cargoMat = new THREE.MeshStandardMaterial({ map: truckArtTex, roughness: 0.6 });
  const woodTopMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.85 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88 });

  // Truck Cab
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.26, 2.05, 2.1), cabMat);
  cab.position.set(0, 1.55, -2.55);
  cab.castShadow = true;

  const cabCrown = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.45, 1.4), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }));
  cabCrown.position.set(0, 2.8, -2.4);

  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(1.96, 0.76),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.4 })
  );
  windshield.position.set(0, 1.98, -3.61);
  windshield.rotation.y = Math.PI;

  // Tall Cargo Bed covered in Bangladeshi Truck Art
  const cargo = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.35, 5.1), cargoMat);
  cargo.position.set(0, 1.88, 1.15);
  cargo.castShadow = true;

  const tarp = new THREE.Mesh(new THREE.BoxGeometry(2.42, 0.3, 5.14), woodTopMat);
  tarp.position.set(0, 3.15, 1.15);

  // Headlights + Rear Tail Lights
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.06), lights.headlightMat);
  hlL.position.set(-0.78, 0.85, -3.62);
  const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.06), lights.headlightMat);
  hlR.position.set(0.78, 0.85, -3.62);

  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.06), lights.taillightMat);
  tlL.position.set(-0.88, 0.88, 3.72);
  const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.15, 0.06), lights.taillightMat);
  tlR.position.set(0.88, 0.88, 3.72);

  // 4 Tires
  const wGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.34, 16);
  wGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [[-1.12, -2.45], [1.12, -2.45], [-1.12, 2.15], [1.12, 2.15]]) {
    const w = new THREE.Mesh(wGeo, tireMat);
    w.position.set(wx, 0.48, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }

  g.add(cab, cabCrown, windshield, cargo, tarp, hlL, hlR, tlL, tlR);
  return { group: g, wheels };
}

function createLocalBus(
  colorHex: number,
  shadowTex: THREE.Texture,
  lights: VehicleLightMats
): { group: THREE.Group; wheels: THREE.Object3D[] } {
  const g = new THREE.Group();
  addShadowQuad(g, 2.8, 9.6, shadowTex);
  addBeamQuad(g, 4.6, 14.5, -4.4, lights.beamMat);

  const bodyMat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.35, metalness: 0.25 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.15, metalness: 0.5 });
  const rackMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.5 });
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.88 });

  const hull = new THREE.Mesh(new THREE.BoxGeometry(2.38, 2.35, 8.8), bodyMat);
  hull.position.set(0, 1.65, 0);
  hull.castShadow = true;

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.28, 8.82),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 })
  );
  stripe.position.set(0, 1.35, 0);

  const windowBand = new THREE.Mesh(new THREE.BoxGeometry(2.41, 0.82, 8.2), glassMat);
  windowBand.position.set(0, 2.22, -0.1);

  const roofRack = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.25, 6.4), rackMat);
  roofRack.position.set(0, 2.95, 0.4);

  // Dual Front Headlights & Rear Tail Lights
  const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.06), lights.headlightMat);
  hlL.position.set(-0.84, 0.88, -4.42);
  const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.06), lights.headlightMat);
  hlR.position.set(0.84, 0.88, -4.42);

  const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lights.taillightMat);
  tlL.position.set(-0.84, 0.92, 4.42);
  const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.06), lights.taillightMat);
  tlR.position.set(0.84, 0.92, 4.42);

  const wGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.3, 16);
  wGeo.rotateZ(Math.PI / 2);
  const wheels: THREE.Object3D[] = [];
  for (const [wx, wz] of [[-1.12, -2.65], [1.12, -2.65], [-1.12, 2.45], [1.12, 2.45]]) {
    const w = new THREE.Mesh(wGeo, tireMat);
    w.position.set(wx, 0.45, wz);
    g.add(w);
    wheels.push(w);
  }

  g.add(hull, stripe, windowBand, roofRack, hlL, hlR, tlL, tlR);
  return { group: g, wheels };
}

export class TrafficManager {
  public readonly group = new THREE.Group();
  public readonly vehicles: TrafficVehicle[] = [];
  private readonly pedestrians: PedestrianActor[] = [];
  private readonly shadowTex: THREE.Texture;
  private readonly truckArtTex: THREE.Texture;
  private readonly beamTex: THREE.Texture;
  private readonly headlightMat: THREE.MeshStandardMaterial;
  private readonly taillightMat: THREE.MeshStandardMaterial;
  private readonly routeId: RouteId;
  private readonly beamMat: THREE.MeshBasicMaterial;
  private readonly congestionGroup = new THREE.Group();
  private readonly coneGeo: THREE.CylinderGeometry;
  private readonly coneMat: THREE.MeshStandardMaterial;
  private readonly stripeGeo: THREE.CylinderGeometry;
  private readonly stripeMat: THREE.MeshStandardMaterial;
  private readonly beaconMat: THREE.MeshStandardMaterial;
  private readonly beaconMesh: THREE.Mesh;
  private readonly congestionCones: { cone: THREE.Group; offsetX: number; offsetZ: number }[] = [];

  private density: TrafficDensity = 'normal';
  private activeNode: CongestionNode | null = null;
  private nextSpawnSec = 10;
  private nextNodeId = 1;
  private elapsedSec = 0;

  constructor(routeId: RouteId, routeLengthM: number, maxAnisotropy: number) {
    this.routeId = routeId;
    this.shadowTex = createContactShadowTexture();
    this.truckArtTex = createTruckArtTexture(maxAnisotropy);
    this.beamTex = createHeadlightBeamTexture(maxAnisotropy);

    this.headlightMat = new THREE.MeshStandardMaterial({
      color: 0xfef9c3,
      emissive: 0xfef08a,
      emissiveIntensity: 0.15,
      roughness: 0.2,
    });
    this.taillightMat = new THREE.MeshStandardMaterial({
      color: 0x991b1b,
      emissive: 0xef4444,
      emissiveIntensity: 0.15,
      roughness: 0.25,
    });
    this.beamMat = new THREE.MeshBasicMaterial({
      map: this.beamTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.beamMat.visible = false;

    const lights: VehicleLightMats = {
      headlightMat: this.headlightMat,
      taillightMat: this.taillightMat,
      beamMat: this.beamMat,
    };

    // Build pooled highway congestion marker cones & flashing amber beacon (zero runtime allocations)
    this.coneGeo = new THREE.CylinderGeometry(0.08, 0.28, 0.78, 8);
    this.coneGeo.translate(0, 0.39, 0);
    this.coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.55 });
    this.stripeGeo = new THREE.CylinderGeometry(0.14, 0.2, 0.18, 8);
    this.stripeGeo.translate(0, 0.44, 0);
    this.stripeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });
    this.beaconMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    const coneOffsets = [
      { x: -5.4, z: 32 },
      { x: -5.4, z: 12 },
      { x: -5.4, z: -12 },
      { x: -5.4, z: -32 },
      { x: 5.4, z: 20 },
      { x: 5.4, z: -20 },
    ];
    for (const co of coneOffsets) {
      const cGroup = new THREE.Group();
      const coneMesh = new THREE.Mesh(this.coneGeo, this.coneMat);
      const bandMesh = new THREE.Mesh(this.stripeGeo, this.stripeMat);
      cGroup.add(coneMesh, bandMesh);
      this.congestionGroup.add(cGroup);
      this.congestionCones.push({ cone: cGroup, offsetX: co.x, offsetZ: co.z });
    }
    this.beaconMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 1.35, 10), this.beaconMat);
    this.congestionGroup.add(this.beaconMesh);
    this.congestionGroup.visible = false;
    this.group.add(this.congestionGroup);

    // Spawn 46 pooled AI vehicles (16 active on Low, 28 on Normal, 46 on Heavy)
    const totalPool = 46;
    const kinds: TrafficKind[] = ['cng', 'easybike', 'truck', 'localbus', 'cng', 'truck'];
    for (let i = 0; i < totalPool; i++) {
      const kind = kinds[i % kinds.length];
      // Even indices = left lane (-3.1m, same direction -Z); Odd indices = right lane (+3.1m, oncoming +Z)
      const isLeftLane = i % 2 === 0;
      const direction: -1 | 1 = isLeftLane ? -1 : 1;
      const laneOffset = isLeftLane ? -3.1 : 3.1;
      const z = -140 - i * ((routeLengthM - 240) / totalPool);

      let built: { group: THREE.Group; wheels: THREE.Object3D[] };
      let halfWidth = 0.8;
      let halfLength = 1.6;
      let baseSpeedMps = 10;

      if (kind === 'cng') {
        built = createCngAutoRickshaw(this.shadowTex, lights);
        halfWidth = 0.72;
        halfLength = 1.25;
        baseSpeedMps = 11.5; // ~41 km/h
      } else if (kind === 'easybike') {
        built = createEasyBike(this.shadowTex, lights);
        halfWidth = 0.68;
        halfLength = 1.25;
        baseSpeedMps = 7.8; // ~28 km/h
      } else if (kind === 'truck') {
        built = createBangladeshiTruck(this.truckArtTex, this.shadowTex, lights);
        halfWidth = 1.22;
        halfLength = 3.8;
        baseSpeedMps = 14.2; // ~51 km/h
      } else {
        const busColors = [0x15803d, 0x0284c7, 0xb91c1c, 0x7e22ce];
        built = createLocalBus(busColors[i % busColors.length], this.shadowTex, lights);
        halfWidth = 1.24;
        halfLength = 4.4;
        baseSpeedMps = 16.5; // ~59 km/h
      }

      this.group.add(built.group);
      this.vehicles.push({
        id: i,
        active: true,
        kind,
        mesh: built.group,
        z,
        laneOffset,
        direction,
        speedMps: baseSpeedMps,
        baseSpeedMps,
        halfWidth,
        halfLength,
        wheels: built.wheels,
      });
    }
    this.setDensity('normal');

    // Spawn 28 roadside pedestrians walking along highway shoulders
    const shirtCols = [0xf8fafc, 0x0ea5e9, 0xef4444, 0xf59e0b, 0x10b981];
    const lungiCols = [0x1e3a8a, 0x7c2d12, 0x064e3b, 0x334155];
    for (let i = 0; i < 28; i++) {
      const pGroup = new THREE.Group();
      const legGeo = new THREE.BoxGeometry(0.14, 0.78, 0.16);
      const legMat = new THREE.MeshStandardMaterial({ color: lungiCols[i % lungiCols.length], roughness: 0.88 });
      const leftLeg = new THREE.Mesh(legGeo, legMat);
      leftLeg.position.set(-0.09, 0.39, 0);
      const rightLeg = new THREE.Mesh(legGeo, legMat);
      rightLeg.position.set(0.09, 0.39, 0);

      const torso = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.58, 0.22),
        new THREE.MeshStandardMaterial({ color: shirtCols[i % shirtCols.length], roughness: 0.82 })
      );
      torso.position.y = 1.06;
      torso.castShadow = true;

      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.14, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x8d5524, roughness: 0.75 })
      );
      head.position.y = 1.5;

      pGroup.add(leftLeg, rightLeg, torso, head);
      this.group.add(pGroup);

      const side = i % 2 === 0 ? -1 : 1;
      let pz = -120 - i * ((routeLengthM - 200) / 28);
      if (isInsideBridgeApproach(pz, routeId, 12)) {
        pz -= 160;
      }
      this.pedestrians.push({
        mesh: pGroup,
        leftLeg,
        rightLeg,
        z: pz,
        sideOffset: side * (7.2 + (i % 3) * 0.6),
        walkDir: i % 2 === 0 ? -1 : 1,
        phase: i * 1.1,
      });
    }
  }

  public setDensity(density: TrafficDensity): void {
    this.density = density;
    const activeCount = density === 'low' ? 16 : density === 'normal' ? 28 : this.vehicles.length;
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      v.active = i < activeCount;
      v.mesh.visible = v.active;
    }
    // Adjust pending spawn interval immediately so changing density feels responsive
    const maxWait = density === 'low' ? 42 : density === 'normal' ? 22 : 11;
    this.nextSpawnSec = Math.min(this.nextSpawnSec, maxWait);
  }

  public getDensity(): TrafficDensity {
    return this.density;
  }

  public resetCongestion(): void {
    this.activeNode = null;
    this.congestionGroup.visible = false;
    this.nextSpawnSec = this.density === 'low' ? 22 : this.density === 'normal' ? 11 : 6;
  }

  public getCongestionStatus(busZ: number): CongestionStatus {
    const node = this.activeNode;
    if (!node) {
      return { active: false, distM: null, speedLimitKmh: 80, justSpawned: false };
    }
    const edgeStart = node.centerZ + node.halfSpanM;
    const edgeEnd = node.centerZ - node.halfSpanM;
    const inside = busZ <= edgeStart + 10 && busZ >= edgeEnd - 10;
    const distAhead = busZ > edgeStart + 10 ? Math.round(busZ - edgeStart) : null;
    const withinAlertRange = inside || (distAhead !== null && distAhead <= 240);

    let justSpawned = false;
    if (!node.announced && withinAlertRange) {
      node.announced = true;
      justSpawned = true;
    }

    return {
      active: inside,
      distM: inside ? 0 : distAhead !== null && distAhead <= 260 ? distAhead : null,
      speedLimitKmh: inside ? 35 : 80,
      justSpawned,
    };
  }

  private spawnCongestionNode(busZ: number, routeLengthM: number): void {
    const centerZ = busZ - (185 + Math.random() * 65);
    // Keep away from start/finish terminals
    if (centerZ > -220 || centerZ < -(routeLengthM - 210)) {
      this.nextSpawnSec = 10;
      return;
    }

    const halfSpanM = this.density === 'low' ? 68 : this.density === 'normal' ? 92 : 120;
    const crawlSpeedMps = this.density === 'low' ? 5.6 : this.density === 'normal' ? 4.2 : 2.9;
    const duration = this.density === 'low' ? 22 : this.density === 'normal' ? 30 : 38;

    this.activeNode = {
      id: this.nextNodeId++,
      centerZ,
      halfSpanM,
      crawlSpeedMps,
      remainingSec: duration,
      announced: false,
    };

    // Position orange highway congestion cones & amber beacon along the node
    this.congestionGroup.visible = true;
    for (const c of this.congestionCones) {
      const cz = centerZ + c.offsetZ;
      const cx = getRoadX(cz);
      const cy = getRoadY(cz, this.routeId);
      const ang = getRoadTangentAngle(cz);
      c.cone.position.set(cx + Math.cos(ang) * c.offsetX, cy, cz - Math.sin(ang) * c.offsetX);
      c.cone.rotation.y = ang;
    }
    const bx = getRoadX(centerZ + halfSpanM * 0.72);
    const by = getRoadY(centerZ + halfSpanM * 0.72, this.routeId);
    const bang = getRoadTangentAngle(centerZ + halfSpanM * 0.72);
    this.beaconMesh.position.set(
      bx - Math.cos(bang) * 6.0,
      by + 0.68,
      centerZ + halfSpanM * 0.72 + Math.sin(bang) * 6.0
    );

    // Gather a realistic cluster of active vehicles into staggered bumper-to-bumper jam queues
    const targetCluster = this.density === 'low' ? 7 : this.density === 'normal' ? 12 : 20;
    let gatheredLeft = 0;
    let gatheredRight = 0;
    const maxPerLane = Math.ceil(targetCluster / 2);

    for (const v of this.vehicles) {
      if (!v.active) continue;
      // Only repurpose vehicles that aren't immediately on top of the player bus
      if (Math.abs(v.z - busZ) < 28) continue;

      if (v.direction === -1 && gatheredLeft < maxPerLane) {
        const slotZ = centerZ + halfSpanM - 10 - gatheredLeft * 14.5;
        v.z = slotZ;
        v.speedMps = Math.min(v.speedMps, crawlSpeedMps + 1.5);
        gatheredLeft++;
      } else if (v.direction === 1 && gatheredRight < maxPerLane) {
        const slotZ = centerZ - halfSpanM + 10 + gatheredRight * 15.5;
        v.z = slotZ;
        v.speedMps = Math.min(v.speedMps, crawlSpeedMps + 1.5);
        gatheredRight++;
      }
      if (gatheredLeft + gatheredRight >= targetCluster) break;
    }
  }

  public setNightLighting(factor: number): void {
    const f = THREE.MathUtils.clamp(factor, 0, 1);
    this.headlightMat.emissiveIntensity = 0.14 + f * 3.1;
    this.taillightMat.emissiveIntensity = 0.14 + f * 2.4;
    this.beamMat.opacity = f * 0.45;
    this.beamMat.visible = f > 0.04;
  }

  public update(delta: number, busZ: number, busX: number, hornActive: boolean, routeLengthM: number): void {
    this.elapsedSec += delta;

    // Update or periodically spawn localized highway congestion nodes
    if (this.activeNode) {
      this.activeNode.remainingSec -= delta;
      // Pulse the roadside hazard beacon
      this.beaconMat.emissiveIntensity = 1.2 + Math.sin(this.elapsedSec * 7.5) * 1.1;

      const clearedBehind = busZ < this.activeNode.centerZ - this.activeNode.halfSpanM - 55;
      if (this.activeNode.remainingSec <= 0 || clearedBehind) {
        this.activeNode = null;
        this.congestionGroup.visible = false;
        this.nextSpawnSec =
          this.density === 'low'
            ? 42 + Math.random() * 18
            : this.density === 'normal'
              ? 22 + Math.random() * 12
              : 11 + Math.random() * 7;
      }
    } else {
      this.nextSpawnSec -= delta;
      if (this.nextSpawnSec <= 0) {
        this.spawnCongestionNode(busZ, routeLengthM);
      }
    }

    const densitySpeedMult = this.density === 'low' ? 1.08 : this.density === 'normal' ? 1.0 : 0.86;
    const node = this.activeNode;

    for (const v of this.vehicles) {
      if (!v.active) continue;

      const inCongestion =
        node !== null && v.z <= node.centerZ + node.halfSpanM && v.z >= node.centerZ - node.halfSpanM;

      // In normal cruising, honking lets slower left-lane vehicles yield slightly to shoulder.
      // Inside a dense congestion jam, vehicles stagger slightly left/right and cannot get out of the way cleanly.
      let targetLane = v.laneOffset;
      if (inCongestion && v.direction === -1) {
        targetLane = v.laneOffset + (v.id % 3 === 0 ? -0.9 : v.id % 3 === 1 ? 0.95 : 0);
      } else if (v.direction === -1 && hornActive && v.z < busZ && busZ - v.z < 55) {
        targetLane = v.laneOffset - 0.85;
      }

      // Base speed modulated by density & localized congestion crawl wave
      let desiredSpeed = v.baseSpeedMps * densitySpeedMult;
      if (inCongestion && node) {
        const wave = 0.65 + 0.35 * Math.sin(this.elapsedSec * 1.35 + v.id * 0.9);
        desiredSpeed = Math.min(desiredSpeed, node.crawlSpeedMps * wave);
      }

      // Simple spacing check with active vehicles ahead in the same lane
      const minGap = inCongestion ? 4.6 : 9.0;
      for (const other of this.vehicles) {
        if (!other.active || other.id === v.id || other.direction !== v.direction) continue;
        const dz = (other.z - v.z) * v.direction;
        if (dz > 0 && dz < v.halfLength + other.halfLength + minGap) {
          desiredSpeed = Math.min(desiredSpeed, other.speedMps * 0.85);
        }
      }

      // Avoid driving straight through stopped player bus if in same lane
      if (v.direction === -1) {
        const dzPlayer = v.z - busZ; // positive when AI is behind player
        const dxPlayer = Math.abs(v.mesh.position.x - busX);
        if (dzPlayer > 0 && dzPlayer < 19 && dxPlayer < 2.6) {
          desiredSpeed = 0;
        }
      }

      v.speedMps = THREE.MathUtils.damp(v.speedMps, desiredSpeed, inCongestion ? 4.2 : 3.0, delta);
      v.z += v.direction * v.speedMps * delta;

      // Recycle AI vehicles relative to player Z so traffic stays lively around the bus
      const recycleFrontSpan = this.density === 'heavy' ? 250 : 340;
      if (v.direction === -1 && v.z > busZ + 140) {
        v.z = Math.max(-(routeLengthM - 120), busZ - recycleFrontSpan - Math.random() * 140);
      } else if (v.direction === -1 && v.z < busZ - 420) {
        v.z = Math.min(-90, busZ - 140 - Math.random() * 140);
      } else if (v.direction === 1 && v.z > busZ + 110) {
        v.z = Math.max(-(routeLengthM - 80), busZ - 320 - Math.random() * 160);
      }

      // Place flush on curved & elevated highway/bridge deck
      const cx = getRoadX(v.z);
      const angle = getRoadTangentAngle(v.z);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const curX = cx + cosA * targetLane;
      const curZ = v.z - sinA * targetLane;
      const roadY = getRoadY(curZ, this.routeId);
      const roadSlope = getRoadSlopeAngle(curZ, this.routeId);

      v.mesh.position.set(curX, roadY, curZ);
      // Orient vehicle along tangent (facing -Z if direction === -1, +Z if +1) and pitch cleanly on bridge ramps
      v.mesh.rotation.order = 'YXZ';
      v.mesh.rotation.y = angle + (v.direction === 1 ? Math.PI : 0);
      v.mesh.rotation.x = (v.direction === 1 ? -1 : 1) * roadSlope;

      // Spin AI wheels
      const spin = v.speedMps * delta * 2.4;
      for (const w of v.wheels) {
        w.rotation.x -= spin;
      }
    }

    // Update roadside walking villagers (keep off river spans)
    for (const p of this.pedestrians) {
      p.z += p.walkDir * 1.15 * delta;
      p.phase += delta * 6.5;

      const onBridge = isInsideBridgeApproach(p.z, this.routeId, 8);
      p.mesh.visible = !onBridge;
      if (onBridge) continue;

      const cx = getRoadX(p.z);
      const angle = getRoadTangentAngle(p.z);
      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      p.mesh.position.set(cx + cosA * p.sideOffset, -0.04, p.z - sinA * p.sideOffset);
      p.mesh.rotation.y = angle + (p.walkDir === 1 ? Math.PI : 0);
      p.leftLeg.rotation.x = Math.sin(p.phase) * 0.45;
      p.rightLeg.rotation.x = -Math.sin(p.phase) * 0.45;
    }
  }

  public dispose(): void {
    this.shadowTex.dispose();
    this.truckArtTex.dispose();
    this.beamTex.dispose();
    this.headlightMat.dispose();
    this.taillightMat.dispose();
    this.beamMat.dispose();
    this.coneGeo.dispose();
    this.coneMat.dispose();
    this.stripeGeo.dispose();
    this.stripeMat.dispose();
    this.beaconMesh.geometry.dispose();
    this.beaconMat.dispose();
  }
}
