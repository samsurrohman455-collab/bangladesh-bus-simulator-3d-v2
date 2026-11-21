import React from 'react';
import { LIVERIES, LiveryId, ROUTES, RouteId, TrafficDensity } from '../game/types';
import { Bus, Car, MapPin, Play, RotateCcw, X } from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface CoachMenuModalProps {
  isOpen: boolean;
  isInitialLaunch: boolean;
  currentLivery: LiveryId;
  currentRoute: RouteId;
  currentTrafficDensity: TrafficDensity;
  onSelectLivery: (id: LiveryId) => void;
  onSelectRoute: (id: RouteId) => void;
  onSelectTrafficDensity: (density: TrafficDensity) => void;
  onResetTrip: () => void;
  onClose: () => void;
}

export const CoachMenuModal: React.FC<CoachMenuModalProps> = ({
  isOpen,
  isInitialLaunch,
  currentLivery,
  currentRoute,
  currentTrafficDensity,
  onSelectLivery,
  onSelectRoute,
  onSelectTrafficDensity,
  onResetTrip,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80">
      <div className="w-full max-w-2xl rounded-xl bg-slate-900 border border-slate-700/80 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-white tracking-tight">
              Bangla Highway Coach 3D
            </h1>
            <p className="text-xs text-slate-400 mt-0.5 font-bangla">
              বাংলাদেশ হাইওয়ে বাস সিমুলেটর · Select Coach Livery & Highway Route
            </p>
          </div>
          {!isInitialLaunch && (
            <button
              onClick={onClose}
              aria-label="Close menu"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="p-4 sm:p-6 space-y-5 max-h-[70dvh] overflow-y-auto touch-pan-y">
          {/* Coach Livery Selection */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-3">
              <Bus className="w-4 h-4 text-amber-400" />
              <span>Coach Operator Livery</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(LIVERIES) as LiveryId[]).map((id) => {
                const liv = LIVERIES[id];
                const active = currentLivery === id;
                return (
                  <button
                    key={id}
                    onClick={() => onSelectLivery(id)}
                    className={`text-left p-3.5 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-800 border-amber-400 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-4 h-4 rounded-sm shrink-0 border border-white/20"
                        style={{ backgroundColor: liv.primaryHex }}
                      />
                      <span
                        className="w-4 h-4 rounded-sm shrink-0 border border-white/20"
                        style={{ backgroundColor: liv.secondaryHex }}
                      />
                    </div>
                    <div className="font-display font-bold text-sm text-white truncate">
                      {liv.name}
                    </div>
                    <div className="font-bangla text-xs text-amber-300/90 truncate">
                      {liv.banglaName}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      {liv.subtitle}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Route Selection */}
          <div>
            <div className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-300 mb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-400" />
                <span>All-Bangladesh Highway Routes (7 Corridors · 8 Divisions)</span>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {(Object.keys(ROUTES) as RouteId[]).map((id) => {
                const route = ROUTES[id];
                const active = currentRoute === id;
                const pumpCount = route.stops.filter((s) => s.type === 'fuel').length;
                return (
                  <button
                    key={id}
                    onClick={() => onSelectRoute(id)}
                    className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? 'bg-slate-800 border-emerald-400 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 font-mono-num text-[11px] text-emerald-400 font-semibold">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: route.mapColorHex }}
                        />
                        {route.highwayCode}
                      </span>
                      <span className="font-mono-num text-[10px] text-slate-400">
                        {route.realKm} km
                      </span>
                    </div>
                    <div className="font-display font-bold text-sm text-white mt-1 leading-snug">
                      {route.shortLabel}
                    </div>
                    <div className="font-bangla text-xs text-amber-300/95 mt-0.5 leading-snug">
                      {route.shortBangla}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1 truncate" title={route.name}>
                      {route.regionLabel}
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1.5">
                      {route.stops.length} Stops · {pumpCount} Petrol Pumps
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Highway Traffic Density Selection */}
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-3">
              <Car className="w-4 h-4 text-sky-400" />
              <span>Highway Traffic Density &amp; Congestion</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: 'low',
                    label: 'Low',
                    bangla: 'হালকা ট্রাফিক',
                    desc: 'Open lanes · Rare short jams',
                    activeBorder: 'border-emerald-400',
                    dot: 'bg-emerald-400',
                  },
                  {
                    id: 'normal',
                    label: 'Normal',
                    bangla: 'স্বাভাবিক',
                    desc: 'Balanced flow · Periodic jams',
                    activeBorder: 'border-amber-400',
                    dot: 'bg-amber-400',
                  },
                  {
                    id: 'heavy',
                    label: 'Heavy',
                    bangla: 'ভারী যানজট',
                    desc: 'Packed highway · Frequent jams',
                    activeBorder: 'border-red-400',
                    dot: 'bg-red-400',
                  },
                ] as const
              ).map((opt) => {
                const active = currentTrafficDensity === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onSelectTrafficDensity(opt.id)}
                    className={`text-left p-3 rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? `bg-slate-800 ${opt.activeBorder} text-white`
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                      <span className="font-display font-bold text-sm text-white">{opt.label}</span>
                    </div>
                    <div className="font-bangla text-xs text-amber-300/90 mt-1">{opt.bangla}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Controls Quick Reference */}
          <div className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5">
            <div className="text-xs font-semibold text-slate-200">
              Mobile Touch &amp; Desktop Controls
            </div>
            <p className="font-bangla text-xs text-amber-200/90 leading-relaxed">
              মোবাইলে খেলতে: বাম পাশে স্টিয়ারিং হুইল (অথবা ◀ / ▶ বাটন) দিয়ে বাস ঘোরান এবং ডান পাশে GAS, BRAKE ও AIR HORN চেপে ধরুন।
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-xs text-slate-400">
              <div><span className="font-mono-num text-slate-200">W / ↑</span> Throttle</div>
              <div><span className="font-mono-num text-slate-200">S / ↓ / Space</span> Brake</div>
              <div><span className="font-mono-num text-slate-200">A / D / ← / →</span> Steer</div>
              <div><span className="font-mono-num text-slate-200">H</span> Hydraulic Air Horn</div>
              <div><span className="font-mono-num text-slate-200">R</span> Reverse Gear</div>
              <div><span className="font-mono-num text-slate-200">C / N</span> Camera / Mirror</div>
              <div><span className="font-mono-num text-slate-200">L</span> Headlights</div>
              <div><span className="font-mono-num text-slate-200">K</span> Wipers</div>
              <div><span className="font-mono-num text-slate-200">T / V</span> Time / Weather</div>
              <div><span className="font-mono-num text-slate-200">G</span> Traffic Density</div>
              <div><span className="font-mono-num text-slate-200">Q / E / Z</span> Indicators</div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-950/60 border-t border-slate-800">
          {!isInitialLaunch ? (
            <button
              onClick={() => {
                onResetTrip();
                onClose();
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restart Route</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400">
              Drive on the <span className="text-amber-300 font-semibold">LEFT</span> lane
            </div>
          )}

          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton />
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-display font-bold text-slate-950 bg-amber-400 hover:bg-amber-300 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{isInitialLaunch ? 'Start Driving' : 'Resume Drive'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
