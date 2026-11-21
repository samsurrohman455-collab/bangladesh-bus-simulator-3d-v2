import React, { useEffect, useRef } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export interface MirrorViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface RearviewMirrorOverlayProps {
  visible: boolean;
  mirrorEnabled: boolean;
  reverseGear: boolean;
  blindSpotLeft: boolean;
  blindSpotRight: boolean;
  onToggleMirror: () => void;
  onViewportChange: (rect: MirrorViewportRect | null) => void;
}

export const RearviewMirrorOverlay: React.FC<RearviewMirrorOverlayProps> = ({
  visible,
  mirrorEnabled,
  reverseGear,
  blindSpotLeft,
  blindSpotRight,
  onToggleMirror,
  onViewportChange,
}) => {
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible || !mirrorEnabled) {
      onViewportChange(null);
      return;
    }

    const measure = () => {
      const el = slotRef.current;
      if (!el) {
        onViewportChange(null);
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) {
        onViewportChange({
          left: r.left,
          top: r.top,
          width: r.width,
          height: r.height,
        });
      } else {
        onViewportChange(null);
      }
    };

    measure();
    const rafId = requestAnimationFrame(measure);

    const observer = new ResizeObserver(measure);
    if (slotRef.current) {
      observer.observe(slotRef.current);
      if (slotRef.current.parentElement?.parentElement) {
        observer.observe(slotRef.current.parentElement.parentElement);
      }
    }

    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      onViewportChange(null);
    };
  }, [visible, mirrorEnabled, onViewportChange]);

  if (!visible) {
    return null;
  }

  if (!mirrorEnabled) {
    return (
      <div className="pointer-events-auto flex justify-center">
        <button
          onClick={onToggleMirror}
          title="Show Rearview Mirror (N)"
          className="h-8 px-3 rounded-lg bg-slate-950/90 hover:bg-slate-900 border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 shadow-lg transition-colors cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-sky-300" />
          <span>Show Rearview Mirror</span>
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto w-[270px] sm:w-[336px] md:w-[376px] rounded-xl bg-slate-950/95 border-2 border-slate-700/90 shadow-2xl overflow-hidden">
      {/* Mirror Housing Bezel Header */}
      <div className="px-2.5 py-1 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
              blindSpotLeft
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            ◀ L
          </span>
          <span className="font-display font-semibold text-slate-200 truncate">
            Rearview Mirror
          </span>
          {reverseGear && (
            <span className="font-mono-num font-bold text-amber-300 text-[10px]">
              REV
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
              blindSpotRight
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-800 text-slate-400'
            }`}
          >
            R ▶
          </span>
          <button
            onClick={onToggleMirror}
            title="Hide Rearview Mirror (N)"
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
            aria-label="Hide Rearview Mirror"
          >
            <EyeOff className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transparent Optical Mirror Viewport Cutout (rendered live via WebGL scissor pass) */}
      <div
        ref={slotRef}
        className="relative w-full h-[86px] sm:h-[106px] md:h-[118px] bg-transparent"
      >
        {/* Subtle Glass Edge Vignette & Overtaking Lane Guide Ticks */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 border border-white/10"
          style={{
            boxShadow: 'inset 0 0 14px rgba(2, 6, 23, 0.55)',
          }}
        />
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 w-full h-full"
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
        >
          {/* Left & right lane guide marks */}
          <line
            x1="22"
            y1="38"
            x2="31"
            y2="25"
            stroke="rgba(250, 204, 21, 0.45)"
            strokeWidth="0.6"
          />
          <line
            x1="78"
            y1="38"
            x2="69"
            y2="25"
            stroke="rgba(250, 204, 21, 0.45)"
            strokeWidth="0.6"
          />
          <line
            x1="50"
            y1="38"
            x2="50"
            y2="31"
            stroke="rgba(226, 232, 240, 0.35)"
            strokeWidth="0.5"
            strokeDasharray="1.5 1.5"
          />
        </svg>
      </div>
    </div>
  );
};
