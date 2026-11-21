import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  Car,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CloudFog,
  CloudRain,
  DoorOpen,
  Lightbulb,
  Map as MapIcon,
  Menu,
  MessageSquare,
  Moon,
  RotateCcw,
  Sun,
  Sunset,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import { CoachMenuModal } from './components/CoachMenuModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallButton } from './components/PWAInstallButton';
import { MirrorViewportRect, RearviewMirrorOverlay } from './components/RearviewMirrorOverlay';
import { RouteMapModal } from './components/RouteMapModal';
import { TouchSteeringWheel } from './components/TouchSteeringWheel';
import { WeatherOverlay } from './components/WeatherOverlay';
import { BusSimulatorEngine } from './game/engine';
import { CameraMode, GameHudState, LIVERIES, LiveryId, ROUTES, RouteId, TrafficDensity } from './game/types';

const INITIAL_HUD: GameHudState = {
  speedKmh: 0,
  rpm: 750,
  gear: 'N',
  fuel: 78,
  taka: 1500,
  passengers: 18,
  maxPassengers: 42,
  busHealth: 100,
  distanceDrivenM: 0,
  routeProgress: 0,
  busZ: -42,
  nextStopName: 'Gabtoli Terminal, Dhaka',
  nextStopBangla: 'গাবতলী টার্মিনাল, ঢাকা',
  nextStopDistM: 55,
  nextStopType: 'terminal',
  atStopAction: 'none',
  boardingProgress: 0,
  speedLimitKmh: 80,
  isSpeeding: false,
  headlightsOn: true,
  wipersOn: false,
  leftIndicator: false,
  rightIndicator: false,
  hazardOn: false,
  reverseGear: false,
  doorOpen: false,
  hornActive: false,
  timeMinutes: 15 * 60 + 20,
  timePhase: 'day',
  streetLampsOn: false,
  weather: 'clear',
  weatherAuto: true,
  windshieldWetness: 0,
  cameraMode: 'chase',
  rearviewMirrorOn: true,
  rearBlindSpot: { left: false, right: false },
  trafficDensity: 'normal',
  congestionActive: false,
  congestionDistM: null,
  liveryId: 'hanif',
  routeId: 'panchagarh',
  steerAngle: 0,
  alertText: null,
  alertTone: 'info',
  passengerQuote: null,
  tripComplete: false,
  stats: {
    totalFareEarned: 0,
    totalPenalties: 0,
    passengersServed: 18,
    tollsPaid: 0,
    fuelSpent: 0,
  },
};

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BusSimulatorEngine | null>(null);

  const [hud, setHud] = useState<GameHudState>(INITIAL_HUD);
  const [menuOpen, setMenuOpen] = useState(true);
  const [mapOpen, setMapOpen] = useState(false);
  const [isInitialLaunch, setIsInitialLaunch] = useState(true);
  const [hudCollapsed, setHudCollapsed] = useState(false);
  const [muted, setMuted] = useState(false);
  const [steerMode, setSteerMode] = useState<'wheel' | 'arrows'>('wheel');
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  useEffect(() => {
    const onQuotaExceeded = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuotaExceeded);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuotaExceeded);
  }, []);

  // Track keyboard state cleanly without re-mounting WebGL
  const keysRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    horn: false,
  });

  // Track touch pedal & arrow-steer state separately so keyboard and touch never clobber each other
  const touchRef = useRef({
    throttle: 0,
    brake: 0,
    steer: 0,
    arrowLeft: false,
    arrowRight: false,
    horn: false,
  });

  const syncCombinedInputs = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const k = keysRef.current;
    const t = touchRef.current;
    const throttle = Math.max(k.up ? 1 : 0, t.throttle);
    const brake = Math.max(k.down ? 1 : 0, t.brake);
    const keySteer = (k.right ? 1 : 0) - (k.left ? 1 : 0);
    const arrowSteer = (t.arrowRight ? 1 : 0) - (t.arrowLeft ? 1 : 0);
    const steer = keySteer !== 0 ? keySteer : arrowSteer !== 0 ? arrowSteer : t.steer;
    const horn = k.horn || t.horn;
    eng.setInput({ throttle, brake, steer, horn });
  }, []);

  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new BusSimulatorEngine(mountEl, (nextState) => {
      setHud(nextState);
    });
    engine.setPaused(true);
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Keep engine paused when menu or map modal is open
  useEffect(() => {
    engineRef.current?.setPaused(menuOpen || mapOpen);
  }, [menuOpen, mapOpen]);

  // Global Keyboard Controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const eng = engineRef.current;
      if (!eng) return;

      eng.unlockAudio();

      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.up = true;
          syncCombinedInputs();
          break;
        case 'KeyS':
        case 'ArrowDown':
        case 'Space':
          e.preventDefault();
          keysRef.current.down = true;
          syncCombinedInputs();
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = true;
          syncCombinedInputs();
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = true;
          syncCombinedInputs();
          break;
        case 'KeyH':
          keysRef.current.horn = true;
          syncCombinedInputs();
          break;
        case 'KeyR':
          eng.toggleReverse();
          break;
        case 'KeyC':
          eng.cycleCamera();
          break;
        case 'KeyN':
          eng.toggleRearviewMirror();
          break;
        case 'KeyL':
          eng.toggleHeadlights();
          break;
        case 'KeyK':
          eng.toggleWipers();
          break;
        case 'KeyQ':
          eng.toggleLeftIndicator();
          break;
        case 'KeyE':
          eng.toggleRightIndicator();
          break;
        case 'KeyZ':
          eng.toggleHazard();
          break;
        case 'KeyO':
          eng.toggleDoor();
          break;
        case 'KeyT':
          eng.cycleTimeOfDay();
          break;
        case 'KeyV':
          eng.cycleWeather();
          break;
        case 'KeyG':
          eng.cycleTrafficDensity();
          break;
        case 'KeyM':
          setMapOpen((prev) => !prev);
          break;
        case 'KeyU':
          setHudCollapsed((prev) => !prev);
          break;
        case 'Escape':
          if (mapOpen) {
            setMapOpen(false);
          } else {
            setMenuOpen((prev) => {
              if (isInitialLaunch) return true;
              return !prev;
            });
          }
          break;
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW':
        case 'ArrowUp':
          keysRef.current.up = false;
          syncCombinedInputs();
          break;
        case 'KeyS':
        case 'ArrowDown':
        case 'Space':
          keysRef.current.down = false;
          syncCombinedInputs();
          break;
        case 'KeyA':
        case 'ArrowLeft':
          keysRef.current.left = false;
          syncCombinedInputs();
          break;
        case 'KeyD':
        case 'ArrowRight':
          keysRef.current.right = false;
          syncCombinedInputs();
          break;
        case 'KeyH':
          keysRef.current.horn = false;
          syncCombinedInputs();
          break;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [isInitialLaunch, mapOpen, syncCombinedInputs]);

  const handleCloseMenu = () => {
    engineRef.current?.unlockAudio();
    setIsInitialLaunch(false);
    setMenuOpen(false);
  };

  const handleSelectLivery = (id: LiveryId) => {
    engineRef.current?.unlockAudio();
    engineRef.current?.setLivery(id);
  };

  const handleSelectRoute = (id: RouteId) => {
    engineRef.current?.unlockAudio();
    engineRef.current?.loadRoute(id);
  };

  const handleSelectTrafficDensity = (density: TrafficDensity) => {
    engineRef.current?.unlockAudio();
    engineRef.current?.setTrafficDensity(density);
  };

  const handleToggleMute = () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.unlockAudio();
    const next = !muted;
    eng.setMuted(next);
    setMuted(next);
  };

  const handleCameraSwitch = (mode: CameraMode) => {
    engineRef.current?.unlockAudio();
    engineRef.current?.setCameraMode(mode);
  };

  const handleMirrorViewportChange = useCallback((rect: MirrorViewportRect | null) => {
    engineRef.current?.setMirrorViewportRect(rect);
  }, []);

  const currentRoute = ROUTES[hud.routeId];
  const currentLivery = LIVERIES[hud.liveryId];

  const alertStyles: Record<GameHudState['alertTone'], string> = {
    info: 'bg-slate-950/90 border-sky-400/60 text-sky-100',
    success: 'bg-emerald-950/92 border-emerald-400/70 text-emerald-100',
    warning: 'bg-amber-950/92 border-amber-400/70 text-amber-100',
    danger: 'bg-red-950/92 border-red-400/80 text-red-100',
  };

  return (
    <div className="relative w-full h-dvh overflow-hidden bg-slate-950">
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center fixed top-0 inset-x-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Dedicated WebGL Container (isolated from React HUD re-renders) */}
      <div ref={canvasMountRef} className="absolute inset-0 w-full h-full touch-none" />

      {/* Dynamic Weather Visual Overlay (rain streaks, fog veil, windshield droplets) */}
      <WeatherOverlay
        weather={hud.weather}
        timePhase={hud.timePhase}
        cameraMode={hud.cameraMode}
        wipersOn={hud.wipersOn}
        windshieldWetness={hud.windshieldWetness}
      />

      {/* Top Minimal Telemetry Strip */}
      <header className="pointer-events-none fixed top-0 inset-x-0 z-20 p-2 sm:p-4 pt-[max(0.5rem,env(safe-area-inset-top))] flex flex-col items-center gap-1.5 sm:gap-2">
        <div className="pointer-events-auto w-full max-w-6xl rounded-xl bg-slate-950/88 border border-white/12 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Coach & Route Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-display font-bold text-white truncate">
              <span className="truncate">{currentLivery.name}</span>
              <span className="text-slate-500 hidden sm:inline" aria-hidden="true">·</span>
              <span className="text-amber-300 font-bangla truncate hidden sm:inline">{currentRoute.banglaName}</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] text-slate-300 truncate mt-0.5">
              <span className="truncate">{hud.nextStopName}</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="font-mono-num text-emerald-300 shrink-0">{hud.nextStopDistM}m</span>
              <span className="text-slate-500 hidden sm:inline" aria-hidden="true">·</span>
              <span className="hidden sm:inline font-mono-num text-slate-400">
                {Math.round(hud.routeProgress * 100)}%
              </span>
            </div>
          </div>

          {/* Center/Right: Economy & Bus Telemetry */}
          <div className="flex items-center gap-2 sm:gap-4 text-xs sm:text-sm shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 font-mono-num">
              <div>
                <span className="text-slate-400 text-[10px] mr-0.5 hidden sm:inline">Bal</span>
                <span className="font-bold text-amber-300">৳{hud.taka.toLocaleString()}</span>
              </div>
              <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
              <div className="hidden sm:block">
                <span className="text-slate-400 text-[10px] mr-0.5 hidden sm:inline">Pax</span>
                <span className="font-semibold text-white">{hud.passengers}/{hud.maxPassengers}</span>
              </div>
              <span className="text-slate-600" aria-hidden="true">·</span>
              <div>
                <span className="text-slate-400 text-[10px] mr-0.5 hidden sm:inline">Fuel</span>
                <span className={`font-semibold ${hud.fuel < 20 ? 'text-red-400' : 'text-emerald-300'}`}>
                  {hud.fuel}%
                </span>
              </div>
              <span className="text-slate-600 hidden md:inline" aria-hidden="true">·</span>
              <div className="hidden md:block">
                <span className="text-slate-400 text-[10px] mr-1">Limit</span>
                <span className={`font-semibold ${hud.isSpeeding ? 'text-red-400' : 'text-slate-200'}`}>
                  {hud.speedLimitKmh} km/h
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1 sm:gap-1.5">
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.cycleTimeOfDay();
                }}
                title="Cycle Day / Sunset / Night (T)"
                className="h-10 px-2 sm:px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-100 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {hud.timePhase === 'day' ? (
                  <Sun className="w-4 h-4 text-amber-300" />
                ) : hud.timePhase === 'sunset' ? (
                  <Sunset className="w-4 h-4 text-orange-400" />
                ) : (
                  <Moon className="w-4 h-4 text-sky-300" />
                )}
                <span className="font-mono-num text-xs font-semibold">
                  {String(Math.floor(hud.timeMinutes / 60)).padStart(2, '0')}:
                  {String(hud.timeMinutes % 60).padStart(2, '0')}
                </span>
                <span className="hidden lg:inline text-[11px] text-slate-300 capitalize">
                  {hud.timePhase}
                </span>
              </button>
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.cycleWeather();
                }}
                title={
                  hud.weatherAuto
                    ? 'Weather synced with time (Click/V to override)'
                    : 'Manual weather (Click/V to cycle or return to Auto)'
                }
                className={`h-10 px-2 sm:px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  hud.weather === 'rain'
                    ? 'bg-sky-950/90 hover:bg-sky-900 border-sky-400/50 text-sky-200'
                    : hud.weather === 'fog'
                      ? 'bg-slate-800 hover:bg-slate-700 border-slate-400/50 text-slate-100'
                      : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-slate-100'
                }`}
              >
                {hud.weather === 'rain' ? (
                  <CloudRain className="w-4 h-4 text-sky-300" />
                ) : hud.weather === 'fog' ? (
                  <CloudFog className="w-4 h-4 text-slate-300" />
                ) : (
                  <Sun className="w-4 h-4 text-amber-300" />
                )}
                <span className="hidden sm:inline text-xs font-semibold capitalize">
                  {hud.weather}
                </span>
                <span className="hidden lg:inline text-[10px] text-slate-400">
                  {hud.weatherAuto ? 'Auto' : 'Manual'}
                </span>
              </button>
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.cycleTrafficDensity();
                }}
                title="Cycle Traffic Density: Low / Normal / Heavy (G)"
                className={`h-10 px-2 sm:px-2.5 rounded-lg border flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  hud.trafficDensity === 'heavy'
                    ? 'bg-red-950/90 hover:bg-red-900 border-red-400/50 text-red-200'
                    : hud.trafficDensity === 'low'
                      ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-400/40 text-emerald-200'
                      : 'bg-slate-900 hover:bg-slate-800 border-white/10 text-amber-200'
                }`}
              >
                <Car className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline text-xs font-semibold capitalize">
                  {hud.trafficDensity === 'normal' ? 'Norm' : hud.trafficDensity}
                </span>
              </button>
              <button
                onClick={() => setMapOpen(true)}
                title="Route Map (M)"
                className="min-w-[40px] h-10 px-2 sm:px-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-emerald-300 flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <MapIcon className="w-4 h-4" />
                <span className="hidden sm:inline text-xs font-semibold">Map</span>
              </button>
              <button
                onClick={() => engineRef.current?.cycleCamera()}
                title="Switch Camera (C)"
                className="min-w-[40px] h-10 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 flex items-center justify-center gap-1 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span className="text-[10px] font-semibold uppercase sm:hidden">{hud.cameraMode.slice(0, 3)}</span>
              </button>
              <button
                onClick={handleToggleMute}
                title={muted ? 'Unmute Audio' : 'Mute Audio'}
                className="min-w-[40px] h-10 px-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              >
                {muted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <PWAInstallButton compact />
              <button
                onClick={() => setMenuOpen(true)}
                title="Coach & Route Menu"
                className="h-10 px-2.5 sm:px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/10 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <Menu className="w-4 h-4" />
                <span className="hidden sm:inline">Menu</span>
              </button>
            </div>
          </div>
        </div>
        <OfflineIndicator />

        {/* Highway Progress Hairline */}
        <div className="w-full max-w-6xl h-1 bg-slate-900/80 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-transform duration-150 origin-left"
            style={{ transform: `scaleX(${Math.max(0.01, hud.routeProgress)})` }}
          />
        </div>

        {/* Cockpit Rearview Mirror Feed Overlay */}
        <RearviewMirrorOverlay
          visible={hud.cameraMode === 'cockpit' && !menuOpen && !mapOpen && !hud.tripComplete}
          mirrorEnabled={hud.rearviewMirrorOn}
          reverseGear={hud.reverseGear}
          blindSpotLeft={hud.rearBlindSpot.left}
          blindSpotRight={hud.rearBlindSpot.right}
          onToggleMirror={() => engineRef.current?.toggleRearviewMirror()}
          onViewportChange={handleMirrorViewportChange}
        />

        {/* Transient Event Alert Banner */}
        {hud.alertText && (
          <div
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg border text-xs sm:text-sm font-medium shadow-lg text-center max-w-[92vw] ${alertStyles[hud.alertTone]}`}
          >
            {hud.alertText}
          </div>
        )}

        {/* Passenger Voice Quote Caption */}
        {hud.passengerQuote && (
          <div className="px-3.5 py-2 rounded-lg bg-slate-950/92 border border-amber-400/40 shadow-lg max-w-[90vw] sm:max-w-md flex items-start gap-2.5 text-left">
            <MessageSquare className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                <span>{hud.passengerQuote.speaker}</span>
                <span className="text-slate-500" aria-hidden="true">·</span>
                <span className="text-slate-300">{hud.passengerQuote.category}</span>
              </div>
              <div className="font-bangla text-xs sm:text-sm text-white leading-snug">
                {hud.passengerQuote.textBn}
              </div>
              <div className="text-[11px] text-slate-400 leading-tight mt-0.5">
                {hud.passengerQuote.textEn}
              </div>
            </div>
          </div>
        )}

        {/* Localized Congestion Node Status Banner */}
        {!hud.tripComplete && (hud.congestionActive || hud.congestionDistM !== null) && (
          <div
            className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-lg border shadow-lg flex items-center gap-2 text-xs sm:text-sm font-medium max-w-[92vw] ${
              hud.congestionActive
                ? 'bg-red-950/92 border-red-400/75 text-red-100'
                : 'bg-amber-950/92 border-amber-400/70 text-amber-100'
            }`}
          >
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-300" />
            {hud.congestionActive ? (
              <span className="font-bangla">
                রাস্তায় যানজট · <span className="font-sans font-semibold">Congestion Zone · Slow Crawl (Limit 35 km/h)</span>
              </span>
            ) : (
              <span className="font-bangla">
                সামনে যানজট · <span className="font-sans font-semibold">Congestion Ahead ({hud.congestionDistM}m)</span>
              </span>
            )}
          </div>
        )}

        {/* Active Boarding / Refueling Bay Prompt */}
        {hud.atStopAction !== 'none' && (
          <div className="px-4 py-2 rounded-lg bg-slate-950/92 border border-emerald-400/60 text-xs sm:text-sm text-white shadow-xl flex flex-col items-center gap-1.5 min-w-[220px] max-w-[90vw]">
            <div className="font-semibold text-emerald-300 text-center">
              {hud.atStopAction === 'boarding'
                ? hud.speedKmh < 9
                  ? `Boarding at ${hud.nextStopName}...`
                  : `Stop at ${hud.nextStopName} (<8 km/h)`
                : hud.speedKmh < 12
                  ? `Petrol Pump: Refueling (${hud.fuel}%)...`
                  : `Petrol Pump Bay: Slow down (<12 km/h) to Refuel`}
            </div>
            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 transition-all duration-100"
                style={{ width: `${Math.round(hud.boardingProgress * 100)}%` }}
              />
            </div>
          </div>
        )}
      </header>

      {/* Collapsible Bottom Controls & Driving Dock */}
      <div
        className={`fixed bottom-0 inset-x-0 z-20 pointer-events-none transition-transform duration-200 ${
          hudCollapsed ? 'translate-y-[calc(100%-34px)]' : 'translate-y-0'
        }`}
      >
        {/* Collapse / Expand Toggle Handle */}
        <div className="flex justify-center mb-1">
          <button
            onClick={() => setHudCollapsed((prev) => !prev)}
            className="pointer-events-auto px-3 py-1 rounded-t-lg bg-slate-950/88 border border-b-0 border-white/12 text-[11px] font-medium text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
          >
            {hudCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        {/* Main Bottom Control Deck */}
        <div className="px-2.5 sm:px-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex items-end justify-between gap-2 sm:gap-4 max-w-7xl mx-auto">
          {/* Bottom-Left: Steering + Compact Mobile-Safe Utility Row */}
          <div className="pointer-events-auto flex flex-col items-start gap-2">
            {/* Utility Switches stacked cleanly ABOVE steering on mobile, or beside on desktop */}
            <div className="flex flex-wrap items-center gap-1 sm:gap-1.5">
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.toggleLeftIndicator();
                }}
                title="Left Indicator (Q)"
                className={`min-w-[36px] sm:min-w-[42px] h-9 sm:h-10 px-2 rounded-lg border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  hud.leftIndicator || hud.hazardOn
                    ? 'bg-amber-500 border-amber-300 text-slate-950'
                    : 'bg-slate-950/88 border-white/12 text-slate-300 hover:text-white'
                }`}
              >
                ◀
              </button>
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.toggleHazard();
                }}
                title="Hazard Lights (Z)"
                className={`min-w-[36px] sm:min-w-[42px] h-9 sm:h-10 px-2 rounded-lg border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  hud.hazardOn
                    ? 'bg-red-600 border-red-400 text-white'
                    : 'bg-slate-950/88 border-white/12 text-slate-300 hover:text-white'
                }`}
              >
                ⚠
              </button>
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.toggleRightIndicator();
                }}
                title="Right Indicator (E)"
                className={`min-w-[36px] sm:min-w-[42px] h-9 sm:h-10 px-2 rounded-lg border text-[11px] sm:text-xs font-bold transition-colors cursor-pointer ${
                  hud.rightIndicator || hud.hazardOn
                    ? 'bg-amber-500 border-amber-300 text-slate-950'
                    : 'bg-slate-950/88 border-white/12 text-slate-300 hover:text-white'
                }`}
              >
                ▶
              </button>
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.toggleHeadlights();
                }}
                title="Headlights (L)"
                className={`h-9 sm:h-10 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  hud.headlightsOn
                    ? 'bg-sky-500/90 border-sky-300 text-slate-950'
                    : 'bg-slate-950/88 border-white/12 text-slate-300 hover:text-white'
                }`}
              >
                <Lightbulb className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.toggleWipers();
                }}
                title="Wipers (K)"
                className={`h-9 sm:h-10 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  hud.wipersOn
                    ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                    : hud.weather === 'rain' && hud.windshieldWetness > 0.45
                      ? 'bg-amber-950/90 border-amber-400 text-amber-200'
                      : 'bg-slate-950/88 border-white/12 text-slate-300 hover:text-white'
                }`}
              >
                <Wind className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">Wiper</span>
              </button>
              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.toggleDoor();
                }}
                title="Bus Door (O)"
                className={`h-9 sm:h-10 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  hud.doorOpen
                    ? 'bg-amber-400 border-amber-200 text-slate-950'
                    : 'bg-slate-950/88 border-white/12 text-slate-300 hover:text-white'
                }`}
              >
                <DoorOpen className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-[11px]">দরজা</span>
              </button>
              <button
                onClick={() => setSteerMode((m) => (m === 'wheel' ? 'arrows' : 'wheel'))}
                title="Switch Steering Style"
                className="h-9 sm:h-10 px-2 rounded-lg border bg-slate-950/88 border-white/12 text-[10px] font-semibold text-slate-300 hover:text-white cursor-pointer whitespace-nowrap"
              >
                {steerMode === 'wheel' ? 'Arrows' : 'Wheel'}
              </button>
            </div>

            {/* Primary Steering Input: Wheel OR Touch Arrow Pads */}
            {steerMode === 'wheel' ? (
              <TouchSteeringWheel
                steerAngle={hud.steerAngle}
                onSteerChange={(val) => {
                  touchRef.current.steer = val;
                  syncCombinedInputs();
                }}
                onInteract={() => engineRef.current?.unlockAudio()}
              />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onContextMenu={(e) => e.preventDefault()}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    engineRef.current?.unlockAudio();
                    touchRef.current.arrowLeft = true;
                    syncCombinedInputs();
                  }}
                  onPointerUp={(e) => {
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch {
                      // noop
                    }
                    touchRef.current.arrowLeft = false;
                    syncCombinedInputs();
                  }}
                  onPointerCancel={() => {
                    touchRef.current.arrowLeft = false;
                    syncCombinedInputs();
                  }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-950/88 active:bg-amber-400 active:text-slate-950 border-2 border-white/20 text-white flex items-center justify-center shadow-lg touch-none cursor-pointer"
                  aria-label="Steer Left"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onContextMenu={(e) => e.preventDefault()}
                  onPointerDown={(e) => {
                    e.preventDefault();
                    e.currentTarget.setPointerCapture(e.pointerId);
                    engineRef.current?.unlockAudio();
                    touchRef.current.arrowRight = true;
                    syncCombinedInputs();
                  }}
                  onPointerUp={(e) => {
                    try {
                      e.currentTarget.releasePointerCapture(e.pointerId);
                    } catch {
                      // noop
                    }
                    touchRef.current.arrowRight = false;
                    syncCombinedInputs();
                  }}
                  onPointerCancel={() => {
                    touchRef.current.arrowRight = false;
                    syncCombinedInputs();
                  }}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-slate-950/88 active:bg-amber-400 active:text-slate-950 border-2 border-white/20 text-white flex items-center justify-center shadow-lg touch-none cursor-pointer"
                  aria-label="Steer Right"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>
              </div>
            )}
          </div>

          {/* Bottom-Center: Digital Speedometer, Gear, RPM & Camera Views (Desktop & Tablet) */}
          <div className="pointer-events-auto hidden md:flex flex-col items-center gap-2 rounded-xl bg-slate-950/88 border border-white/12 px-5 py-3 shadow-2xl">
            <div className="flex items-baseline gap-4">
              <div className="text-center">
                <div
                  className={`font-mono-num text-3xl font-bold leading-none ${
                    hud.isSpeeding ? 'text-red-400' : 'text-white'
                  }`}
                >
                  {hud.speedKmh}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">KM/H</div>
              </div>

              <div className="h-8 w-px bg-white/10" />

              <div className="text-center min-w-[42px]">
                <div
                  className={`font-mono-num text-2xl font-bold leading-none ${
                    hud.gear === 'R' ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {hud.gear}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">GEAR</div>
              </div>
            </div>

            {/* RPM Bar */}
            <div className="w-44 h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 ${
                  hud.rpm > 4500 ? 'bg-red-500' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.min(100, Math.round((hud.rpm / 6000) * 100))}%` }}
              />
            </div>

            {/* Camera Segmented Buttons */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-900 border border-white/10">
              {(['chase', 'cockpit', 'cinematic'] as CameraMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleCameraSwitch(mode)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold capitalize transition-colors cursor-pointer ${
                    hud.cameraMode === mode
                      ? 'bg-amber-400 text-slate-950'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {/* Bottom-Right: Compact Speed Badge (Mobile) + Horn, Reverse, Brake & Gas Pedals */}
          <div className="pointer-events-auto flex flex-col items-end gap-2">
            {/* Mobile Compact Speed + Horn + Gear Strip stacked neatly above pedals */}
            <div className="flex items-center gap-1.5">
              <div className="md:hidden flex items-center gap-1.5 px-2.5 h-10 rounded-lg bg-slate-950/90 border border-white/12">
                <span className={`font-mono-num text-base font-bold leading-none ${hud.isSpeeding ? 'text-red-400' : 'text-white'}`}>
                  {hud.speedKmh}
                </span>
                <span className="text-[9px] text-slate-400 font-mono-num">{hud.gear}</span>
              </div>

              <button
                onClick={() => {
                  engineRef.current?.unlockAudio();
                  engineRef.current?.toggleReverse();
                }}
                className={`h-10 px-2.5 sm:px-3 rounded-lg border font-mono-num font-bold text-[11px] sm:text-xs transition-colors cursor-pointer whitespace-nowrap ${
                  hud.reverseGear
                    ? 'bg-amber-500 border-amber-300 text-slate-950'
                    : 'bg-slate-950/88 border-white/15 text-slate-200 hover:bg-slate-900'
                }`}
              >
                {hud.reverseGear ? 'REV' : 'D'}
              </button>

              <button
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  engineRef.current?.unlockAudio();
                  touchRef.current.horn = true;
                  syncCombinedInputs();
                }}
                onPointerUp={(e) => {
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    // noop
                  }
                  touchRef.current.horn = false;
                  syncCombinedInputs();
                }}
                onPointerCancel={() => {
                  touchRef.current.horn = false;
                  syncCombinedInputs();
                }}
                className={`h-10 px-3 sm:px-4 rounded-lg border font-display font-bold text-[11px] sm:text-xs tracking-wide transition-colors cursor-pointer touch-none whitespace-nowrap ${
                  hud.hornActive
                    ? 'bg-amber-400 border-amber-200 text-slate-950'
                    : 'bg-slate-950/88 border-amber-400/50 text-amber-300 hover:bg-slate-900'
                }`}
              >
                HORN
              </button>
            </div>

            {/* Pedals Row */}
            <div className="flex items-end gap-2">
              <button
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  engineRef.current?.unlockAudio();
                  touchRef.current.brake = 1;
                  syncCombinedInputs();
                }}
                onPointerUp={(e) => {
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    // noop
                  }
                  touchRef.current.brake = 0;
                  syncCombinedInputs();
                }}
                onPointerCancel={() => {
                  touchRef.current.brake = 0;
                  syncCombinedInputs();
                }}
                className="w-14 sm:w-16 h-20 sm:h-24 rounded-xl bg-red-950/90 active:bg-red-600 border-2 border-red-400/60 text-red-100 font-display font-bold text-xs flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer touch-none"
              >
                <span>BRAKE</span>
                <span className="text-[10px] text-red-300/80 font-mono-num hidden sm:inline">S</span>
              </button>

              <button
                onContextMenu={(e) => e.preventDefault()}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  engineRef.current?.unlockAudio();
                  touchRef.current.throttle = 1;
                  syncCombinedInputs();
                }}
                onPointerUp={(e) => {
                  try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                  } catch {
                    // noop
                  }
                  touchRef.current.throttle = 0;
                  syncCombinedInputs();
                }}
                onPointerCancel={() => {
                  touchRef.current.throttle = 0;
                  syncCombinedInputs();
                }}
                className="w-14 sm:w-16 h-24 sm:h-28 rounded-xl bg-emerald-950/90 active:bg-emerald-600 border-2 border-emerald-400/60 text-emerald-100 font-display font-bold text-xs flex flex-col items-center justify-center gap-0.5 shadow-lg cursor-pointer touch-none"
              >
                <span>GAS</span>
                <span className="text-[10px] text-emerald-300/80 font-mono-num hidden sm:inline">W</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Coach & Route Selection Modal */}
      <CoachMenuModal
        isOpen={menuOpen}
        isInitialLaunch={isInitialLaunch}
        currentLivery={hud.liveryId}
        currentRoute={hud.routeId}
        currentTrafficDensity={hud.trafficDensity}
        onSelectLivery={handleSelectLivery}
        onSelectRoute={handleSelectRoute}
        onSelectTrafficDensity={handleSelectTrafficDensity}
        onResetTrip={() => engineRef.current?.resetTripState()}
        onClose={handleCloseMenu}
      />

      {/* Interactive Highway Route Map Modal */}
      <RouteMapModal
        isOpen={mapOpen}
        routeId={hud.routeId}
        liveryId={hud.liveryId}
        busZ={hud.busZ}
        onSelectRoute={handleSelectRoute}
        onClose={() => setMapOpen(false)}
      />

      {/* Trip Complete Summary Modal */}
      {hud.tripComplete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-slate-950/82">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-emerald-500/50 shadow-2xl p-6 space-y-5">
            <div>
              <div className="text-xs font-semibold text-emerald-400">
                Route Completed · {currentRoute.highwayCode}
              </div>
              <h2 className="font-display text-2xl font-bold text-white mt-1">
                Welcome to {hud.nextStopName}
              </h2>
              <p className="font-bangla text-sm text-amber-300 mt-0.5">
                {currentLivery.banglaName} · শুভ যাত্রা সম্পন্ন
              </p>
            </div>

            <div className="space-y-2.5 py-3 border-y border-slate-800 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Ticket Fares Earned</span>
                <span className="font-mono-num font-bold text-emerald-400">+৳{hud.stats.totalFareEarned.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Passengers Served</span>
                <span className="font-mono-num font-semibold text-white">{hud.stats.passengersServed}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Highway Tolls &amp; Fuel</span>
                <span className="font-mono-num text-slate-300">-৳{(hud.stats.tollsPaid + hud.stats.fuelSpent).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Traffic / Speed Penalties</span>
                <span className="font-mono-num text-red-400">-৳{hud.stats.totalPenalties.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-slate-800 text-base font-bold">
                <span className="text-white">Final Taka Balance</span>
                <span className="font-mono-num text-amber-300">৳{hud.taka.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => engineRef.current?.resetTripState()}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-display font-bold text-sm transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Drive Again</span>
              </button>
              <button
                onClick={() => setMenuOpen(true)}
                className="py-2.5 px-4 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold transition-colors cursor-pointer"
              >
                Switch Route
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
