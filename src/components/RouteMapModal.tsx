import React, { useEffect, useMemo, useState } from 'react';
import { Fuel, Globe, MapPin, Navigation, ShieldAlert, X } from 'lucide-react';
import { LiveryId, ROUTES, RouteId } from '../game/types';
import { getRiverBridgeZones, getRoadX } from '../game/world';
import { BangladeshGoogleMap } from './BangladeshGoogleMap';

interface RouteMapModalProps {
  isOpen: boolean;
  routeId: RouteId;
  liveryId?: LiveryId;
  busZ: number;
  onSelectRoute: (id: RouteId) => void;
  onClose: () => void;
}

// Schematic nationwide SVG coordinates for offline/fallback Bangladesh diagram
const SCHEMATIC_DHAKA = { x: 162, y: 205 };
const SCHEMATIC_CORRIDORS: Record<
  RouteId,
  {
    points: [number, number][];
    destLabelBn: string;
    destLabelEn: string;
    labelDx: number;
    labelDy: number;
  }
> = {
  panchagarh: {
    points: [
      [162, 205],
      [138, 174],
      [120, 134],
      [104, 88],
      [78, 42],
    ],
    destLabelBn: 'পঞ্চগড়',
    destLabelEn: 'Panchagarh',
    labelDx: 10,
    labelDy: 3,
  },
  rajshahi: {
    points: [
      [162, 205],
      [135, 182],
      [105, 174],
      [66, 166],
    ],
    destLabelBn: 'রাজশাহী',
    destLabelEn: 'Rajshahi',
    labelDx: -6,
    labelDy: -10,
  },
  mymensingh: {
    points: [
      [162, 205],
      [168, 165],
      [172, 126],
    ],
    destLabelBn: 'ময়মনসিংহ',
    destLabelEn: 'Mymensingh',
    labelDx: 9,
    labelDy: 2,
  },
  sylhet: {
    points: [
      [162, 205],
      [204, 182],
      [240, 154],
      [268, 118],
    ],
    destLabelBn: 'সিলেট',
    destLabelEn: 'Sylhet',
    labelDx: -10,
    labelDy: -10,
  },
  coxsbazar: {
    points: [
      [162, 205],
      [198, 224],
      [226, 256],
      [246, 304],
      [266, 366],
    ],
    destLabelBn: 'কক্সবাজার',
    destLabelEn: "Cox's Bazar",
    labelDx: -48,
    labelDy: 14,
  },
  barishal: {
    points: [
      [162, 205],
      [158, 246],
      [156, 294],
      [152, 344],
    ],
    destLabelBn: 'বরিশাল–কুয়াকাটা',
    destLabelEn: 'Kuakata',
    labelDx: 8,
    labelDy: 12,
  },
  khulna: {
    points: [
      [162, 205],
      [148, 238],
      [114, 260],
      [96, 298],
    ],
    destLabelBn: 'খুলনা',
    destLabelEn: 'Khulna',
    labelDx: -38,
    labelDy: 12,
  },
};

function samplePolyline(points: [number, number][], frac: number): { x: number; y: number } {
  if (points.length === 0) return SCHEMATIC_DHAKA;
  if (points.length === 1) return { x: points[0][0], y: points[0][1] };
  const clamped = Math.max(0, Math.min(1, frac));
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    const d = Math.hypot(dx, dy);
    segLens.push(d);
    total += d;
  }
  const target = clamped * total;
  let acc = 0;
  for (let i = 0; i < segLens.length; i++) {
    const seg = segLens[i];
    if (acc + seg >= target || i === segLens.length - 1) {
      const t = seg > 0 ? Math.max(0, Math.min(1, (target - acc) / seg)) : 0;
      return {
        x: points[i][0] + (points[i + 1][0] - points[i][0]) * t,
        y: points[i][1] + (points[i + 1][1] - points[i][1]) * t,
      };
    }
    acc += seg;
  }
  const last = points[points.length - 1];
  return { x: last[0], y: last[1] };
}

