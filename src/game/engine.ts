import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BusAudioEngine } from './audio';
import { BusRig, createBangladeshiBus } from './busModel';
import { PassengerVoiceCategory } from './passengerVoices';
import { TrafficManager } from './traffic';
import {
  CameraMode,
  GameHudState,
  InputState,
  LIVERIES,
  LiveryId,
  ROUTES,
  RouteId,
  TimePhase,
  TrafficDensity,
  WeatherCondition,
} from './types';
import { WeatherEffects } from './weather';
import {
  buildBangladeshiWorld,
  getRoadSlopeAngle,
  getRoadTangentAngle,
  getRoadX,
  getRoadY,
  isInsideBridgeApproach,
  WorldBuildResult,
} from './world';

// Pre-allocated math & color helpers outside render loop (zero GC)
const _camTargetPos = new THREE.Vector3();
const _camTargetLook = new THREE.Vector3();
const _busWorldPos = new THREE.Vector3();
const _cockpitWorldPos = new THREE.Vector3();
const _cockpitQuat = new THREE.Quaternion();
const _forwardDir = new THREE.Vector3();
const _rearWorldPos = new THREE.Vector3();
const _rearQuat = new THREE.Quaternion();
const _rearDir = new THREE.Vector3();
const _rearLookTarget = new THREE.Vector3();
const _rearUp = new THREE.Vector3();
const _upVec = new THREE.Vector3(0, 1, 0);

const _daySkyColor = new THREE.Color();
const _sunsetSkyColor = new THREE.Color(0xe07a4f);
const _nightSkyColor = new THREE.Color(0x070d1c);
const _curSkyColor = new THREE.Color();

const _daySunColor = new THREE.Color(0xfff1d6);
const _sunsetSunColor = new THREE.Color(0xff8438);
const _nightMoonColor = new THREE.Color(0x88b2ff);
const _curSunColor = new THREE.Color();

const _dayHemiSky = new THREE.Color(0x9bd6ff);
const _sunsetHemiSky = new THREE.Color(0xff9b6a);
const _nightHemiSky = new THREE.Color(0x1f3a66);
const _curHemiSky = new THREE.Color();

const _dayHemiGround = new THREE.Color(0x3b5e2b);
const _sunsetHemiGround = new THREE.Color(0x472c22);
const _nightHemiGround = new THREE.Color(0x090f1a);
const _curHemiGround = new THREE.Color();

const _rainSkyTintDay = new THREE.Color(0x64788c);
const _rainSkyTintNight = new THREE.Color(0x08101d);
const _fogSkyTintDay = new THREE.Color(0xc4d0db);
const _fogSkyTintNight = new THREE.Color(0x162235);
const _weatherSkyTarget = new THREE.Color();

// Game clock rate: ~5.5 in-game minutes per real second (~4.3 min full 24h cycle)
const CLOCK_MINUTES_PER_SEC = 5.5;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = THREE.MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function blendThreeColors(
  out: THREE.Color,
  c1: THREE.Color,
  w1: number,
  c2: THREE.Color,
  w2: number,
  c3: THREE.Color,
  w3: number
): void {
  out.setRGB(
    c1.r * w1 + c2.r * w2 + c3.r * w3,
    c1.g * w1 + c2.g * w2 + c3.g * w3,
    c1.b * w1 + c2.b * w2 + c3.b * w3
  );
}

export class BusSimulatorEngine {
  private readonly container: HTMLElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly isSoftwareGl: boolean;
  private readonly maxAnisotropy: number;
  private readonly audio = new BusAudioEngine();

  private readonly sunLight: THREE.DirectionalLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly lampPointLights: THREE.PointLight[] = [];
  private readonly envTexture: THREE.Texture;

  private readonly rearCamera: THREE.PerspectiveCamera;
  private readonly rearRenderTarget: THREE.WebGLRenderTarget;
  private readonly mirrorScene: THREE.Scene;
  private readonly mirrorOrthoCam: THREE.OrthographicCamera;
  private readonly mirrorQuad: THREE.Mesh;
  private mirrorViewportRect: { left: number; top: number; width: number; height: number } | null = null;
  private rearviewMirrorOn = true;
  private rearBlindSpot = { left: false, right: false };

  private bus: BusRig;
  private world: WorldBuildResult | null = null;
  private traffic: TrafficManager | null = null;

  private onHudUpdate: (state: GameHudState) => void;
  private frameId = 0;
  private lastTimeMs = 0;
  private elapsedSec = 0;
  private disposed = false;
  private paused = false;

  // Dynamic real-time clock (minutes from midnight 0..1439)
  private timeMinutes = 15 * 60 + 20; // Start at 15:20 Day; advances smoothly to Sunset & Night
  private timePhase: TimePhase = 'day';
  private streetLampsOn = false;
  private lampFactor = 0;

  // Dynamic weather system ('clear' | 'rain' | 'fog')
  private readonly weatherEffects = new WeatherEffects();
  private weather: WeatherCondition = 'clear';
  private rainFactor = 0;
  private fogFactor = 0;
  private windshieldWetness = 0;
  private weatherAuto = true;
  private manualWeatherTimer = 0;
  private manualWeatherSteps = 0;
  private wiperHintCooldown = 0;

  // Bus state & physics
  private liveryId: LiveryId = 'hanif';
  private routeId: RouteId = 'panchagarh';
  private cameraMode: CameraMode = 'chase';

  private busPos = new THREE.Vector3(0, 0, -42);
  private busYaw = 0; // 0 = facing -Z
  private speedMps = 0;
  private wheelSpinRad = 0;
  private currentSteer = 0; // -1..1
  private pitchRad = 0;
  private rollRad = 0;
  private bounceY = 0;
  private bounceVel = 0;

  // Controls & toggles
  private input: InputState = {
    throttle: 0,
    brake: 0,
    steer: 0,
    horn: false,
    cityHorn: false,
  };
  private headlightsOn = true;
  private wipersOn = false;
  private wiperPhase = 0;
  private lastWiperCycle = -1;
  private leftIndicator = false;
  private rightIndicator = false;
  private hazardOn = false;
  private reverseGear = false;
  private doorOpen = false;
  private doorOpenProgress = 0;
  private blinkTimer = 0;
  private blinkOn = false;

  // Gameplay & economy
  private fuel = 94;
  private taka = 1500;
  private passengers = 18;
  private readonly maxPassengers = 42;
  private busHealth = 100;
  private distanceDrivenM = 0;
  private completedStops = new Set<string>();
  private activeStopId: string | null = null;
  private stopActionProgress = 0;
  private atStopAction: 'none' | 'boarding' | 'refueling' | 'toll' = 'none';
  private tripComplete = false;

  private collisionCooldown = 0;
  private speedBreakerCooldown = 0;
  private speedFineCooldown = 0;
  private speedingDuration = 0;

  private alertText: string | null = null;
  private alertTone: 'info' | 'success' | 'warning' | 'danger' = 'info';
  private alertTimer = 0;
  private passengerQuote: GameHudState['passengerQuote'] = null;
  private passengerQuoteTimer = 0;
  private stopBoardingSpoken = new Set<string>();
  private stopDisembarkSpoken = new Set<string>();
  private commentTimerSec = 16;
  private trafficDensity: TrafficDensity = 'normal';
  private congestionActive = false;
  private congestionDistM: number | null = null;
  private congestionVoiceCooldown = 0;
  private lastHudEmit = 0;

  private stats = {
    totalFareEarned: 0,
    totalPenalties: 0,
    passengersServed: 18,
    tollsPaid: 0,
    fuelSpent: 0,
  };

  private camInitialized = false;
  private wasMovingAndBraked = false;

  constructor(container: HTMLElement, onHudUpdate: (state: GameHudState) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    // 1. Software WebGL detection from GPU renderer string
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas');
        const gl = probe.getContext('webgl2') || probe.getContext('webgl');
        if (!gl) return true;
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
        const gpu = String(gl.getParameter(param));
        gl.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Cameras
    this.scene = new THREE.Scene();
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.15, 750);

