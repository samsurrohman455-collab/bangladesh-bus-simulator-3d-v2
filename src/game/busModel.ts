import * as THREE from 'three';
import {
  createBusLiveryTexture,
  createContactShadowTexture,
  createGaugeFaceTexture,
  createLedBoardTexture,
} from './textures';
import { LiveryConfig } from './types';

export interface BusRig {
  root: THREE.Group;
  bodyTiltGroup: THREE.Group;
  frontLeftSteer: THREE.Group;
  frontRightSteer: THREE.Group;
  wheelMeshes: THREE.Group[];
  steeringWheel: THREE.Group;
  speedNeedle: THREE.Object3D;
  rpmNeedle: THREE.Object3D;
  wiperLeft: THREE.Group;
  wiperRight: THREE.Group;
  tassel: THREE.Group;
  headlightLeft: THREE.SpotLight;
  headlightRight: THREE.SpotLight;
  headlightLensMat: THREE.MeshStandardMaterial;
  brakeLensMat: THREE.MeshStandardMaterial;
  reverseLensMat: THREE.MeshStandardMaterial;
  leftIndMat: THREE.MeshStandardMaterial;
  rightIndMat: THREE.MeshStandardMaterial;
  cockpitAnchor: THREE.Object3D;
  rearMirrorAnchor: THREE.Object3D;
  setLivery: (livery: LiveryConfig, routeLabel: string, maxAnisotropy: number) => void;
  updateLights: (opts: {
    headlights: boolean;
    braking: boolean;
    reversing: boolean;
    leftBlink: boolean;
    rightBlink: boolean;
  }) => void;
  updateDynamics: (opts: {
    wheelSpinRad: number;
    steerAngleRad: number;
    speedKmh: number;
    rpm: number;
    wiperPhase: number;
    pitchRad: number;
    rollRad: number;
    bounceY: number;
    doorOpenProgress: number;
    time: number;
  }) => void;
}

function buildWheel(radius: number, width: number, isDual: boolean): THREE.Group {
  const wheelGroup = new THREE.Group();

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x17191d,
    roughness: 0.88,
    metalness: 0.08,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    roughness: 0.22,
    metalness: 0.88,
  });
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.45,
    metalness: 0.65,
  });

  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI / 2);

  const rimGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.02, 18);
  rimGeo.rotateZ(Math.PI / 2);

  const hubGeo = new THREE.CylinderGeometry(radius * 0.24, radius * 0.24, width + 0.05, 12);
  hubGeo.rotateZ(Math.PI / 2);

  if (isDual) {
    const t1 = new THREE.Mesh(tireGeo, tireMat);
    t1.position.x = -width * 0.54;
    t1.castShadow = true;
    const t2 = new THREE.Mesh(tireGeo, tireMat);
    t2.position.x = width * 0.54;
    t2.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    rim.position.x = width * 0.45;
    const hub = new THREE.Mesh(hubGeo, hubMat);
    hub.position.x = width * 0.46;
    wheelGroup.add(t1, t2, rim, hub);
  } else {
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    const rim = new THREE.Mesh(rimGeo, rimMat);
    const hub = new THREE.Mesh(hubGeo, hubMat);
    wheelGroup.add(tire, rim, hub);
  }

  return wheelGroup;
}