export const RouteMapModal: React.FC<RouteMapModalProps> = ({
  isOpen,
  routeId,
  liveryId = 'hanif',
  busZ,
  onSelectRoute,
  onClose,
}) => {
  const route = ROUTES[routeId];
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'country' | 'route'>('country');

  useEffect(() => {
    setSelectedStopId(null);
  }, [routeId]);

  const { svgPath, busPoint, stopPoints, riverBands, progressFrac } = useMemo(() => {
    const total = route.totalLengthM;
    const w = 320;
    const h = 440;
    const padY = 24;
    const usableH = h - padY * 2;
    const frac = Math.max(0, Math.min(1, Math.abs(busZ) / Math.max(1, total)));

    const toSvg = (z: number) => {
      const progress = Math.max(0, Math.min(1, Math.abs(z) / total));
      const y = h - padY - progress * usableH;
      const roadX = getRoadX(z);
      const x = w * 0.42 + roadX * 2.1;
      return { x, y };
    };

    const samples = 64;
    let d = '';
    for (let i = 0; i <= samples; i++) {
      const z = -(i / samples) * total;
      const pt = toSvg(z);
      d += `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)} `;
    }

    const stops = route.stops.map((stop) => ({
      stop,
      ...toSvg(stop.z),
    }));

    const riverBands = getRiverBridgeZones(routeId).map((b) => {
      const p1 = toSvg(b.zRiverStart);
      const p2 = toSvg(b.zRiverEnd);
      const yTop = Math.min(p1.y, p2.y);
      const bandH = Math.max(10, Math.abs(p2.y - p1.y));
      return {
        id: b.id,
        label: b.bridgeNameBn,
        yTop,
        bandH,
        midX: (p1.x + p2.x) * 0.5,
      };
    });

    return {
      svgPath: d,
      busPoint: toSvg(busZ),
      stopPoints: stops,
      riverBands,
      progressFrac: frac,
    };
  }, [route, routeId, busZ]);

  if (!isOpen) return null;

  const countryBusPos = samplePolyline(SCHEMATIC_CORRIDORS[routeId].points, progressFrac);

  const fallbackSvg =
    viewMode === 'country' ? (
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-2.5 flex justify-center">
        <svg viewBox="0 0 320 400" className="w-full max-w-[340px] h-auto">
          <rect x="0" y="0" width="320" height="400" fill="#07111b" rx="10" />
          {/* Bay of Bengal */}
          <path d="M 40 340 Q 160 320 295 365 L 320 400 L 0 400 Z" fill="#0b283f" />
          <text x="195" y="384" fill="#38bdf8" fontSize="9" opacity="0.7" fontWeight="600">
            Bay of Bengal
          </text>

          {/* Schematic Bangladesh Landmass Silhouette */}
          <path
            d="M 70 30 L 106 34 L 122 68 L 160 92 L 210 100 L 280 105 L 288 142 L 252 178 L 246 226 L 266 286 L 278 378 L 252 372 L 236 306 L 194 316 L 154 352 L 104 334 L 78 308 L 76 238 L 48 182 L 60 132 L 74 92 Z"
            fill="#0f2922"
            stroke="#10b981"
            strokeOpacity="0.35"
            strokeWidth="2"
          />

          {/* Major Rivers: Jamuna, Padma, Meghna */}
          <path d="M 122 68 Q 134 150 136 205" fill="none" stroke="#0284c7" strokeWidth="4" opacity="0.45" />
          <path d="M 55 170 Q 112 204 166 236" fill="none" stroke="#0284c7" strokeWidth="4" opacity="0.45" />
          <path d="M 218 145 Q 194 218 190 304" fill="none" stroke="#0284c7" strokeWidth="3.5" opacity="0.45" />

          {/* All 7 Bangladesh Highway Corridors */}
          {(Object.keys(SCHEMATIC_CORRIDORS) as RouteId[]).map((id) => {
            const spec = SCHEMATIC_CORRIDORS[id];
            const cfg = ROUTES[id];
            const isActive = id === routeId;
            const dAttr = spec.points
              .map(([x, y], idx) => `${idx === 0 ? 'M' : 'L'} ${x} ${y}`)
              .join(' ');
            const dest = spec.points[spec.points.length - 1];
            return (
              <g
                key={id}
                className="cursor-pointer"
                onClick={() => onSelectRoute(id)}
              >
                <path
                  d={dAttr}
                  fill="none"
                  stroke={isActive ? '#ffffff' : cfg.mapColorHex}
                  strokeWidth={isActive ? 6 : 3}
                  strokeOpacity={isActive ? 0.25 : 0.65}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d={dAttr}
                  fill="none"
                  stroke={isActive ? '#10b981' : cfg.mapColorHex}
                  strokeWidth={isActive ? 3.5 : 2}
                  strokeDasharray={isActive ? undefined : '4 3'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx={dest[0]}
                  cy={dest[1]}
                  r={isActive ? 6 : 4.5}
                  fill={cfg.mapColorHex}
                  stroke="#0f172a"
                  strokeWidth="1.8"
                />
                <text
                  x={dest[0] + spec.labelDx}
                  y={dest[1] + spec.labelDy}
                  fill={isActive ? '#fef08a' : '#cbd5e1'}
                  fontSize={isActive ? '10' : '9'}
                  fontFamily="Hind Siliguri, sans-serif"
                  fontWeight={isActive ? '700' : '600'}
                >
                  {spec.destLabelBn}
                </text>
              </g>
            );
          })}

          {/* Dhaka Central Hub */}
          <circle cx={SCHEMATIC_DHAKA.x} cy={SCHEMATIC_DHAKA.y} r="7" fill="#facc15" stroke="#0f172a" strokeWidth="2" />
          <text
            x={SCHEMATIC_DHAKA.x + 10}
            y={SCHEMATIC_DHAKA.y - 6}
            fill="#fef08a"
            fontSize="10"
            fontFamily="Hind Siliguri, sans-serif"
            fontWeight="700"
          >
            ঢাকা (Dhaka)
          </text>

          {/* Animated Live Bus Position */}
          <g transform={`translate(${countryBusPos.x}, ${countryBusPos.y})`}>
            <circle r="11" fill="#f97316" opacity="0.32" />
            <circle r="5.5" fill="#f97316" stroke="#ffffff" strokeWidth="1.8" />
          </g>
        </svg>
      </div>
    ) : (
      <div className="rounded-xl bg-slate-950 border border-slate-800 p-2 flex justify-center">
        <svg viewBox="0 0 320 440" className="w-full max-w-[260px] h-auto">
          <rect x="0" y="0" width="320" height="440" fill="#08111c" rx="10" />
          {riverBands.map((rb) => (
            <g key={rb.id}>
              <rect x="0" y={rb.yTop} width="320" height={rb.bandH} fill="#0e4a5c" opacity="0.65" />
              <text
                x="16"
                y={rb.yTop + rb.bandH * 0.5 + 3}
                fill="#7dd3fc"
                fontSize="9"
                fontFamily="Hind Siliguri, sans-serif"
                fontWeight="600"
              >
                {rb.label}
              </text>
            </g>
          ))}
          <path d={svgPath} fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
          <path d={svgPath} fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="6 6" />
          {stopPoints.map(({ stop, x, y }) => {
            const isFuel = stop.type === 'fuel';
            const isToll = stop.type === 'toll';
            const dotColor = isFuel ? '#facc15' : isToll ? '#38bdf8' : '#10b981';
            return (
              <g key={stop.id}>
                <circle cx={x} cy={y} r={isFuel ? 6 : 7} fill={dotColor} stroke="#0f172a" strokeWidth="2" />
                <text
                  x={x + 12}
                  y={y + 4}
                  fill={isFuel ? '#fde047' : '#e2e8f0'}
                  fontSize="10"
                  fontFamily="Hind Siliguri, sans-serif"
                  fontWeight="600"
                >
                  {isFuel ? '⛽ ' : ''}
                  {stop.banglaName}
                </text>
              </g>
            );
          })}
          <g transform={`translate(${busPoint.x}, ${busPoint.y})`}>
            <circle r="11" fill="#f97316" opacity="0.28" />
            <rect x="-6" y="-10" width="12" height="20" rx="3" fill="#f97316" stroke="#ffffff" strokeWidth="2" />
          </g>
        </svg>
      </div>
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/82">
      <div className="w-full max-w-5xl rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-5 py-3 border-b border-slate-800">
          <div>
            <h2 className="font-display text-base sm:text-lg font-bold text-white">
              Bangladesh Highway Map · {route.highwayCode}
            </h2>
            <p className="font-bangla text-xs text-amber-300 mt-0.5">
              {route.banglaName}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {/* Entire Bangladesh vs Active Route Mode Toggle */}
            <div className="inline-flex rounded-lg bg-slate-950 p-0.5 border border-slate-700/80">
              <button
                type="button"
                onClick={() => setViewMode('country')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'country'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Entire Bangladesh</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('route')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  viewMode === 'route'
                    ? 'bg-amber-400 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Active Route</span>
              </button>
            </div>

            <button
              onClick={onClose}
              aria-label="Close map"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* All 7 Bangladesh Division Route Switch Tabs */}
        <div className="px-4 sm:px-5 pt-3 flex flex-wrap gap-1.5">
          {(Object.keys(ROUTES) as RouteId[]).map((id) => {
            const rCfg = ROUTES[id];
            const active = id === routeId;
            return (
              <button
                key={id}
                onClick={() => onSelectRoute(id)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 border border-black/30"
                  style={{ backgroundColor: rCfg.mapColorHex }}
                />
                <span className="font-bangla">{rCfg.shortBangla}</span>
                <span className={`font-mono-num text-[10px] ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {rCfg.highwayCode.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-5 gap-4 items-start max-h-[75dvh] overflow-y-auto touch-pan-y">
          {/* Interactive Live Bangladesh Google Map */}
          <div className="lg:col-span-3">
            <BangladeshGoogleMap
              routeId={routeId}
              liveryId={liveryId}
              busZ={busZ}
              viewMode={viewMode}
              selectedStopId={selectedStopId}
              onSelectStop={setSelectedStopId}
              onSelectRoute={onSelectRoute}
              fallbackContent={fallbackSvg}
            />
          </div>

          {/* Stop-by-Stop Legend & Distance List */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-300 mb-1">
              <span>{route.shortLabel} ({route.realKm} km)</span>
              <span className="font-mono-num text-[11px] text-amber-300">
                {Math.round(
                  Math.max(0, Math.min(1, Math.abs(busZ) / Math.max(1, route.totalLengthM))) * 100
                )}
                % done
              </span>
            </div>
            {route.stops.map((stop) => {
              const distFromBus = Math.round(busZ - stop.z);
              const passed = distFromBus < -15;
              const selected = selectedStopId === stop.id;
              return (
                <button
                  key={stop.id}
                  type="button"
                  onClick={() => setSelectedStopId(selected ? null : stop.id)}
                  className={`w-full text-left flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer ${
                    selected
                      ? 'bg-emerald-950/70 border-emerald-400/70 text-white'
                      : passed
                        ? 'bg-slate-950/40 border-slate-800/70 text-slate-500 hover:border-slate-700'
                        : 'bg-slate-950/80 border-slate-800 text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {stop.type === 'fuel' ? (
                      <Fuel className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    ) : stop.type === 'toll' ? (
                      <ShieldAlert className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="font-bangla font-semibold truncate">{stop.banglaName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{stop.name}</div>
                    </div>
                  </div>
                  <div className="font-mono-num text-[11px] shrink-0">
                    {passed ? 'Passed' : `${Math.max(0, distFromBus)}m`}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};


