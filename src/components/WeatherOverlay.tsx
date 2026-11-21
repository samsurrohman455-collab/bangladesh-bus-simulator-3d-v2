import React from 'react';
import { CameraMode, TimePhase, WeatherCondition } from '../game/types';

interface WeatherOverlayProps {
  weather: WeatherCondition;
  timePhase: TimePhase;
  cameraMode: CameraMode;
  wipersOn: boolean;
  windshieldWetness: number;
}

// Deterministic droplet coordinates for crisp GPU-free glass spray overlay
const GLASS_DROPS = [
  { x: 14, y: 18, r: 4.5 },
  { x: 24, y: 31, r: 3.2 },
  { x: 33, y: 14, r: 5.0 },
  { x: 42, y: 27, r: 3.6 },
  { x: 54, y: 16, r: 4.2 },
  { x: 66, y: 29, r: 3.4 },
  { x: 76, y: 15, r: 4.8 },
  { x: 87, y: 24, r: 3.8 },
  { x: 11, y: 46, r: 3.6 },
  { x: 21, y: 58, r: 4.6 },
  { x: 37, y: 49, r: 3.0 },
  { x: 49, y: 42, r: 4.1 },
  { x: 61, y: 53, r: 3.5 },
  { x: 72, y: 44, r: 4.4 },
  { x: 85, y: 51, r: 3.3 },
  { x: 92, y: 38, r: 4.0 },
  { x: 18, y: 74, r: 3.9 },
  { x: 31, y: 69, r: 3.4 },
  { x: 46, y: 68, r: 4.2 },
  { x: 64, y: 73, r: 3.8 },
  { x: 79, y: 66, r: 4.5 },
  { x: 89, y: 76, r: 3.2 },
  { x: 8, y: 82, r: 4.1 },
  { x: 56, y: 84, r: 3.5 },
];

export const WeatherOverlay: React.FC<WeatherOverlayProps> = ({
  weather,
  timePhase,
  cameraMode,
  wipersOn,
  windshieldWetness,
}) => {
  const isRain = weather === 'rain';
  const isFog = weather === 'fog';
  const dropOpacity =
    windshieldWetness <= 0.02
      ? 0
      : cameraMode === 'cockpit'
        ? Math.min(0.85, windshieldWetness * 0.88)
        : Math.min(0.42, windshieldWetness * 0.44);

  if (!isRain && !isFog && dropOpacity <= 0.02) {
    return null;
  }

  const mistTone =
    timePhase === 'night'
      ? 'rgba(30, 41, 59, 0.46)'
      : timePhase === 'sunset'
        ? 'rgba(203, 178, 166, 0.36)'
        : 'rgba(219, 230, 240, 0.42)';

  const mistEdgeTone =
    timePhase === 'night'
      ? 'rgba(15, 23, 42, 0.56)'
      : timePhase === 'sunset'
        ? 'rgba(180, 152, 144, 0.38)'
        : 'rgba(203, 218, 230, 0.46)';

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 overflow-hidden"
    >
      {/* Rain atmospheric slate vignette + diagonal rain streaks */}
      {isRain && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{
              background:
                timePhase === 'night'
                  ? 'radial-gradient(circle at 50% 45%, rgba(15,23,42,0.06) 35%, rgba(2,6,23,0.48) 100%)'
                  : 'radial-gradient(circle at 50% 45%, rgba(148,163,184,0.08) 38%, rgba(30,41,59,0.34) 100%)',
            }}
          />
          <div className="weather-rain-layer opacity-35" />
        </>
      )}

      {/* Dense foggy atmospheric veil + drifting mist banks */}
      {isFog && (
        <>
          <div
            className="absolute inset-0 transition-opacity duration-700"
            style={{
              background: `linear-gradient(180deg, ${mistTone} 0%, rgba(226,232,240,0.12) 48%, ${mistEdgeTone} 100%)`,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 52%, rgba(255,255,255,0) 24%, ${mistEdgeTone} 100%)`,
            }}
          />
          <div
            className="weather-mist-band"
            style={{
              background:
                timePhase === 'night'
                  ? 'linear-gradient(90deg, rgba(51,65,85,0) 0%, rgba(100,116,139,0.18) 50%, rgba(51,65,85,0) 100%)'
                  : 'linear-gradient(90deg, rgba(241,245,249,0) 0%, rgba(241,245,249,0.28) 50%, rgba(241,245,249,0) 100%)',
            }}
          />
        </>
      )}

      {/* Windshield water droplets & streaks (intensifies when wipers are OFF during rain) */}
      {dropOpacity > 0.02 && (
        <svg
          className="absolute inset-0 w-full h-full transition-opacity duration-200"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ opacity: dropOpacity }}
        >
          {GLASS_DROPS.map((d, idx) => {
            // In chase/cinematic view, keep center clear & spray mainly around outer edges
            if (
              cameraMode !== 'cockpit' &&
              d.x > 25 &&
              d.x < 75 &&
              d.y > 22 &&
              d.y < 78
            ) {
              return null;
            }
            const streakLen = d.r * 1.45;
            return (
              <g key={idx}>
                <ellipse
                  cx={d.x}
                  cy={d.y}
                  rx={d.r * 0.28}
                  ry={d.r * 0.42}
                  fill="rgba(224, 242, 254, 0.34)"
                  stroke="rgba(255, 255, 255, 0.38)"
                  strokeWidth="0.18"
                />
                <line
                  x1={d.x}
                  y1={d.y - d.r * 0.3}
                  x2={d.x - 0.35}
                  y2={d.y - streakLen}
                  stroke="rgba(224, 242, 254, 0.28)"
                  strokeWidth="0.22"
                  strokeLinecap="round"
                />
              </g>
            );
          })}
          {cameraMode === 'cockpit' && wipersOn && (
            <path
              d="M 16 92 A 42 52 0 0 1 84 92"
              fill="none"
              stroke="rgba(226, 232, 240, 0.16)"
              strokeWidth="0.5"
              strokeDasharray="2 3"
            />
          )}
        </svg>
      )}
    </div>
  );
};