    // Back-facing rearview mirror camera + HDR render target + orthographic blit quad
    this.rearCamera = new THREE.PerspectiveCamera(68, 2.8, 0.25, 520);
    this.rearRenderTarget = new THREE.WebGLRenderTarget(
      this.isSoftwareGl ? 320 : 420,
      this.isSoftwareGl ? 116 : 150,
      {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        type: this.renderer.capabilities.isWebGL2 ? THREE.HalfFloatType : THREE.UnsignedByteType,
      }
    );
    this.mirrorScene = new THREE.Scene();
    this.mirrorOrthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, -1, 1);
    const mirrorGeo = new THREE.PlaneGeometry(2, 2);
    // Flip UV X so left/right match a real interior rearview mirror reflection
    const uvAttr = mirrorGeo.attributes.uv;
    for (let i = 0; i < uvAttr.count; i++) {
      uvAttr.setX(i, 1 - uvAttr.getX(i));
    }
    const mirrorMat = new THREE.MeshBasicMaterial({
      map: this.rearRenderTarget.texture,
      toneMapped: true,
      depthTest: false,
      depthWrite: false,
    });
    this.mirrorQuad = new THREE.Mesh(mirrorGeo, mirrorMat);
    this.mirrorScene.add(this.mirrorQuad);

    // 4. Procedural Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();

    // 5. Warm Tropical Sun + Cool Sky/Paddy Fill
    this.hemiLight = new THREE.HemisphereLight(0x9bd6ff, 0x3b5e2b, 0.85);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1d6, 2.25);
    this.sunLight.position.set(45, 72, 35);
    this.sunLight.castShadow = !this.isSoftwareGl;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 190;
    const d = 48;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 2 pooled warm sodium-amber PointLights repositioned onto nearest street lamps at dusk/night
    for (let i = 0; i < 2; i++) {
      const pLight = new THREE.PointLight(0xffcf70, 0, 44, 1.5);
      pLight.castShadow = false;
      this.scene.add(pLight);
      this.lampPointLights.push(pLight);
    }

    // 6. Build Bus
    const route = ROUTES[this.routeId];
    this.bus = createBangladeshiBus(
      LIVERIES[this.liveryId],
      route.banglaName,
      this.maxAnisotropy,
      this.isSoftwareGl
    );
    this.scene.add(this.bus.root);
    this.scene.add(this.weatherEffects.group);

    // 7. Build Route World & Traffic
    this.loadRoute(this.routeId);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Listeners
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleOrientationResize);
    window.visualViewport?.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    this.lastTimeMs = performance.now();
    this.emitHud(true);
    this.scheduleNextTick();
  }

  private handleContextLost = (e: Event): void => {
    e.preventDefault();
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
  };

  private handleContextRestored = (): void => {
    this.lastTimeMs = performance.now();
    this.scheduleNextTick();
  };

  private handleResize = (): void => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private handleOrientationResize = (): void => {
    window.setTimeout(this.handleResize, 120);
  };

  public unlockAudio(): void {
    this.audio.unlock();
  }

  public setMuted(muted: boolean): void {
    this.audio.setMuted(muted);
  }

  public isMuted(): boolean {
    return this.audio.isMuted();
  }

  public setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.audio.setAirHorn(false);
      this.audio.updateRainAmbience(0, this.cameraMode === 'cockpit');
    }
  }

  public setLivery(liveryId: LiveryId): void {
    this.liveryId = liveryId;
    const route = ROUTES[this.routeId];
    this.bus.setLivery(LIVERIES[liveryId], route.banglaName, this.maxAnisotropy);
    this.showAlert(`${LIVERIES[liveryId].name} coach ready!`, 'info', 2.4);
    this.emitHud(true);
  }

  public loadRoute(routeId: RouteId): void {
    this.routeId = routeId;
    const route = ROUTES[routeId];

    // Sky & horizon fog
    this.scene.background = new THREE.Color(route.skyHorizonHex);
    this.scene.fog = new THREE.FogExp2(route.skyHorizonHex, route.fogDensity);

    // Tear down previous world/traffic
    if (this.world) {
      this.scene.remove(this.world.group);
      this.world.dispose();
    }
    if (this.traffic) {
      this.scene.remove(this.traffic.group);
      this.traffic.dispose();
    }

    this.world = buildBangladeshiWorld(route, this.maxAnisotropy);
    this.scene.add(this.world.group);

    this.traffic = new TrafficManager(this.routeId, route.totalLengthM, this.maxAnisotropy);
    this.traffic.setDensity(this.trafficDensity);
    this.scene.add(this.traffic.group);

    this.bus.setLivery(LIVERIES[this.liveryId], route.banglaName, this.maxAnisotropy);
    this.resetTripState();
  }

  public resetTripState(): void {
    const startZ = -35;
    const startX = getRoadX(startZ);
    const angle = getRoadTangentAngle(startZ);
    // Start in left lane (-3.1m)
    this.busPos.set(startX - Math.cos(angle) * 3.1, getRoadY(startZ, this.routeId), startZ + Math.sin(angle) * 3.1);
    this.busYaw = angle;
    this.speedMps = 0;
    this.currentSteer = 0;
    this.pitchRad = 0;
    this.rollRad = 0;
    this.bounceY = 0;
    this.bounceVel = 0;
    this.reverseGear = false;
    this.doorOpen = false;
    this.doorOpenProgress = 0;
    this.fuel = 78;
    this.taka = 1500;
    this.passengers = 18;
    this.busHealth = 100;
    this.distanceDrivenM = 0;
    this.completedStops.clear();
    this.stopBoardingSpoken.clear();
    this.stopDisembarkSpoken.clear();
    this.commentTimerSec = 16;
    this.passengerQuote = null;
    this.passengerQuoteTimer = 0;
    this.audio.stopPassengerVoice();
    this.activeStopId = null;
    this.stopActionProgress = 0;
    this.atStopAction = 'none';
    this.tripComplete = false;
    this.stats = {
      totalFareEarned: 0,
      totalPenalties: 0,
      passengersServed: 18,
      tollsPaid: 0,
      fuelSpent: 0,
    };
    if (this.world) {
      for (const tb of this.world.tollBarriers) {
        tb.paid = false;
        tb.openProgress = 0;
      }
    }
    this.camInitialized = false;
    this.timeMinutes = 15 * 60 + 20;
    this.weatherAuto = true;
    this.manualWeatherTimer = 0;
    this.manualWeatherSteps = 0;
    this.weather = this.getWeatherForMinutes(this.timeMinutes);
    this.rainFactor = 0;
    this.fogFactor = 0;
    this.windshieldWetness = 0;
    this.wipersOn = false;
    this.wiperHintCooldown = 0;
    this.traffic?.resetCongestion();
    this.congestionActive = false;
    this.congestionDistM = null;
    this.congestionVoiceCooldown = 0;
    this.audio.updateRainAmbience(0, this.cameraMode === 'cockpit');
    this.updateTimeOfDayLighting(false);
    this.bus.root.position.copy(this.busPos);
    this.bus.root.rotation.order = 'YXZ';
    this.bus.root.rotation.set(getRoadSlopeAngle(startZ, this.routeId), this.busYaw, 0);
    const route = ROUTES[this.routeId];
    this.showAlert(`Departing ${route.stops[0].name} · Drive on LEFT lane`, 'info', 4.0);
    this.emitHud(true);
  }

  public setInput(partial: Partial<InputState>): void {
    Object.assign(this.input, partial);
    if (partial.horn !== undefined) {
      this.audio.setAirHorn(this.input.horn && !this.paused);
    }
  }

  public toggleHeadlights(): void {
    this.headlightsOn = !this.headlightsOn;
    this.emitHud(true);
  }

  public toggleWipers(): void {
    this.wipersOn = !this.wipersOn;
    this.showAlert(
      this.wipersOn ? 'ওয়াইপার চালু হয়েছে (Wipers On)' : 'ওয়াইপার বন্ধ হয়েছে (Wipers Off)',
      'info',
      1.6
    );
    this.emitHud(true);
  }

  public toggleLeftIndicator(): void {
    this.hazardOn = false;
    this.leftIndicator = !this.leftIndicator;
    if (this.leftIndicator) this.rightIndicator = false;
    this.emitHud(true);
  }

  public toggleRightIndicator(): void {
    this.hazardOn = false;
    this.rightIndicator = !this.rightIndicator;
    if (this.rightIndicator) this.leftIndicator = false;
    this.emitHud(true);
  }

  public toggleHazard(): void {
    this.hazardOn = !this.hazardOn;
    if (this.hazardOn) {
      this.leftIndicator = false;
      this.rightIndicator = false;
    }
    this.emitHud(true);
  }

  public toggleReverse(): void {
    if (Math.abs(this.speedMps) < 2.2) {
      this.reverseGear = !this.reverseGear;
      this.showAlert(this.reverseGear ? 'Reverse Gear Engaged (R)' : 'Drive Mode Engaged (D)', 'info', 1.6);
      this.emitHud(true);
    }
  }

  public toggleDoor(): void {
    this.doorOpen = !this.doorOpen;
    this.audio.playDoorAir(this.doorOpen);
    this.showAlert(this.doorOpen ? 'দরজা খোলা হয়েছে (Door Open)' : 'দরজা বন্ধ হয়েছে (Door Closed)', 'info', 1.6);
    if (this.doorOpen && Math.abs(this.speedMps) * 3.6 < 6 && !this.passengerQuote) {
      this.triggerPassengerVoice(Math.random() < 0.5 ? 'boarding' : 'disembarking');
    }
    this.emitHud(true);
  }

  public cycleCamera(): void {
    const order: CameraMode[] = ['chase', 'cockpit', 'cinematic'];
    const idx = (order.indexOf(this.cameraMode) + 1) % order.length;
    this.setCameraMode(order[idx]);
  }

  public setCameraMode(mode: CameraMode): void {
    this.cameraMode = mode;
    this.camInitialized = false;
    this.emitHud(true);
  }

  public toggleRearviewMirror(): void {
    this.rearviewMirrorOn = !this.rearviewMirrorOn;
    this.emitHud(true);
  }

  public setMirrorViewportRect(
    rect: { left: number; top: number; width: number; height: number } | null
  ): void {
    this.mirrorViewportRect = rect;
    if (rect && rect.width > 10 && rect.height > 10) {
      this.rearCamera.aspect = rect.width / rect.height;
      this.rearCamera.updateProjectionMatrix();
    }
  }

  public cycleTimeOfDay(): void {
    if (this.timePhase === 'day') {
      this.timeMinutes = 17 * 60 + 45; // 17:45 Golden Sunset
    } else if (this.timePhase === 'sunset') {
      this.timeMinutes = 21 * 60 + 15; // 21:15 Highway Night
    } else {
      this.timeMinutes = 14 * 60 + 0; // 14:00 Bright Afternoon
    }
    // Re-sync weather automatically to the new time of day
    this.weatherAuto = true;
    this.manualWeatherTimer = 0;
    this.manualWeatherSteps = 0;
    const timeWeather = this.getWeatherForMinutes(this.timeMinutes);
    this.updateTimeOfDayLighting(true);
    if (timeWeather !== this.weather) {
      this.setWeather(timeWeather, false);
    } else {
      this.emitHud(true);
    }
  }

  public cycleWeather(): void {
    const order: WeatherCondition[] = ['clear', 'rain', 'fog'];
    if (!this.weatherAuto && this.manualWeatherSteps >= 2) {
      this.weatherAuto = true;
      this.manualWeatherTimer = 0;
      this.manualWeatherSteps = 0;
      const synced = this.getWeatherForMinutes(this.timeMinutes);
      if (synced !== this.weather) {
        this.setWeather(synced, false);
      } else {
        this.showAlert('সময় অনুযায়ী অটো আবহাওয়া চালু (Auto Weather)', 'info', 2.4);
        this.emitHud(true);
      }
      return;
    }

    const next = order[(order.indexOf(this.weather) + 1) % order.length];
    this.manualWeatherSteps = this.weatherAuto ? 1 : this.manualWeatherSteps + 1;
    this.setWeather(next, true);
  }

  public setWeather(next: WeatherCondition, manual = false): void {
    if (manual) {
      this.weatherAuto = false;
      this.manualWeatherTimer = 75;
    }
    if (this.weather === next && !manual) return;
    this.weather = next;

    if (next === 'rain') {
      if (!this.headlightsOn) this.headlightsOn = true;
      this.showAlert('বৃষ্টি শুরু হয়েছে · প্রয়োজনে ওয়াইপার (K) ও হেডলাইট ব্যবহার করুন (Rain)', 'info', 3.4);
    } else if (next === 'fog') {
      if (!this.headlightsOn) this.headlightsOn = true;
      this.showAlert('ঘন কুয়াশা পড়েছে · হেডলাইট চালু রেখে ধীরে চালান (Foggy)', 'warning', 3.4);
    } else {
      this.showAlert('আবহাওয়া পরিষ্কার হয়েছে (Clear Sky)', 'success', 2.8);
    }
    this.emitHud(true);
  }

  public setTrafficDensity(density: TrafficDensity): void {
    this.trafficDensity = density;
    this.traffic?.setDensity(density);
    const labels: Record<TrafficDensity, string> = {
      low: 'হালকা ট্রাফিক (Traffic Density: Low)',
      normal: 'স্বাভাবিক ট্রাফিক (Traffic Density: Normal)',
      heavy: 'ভারী যানজট (Traffic Density: Heavy)',
    };
    this.showAlert(labels[density], density === 'heavy' ? 'warning' : 'info', 2.4);
    this.emitHud(true);
  }

  public cycleTrafficDensity(): void {
    const order: TrafficDensity[] = ['low', 'normal', 'heavy'];
    const next = order[(order.indexOf(this.trafficDensity) + 1) % order.length];
    this.setTrafficDensity(next);
  }

  private showAlert(text: string, tone: 'info' | 'success' | 'warning' | 'danger', duration = 2.6): void {
    this.alertText = text;
    this.alertTone = tone;
    this.alertTimer = duration;
  }

  private triggerPassengerVoice(category: PassengerVoiceCategory): void {
    void this.audio.playPassengerVoice(category).then((clip) => {
      if (clip && !this.disposed) {
        this.passengerQuote = {
          speaker: clip.speaker,
          textBn: clip.textBn,
          textEn: clip.textEn,
          category: clip.category,
        };
        this.passengerQuoteTimer = 3.4;
      }
    });
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(() => {
        if (!this.disposed) this.tick();
      });
    } else {
      this.frameId = requestAnimationFrame(() => {
        if (!this.disposed) this.tick();
      });
    }
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (!gl || !gl.fenceSync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private tick(): void {
    const now = performance.now();
    const rawDelta = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const delta = Math.min(0.05, Math.max(0.001, rawDelta));
    this.elapsedSec += delta;

    if (!this.paused && !this.tripComplete) {
      this.stepSimulation(delta);
    } else {
      this.audio.updateEngine(750, 0, 0);
    }

    this.updateCamera(delta);

    const renderMirror =
      this.cameraMode === 'cockpit' &&
      this.rearviewMirrorOn &&
      this.mirrorViewportRect !== null &&
      this.mirrorViewportRect.width > 10 &&
      this.mirrorViewportRect.height > 10;

    if (renderMirror) {
      this.updateRearCamera();
      const prevTarget = this.renderer.getRenderTarget();
      this.renderer.setRenderTarget(this.rearRenderTarget);
      this.renderer.clear();
      this.renderer.render(this.scene, this.rearCamera);
      this.renderer.setRenderTarget(prevTarget);
    }

    this.renderer.render(this.scene, this.camera);

    if (renderMirror && this.mirrorViewportRect) {
      this.renderMirrorOverlay(this.mirrorViewportRect);
    }

    if (now - this.lastHudEmit > 75) {
      this.lastHudEmit = now;
      this.emitHud(false);
    }

    this.scheduleNextTick();
  }

  private stepSimulation(delta: number): void {
    const route = ROUTES[this.routeId];
    this.collisionCooldown = Math.max(0, this.collisionCooldown - delta);
    this.speedBreakerCooldown = Math.max(0, this.speedBreakerCooldown - delta);
    this.speedFineCooldown = Math.max(0, this.speedFineCooldown - delta);
    this.wiperHintCooldown = Math.max(0, this.wiperHintCooldown - delta);
    this.congestionVoiceCooldown = Math.max(0, this.congestionVoiceCooldown - delta);

    // Advance continuous real-time clock & time-synced weather
    this.timeMinutes = (this.timeMinutes + delta * CLOCK_MINUTES_PER_SEC) % 1440;

    if (!this.weatherAuto) {
      this.manualWeatherTimer -= delta;
      if (this.manualWeatherTimer <= 0) {
        this.weatherAuto = true;
        this.manualWeatherSteps = 0;
      }
    }

    if (this.weatherAuto) {
      const scheduledWeather = this.getWeatherForMinutes(this.timeMinutes);
      if (scheduledWeather !== this.weather) {
        this.setWeather(scheduledWeather, false);
      }
    }

    const targetRain = this.weather === 'rain' ? 1 : 0;
    const targetFog = this.weather === 'fog' ? 1 : 0;
    this.rainFactor = THREE.MathUtils.damp(this.rainFactor, targetRain, 1.8, delta);
    this.fogFactor = THREE.MathUtils.damp(this.fogFactor, targetFog, 1.5, delta);

    this.updateTimeOfDayLighting(true);

    if (this.alertTimer > 0) {
      this.alertTimer -= delta;
      if (this.alertTimer <= 0) {
        this.alertText = null;
      }
    }

    if (this.passengerQuoteTimer > 0) {
      this.passengerQuoteTimer -= delta;
      if (this.passengerQuoteTimer <= 0) {
        this.passengerQuote = null;
      }
    }

    if (Math.abs(this.speedMps) > 5 && this.activeStopId === null && this.passengers > 0) {
      this.commentTimerSec -= delta;
      if (this.commentTimerSec <= 0) {
        this.commentTimerSec = 18 + Math.random() * 14;
        this.triggerPassengerVoice('comment');
      }
    }

    // 1. Steering smoothing
    const steerTarget = THREE.MathUtils.clamp(this.input.steer, -1, 1);
    this.currentSteer = THREE.MathUtils.damp(this.currentSteer, steerTarget, 7.5, delta);
    const maxSteerAngle = THREE.MathUtils.lerp(0.46, 0.22, Math.min(1, Math.abs(this.speedMps) / 26));
    const steerAngleRad = -this.currentSteer * maxSteerAngle;

    // 2. Longitudinal acceleration, braking & fuel consumption
    const hasFuel = this.fuel > 0.2;
    const accelInput = hasFuel ? this.input.throttle : 0;
    const brakeInput = this.input.brake;

    const maxForwardMps = 28.5; // ~102.6 km/h luxury coach top speed
    const maxReverseMps = -7.5; // ~27 km/h reverse

    let accelMps2 = 0;
    if (accelInput > 0) {
      if (this.reverseGear) {
        accelMps2 = -accelInput * 5.2;
      } else {
        // Strong diesel torque at low speed, tapering near top speed
        const speedFactor = 1 - Math.max(0, this.speedMps / maxForwardMps) * 0.65;
        accelMps2 = accelInput * 7.4 * speedFactor;
      }
    }

    // Service brake (wet asphalt slightly extends stopping distance during heavy rain)
    const wetBrakeGrip = 14.5 - this.rainFactor * 2.4;
    if (brakeInput > 0) {
      const sign = Math.sign(this.speedMps);
      if (Math.abs(this.speedMps) > 0.25) {
        accelMps2 -= sign * brakeInput * wetBrakeGrip;
        if (Math.abs(this.speedMps) > 4.5) {
          this.wasMovingAndBraked = true;
        }
      } else {
        this.speedMps = 0;
      }
    }

    // Rolling resistance + aerodynamic drag + off-road paddy shoulder drag
    const roadCx = getRoadX(this.busPos.z);
    const roadAngle = getRoadTangentAngle(this.busPos.z);
    const lateralOffset = (this.busPos.x - roadCx) * Math.cos(roadAngle);
    const offRoad = Math.abs(lateralOffset) > 5.8;

    const dragCoeff = offRoad ? 1.45 : 0.22;
    accelMps2 -= this.speedMps * dragCoeff * 0.55;
    if (accelInput === 0 && brakeInput === 0 && Math.abs(this.speedMps) > 0.05) {
      accelMps2 -= Math.sign(this.speedMps) * (offRoad ? 3.5 : 0.75);
    }

    const prevSpeed = this.speedMps;
    this.speedMps = THREE.MathUtils.clamp(this.speedMps + accelMps2 * delta, maxReverseMps, maxForwardMps);
    if (accelInput === 0 && Math.abs(this.speedMps) < 0.14 && Math.abs(prevSpeed) >= 0.14) {
      this.speedMps = 0;
      if (this.wasMovingAndBraked) {
        this.wasMovingAndBraked = false;
        this.audio.playAirBrakeHiss();
      }
    }

    // Fuel consumption
    if (hasFuel && Math.abs(this.speedMps) > 0.5) {
      const burn = (0.04 + accelInput * 0.18) * delta * 1.3;
      this.fuel = Math.max(0, this.fuel - burn);
      if (this.fuel < 18 && Math.floor(this.fuel) !== Math.floor(this.fuel + burn)) {
        this.showAlert('পেট্রোল/ডিজেল কম! সামনের পেট্রোল পাম্পে থামুন (Low Fuel)', 'warning', 2.8);
      }
    } else if (!hasFuel && accelInput > 0) {
      this.showAlert('Tank Empty! Refuel at Petrol Pump...', 'danger', 2.0);
    }

    // 3. Kinematics (Yaw & Position)
    const wheelbase = 6.6;
    if (Math.abs(this.speedMps) > 0.05) {
      const turnRate = (this.speedMps / wheelbase) * Math.tan(steerAngleRad);
      this.busYaw += turnRate * delta;
    }

    const vx = -Math.sin(this.busYaw) * this.speedMps;
    const vz = -Math.cos(this.busYaw) * this.speedMps;
    this.busPos.x += vx * delta;
    this.busPos.z += vz * delta;

    // Keep bus within highway + shoulder embankment (or bridge parapet walls!)
    const newRoadCx = getRoadX(this.busPos.z);
    const onBridge = isInsideBridgeApproach(this.busPos.z, this.routeId, 0);
    const maxCorridor = onBridge ? 4.85 : 11.2;
    if (this.busPos.x < newRoadCx - maxCorridor) {
      this.busPos.x = newRoadCx - maxCorridor;
      this.speedMps *= 0.85;
    } else if (this.busPos.x > newRoadCx + maxCorridor) {
      this.busPos.x = newRoadCx + maxCorridor;
      this.speedMps *= 0.85;
    }

    this.busPos.y = getRoadY(this.busPos.z, this.routeId);

    // Clamp Z bounds at start/end of highway
    if (this.busPos.z > 20) {
      this.busPos.z = 20;
      this.speedMps = Math.min(0, this.speedMps);
    }

    this.distanceDrivenM = Math.max(this.distanceDrivenM, Math.abs(this.busPos.z + 35));
    this.wheelSpinRad -= (this.speedMps * delta) / 0.52;

    // 4. Suspension Pitch, Roll & Speed Breakers
    const targetPitch = THREE.MathUtils.clamp(-accelMps2 * 0.0038, -0.04, 0.04);
    const targetRoll = THREE.MathUtils.clamp(-this.currentSteer * (this.speedMps / 24) * 0.045, -0.055, 0.055);
    this.pitchRad = THREE.MathUtils.damp(this.pitchRad, targetPitch, 7.0, delta);
    this.rollRad = THREE.MathUtils.damp(this.rollRad, targetRoll, 7.0, delta);

    if (this.world) {
      for (const sb of this.world.speedBreakers) {
        if (Math.abs(this.busPos.z - sb.z) < 1.3 && this.speedBreakerCooldown <= 0) {
          this.speedBreakerCooldown = 1.2;
          const kmh = Math.abs(this.speedMps) * 3.6;
          this.bounceVel += Math.min(2.6, 0.8 + kmh * 0.032);
          this.audio.playThump(Math.min(1, 0.35 + kmh / 80));
          if (kmh > 44) {
            this.taka = Math.max(0, this.taka - 100);
            this.stats.totalPenalties += 100;
            this.busHealth = Math.max(10, this.busHealth - 3);
            this.showAlert('Speed Breaker Impact! Slow down (<40 km/h) · -৳100', 'warning', 2.6);
            if (this.passengers > 0 && Math.random() < 0.35) {
              this.triggerPassengerVoice('comment');
            }
          }
        }
      }
      this.world.updateDynamicProps(delta, this.busPos.z);
    }

    // Spring-damper vertical suspension bounce
    const springK = 55;
    const springDamp = 9;
    this.bounceVel += (-springK * this.bounceY - springDamp * this.bounceVel) * delta;
    this.bounceY += this.bounceVel * delta;
    if (offRoad && Math.abs(this.speedMps) > 2) {
      this.bounceY += Math.sin(this.elapsedSec * 28) * 0.012;
    }

    // 5. Indicators, Wipers & Lighting
    this.blinkTimer += delta;
    if (this.blinkTimer >= 0.44) {
      this.blinkTimer = 0;
      this.blinkOn = !this.blinkOn;
      if (this.leftIndicator || this.rightIndicator || this.hazardOn) {
        this.audio.playIndicatorTick(this.blinkOn);
      }
    }

    if (this.wipersOn) {
      this.wiperPhase += delta * 5.2;
      const cycle = Math.floor(this.wiperPhase / Math.PI);
      if (cycle !== this.lastWiperCycle) {
        this.lastWiperCycle = cycle;
        this.audio.playWiperSwish();
        // Each wiper pass sweeps water off the windshield
        this.windshieldWetness = Math.max(0, this.windshieldWetness - 0.34);
      }
      const targetWetWithWipers = this.rainFactor * 0.16 + this.fogFactor * 0.04;
      this.windshieldWetness = THREE.MathUtils.damp(this.windshieldWetness, targetWetWithWipers, 3.8, delta);
    } else {
      this.wiperPhase = 0;
      this.lastWiperCycle = -1;
      if (this.rainFactor > 0.2) {
        this.windshieldWetness = Math.min(1, this.windshieldWetness + delta * (0.14 + this.rainFactor * 0.12));
        if (this.windshieldWetness > 0.68 && this.wiperHintCooldown <= 0) {
          this.wiperHintCooldown = 20;
          this.showAlert('বৃষ্টিতে কাঁচ ঝাপসা! ওয়াইপার চালু করুন (Press K)', 'warning', 2.8);
        }
      } else if (this.fogFactor > 0.25) {
        this.windshieldWetness = THREE.MathUtils.damp(this.windshieldWetness, 0.26 * this.fogFactor, 0.6, delta);
      } else {
        this.windshieldWetness = Math.max(0, this.windshieldWetness - delta * 0.22);
      }
    }

    // Update 3D rain streaks, drifting fog banks, wet road surface & rain audio
    const nightWeight = this.timePhase === 'night' ? 1 : this.timePhase === 'sunset' ? 0.35 : 0;
    this.weatherEffects.update(
      delta,
      this.busPos,
      this.speedMps,
      this.rainFactor,
      this.fogFactor,
      nightWeight
    );
    this.world?.setWeatherSurface(this.rainFactor);
    this.audio.updateRainAmbience(this.rainFactor, this.cameraMode === 'cockpit');

    const speedKmh = Math.abs(this.speedMps) * 3.6;
    if (this.doorOpen && speedKmh > 18) {
      this.doorOpen = false;
      this.audio.playDoorAir(false);
    }
    this.doorOpenProgress = THREE.MathUtils.damp(this.doorOpenProgress, this.doorOpen ? 1 : 0, 7.0, delta);

    const rpm = this.computeRpm(speedKmh, accelInput);
    this.audio.updateEngine(rpm, accelInput, speedKmh);

    this.bus.root.position.copy(this.busPos);
    this.bus.root.rotation.order = 'YXZ';
    this.bus.root.rotation.y = this.busYaw;
    this.bus.root.rotation.x = getRoadSlopeAngle(this.busPos.z, this.routeId);
    this.bus.updateLights({
      headlights: this.headlightsOn,
      braking: brakeInput > 0.05 || (this.speedMps < 0.2 && this.reverseGear),
      reversing: this.reverseGear,
      leftBlink: this.blinkOn && (this.leftIndicator || this.hazardOn),
      rightBlink: this.blinkOn && (this.rightIndicator || this.hazardOn),
    });
    this.bus.updateDynamics({
      wheelSpinRad: this.wheelSpinRad,
      steerAngleRad,
      speedKmh,
      rpm,
      wiperPhase: this.wiperPhase,
      pitchRad: this.pitchRad,
      rollRad: this.rollRad,
      bounceY: this.bounceY,
      doorOpenProgress: this.doorOpenProgress,
      time: this.elapsedSec,
    });

    // Move sun/moon shadow frustum smoothly with the bus along current time-of-day arc
    this.positionDirectionalLightAndStreetLamps();

    // 6. Traffic Updates, Localized Congestion Nodes, Rear Blind-Spot Check & Collisions
    if (this.traffic) {
      this.traffic.update(delta, this.busPos.z, this.busPos.x, this.input.horn, route.totalLengthM);

      const cong = this.traffic.getCongestionStatus(this.busPos.z);
      this.congestionActive = cong.active;
      this.congestionDistM = cong.distM;
      if (cong.justSpawned) {
        this.showAlert('সামনে রাস্তায় যানজট! গতি কমিয়ে সাবধানে এগিয়ে যান (Traffic Jam Ahead)', 'warning', 3.4);
      }
      if (cong.active && this.passengers > 0 && this.congestionVoiceCooldown <= 0) {
        this.congestionVoiceCooldown = 35;
        this.triggerPassengerVoice('comment');
      }

      let leftAlert = false;
      let rightAlert = false;
      for (const v of this.traffic.vehicles) {
        if (!v.active) continue;
        // Longitudinal offset relative to bus (+Z is behind bus)
        const dzBehind = v.z - this.busPos.z;
        if (dzBehind > -4.5 && dzBehind < 34) {
          const dxRel = v.mesh.position.x - this.busPos.x;
          if (dxRel <= -1.2 && dxRel > -5.5) leftAlert = true;
          else if (dxRel >= 1.2 && dxRel < 5.8) rightAlert = true;
        }

        if (this.collisionCooldown <= 0) {
          const dx = Math.abs(v.mesh.position.x - this.busPos.x);
          const dz = Math.abs(v.mesh.position.z - this.busPos.z);
          if (dx < 1.24 + v.halfWidth && dz < 5.3 + v.halfLength) {
            this.collisionCooldown = 1.6;
            this.speedMps *= -0.25;
            this.bounceVel += 2.2;
            this.audio.playThump(1.0);
            this.busHealth = Math.max(5, this.busHealth - 9);
            this.taka = Math.max(0, this.taka - 300);
            this.stats.totalPenalties += 300;
            const nameMap: Record<string, string> = {
              cng: 'CNG Auto-Rickshaw',
              easybike: 'Easy Bike',
              truck: 'Highway Truck',
              localbus: 'Local Bus',
            };
            this.showAlert(`Traffic Collision with ${nameMap[v.kind]}! Fine -৳300`, 'danger', 3.0);
            break;
          }
        }
      }
      this.rearBlindSpot.left = leftAlert;
      this.rearBlindSpot.right = rightAlert;
    } else {
      this.congestionActive = false;
      this.congestionDistM = null;
    }

    // 7. Speed Limit Check
    const speedLimit = this.getCurrentSpeedLimit(route.stops);
    if (speedKmh > speedLimit + 5) {
      this.speedingDuration += delta;
      if (this.speedingDuration > 2.2 && this.speedFineCooldown <= 0) {
        this.speedFineCooldown = 6.5;
        this.taka = Math.max(0, this.taka - 150);
        this.stats.totalPenalties += 150;
        this.showAlert(`Highway Speeding (${Math.round(speedKmh)}/${speedLimit} km/h)! Fine -৳150`, 'danger', 2.8);
      }
    } else {
      this.speedingDuration = Math.max(0, this.speedingDuration - delta * 2);
    }

    // 8. Bus Stands, Fuel Station, Toll Plaza & Final Terminal
    this.handleStopsAndEconomy(delta, speedKmh, route.stops);
  }

  private getCurrentSpeedLimit(stops: typeof ROUTES.coxsbazar.stops): number {
    let limit = 80;
    for (const s of stops) {
      if (Math.abs(this.busPos.z - s.z) < 75) {
        limit = s.type === 'toll' ? 35 : 45;
        break;
      }
    }
    return this.congestionActive ? Math.min(limit, 35) : limit;
  }

  private handleStopsAndEconomy(delta: number, speedKmh: number, stops: typeof ROUTES.coxsbazar.stops): void {
    this.atStopAction = 'none';
    this.activeStopId = null;

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i];
      const dz = Math.abs(this.busPos.z - stop.z);

      if (stop.type === 'toll' && dz < 10 && !this.completedStops.has(stop.id)) {
        this.completedStops.add(stop.id);
        const fee = stop.tollFee ?? 250;
        this.taka = Math.max(0, this.taka - fee);
        this.stats.tollsPaid += fee;
        if (this.world) {
          const barrier = this.world.tollBarriers.find((b) => b.stop.id === stop.id);
          if (barrier) barrier.paid = true;
        }
        this.audio.playBoardingChime();
        this.showAlert(`${stop.name} Toll Paid · -৳${fee}`, 'info', 2.6);
        return;
      }

      if ((stop.type === 'stand' || stop.type === 'terminal') && dz < 13 && !this.completedStops.has(stop.id)) {
        const isLast = i === stops.length - 1;
        this.activeStopId = stop.id;
        this.atStopAction = 'boarding';

        if (speedKmh < 8.5) {
          if (!this.doorOpen) {
            this.doorOpen = true;
            this.audio.playDoorAir(true);
          }

          if (isLast) {
            if (!this.stopDisembarkSpoken.has(stop.id) && this.passengers > 0) {
              this.stopDisembarkSpoken.add(stop.id);
              this.triggerPassengerVoice('disembarking');
            }
          } else {
            if (!this.stopBoardingSpoken.has(stop.id)) {
              this.stopBoardingSpoken.add(stop.id);
              this.triggerPassengerVoice('boarding');
            }
            if (this.stopActionProgress >= 0.52 && this.passengers > 0 && !this.stopDisembarkSpoken.has(stop.id)) {
              this.stopDisembarkSpoken.add(stop.id);
              this.triggerPassengerVoice('disembarking');
            }
          }

          this.stopActionProgress += delta / 2.6;
          if (this.stopActionProgress >= 1) {
            this.completedStops.add(stop.id);
            this.stopActionProgress = 0;
            this.doorOpen = false;
            this.audio.playDoorAir(false);
            this.audio.playBoardingChime();

            if (isLast) {
              const dropFare = this.passengers * stop.farePerPassenger;
              this.taka += dropFare;
              this.stats.totalFareEarned += dropFare;
              this.passengers = 0;
              this.tripComplete = true;
              this.showAlert(`Arrived at ${stop.name}! Final Fare +৳${dropFare}`, 'success', 5.0);
              this.emitHud(true);
            } else {
              const alighting = Math.min(this.passengers, 4 + Math.floor(Math.random() * 5));
              const boarding = Math.min(this.maxPassengers - (this.passengers - alighting), 6 + Math.floor(Math.random() * 7));
              this.passengers = this.passengers - alighting + boarding;
              this.stats.passengersServed += boarding;
              const earned = (alighting + boarding) * stop.farePerPassenger;
              this.taka += earned;
              this.stats.totalFareEarned += earned;
              this.showAlert(
                `${stop.name}: +${boarding} boarded · Fare +৳${earned}`,
                'success',
                3.2
              );
            }
          }
        } else {
          this.stopActionProgress = Math.max(0, this.stopActionProgress - delta * 0.5);
        }
        return;
      }

      if (stop.type === 'fuel' && dz < 18 && !this.completedStops.has(stop.id)) {
        this.activeStopId = stop.id;
        this.atStopAction = 'refueling';

        if (speedKmh < 12) {
          if (this.fuel < 99.5) {
            const added = Math.min(100 - this.fuel, delta * 32);
            this.fuel += added;
            const cost = Math.round(added * 9.5);
            this.taka = Math.max(0, this.taka - cost);
            this.stats.fuelSpent += cost;
            this.stopActionProgress = this.fuel / 100;
          } else {
            this.fuel = 100;
            this.completedStops.add(stop.id);
            this.stopActionProgress = 0;
            this.audio.playBoardingChime();
            this.showAlert(`${stop.banglaName}: ট্যাংক ফুল হয়েছে (100%)`, 'success', 2.6);
            if (this.passengers > 0) {
              this.triggerPassengerVoice('comment');
            }
          }
        }
        return;
      }
    }

    this.stopActionProgress = 0;
  }

  private computeRpm(speedKmh: number, throttle: number): number {
    if (speedKmh < 2) return 750 + throttle * 1650;
    const gearBand = (speedKmh % 18) / 18;
    return 1150 + gearBand * 3400 + throttle * 750;
  }

  private computeGearLabel(speedKmh: number): string {
    if (this.reverseGear) return 'R';
    if (speedKmh < 1.2) return 'N';
    if (speedKmh < 16) return 'D1';
    if (speedKmh < 32) return 'D2';
    if (speedKmh < 50) return 'D3';
    if (speedKmh < 68) return 'D4';
    if (speedKmh < 85) return 'D5';
    return 'D6';
  }

  private updateCamera(delta: number): void {
    const speedKmh = Math.abs(this.speedMps) * 3.6;

    if (this.cameraMode === 'cockpit') {
      this.bus.cockpitAnchor.getWorldPosition(_cockpitWorldPos);
      this.bus.bodyTiltGroup.getWorldQuaternion(_cockpitQuat);

      _forwardDir.set(0, -0.05, -1).applyQuaternion(_cockpitQuat);
      _camTargetLook.copy(_cockpitWorldPos).addScaledVector(_forwardDir, 22);

      this.camera.position.copy(_cockpitWorldPos);
      this.camera.lookAt(_camTargetLook);
      if (this.camera.fov !== 70) {
        this.camera.fov = 70;
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    this.bus.root.getWorldPosition(_busWorldPos);
    const sinY = Math.sin(this.busYaw);
    const cosY = Math.cos(this.busYaw);

    if (this.cameraMode === 'chase') {
      const dist = 13.8;
      const height = 4.9;
      _camTargetPos.set(
        _busWorldPos.x + sinY * dist,
        _busWorldPos.y + height,
        _busWorldPos.z + cosY * dist
      );
      _camTargetLook.set(
        _busWorldPos.x - sinY * 10,
        _busWorldPos.y + 2.1,
        _busWorldPos.z - cosY * 10
      );
      const targetFov = 58 + Math.min(10, speedKmh * 0.1);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 4, delta);
      this.camera.updateProjectionMatrix();
    } else {
      // Cinematic sweeping highway side-angle
      const orbitAngle = this.busYaw + 0.58 + Math.sin(this.elapsedSec * 0.25) * 0.22;
      _camTargetPos.set(
        _busWorldPos.x + Math.sin(orbitAngle) * 16.5,
        _busWorldPos.y + 5.6 + Math.sin(this.elapsedSec * 0.4) * 0.8,
        _busWorldPos.z + Math.cos(orbitAngle) * 16.5
      );
      _camTargetLook.set(
        _busWorldPos.x - sinY * 3.5,
        _busWorldPos.y + 1.9,
        _busWorldPos.z - cosY * 3.5
      );
    }

    if (!this.camInitialized) {
      this.camera.position.copy(_camTargetPos);
      this.camera.lookAt(_camTargetLook);
      this.camInitialized = true;
    } else {
      const k = 1 - Math.exp(-6.5 * delta);
      this.camera.position.lerp(_camTargetPos, k);
      this.camera.lookAt(_camTargetLook);
    }
    this.camera.up.copy(_upVec);
  }

  private updateRearCamera(): void {
    this.bus.rearMirrorAnchor.getWorldPosition(_rearWorldPos);
    this.bus.bodyTiltGroup.getWorldQuaternion(_rearQuat);

    _rearDir.set(0, -0.075, 1).applyQuaternion(_rearQuat);
    _rearLookTarget.copy(_rearWorldPos).addScaledVector(_rearDir, 24);
    _rearUp.copy(_upVec).applyQuaternion(_rearQuat);

    this.rearCamera.position.copy(_rearWorldPos);
    this.rearCamera.up.copy(_rearUp);
    this.rearCamera.lookAt(_rearLookTarget);
  }

  private renderMirrorOverlay(rect: { left: number; top: number; width: number; height: number }): void {
    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    if (canvasRect.width <= 0 || canvasRect.height <= 0) return;

    const vx = Math.round(rect.left - canvasRect.left);
    const vy = Math.round(canvasRect.bottom - (rect.top + rect.height));
    const vw = Math.round(rect.width);
    const vh = Math.round(rect.height);

    if (vw <= 4 || vh <= 4) return;

    const prevAutoClear = this.renderer.autoClear;
    this.renderer.autoClear = false;
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(vx, vy, vw, vh);
    this.renderer.setScissor(vx, vy, vw, vh);
    this.renderer.clearDepth();
    this.renderer.render(this.mirrorScene, this.mirrorOrthoCam);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, canvasRect.width, canvasRect.height);
    this.renderer.autoClear = prevAutoClear;
  }

  private emitHud(force: boolean): void {
    if (!force && this.disposed) return;
    const route = ROUTES[this.routeId];
    const speedKmh = Math.round(Math.abs(this.speedMps) * 3.6);
    const speedLimitKmh = this.getCurrentSpeedLimit(route.stops);

    let nextStop = route.stops.find((s) => !this.completedStops.has(s.id) && s.z <= this.busPos.z + 18);
    if (!nextStop) {
      nextStop = route.stops[route.stops.length - 1];
    }

    const distToNext = Math.max(0, Math.round(this.busPos.z - nextStop.z));
    const progress = THREE.MathUtils.clamp(Math.abs(this.busPos.z + 35) / route.totalLengthM, 0, 1);

    this.onHudUpdate({
      speedKmh,
      rpm: Math.round(this.computeRpm(speedKmh, this.input.throttle)),
      gear: this.computeGearLabel(speedKmh),
      fuel: Math.round(this.fuel),
      taka: Math.round(this.taka),
      passengers: this.passengers,
      maxPassengers: this.maxPassengers,
      busHealth: Math.round(this.busHealth),
      distanceDrivenM: Math.round(this.distanceDrivenM),
      routeProgress: progress,
      busZ: this.busPos.z,
      nextStopName: nextStop.name,
      nextStopBangla: nextStop.banglaName,
      nextStopDistM: distToNext,
      nextStopType: nextStop.type,
      atStopAction: this.activeStopId ? this.atStopAction : 'none',
      boardingProgress: this.stopActionProgress,
      speedLimitKmh,
      isSpeeding: speedKmh > speedLimitKmh + 4,
      headlightsOn: this.headlightsOn,
      wipersOn: this.wipersOn,
      leftIndicator: this.leftIndicator,
      rightIndicator: this.rightIndicator,
      hazardOn: this.hazardOn,
      reverseGear: this.reverseGear,
      doorOpen: this.doorOpen,
      hornActive: this.input.horn,
      timeMinutes: Math.floor(this.timeMinutes) % 1440,
      timePhase: this.timePhase,
      streetLampsOn: this.streetLampsOn,
      weather: this.weather,
      weatherAuto: this.weatherAuto,
      windshieldWetness: Number(this.windshieldWetness.toFixed(2)),
      cameraMode: this.cameraMode,
      rearviewMirrorOn: this.rearviewMirrorOn,
      rearBlindSpot: { ...this.rearBlindSpot },
      trafficDensity: this.trafficDensity,
      congestionActive: this.congestionActive,
      congestionDistM: this.congestionDistM,
      liveryId: this.liveryId,
      routeId: this.routeId,
      steerAngle: this.currentSteer,
      alertText: this.alertText,
      alertTone: this.alertTone,
      passengerQuote: this.passengerQuote,
      tripComplete: this.tripComplete,
      stats: { ...this.stats },
    });
  }

  private getWeatherForMinutes(minutes: number): WeatherCondition {
    const m = ((minutes % 1440) + 1440) % 1440;
    // 04:30 - 07:00: Dawn river mist/fog
    if (m >= 4 * 60 + 30 && m < 7 * 60) return 'fog';
    // 07:00 - 16:00: Clear day
    if (m >= 7 * 60 && m < 16 * 60) return 'clear';
    // 16:00 - 19:30: Late afternoon / monsoon sunset rain
    if (m >= 16 * 60 && m < 19 * 60 + 30) return 'rain';
    // 19:30 - 21:00: Clear evening
    if (m >= 19 * 60 + 30 && m < 21 * 60) return 'clear';
    // 21:00 - 23:30: Night highway fog
    if (m >= 21 * 60 && m < 23 * 60 + 30) return 'fog';
    // 23:30 - 04:30: Clear midnight highway
    return 'clear';
  }

  private getPhaseFromMinutes(m: number): TimePhase {
    if (m >= 18 * 60 + 45 || m < 5 * 60 + 15) return 'night';
    if ((m >= 16 * 60 + 40 && m < 18 * 60 + 45) || (m >= 5 * 60 + 15 && m < 6 * 60 + 45)) {
      return 'sunset';
    }
    return 'day';
  }

  private updateTimeOfDayLighting(announceTransitions: boolean): void {
    const route = ROUTES[this.routeId];
    const m = ((this.timeMinutes % 1440) + 1440) % 1440;

    const prevPhase = this.timePhase;
    const nextPhase = this.getPhaseFromMinutes(m);
    this.timePhase = nextPhase;

    // Smooth atmospheric blend weights
    const dayCore = smoothstep(340, 425, m) * (1 - smoothstep(995, 1070, m));
    const sunsetPeak =
      smoothstep(985, 1055, m) * (1 - smoothstep(1065, 1135, m)) +
      smoothstep(295, 345, m) * (1 - smoothstep(350, 425, m));
    const nightCore = (1 - smoothstep(295, 360, m)) + smoothstep(1070, 1140, m);

    const totalW = Math.max(0.001, dayCore + sunsetPeak + nightCore);
    const dayW = dayCore / totalW;
    const sunsetW = sunsetPeak / totalW;
    const nightW = nightCore / totalW;

    // Street lamps & traffic headlights activate smoothly from dusk (~17:15) until dawn (~06:35)
    this.lampFactor = THREE.MathUtils.clamp(
      smoothstep(1035, 1095, m) + (1 - smoothstep(340, 395, m)),
      0,
      1
    );
    const lampsActive = this.lampFactor > 0.25;
    this.streetLampsOn = lampsActive;

    // Auto-switch player headlights at dusk/night transitions and notify driver
    if (announceTransitions && nextPhase !== prevPhase) {
      if (nextPhase === 'sunset') {
        if (!this.headlightsOn) this.headlightsOn = true;
        this.showAlert('গোধূলি সন্ধ্যা · স্ট্রিট ল্যাম্প ও হেডলাইট চালু (Sunset)', 'info', 3.0);
      } else if (nextPhase === 'night') {
        if (!this.headlightsOn) this.headlightsOn = true;
        this.showAlert('রাত হয়েছে · হাইওয়ে বাতি ও হেডলাইট সক্রিয় (Night)', 'info', 3.0);
      } else {
        this.showAlert('সকাল হয়েছে · দিনের আলো (Daylight)', 'info', 2.8);
      }
    }

    // 1. Sky Background & Exponential Fog (blended with dynamic rain & foggy mist conditions)
    _daySkyColor.setHex(route.skyHorizonHex);
    blendThreeColors(_curSkyColor, _daySkyColor, dayW, _sunsetSkyColor, sunsetW, _nightSkyColor, nightW);

    if (this.rainFactor > 0.01) {
      _weatherSkyTarget.copy(_rainSkyTintDay).lerp(_rainSkyTintNight, nightW);
      _curSkyColor.lerp(_weatherSkyTarget, this.rainFactor * 0.72);
    }
    if (this.fogFactor > 0.01) {
      _weatherSkyTarget.copy(_fogSkyTintDay).lerp(_fogSkyTintNight, nightW);
      _curSkyColor.lerp(_weatherSkyTarget, this.fogFactor * 0.84);
    }

    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(_curSkyColor);
    } else {
      this.scene.background = _curSkyColor.clone();
    }
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(_curSkyColor);
      const baseFog = route.fogDensity * (1 + sunsetW * 0.16 + nightW * 0.48);
      this.scene.fog.density = baseFog + this.rainFactor * 0.0044 + this.fogFactor * 0.0155;
    }

    // 2. Hemisphere Sky / Paddy Fill
    blendThreeColors(_curHemiSky, _dayHemiSky, dayW, _sunsetHemiSky, sunsetW, _nightHemiSky, nightW);
    blendThreeColors(_curHemiGround, _dayHemiGround, dayW, _sunsetHemiGround, sunsetW, _nightHemiGround, nightW);
    this.hemiLight.color.copy(_curHemiSky);
    this.hemiLight.groundColor.copy(_curHemiGround);
    const weatherDim = 1 - this.rainFactor * 0.34 - this.fogFactor * 0.24;
    this.hemiLight.intensity = (dayW * 0.85 + sunsetW * 0.78 + nightW * 0.44) * weatherDim;

    // 3. Directional Sun / Moon Color & Intensity (softened under rain/fog overcast)
    blendThreeColors(_curSunColor, _daySunColor, dayW, _sunsetSunColor, sunsetW, _nightMoonColor, nightW);
    this.sunLight.color.copy(_curSunColor);
    const sunWeatherDim = 1 - this.rainFactor * 0.48 - this.fogFactor * 0.42;
    this.sunLight.intensity = (dayW * 2.25 + sunsetW * 1.9 + nightW * 0.48) * sunWeatherDim;

    // 4. Tone Mapping & Studio Reflection Balance
    this.renderer.toneMappingExposure =
      (dayW * 1.08 + sunsetW * 1.04 + nightW * 0.94) * (1 - this.rainFactor * 0.08);
    this.scene.environmentIntensity =
      (dayW * 1.0 + sunsetW * 0.65 + nightW * 0.28) * (1 - this.fogFactor * 0.25);

    // 5. Player bus SpotLight boost at night or fog/rain for crisp visibility
    const baseSpot = this.isSoftwareGl ? 18 : 26;
    const visibilityBoostFactor = Math.max(this.lampFactor, this.rainFactor * 0.65 + this.fogFactor * 0.75);
    const nightBoost = baseSpot * (1 + visibilityBoostFactor * 0.95);
    this.bus.headlightLeft.intensity = nightBoost;
    this.bus.headlightRight.intensity = nightBoost;

    // 6. Activate highway street lamps & AI traffic headlights/tail lights
    const streetActivation = Math.max(this.lampFactor, this.rainFactor * 0.65 + this.fogFactor * 0.8);
    this.world?.setLampActivation(streetActivation);
    this.traffic?.setNightLighting(streetActivation);

    this.positionDirectionalLightAndStreetLamps();
  }

  private positionDirectionalLightAndStreetLamps(): void {
    const m = ((this.timeMinutes % 1440) + 1440) % 1440;
    const isNight = m >= 1110 || m < 325;

    if (isNight) {
      // High silvery moonlight arc
      this.sunLight.position.set(this.busPos.x - 36, this.busPos.y + 64, this.busPos.z + 24);
    } else {
      // Sun traverses East (+X at dawn) -> Zenith -> West (-X at sunset)
      const sunProg = THREE.MathUtils.clamp((m - 325) / (1110 - 325), 0, 1);
      const sunX = Math.cos(sunProg * Math.PI) * 76;
      const sunY = Math.max(14, Math.sin(sunProg * Math.PI) * 74);
      this.sunLight.position.set(this.busPos.x + sunX, this.busPos.y + sunY, this.busPos.z + 28);
    }
    this.sunLight.target.position.set(this.busPos.x, this.busPos.y, this.busPos.z - 14);
    this.sunLight.target.updateMatrixWorld();

    // Assign the 2 pooled warm street-lamp PointLights to the 2 closest lamps near the bus
    const streetLampLevel = Math.max(this.lampFactor, this.rainFactor * 0.65 + this.fogFactor * 0.8);
    if (streetLampLevel > 0.04 && this.world && this.world.streetLampPositions.length > 0) {
      const lamps = this.world.streetLampPositions;
      let idx1 = -1;
      let idx2 = -1;
      let d1 = Infinity;
      let d2 = Infinity;

      for (let i = 0; i < lamps.length; i++) {
        const dz = lamps[i].z - this.busPos.z;
        const distSq = dz * dz;
        if (distSq < d1) {
          d2 = d1;
          idx2 = idx1;
          d1 = distSq;
          idx1 = i;
        } else if (distSq < d2) {
          d2 = distSq;
          idx2 = i;
        }
      }

      const targetIntensity = streetLampLevel * 26;
      const pair = [idx1, idx2];
      for (let k = 0; k < this.lampPointLights.length; k++) {
        const li = pair[k];
        const pLight = this.lampPointLights[k];
        if (li >= 0) {
          const spec = lamps[li];
          pLight.position.set(spec.x, spec.y, spec.z);
          pLight.intensity = targetIntensity;
        } else {
          pLight.intensity = 0;
        }
      }
    } else {
      for (const pLight of this.lampPointLights) {
        pLight.intensity = 0;
      }
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleOrientationResize);
    window.visualViewport?.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.audio.dispose();
    this.weatherEffects.dispose();
    this.rearRenderTarget.dispose();
    this.mirrorQuad.geometry.dispose();
    (this.mirrorQuad.material as THREE.Material).dispose();
    this.world?.dispose();
    this.traffic?.dispose();
    for (const pLight of this.lampPointLights) {
      this.scene.remove(pLight);
      pLight.dispose();
    }
    this.envTexture.dispose();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
