import React, { useRef } from 'react';

interface TouchSteeringWheelProps {
  steerAngle: number; // -1..1
  onSteerChange: (val: number) => void;
  onInteract: () => void;
}

export const TouchSteeringWheel: React.FC<TouchSteeringWheelProps> = ({
  steerAngle,
  onSteerChange,
  onInteract,
}) => {
  const wheelRef = useRef<HTMLDivElement>(null);
  const draggingPointerId = useRef<number | null>(null);
  const startXRef = useRef<number>(0);

  const computeSteer = (clientX: number, rect: DOMRect): number => {
    const centerX = rect.left + rect.width / 2;
    const dxFromStart = clientX - startXRef.current;
    const dxFromCenter = clientX - centerX;
    // Responsive blend: moving thumb left/right from touch start gives smooth precision on small phones
    const raw = (dxFromStart * 0.75 + dxFromCenter * 0.35) / (rect.width * 0.44);
    return Math.max(-1, Math.min(1, raw));
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    onInteract();
    draggingPointerId.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    startXRef.current = e.clientX;
    const rect = e.currentTarget.getBoundingClientRect();
    const dxCenter = (e.clientX - (rect.left + rect.width / 2)) / (rect.width * 0.5);
    if (Math.abs(dxCenter) > 0.18) {
      onSteerChange(Math.max(-1, Math.min(1, dxCenter * 0.9)));
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPointerId.current !== e.pointerId) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    onSteerChange(computeSteer(e.clientX, rect));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPointerId.current !== e.pointerId) return;
    draggingPointerId.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // noop
    }
    onSteerChange(0);
  };

  const visualDeg = steerAngle * 115;

  return (
    <div
      ref={wheelRef}
      role="slider"
      aria-label="Steering Wheel"
      aria-valuemin={-100}
      aria-valuemax={100}
      aria-valuenow={Math.round(steerAngle * 100)}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-slate-300/75 bg-slate-950/80 shadow-xl cursor-grab active:cursor-grabbing touch-none select-none flex items-center justify-center"
      style={{
        transform: `rotate(${visualDeg}deg)`,
        transition: draggingPointerId.current === null ? 'transform 140ms cubic-bezier(0.16, 1, 0.3, 1)' : 'none',
      }}
    >
      {/* Top center alignment stripe */}
      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-2.5 rounded-sm bg-amber-400" />
      {/* Spokes */}
      <div className="absolute inset-x-2.5 top-1/2 -translate-y-1/2 h-2 bg-slate-600/85 rounded-full" />
      <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-2 h-8 sm:h-10 bg-slate-600/85 rounded-full" />
      {/* Center Hub */}
      <div className="relative z-10 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-800 border border-slate-500/70 flex items-center justify-center text-[9px] sm:text-[10px] font-display font-bold tracking-wider text-amber-400">
        BD
      </div>
    </div>
  );
};