export function createBangladeshiBus(
  initialLivery: LiveryConfig,
  routeLabel: string,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): BusRig {
  const root = new THREE.Group();
  const bodyTiltGroup = new THREE.Group();
  root.add(bodyTiltGroup);

  // Soft radial contact shadow flush on road (y = 0.025)
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 12.6),
    new THREE.MeshBasicMaterial({
      map: createContactShadowTexture(),
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    })
  );
  contactShadow.rotation.x = -Math.PI / 2;
  contactShadow.position.y = 0.025;
  root.add(contactShadow);

  // Shared materials
  const hullPaintMat = new THREE.MeshPhysicalMaterial({
    color: initialLivery.primaryColor,
    roughness: 0.25,
    metalness: 0.35,
    clearcoat: 0.9,
    clearcoatRoughness: 0.14,
  });

  const roofPaintMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.28,
    metalness: 0.15,
    clearcoat: 0.8,
  });

  const accentTrimMat = new THREE.MeshStandardMaterial({
    color: initialLivery.secondaryColor,
    roughness: 0.32,
    metalness: 0.4,
  });

  const chassisMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.85,
    metalness: 0.3,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.12,
    metalness: 0.95,
  });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d212b,
    roughness: 0.06,
    metalness: 0.18,
    transparent: true,
    opacity: 0.38,
    clearcoat: 1.0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const frontWindshieldMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.05,
    metalness: 0.1,
    transparent: true,
    opacity: 0.28,
    clearcoat: 1.0,
    depthWrite: false,
  });

  // 1. Lower Chassis & Floor Deck
  const chassis = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.34, 11.1), chassisMat);
  chassis.position.set(0, 0.58, 0);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  bodyTiltGroup.add(chassis);

  // Front & Rear bumpers
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.36, 0.28), hullPaintMat);
  frontBumper.position.set(0, 0.56, -5.56);
  frontBumper.castShadow = true;
  bodyTiltGroup.add(frontBumper);

  const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(2.56, 0.36, 0.26), hullPaintMat);
  rearBumper.position.set(0, 0.56, 5.56);
  rearBumper.castShadow = true;
  bodyTiltGroup.add(rearBumper);

  // 2. Sculpted Lower Side Body & Luggage Skirts (split on left front for real Passenger Door Stepwell)
  const lowerCore = new THREE.Mesh(new THREE.BoxGeometry(1.62, 1.08, 11.0), hullPaintMat);
  lowerCore.position.set(0.46, 1.24, 0);
  lowerCore.castShadow = true;
  lowerCore.receiveShadow = true;
  bodyTiltGroup.add(lowerCore);

  const lowerLeftMain = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.08, 9.64), hullPaintMat);
  lowerLeftMain.position.set(-1.04, 1.24, 0.68);
  lowerLeftMain.castShadow = true;
  lowerLeftMain.receiveShadow = true;
  bodyTiltGroup.add(lowerLeftMain);

  const lowerLeftCorner = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.08, 0.44), hullPaintMat);
  lowerLeftCorner.position.set(-1.04, 1.24, -5.28);
  lowerLeftCorner.castShadow = true;
  bodyTiltGroup.add(lowerLeftCorner);

  // Side Livery Panels strictly on lower skirt (y = 0.70..1.78) so windows remain 100% open & transparent!
  let sideLiveryTex = createBusLiveryTexture(initialLivery, routeLabel, maxAnisotropy);
  const sideLiveryMat = new THREE.MeshStandardMaterial({
    map: sideLiveryTex,
    roughness: 0.28,
    metalness: 0.22,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const leftPanel = new THREE.Mesh(new THREE.PlaneGeometry(9.35, 1.06), sideLiveryMat);
  leftPanel.position.set(-1.285, 1.24, 0.64);
  leftPanel.rotation.y = -Math.PI / 2;
  bodyTiltGroup.add(leftPanel);

  const rightPanel = new THREE.Mesh(new THREE.PlaneGeometry(10.6, 1.06), sideLiveryMat);
  rightPanel.position.set(1.285, 1.24, 0.1);
  rightPanel.rotation.y = Math.PI / 2;
  bodyTiltGroup.add(rightPanel);

  // 3. Upper Window Pillars & Roof Structure (open interior for Cockpit View!)
  const roofShell = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.26, 11.0), roofPaintMat);
  roofShell.position.set(0, 3.28, 0.05);
  roofShell.castShadow = true;
  bodyTiltGroup.add(roofShell);

  // Sloped aerodynamic front brow above windshield
  const frontBrow = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.42, 0.68), hullPaintMat);
  frontBrow.position.set(0, 3.12, -5.24);
  frontBrow.rotation.x = 0.24;
  frontBrow.castShadow = true;
  bodyTiltGroup.add(frontBrow);

  // Front nose fascia below windshield
  const frontFascia = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.92, 0.46), hullPaintMat);
  frontFascia.position.set(0, 1.22, -5.42);
  frontFascia.rotation.x = -0.08;
  frontFascia.castShadow = true;
  bodyTiltGroup.add(frontFascia);

  // Chrome front radiator grille + Paribahan badge bar
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.34, 0.08), chromeMat);
  grille.position.set(0, 0.96, -5.66);
  bodyTiltGroup.add(grille);

  // Rear engine wall (lower half) + Rear Coach Window Frame + Rear Glass
  const rearWallLower = new THREE.Mesh(new THREE.BoxGeometry(2.54, 1.18, 0.32), hullPaintMat);
  rearWallLower.position.set(0, 1.29, 5.38);
  rearWallLower.castShadow = true;
  bodyTiltGroup.add(rearWallLower);

  const rearHeader = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.38, 0.32), hullPaintMat);
  rearHeader.position.set(0, 3.06, 5.38);
  rearHeader.castShadow = true;
  bodyTiltGroup.add(rearHeader);

  const rearPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.1, 0.32), chassisMat);
  rearPillarL.position.set(-1.15, 2.38, 5.38);
  const rearPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 1.1, 0.32), chassisMat);
  rearPillarR.position.set(1.15, 2.38, 5.38);
  const rearGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.06, 1.04), glassMat);
  rearGlass.position.set(0, 2.38, 5.42);
  rearGlass.renderOrder = 2;
  bodyTiltGroup.add(rearPillarL, rearPillarR, rearGlass);

  // Rear engine vent louvers
  const rearVent = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 0.08), chassisMat);
  rearVent.position.set(0, 1.15, 5.54);
  bodyTiltGroup.add(rearVent);

  // Window Beltline & Roof Cantrail Moldings
  const beltRailGeo = new THREE.BoxGeometry(0.08, 0.08, 10.65);
  const beltRailR = new THREE.Mesh(beltRailGeo, chassisMat);
  beltRailR.position.set(1.25, 1.79, 0.05);
  const cantRailR = new THREE.Mesh(beltRailGeo, chassisMat);
  cantRailR.position.set(1.25, 3.14, 0.05);
  const beltRailL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 9.55), chassisMat);
  beltRailL.position.set(-1.25, 1.79, 0.65);
  const cantRailL = new THREE.Mesh(beltRailGeo, chassisMat);
  cantRailL.position.set(-1.25, 3.14, 0.05);
  bodyTiltGroup.add(beltRailR, cantRailR, beltRailL, cantRailL);

  // Individual Framed Side Window Pillars, Sliding Transom Bars & Curtains
  const pillarGeo = new THREE.BoxGeometry(0.11, 1.42, 0.14);
  const pillarZ = [-5.32, -5.06, -4.14, -2.55, -0.95, 0.65, 2.25, 3.85, 5.25];
  for (const pz of pillarZ) {
    const pL = new THREE.Mesh(pillarGeo, chassisMat);
    pL.position.set(-1.23, 2.47, pz);
    if (pz < -5.2) pL.rotation.x = 0.15;
    const pR = new THREE.Mesh(pillarGeo, chassisMat);
    pR.position.set(1.23, 2.47, pz);
    if (pz < -5.2) pR.rotation.x = 0.15;
    bodyTiltGroup.add(pL, pR);
  }

  // Left Passenger Door Vertical Door-Frame Jambs (down to entry stepwell)
  const doorJambGeo = new THREE.BoxGeometry(0.1, 1.4, 0.12);
  const doorJambF = new THREE.Mesh(doorJambGeo, chassisMat);
  doorJambF.position.set(-1.23, 1.15, -5.06);
  const doorJambB = new THREE.Mesh(doorJambGeo, chassisMat);
  doorJambB.position.set(-1.23, 1.15, -4.14);
  bodyTiltGroup.add(doorJambF, doorJambB);

  // Entry Stepwell Stairs + Warm Amber Step Lighting + Stainless Grab Rail (Left Front Doorway)
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.4 });
  const stepLightMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfbbf24, emissiveIntensity: 0.9 });
  for (let s = 0; s < 3; s++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.86), stepMat);
    step.position.set(-1.08 + s * 0.24, 0.54 + s * 0.29, -4.6);
    const nosing = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.86), stepLightMat);
    nosing.position.set(-1.21 + s * 0.24, 0.57 + s * 0.29, -4.6);
    bodyTiltGroup.add(step, nosing);
  }
  const grabPole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.9, 8), chromeMat);
  grabPole.position.set(-0.98, 1.65, -4.22);
  bodyTiltGroup.add(grabPole);

  // Animated Out-Swinging Pneumatic Passenger Door (Left Front: z = -5.06..-4.14)
  const passengerDoorPivot = new THREE.Group();
  passengerDoorPivot.position.set(-1.26, 0.48, -5.06);

  const doorBottomSkirt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.56, 0.88), hullPaintMat);
  doorBottomSkirt.position.set(0, 0.28, 0.45);
  const doorMidRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.9), chassisMat);
  doorMidRail.position.set(0, 1.15, 0.45);
  const doorTopRail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.9), chassisMat);
  doorTopRail.position.set(0, 2.58, 0.45);
  const doorStileF = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.64, 0.08), chassisMat);
  doorStileF.position.set(0, 1.32, 0.04);
  const doorStileB = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.64, 0.08), chassisMat);
  doorStileB.position.set(0, 1.32, 0.86);

  const doorUpperGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 1.32), glassMat);
  doorUpperGlass.position.set(-0.01, 1.87, 0.45);
  doorUpperGlass.rotation.y = -Math.PI / 2;
  doorUpperGlass.renderOrder = 3;

  const doorLowerGlass = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.52), glassMat);
  doorLowerGlass.position.set(-0.01, 0.82, 0.45);
  doorLowerGlass.rotation.y = -Math.PI / 2;
  doorLowerGlass.renderOrder = 3;

  const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.22, 0.04), chromeMat);
  doorHandle.position.set(-0.05, 1.18, 0.78);
  const doorEmergencyBadge = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.08, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4 })
  );
  doorEmergencyBadge.position.set(-0.04, 1.15, 0.45);

  passengerDoorPivot.add(
    doorBottomSkirt,
    doorMidRail,
    doorTopRail,
    doorStileF,
    doorStileB,
    doorUpperGlass,
    doorLowerGlass,
    doorHandle,
    doorEmergencyBadge
  );
  bodyTiltGroup.add(passengerDoorPivot);

  // Right-Side Driver Door Seam, Handle & Split Sliding Window
  const driverDoorRearSeam = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.25, 0.04), chassisMat);
  driverDoorRearSeam.position.set(1.27, 1.16, -4.14);
  const driverDoorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.18), chromeMat);
  driverDoorHandle.position.set(1.29, 1.38, -4.26);
  const driverSliderBar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.26, 0.04), chassisMat);
  driverSliderBar.position.set(1.26, 2.47, -4.6);
  bodyTiltGroup.add(driverDoorRearSeam, driverDoorHandle, driverSliderBar);

  // Individual Framed Side Window Bays (Glass + Aluminum Transom Bars + Pleated Coach Curtains)
  const transomMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.35, metalness: 0.7 });
  const curtainMat = new THREE.MeshStandardMaterial({ color: initialLivery.secondaryColor, roughness: 0.85 });
  const winCenterZs = [-4.6, -3.345, -1.75, -0.15, 1.45, 3.05, 4.55];
  const winWidths = [0.82, 1.48, 1.48, 1.48, 1.48, 1.48, 1.28];

  for (let i = 0; i < winCenterZs.length; i++) {
    const wz = winCenterZs[i];
    const ww = winWidths[i];

    // Right side always has window (bay 0 is driver window, bays 1..6 are passenger bays)
    const winR = new THREE.Mesh(new THREE.PlaneGeometry(ww, 1.28), glassMat);
    winR.position.set(1.255, 2.46, wz);
    winR.rotation.y = Math.PI / 2;
    winR.renderOrder = 2;
    bodyTiltGroup.add(winR);

    if (i > 0) {
      const transomR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, ww), transomMat);
      transomR.position.set(1.26, 2.78, wz);
      const curtainR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.18, 0.16), curtainMat);
      curtainR.position.set(1.19, 2.44, wz - ww * 0.42);
      bodyTiltGroup.add(transomR, curtainR);

      // Left side passenger window bays (bays 1..6; bay 0 is the animated passenger door!)
      const winL = new THREE.Mesh(new THREE.PlaneGeometry(ww, 1.28), glassMat);
      winL.position.set(-1.255, 2.46, wz);
      winL.rotation.y = -Math.PI / 2;
      winL.renderOrder = 2;
      const transomL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, ww), transomMat);
      transomL.position.set(-1.26, 2.78, wz);
      const curtainL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.18, 0.16), curtainMat);
      curtainL.position.set(-1.19, 2.44, wz - ww * 0.42);
      bodyTiltGroup.add(winL, transomL, curtainL);
    }
  }

  // Panoramic front windshield (sloped slightly backward for coach aerodynamics)
  const frontGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.38, 1.56), frontWindshieldMat);
  frontGlass.position.set(0, 2.38, -5.42);
  frontGlass.rotation.x = 0.14;
  frontGlass.rotation.y = Math.PI;
  frontGlass.renderOrder = 3;
  // Use DoubleSide on front windshield so it renders from inside cockpit AND outside
  frontWindshieldMat.side = THREE.DoubleSide;
  bodyTiltGroup.add(frontGlass);

  // Illuminated LED Destination Board above front windshield
  let ledTex = createLedBoardTexture(
    `${initialLivery.banglaName} · ${routeLabel}`,
    '#0b1322',
    '#fbbf24',
    maxAnisotropy
  );
  const ledMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    emissiveMap: ledTex,
    emissive: 0xffffff,
    emissiveIntensity: 0.75,
    roughness: 0.3,
  });
  const ledBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.28), ledMat);
  ledBoard.position.set(0, 3.04, -5.56);
  ledBoard.rotation.y = Math.PI;
  ledBoard.rotation.x = -0.18;
  bodyTiltGroup.add(ledBoard);

  // Rear LED banner
  const rearLedBoard = new THREE.Mesh(new THREE.PlaneGeometry(1.56, 0.28), ledMat);
  rearLedBoard.position.set(0, 3.0, 5.56);
  bodyTiltGroup.add(rearLedBoard);

  // 4. Rooftop AC Condenser Pod (iconic Bangladeshi AC coach feature)
  const acPod = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.34, 4.6), roofPaintMat);
  acPod.position.set(0, 3.56, -0.6);
  acPod.castShadow = true;
  bodyTiltGroup.add(acPod);

  const acGrille = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 3.8), chassisMat);
  acGrille.position.set(0, 3.74, -0.6);
  bodyTiltGroup.add(acGrille);

  const acAccentStripe = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.1, 4.62), accentTrimMat);
  acAccentStripe.position.set(0, 3.45, -0.6);
  bodyTiltGroup.add(acAccentStripe);

  // 5. Long-arm Bangladeshi Coach Side Mirrors (Left & Right)
  const buildMirror = (side: -1 | 1) => {
    const mGroup = new THREE.Group();
    const arm1 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.44, 8), chassisMat);
    arm1.rotation.z = Math.PI / 2;
    arm1.position.set(side * 0.2, 0.22, 0);

    const arm2 = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.44, 8), chassisMat);
    arm2.rotation.z = Math.PI / 2;
    arm2.position.set(side * 0.2, -0.12, 0);

    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.46, 0.24), hullPaintMat);
    housing.position.set(side * 0.42, 0.05, 0);
    housing.rotation.y = side * -0.22;

    const mirrorFace = new THREE.Mesh(
      new THREE.PlaneGeometry(0.2, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.04, metalness: 0.96 })
    );
    mirrorFace.position.set(side * 0.42, 0.05, 0.125);
    mirrorFace.rotation.y = side * -0.22;

    mGroup.add(arm1, arm2, housing, mirrorFace);
    mGroup.position.set(side * 1.24, 2.38, -5.44);
    return mGroup;
  };
  bodyTiltGroup.add(buildMirror(-1), buildMirror(1));

  // 6. Windshield Wipers (twin articulated arms)
  const wiperMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.6 });
  const buildWiper = (xPos: number) => {
    const wPivot = new THREE.Group();
    wPivot.position.set(xPos, 1.66, -5.54);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.85, 0.03), wiperMat);
    blade.position.set(0, 0.42, 0);
    wPivot.add(blade);
    bodyTiltGroup.add(wPivot);
    return wPivot;
  };
  const wiperLeft = buildWiper(-0.55);
  const wiperRight = buildWiper(0.35);

  // 7. Interior Cockpit, Steering Wheel, Live Gauges & Passenger Seats
  const interiorGroup = new THREE.Group();
  bodyTiltGroup.add(interiorGroup);

  const floorDeckMain = new THREE.Mesh(new THREE.BoxGeometry(2.36, 0.08, 9.54), chassisMat);
  floorDeckMain.position.set(0, 1.38, 0.63);
  interiorGroup.add(floorDeckMain);

  const floorDeckFront = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.08, 1.06), chassisMat);
  floorDeckFront.position.set(0.3, 1.38, -4.67);
  interiorGroup.add(floorDeckFront);

  // Passenger seat rows (10 rows of 2+2 blue fabric seats)
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.85 });
  const headrestMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 });
  const seatGeo = new THREE.BoxGeometry(0.42, 0.68, 0.44);
  const headGeo = new THREE.BoxGeometry(0.36, 0.22, 0.14);
  for (let row = 0; row < 9; row++) {
    const rz = -3.4 + row * 0.92;
    for (const sx of [-0.92, -0.44, 0.44, 0.92]) {
      const seat = new THREE.Mesh(seatGeo, seatMat);
      seat.position.set(sx, 1.78, rz);
      const hr = new THREE.Mesh(headGeo, headrestMat);
      hr.position.set(sx, 2.2, rz + 0.14);
      interiorGroup.add(seat, hr);
    }
  }

  // Driver position: Bangladesh uses RIGHT-HAND DRIVE buses (driver sits on right +X, x = +0.62)!
  const driverX = 0.62;
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x181c24, roughness: 0.72, metalness: 0.15 });
  const dashTrimMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.35, metalness: 0.25 });

  const dashboard = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.44, 0.74), dashMat);
  dashboard.position.set(0, 1.66, -4.92);
  interiorGroup.add(dashboard);

  const woodTrim = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.06, 0.12), dashTrimMat);
  woodTrim.position.set(driverX - 0.15, 1.88, -4.64);
  interiorGroup.add(woodTrim);

  // Instrument Binnacle Hood
  const binnacle = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.22, 0.26), dashMat);
  binnacle.position.set(driverX, 1.94, -4.82);
  interiorGroup.add(binnacle);

  // Live 3D Speedometer & Tachometer Gauges
  const speedTex = createGaugeFaceTexture('KM/H', 120, 20, 90, maxAnisotropy);
  const rpmTex = createGaugeFaceTexture('RPM x1K', 6, 1, 5, maxAnisotropy);

  const speedFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.092, 24),
    new THREE.MeshBasicMaterial({ map: speedTex })
  );
  speedFace.position.set(driverX - 0.12, 1.95, -4.685);
  speedFace.rotation.x = -0.25;
  interiorGroup.add(speedFace);

  const rpmFace = new THREE.Mesh(
    new THREE.CircleGeometry(0.092, 24),
    new THREE.MeshBasicMaterial({ map: rpmTex })
  );
  rpmFace.position.set(driverX + 0.12, 1.95, -4.685);
  rpmFace.rotation.x = -0.25;
  interiorGroup.add(rpmFace);

  const needleMat = new THREE.MeshBasicMaterial({ color: 0xf97316 });
  const buildNeedle = (x: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.95, -4.678);
    pivot.rotation.x = -0.25;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.072, 0.006), needleMat);
    bar.position.y = 0.03;
    pivot.add(bar);
    interiorGroup.add(pivot);
    return pivot;
  };
  const speedNeedle = buildNeedle(driverX - 0.12);
  const rpmNeedle = buildNeedle(driverX + 0.12);

  // Working 3D Steering Wheel
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(driverX, 1.84, -4.46);
  steeringWheel.rotation.x = -0.68; // Angled like a real highway coach wheel

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.024, 10, 28), dashMat);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 14), chromeMat);
  wheelHub.rotation.x = Math.PI / 2;
  const spoke1 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.028, 0.02), dashMat);
  const spoke2 = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.21, 0.02), dashMat);
  spoke2.position.y = -0.1;
  steeringWheel.add(wheelRim, wheelHub, spoke1, spoke2);
  interiorGroup.add(steeringWheel);

  // Steering column shaft
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.046, 0.45, 10), dashMat);
  column.position.set(driverX, 1.66, -4.64);
  column.rotation.x = Math.PI / 2 - 0.68;
  interiorGroup.add(column);

  // Decorative Bangladeshi Coach Windshield Tassel (Jhalor) hanging from top mirror
  const tassel = new THREE.Group();
  tassel.position.set(0.18, 2.95, -5.05);
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), accentTrimMat);
  cord.position.y = -0.09;
  const puff = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 }));
  puff.position.y = -0.22;
  tassel.add(cord, puff);
  interiorGroup.add(tassel);

  // First-person cockpit camera anchor (driver eye level on right side)
  const cockpitAnchor = new THREE.Object3D();
  cockpitAnchor.position.set(driverX, 2.44, -4.18);
  bodyTiltGroup.add(cockpitAnchor);

  // Back-facing rearview mirror camera anchor mounted cleanly behind upper rear glass
  const rearMirrorAnchor = new THREE.Object3D();
  rearMirrorAnchor.position.set(0, 2.98, 5.66);
  bodyTiltGroup.add(rearMirrorAnchor);

  // 8. Working Headlights, Brake Lights, Reverse Lights & Indicators
  const headlightLensMat = new THREE.MeshStandardMaterial({
    color: 0xfef9c3,
    emissive: 0xfef08a,
    emissiveIntensity: 1.5,
    roughness: 0.1,
  });
  const brakeLensMat = new THREE.MeshStandardMaterial({
    color: 0x7f1d1d,
    emissive: 0xef4444,
    emissiveIntensity: 0.35,
    roughness: 0.2,
  });
  const reverseLensMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xffffff,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const leftIndMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });
  const rightIndMat = new THREE.MeshStandardMaterial({
    color: 0x92400e,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.0,
    roughness: 0.2,
  });

  const hlGeo = new THREE.BoxGeometry(0.38, 0.18, 0.08);
  const hlL = new THREE.Mesh(hlGeo, headlightLensMat);
  hlL.position.set(-0.92, 0.96, -5.66);
  const hlR = new THREE.Mesh(hlGeo, headlightLensMat);
  hlR.position.set(0.92, 0.96, -5.66);
  bodyTiltGroup.add(hlL, hlR);

  // Real SpotLight beams (skip heavy shadow casting on headlights for FPS; keep 1 main sun shadow)
  const headlightLeft = new THREE.SpotLight(0xfffbeb, isSoftwareGl ? 18 : 26, 75, Math.PI / 5, 0.45, 1.4);
  headlightLeft.position.set(-0.92, 0.98, -5.7);
  headlightLeft.target.position.set(-1.1, 0.1, -34);
  bodyTiltGroup.add(headlightLeft, headlightLeft.target);

  const headlightRight = new THREE.SpotLight(0xfffbeb, isSoftwareGl ? 18 : 26, 75, Math.PI / 5, 0.45, 1.4);
  headlightRight.position.set(0.92, 0.98, -5.7);
  headlightRight.target.position.set(1.1, 0.1, -34);
  bodyTiltGroup.add(headlightRight, headlightRight.target);

  // Rear Brake Lights
  const blGeo = new THREE.BoxGeometry(0.4, 0.18, 0.08);
  const blL = new THREE.Mesh(blGeo, brakeLensMat);
  blL.position.set(-0.92, 0.96, 5.56);
  const blR = new THREE.Mesh(blGeo, brakeLensMat);
  blR.position.set(0.92, 0.96, 5.56);
  bodyTiltGroup.add(blL, blR);

  // Rear Reverse Lights
  const revGeo = new THREE.BoxGeometry(0.22, 0.12, 0.08);
  const revL = new THREE.Mesh(revGeo, reverseLensMat);
  revL.position.set(-0.62, 0.96, 5.56);
  const revR = new THREE.Mesh(revGeo, reverseLensMat);
  revR.position.set(0.62, 0.96, 5.56);
  bodyTiltGroup.add(revL, revR);

  // Front & Rear Amber Indicators
  const indGeo = new THREE.BoxGeometry(0.18, 0.14, 0.1);
  const fIndL = new THREE.Mesh(indGeo, leftIndMat);
  fIndL.position.set(-1.16, 1.16, -5.64);
  const rIndL = new THREE.Mesh(indGeo, leftIndMat);
  rIndL.position.set(-1.16, 1.16, 5.54);

  const fIndR = new THREE.Mesh(indGeo, rightIndMat);
  fIndR.position.set(1.16, 1.16, -5.64);
  const rIndR = new THREE.Mesh(indGeo, rightIndMat);
  rIndR.position.set(1.16, 1.16, 5.54);
  bodyTiltGroup.add(fIndL, rIndL, fIndR, rIndR);

  // 9. 6 Rotating Wheels (Front Axle Steerable + Rear Dual Drive Axle)
  const wheelRadius = 0.52;
  const frontLeftSteer = new THREE.Group();
  frontLeftSteer.position.set(-1.16, wheelRadius, -3.55);
  const flWheel = buildWheel(wheelRadius, 0.3, false);
  frontLeftSteer.add(flWheel);

  const frontRightSteer = new THREE.Group();
  frontRightSteer.position.set(1.16, wheelRadius, -3.55);
  const frWheel = buildWheel(wheelRadius, 0.3, false);
  frWheel.rotation.y = Math.PI;
  frontRightSteer.add(frWheel);

  const rearLeftWheel = buildWheel(wheelRadius, 0.27, true);
  rearLeftWheel.position.set(-1.06, wheelRadius, 3.05);

  const rearRightWheel = buildWheel(wheelRadius, 0.27, true);
  rearRightWheel.position.set(1.06, wheelRadius, 3.05);
  rearRightWheel.rotation.y = Math.PI;

  root.add(frontLeftSteer, frontRightSteer, rearLeftWheel, rearRightWheel);

  const wheelMeshes = [flWheel, frWheel, rearLeftWheel, rearRightWheel];

  return {
    root,
    bodyTiltGroup,
    frontLeftSteer,
    frontRightSteer,
    wheelMeshes,
    steeringWheel,
    speedNeedle,
    rpmNeedle,
    wiperLeft,
    wiperRight,
    tassel,
    headlightLeft,
    headlightRight,
    headlightLensMat,
    brakeLensMat,
    reverseLensMat,
    leftIndMat,
    rightIndMat,
    cockpitAnchor,
    rearMirrorAnchor,
    setLivery(livery, newRouteLabel, aniso) {
      hullPaintMat.color.setHex(livery.primaryColor);
      accentTrimMat.color.setHex(livery.secondaryColor);
      curtainMat.color.setHex(livery.secondaryColor);

      const nextSide = createBusLiveryTexture(livery, newRouteLabel, aniso);
      sideLiveryMat.map = nextSide;
      sideLiveryMat.needsUpdate = true;
      sideLiveryTex.dispose();
      sideLiveryTex = nextSide;

      const nextLed = createLedBoardTexture(
        `${livery.banglaName} · ${newRouteLabel}`,
        '#0b1322',
        '#fbbf24',
        aniso
      );
      ledMat.map = nextLed;
      ledMat.emissiveMap = nextLed;
      ledMat.needsUpdate = true;
      ledTex.dispose();
      ledTex = nextLed;
    },
    updateLights({ headlights, braking, reversing, leftBlink, rightBlink }) {
      headlightLeft.visible = headlights;
      headlightRight.visible = headlights;
      headlightLensMat.emissiveIntensity = headlights ? 2.2 : 0.12;
      brakeLensMat.emissiveIntensity = braking ? 2.8 : headlights ? 0.55 : 0.15;
      reverseLensMat.emissiveIntensity = reversing ? 2.2 : 0.0;
      leftIndMat.emissiveIntensity = leftBlink ? 2.8 : 0.0;
      rightIndMat.emissiveIntensity = rightBlink ? 2.8 : 0.0;
    },
    updateDynamics({
      wheelSpinRad,
      steerAngleRad,
      speedKmh,
      rpm,
      wiperPhase,
      pitchRad,
      rollRad,
      bounceY,
      doorOpenProgress,
      time,
    }) {
      frontLeftSteer.rotation.y = steerAngleRad;
      frontRightSteer.rotation.y = steerAngleRad;

      wheelMeshes[0].rotation.x = wheelSpinRad;
      wheelMeshes[1].rotation.x = -wheelSpinRad;
      wheelMeshes[2].rotation.x = wheelSpinRad;
      wheelMeshes[3].rotation.x = -wheelSpinRad;

      // Out-swinging pneumatic front-left passenger door animation
      passengerDoorPivot.rotation.y = THREE.MathUtils.clamp(doorOpenProgress, 0, 1) * (Math.PI * 0.52);

      // Steering wheel turns realistically (~450 deg lock-to-lock)
      steeringWheel.rotation.z = steerAngleRad * 6.5;

      // Gauge needles sweep clockwise from +135 deg (3pi/4) to -135 deg (-3pi/4)
      const speedNorm = Math.min(1, Math.abs(speedKmh) / 120);
      speedNeedle.rotation.z = Math.PI * 0.75 - speedNorm * Math.PI * 1.5;

      const rpmNorm = Math.min(1, Math.max(0, rpm / 6000));
      rpmNeedle.rotation.z = Math.PI * 0.75 - rpmNorm * Math.PI * 1.5;

      // Windshield wipers
      const wiperAngle = wiperPhase > 0 ? Math.sin(wiperPhase) * 0.88 - 0.15 : -0.95;
      wiperLeft.rotation.z = wiperAngle;
      wiperRight.rotation.z = wiperAngle;

      // Decorative tassel gentle pendulum sway
      tassel.rotation.z = -steerAngleRad * 0.65 + Math.sin(time * 3.4) * 0.06;
      tassel.rotation.x = pitchRad * 1.8;

      // Body suspension pitch, roll & bump
      bodyTiltGroup.rotation.x = pitchRad;
      bodyTiltGroup.rotation.z = rollRad;
      bodyTiltGroup.position.y = bounceY;
    },
  };
}
