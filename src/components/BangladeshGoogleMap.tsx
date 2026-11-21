/// <reference types="google.maps" />
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Bus, Globe, LocateFixed, Maximize2, RefreshCw } from 'lucide-react';
import { LIVERIES, LiveryId, ROUTES, RouteId, RouteStop } from '../game/types';

interface WaypointQuery {
  stopId: string;
  query: string;
}

/**
 * Geographic highway waypoint queries along Bangladesh national highways (N1, N2, N3, N5, N6, N7, N8).
 * Coordinates, geometry, distances, and durations are resolved dynamically at runtime
 * via Google Maps Platform Routes API (Route.computeRoutes).
 */
const ROUTE_WAYPOINT_QUERIES: Record<RouteId, WaypointQuery[]> = {
  panchagarh: [
    { stopId: 'dhaka_gabtoli', query: 'Gabtoli Bus Terminal, Dhaka, Bangladesh' },
    { stopId: 'jamuna_toll', query: 'Jamuna Bridge Toll Plaza, Sirajganj, Bangladesh' },
    { stopId: 'bogura_pump', query: 'Bogura, Bangladesh' },
    { stopId: 'rangpur_stand', query: 'Rangpur, Bangladesh' },
    { stopId: 'bhaulaganj_stand', query: 'Bhaulaganj, Panchagarh, Bangladesh' },
    { stopId: 'panchagarh_term', query: 'Panchagarh, Bangladesh' },
  ],
  coxsbazar: [
    { stopId: 'sayedabad', query: 'Sayedabad Bus Terminal, Dhaka, Bangladesh' },
    { stopId: 'cumilla', query: 'Cumilla, Bangladesh' },
    { stopId: 'feni_toll', query: 'Feni, Bangladesh' },
    { stopId: 'chattogram', query: 'Chattogram, Bangladesh' },
    { stopId: 'coxs_pump', query: 'Lohagara, Chattogram, Bangladesh' },
    { stopId: 'coxs_term', query: "Cox's Bazar, Bangladesh" },
  ],
  sylhet: [
    { stopId: 'mohakhali', query: 'Mohakhali Bus Terminal, Dhaka, Bangladesh' },
    { stopId: 'bhairab', query: 'Bhairab, Kishoreganj, Bangladesh' },
    { stopId: 'habiganj', query: 'Shaistaganj, Habiganj, Bangladesh' },
    { stopId: 'sherpur_toll', query: 'Sherpur, Moulvibazar, Bangladesh' },
    { stopId: 'sylhet_term', query: 'Kadamtali Bus Terminal, Sylhet, Bangladesh' },
  ],
  khulna: [
    { stopId: 'jatrabari_khulna', query: 'Sayedabad Bus Terminal, Dhaka, Bangladesh' },
    { stopId: 'padma_toll_khulna', query: 'Padma Bridge Toll Plaza, Mawa, Bangladesh' },
    { stopId: 'bhanga_stand', query: 'Bhanga, Faridpur, Bangladesh' },
    { stopId: 'jashore_stand', query: 'Jashore, Bangladesh' },
    { stopId: 'khulna_term', query: 'Sonadanga Bus Terminal, Khulna, Bangladesh' },
  ],
  barishal: [
    { stopId: 'gulistan_barishal', query: 'Jatrabari, Dhaka, Bangladesh' },
    { stopId: 'padma_toll_barishal', query: 'Padma Bridge Toll Plaza, Mawa, Bangladesh' },
    { stopId: 'barishal_stand', query: 'Nathullabad Bus Terminal, Barishal, Bangladesh' },
    { stopId: 'kuakata_term', query: 'Kuakata, Patuakhali, Bangladesh' },
  ],
  rajshahi: [
    { stopId: 'gabtoli_raj', query: 'Gabtoli Bus Terminal, Dhaka, Bangladesh' },
    { stopId: 'jamuna_toll_raj', query: 'Jamuna Bridge Toll Plaza, Sirajganj, Bangladesh' },
    { stopId: 'natore_stand', query: 'Bonpara, Natore, Bangladesh' },
    { stopId: 'rajshahi_term', query: 'Shiroil Bus Terminal, Rajshahi, Bangladesh' },
  ],
  mymensingh: [
    { stopId: 'mohakhali_mym', query: 'Mohakhali Bus Terminal, Dhaka, Bangladesh' },
    { stopId: 'gazipur_stand', query: 'Gazipur Chowrasta, Bangladesh' },
    { stopId: 'trishal_stand', query: 'Trishal, Mymensingh, Bangladesh' },
    { stopId: 'mymensingh_term', query: 'Maskanda Bus Terminal, Mymensingh, Bangladesh' },
  ],
};

const ALL_ROUTE_IDS = Object.keys(ROUTES) as RouteId[];

// Initial geographic focus for Bangladesh prior to dynamic route bounds fitting
const BANGLADESH_CENTER: google.maps.LatLngLiteral = { lat: 23.8103, lng: 90.4125 };

interface ComputedBangladeshRoute {
  pathPoints: google.maps.LatLngLiteral[];
  cumulativeMeters: number[];
  totalPathMeters: number;
  stopPositions: Record<string, google.maps.LatLngLiteral>;
  bounds: google.maps.LatLngBoundsLiteral | null;
  distanceText: string | null;
  durationText: string | null;
}

// Session-only in-memory cache so switching routes or reopening the map avoids duplicate API calls
const sessionRouteCache: Partial<Record<RouteId, ComputedBangladeshRoute>> = {};

function haversineMeters(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function interpolateAlongPath(
  pathPoints: google.maps.LatLngLiteral[],
  cumulativeMeters: number[],
  totalPathMeters: number,
  fraction: number
): { position: google.maps.LatLngLiteral; drivenSlice: google.maps.LatLngLiteral[] } {
  if (pathPoints.length === 0) {
    return { position: BANGLADESH_CENTER, drivenSlice: [] };
  }
  if (pathPoints.length === 1 || totalPathMeters <= 0) {
    return { position: pathPoints[0], drivenSlice: [pathPoints[0]] };
  }

  const clamped = Math.max(0, Math.min(1, fraction));
  const targetDist = clamped * totalPathMeters;

  for (let i = 1; i < pathPoints.length; i++) {
    const prevDist = cumulativeMeters[i - 1];
    const nextDist = cumulativeMeters[i];
    if (targetDist <= nextDist || i === pathPoints.length - 1) {
      const segLen = Math.max(1e-6, nextDist - prevDist);
      const t = Math.max(0, Math.min(1, (targetDist - prevDist) / segLen));
      const a = pathPoints[i - 1];
      const b = pathPoints[i];
      const pos: google.maps.LatLngLiteral = {
        lat: a.lat + (b.lat - a.lat) * t,
        lng: a.lng + (b.lng - a.lng) * t,
      };
      return {
        position: pos,
        drivenSlice: [...pathPoints.slice(0, i), pos],
      };
    }
  }

  return { position: pathPoints[pathPoints.length - 1], drivenSlice: pathPoints };
}

function unionBounds(
  list: (google.maps.LatLngBoundsLiteral | null | undefined)[]
): google.maps.LatLngBoundsLiteral | null {
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;
  let found = false;
  for (const b of list) {
    if (!b) continue;
    found = true;
    north = Math.max(north, b.north);
    south = Math.min(south, b.south);
    east = Math.max(east, b.east);
    west = Math.min(west, b.west);
  }
  return found ? { north, south, east, west } : null;
}

function isQuotaError(err: unknown): boolean {
  const e = err as { code?: string; status?: number | string; message?: string } | null;
  if (!e) return false;
  if (e.status === 429) return true;
  const combined = `${e.code ?? ''} ${e.status ?? ''} ${e.message ?? String(err)}`.toUpperCase();
  return (
    combined.includes('429') ||
    combined.includes('RESOURCE_EXHAUSTED') ||
    combined.includes('OVER_QUERY_LIMIT') ||
    combined.includes('OVERQUOTAMAPERROR') ||
    combined.includes('QUOTAEXCEEDEDERROR')
  );
}

async function computeSingleBangladeshRoute(
  routesLib: google.maps.RoutesLibrary,
  id: RouteId
): Promise<ComputedBangladeshRoute | null> {
  const queries = ROUTE_WAYPOINT_QUERIES[id];
  const gameRoute = ROUTES[id];
  const origin = queries[0].query;
  const destination = queries[queries.length - 1].query;
  const intermediates: google.maps.routes.Waypoint[] = queries
    .slice(1, -1)
    .map((item) => ({ location: item.query }));

  const request: google.maps.routes.ComputeRoutesRequest = {
    origin,
    destination,
    intermediates,
    travelMode: 'DRIVING',
    fields: ['path', 'distanceMeters', 'durationMillis', 'viewport', 'legs', 'localizedValues'],
    language: 'en',
    region: 'BD',
    internalUsageAttributionIds: ['gmp_mcp_codeassist_v1_aistudio'],
  };

  const response = await routesLib.Route.computeRoutes(request);
  const primaryRoute = response?.routes?.[0];
  if (!primaryRoute || !primaryRoute.path || primaryRoute.path.length === 0) {
    return null;
  }

  const pathPoints: google.maps.LatLngLiteral[] = primaryRoute.path.map((pt) => ({
    lat: pt.lat,
    lng: pt.lng,
  }));

  const cumulativeMeters: number[] = [0];
  let running = 0;
  for (let i = 1; i < pathPoints.length; i++) {
    running += haversineMeters(pathPoints[i - 1], pathPoints[i]);
    cumulativeMeters.push(running);
  }

  const stopPositions: Record<string, google.maps.LatLngLiteral> = {};
  const legs = primaryRoute.legs ?? [];

  if (legs[0]?.startLocation) {
    stopPositions[queries[0].stopId] = {
      lat: legs[0].startLocation.lat,
      lng: legs[0].startLocation.lng,
    };
  } else {
    stopPositions[queries[0].stopId] = pathPoints[0];
  }

  for (let i = 0; i < legs.length; i++) {
    const targetQuery = queries[i + 1];
    const endLoc = legs[i]?.endLocation;
    if (targetQuery && endLoc) {
      stopPositions[targetQuery.stopId] = {
        lat: endLoc.lat,
        lng: endLoc.lng,
      };
    }
  }

  for (const stop of gameRoute.stops) {
    if (!stopPositions[stop.id]) {
      const frac = Math.max(0, Math.min(1, Math.abs(stop.z) / gameRoute.totalLengthM));
      stopPositions[stop.id] = interpolateAlongPath(
        pathPoints,
        cumulativeMeters,
        running,
        frac
      ).position;
    }
  }

  let bounds: google.maps.LatLngBoundsLiteral | null = null;
  if (primaryRoute.viewport) {
    const ne = primaryRoute.viewport.getNorthEast();
    const sw = primaryRoute.viewport.getSouthWest();
    bounds = {
      north: ne.lat(),
      east: ne.lng(),
      south: sw.lat(),
      west: sw.lng(),
    };
  }

  const distKm =
    typeof primaryRoute.distanceMeters === 'number'
      ? `${Math.round(primaryRoute.distanceMeters / 1000)} km`
      : null;
  const durationHrs =
    typeof primaryRoute.durationMillis === 'number'
      ? `${Math.floor(primaryRoute.durationMillis / 3600000)}h ${Math.round(
          (primaryRoute.durationMillis % 3600000) / 60000
        )}m`
      : null;

  const computed: ComputedBangladeshRoute = {
    pathPoints,
    cumulativeMeters,
    totalPathMeters: running,
    stopPositions,
    bounds,
    distanceText: primaryRoute.localizedValues?.distance ?? distKm,
    durationText: primaryRoute.localizedValues?.duration ?? durationHrs,
  };

  sessionRouteCache[id] = computed;
  return computed;
}

interface StopMarkerWithInfoProps {
  stop: RouteStop;
  position: google.maps.LatLngLiteral;
  distFromBus: number;
  passed: boolean;
  isSelected: boolean;
  onSelect: (stopId: string | null) => void;
}

const StopMarkerWithInfo: React.FC<StopMarkerWithInfoProps> = ({
  stop,
  position,
  distFromBus,
  passed,
  isSelected,
  onSelect,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  const colors =
    stop.type === 'fuel'
      ? { background: '#facc15', borderColor: '#854d0e', glyphColor: '#422006', glyphText: '⛽' }
      : stop.type === 'toll'
        ? { background: '#38bdf8', borderColor: '#0c4a6e', glyphColor: '#082f49', glyphText: '৳' }
        : {
            background: passed ? '#475569' : '#10b981',
            borderColor: passed ? '#1e293b' : '#064e3b',
            glyphColor: '#ffffff',
            glyphText: stop.type === 'terminal' ? 'T' : 'S',
          };

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={`${stop.name} (${stop.banglaName})`}
        clickable={true}
        zIndex={isSelected ? 18 : stop.type === 'terminal' ? 14 : 9}
        onClick={() => onSelect(isSelected ? null : stop.id)}
      >
        <Pin
          background={colors.background}
          borderColor={colors.borderColor}
          glyphColor={colors.glyphColor}
          glyphText={colors.glyphText}
          scale={isSelected ? 1.18 : 0.92}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onSelect(null)} maxWidth={240}>
          <div className="text-slate-900 p-0.5 space-y-1">
            <div className="font-bangla font-bold text-sm leading-snug text-slate-950">
              {stop.banglaName}
            </div>
            <div className="text-xs font-medium text-slate-700">{stop.name}</div>
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-200 text-[11px]">
              <span className="uppercase font-semibold text-emerald-700">{stop.type}</span>
              <span className="font-mono font-semibold text-slate-800">
                {passed ? 'Passed' : `${Math.max(0, distFromBus)}m ahead`}
              </span>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface DivisionHubMarkerProps {
  hubRouteId: RouteId;
  position: google.maps.LatLngLiteral;
  distanceText: string | null;
  durationText: string | null;
  isSelected: boolean;
  onInspect: (id: RouteId | null) => void;
  onDriveRoute: (id: RouteId) => void;
}

const DivisionHubMarker: React.FC<DivisionHubMarkerProps> = ({
  hubRouteId,
  position,
  distanceText,
  durationText,
  isSelected,
  onInspect,
  onDriveRoute,
}) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const cfg = ROUTES[hubRouteId];

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title={`${cfg.shortLabel} (${cfg.highwayCode})`}
        clickable={true}
        zIndex={isSelected ? 17 : 10}
        onClick={() => onInspect(isSelected ? null : hubRouteId)}
      >
        <Pin
          background={cfg.mapColorHex}
          borderColor="#0f172a"
          glyphColor="#0f172a"
          glyphText={cfg.highwayCode.split(' ')[0]}
          scale={isSelected ? 1.15 : 0.88}
        />
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => onInspect(null)} maxWidth={250}>
          <div className="text-slate-900 p-0.5 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-900 text-white">
                {cfg.highwayCode}
              </span>
              <span className="text-[11px] font-mono font-semibold text-slate-600">
                {distanceText ?? `${cfg.realKm} km`}
                {durationText ? ` · ${durationText}` : ''}
              </span>
            </div>
            <div className="font-bangla font-bold text-sm text-slate-950 leading-snug">
              {cfg.shortBangla}
            </div>
            <div className="text-[11px] text-slate-700 leading-snug">{cfg.name}</div>
            <button
              type="button"
              onClick={() => {
                onDriveRoute(hubRouteId);
                onInspect(null);
              }}
              className="w-full mt-1 py-1.5 px-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              Drive This Highway
            </button>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

interface InnerMapProps {
  routeId: RouteId;
  liveryId: LiveryId;
  busZ: number;
  viewMode: 'country' | 'route';
  selectedStopId: string | null;
  onSelectStop: (stopId: string | null) => void;
  onSelectRoute?: (id: RouteId) => void;
  fallbackContent: React.ReactNode;
}

const BangladeshMapCanvas: React.FC<InnerMapProps> = ({
  routeId,
  liveryId,
  busZ,
  viewMode,
  selectedStopId,
  onSelectStop,
  onSelectRoute,
  fallbackContent,
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const mapsLib = useMapsLibrary('maps');
  const loadingStatus = useApiLoadingStatus();

  const [routesMap, setRoutesMap] = useState<Partial<Record<RouteId, ComputedBangladeshRoute>>>(
    () => ({ ...sessionRouteCache })
  );
  const [isComputing, setIsComputing] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const [inspectedHubId, setInspectedHubId] = useState<RouteId | null>(null);

  const routePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const progressPolylineRef = useRef<google.maps.Polyline | null>(null);

  const computedRoute = routesMap[routeId] ?? null;
  const gameRoute = ROUTES[routeId];
  const livery = LIVERIES[liveryId];

  const routeProgress = useMemo(() => {
    return Math.max(0, Math.min(1, Math.abs(busZ) / Math.max(1, gameRoute.totalLengthM)));
  }, [busZ, gameRoute.totalLengthM]);

  const allBangladeshBounds = useMemo(() => {
    return unionBounds(ALL_ROUTE_IDS.map((id) => routesMap[id]?.bounds));
  }, [routesMap]);

  // Compute active route first, and in 'country' mode hydrate remaining Bangladesh highway corridors sequentially
  useEffect(() => {
    if (!routesLib || !map) return;

    let cancelled = false;
    setRouteError(null);

    const hydrate = async () => {
      // 1. Ensure active route is resolved immediately
      if (!sessionRouteCache[routeId] || retryToken > 0) {
        setIsComputing(true);
        try {
          const res = await computeSingleBangladeshRoute(routesLib, routeId);
          if (cancelled) return;
          if (!res) {
            setRouteError('Unable to resolve this Bangladesh highway route right now.');
          } else {
            setRoutesMap((prev) => ({ ...prev, [routeId]: res }));
            if (viewMode === 'route' && res.bounds) {
              map.fitBounds(res.bounds, 36);
            }
          }
        } catch (err: unknown) {
          if (cancelled) return;
          console.error('Google Maps computeRoutes error:', err);
          if (isQuotaError(err)) {
            window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          }
          setRouteError('Unable to load live route data from Google Maps.');
          setIsComputing(false);
          return;
        }
      } else {
        setRoutesMap((prev) => ({ ...prev, [routeId]: sessionRouteCache[routeId] }));
      }

      // 2. In Entire Bangladesh overview mode, sequentially fetch remaining uncached corridors
      if (viewMode === 'country') {
        const missing = ALL_ROUTE_IDS.filter((id) => id !== routeId && !sessionRouteCache[id]);
        if (missing.length > 0) {
          setIsComputing(true);
          for (const id of missing) {
            if (cancelled) break;
            try {
              const computed = await computeSingleBangladeshRoute(routesLib, id);
              if (!cancelled && computed) {
                setRoutesMap((prev) => ({ ...prev, [id]: computed }));
              }
            } catch (err: unknown) {
              if (cancelled) break;
              if (isQuotaError(err)) {
                window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
                break;
              }
            }
          }
        }
      }

      if (!cancelled) {
        setIsComputing(false);
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [routesLib, map, routeId, viewMode, retryToken]);

  // Fit map bounds automatically when switching between Entire Bangladesh & Active Route
  useEffect(() => {
    if (!map) return;
    if (viewMode === 'country' && allBangladeshBounds) {
      map.fitBounds(allBangladeshBounds, 28);
    } else if (viewMode === 'route' && computedRoute?.bounds) {
      map.fitBounds(computedRoute.bounds, 36);
    }
  }, [map, viewMode, allBangladeshBounds, computedRoute]);

  // Draw Bangladesh highway network polylines (all 7 in country mode, or active route in route mode)
  useEffect(() => {
    routePolylinesRef.current.forEach((p) => {
      google.maps.event.clearInstanceListeners(p);
      p.setMap(null);
    });
    routePolylinesRef.current = [];

    if (!map || !mapsLib) return;

    const idsToDraw = viewMode === 'country' ? ALL_ROUTE_IDS : [routeId];
    const created: google.maps.Polyline[] = [];

    for (const id of idsToDraw) {
      const data = routesMap[id];
      if (!data || data.pathPoints.length < 2) continue;

      const isActive = id === routeId;
      const cfg = ROUTES[id];

      const outline = new mapsLib.Polyline({
        path: data.pathPoints,
        geodesic: true,
        strokeColor: isActive ? '#064e3b' : '#0f172a',
        strokeOpacity: isActive ? 0.92 : 0.55,
        strokeWeight: isActive ? 8 : 5,
        zIndex: isActive ? 5 : 1,
        clickable: !isActive && Boolean(onSelectRoute),
        map,
      });

      const core = new mapsLib.Polyline({
        path: data.pathPoints,
        geodesic: true,
        strokeColor: isActive ? '#10b981' : cfg.mapColorHex,
        strokeOpacity: isActive ? 0.96 : 0.72,
        strokeWeight: isActive ? 4 : 2.5,
        zIndex: isActive ? 6 : 2,
        clickable: !isActive && Boolean(onSelectRoute),
        map,
      });

      if (!isActive && onSelectRoute) {
        outline.addListener('click', () => onSelectRoute(id));
        core.addListener('click', () => onSelectRoute(id));
      }

      created.push(outline, core);
    }

    routePolylinesRef.current = created;

    return () => {
      created.forEach((p) => {
        google.maps.event.clearInstanceListeners(p);
        p.setMap(null);
      });
      routePolylinesRef.current = [];
    };
  }, [map, mapsLib, routesMap, routeId, viewMode, onSelectRoute]);

  const { position: busPosition, drivenSlice } = useMemo(() => {
    if (!computedRoute) {
      return { position: BANGLADESH_CENTER, drivenSlice: [] as google.maps.LatLngLiteral[] };
    }
    return interpolateAlongPath(
      computedRoute.pathPoints,
      computedRoute.cumulativeMeters,
      computedRoute.totalPathMeters,
      routeProgress
    );
  }, [computedRoute, routeProgress]);

  // Draw driven-so-far highlight polyline along active Bangladesh highway
  useEffect(() => {
    if (progressPolylineRef.current) {
      progressPolylineRef.current.setMap(null);
      progressPolylineRef.current = null;
    }
    if (!map || !mapsLib || drivenSlice.length < 2) return;

    const drivenLine = new mapsLib.Polyline({
      path: drivenSlice,
      geodesic: true,
      strokeColor: '#f59e0b',
      strokeOpacity: 0.98,
      strokeWeight: 5,
      zIndex: 8,
      map,
    });
    progressPolylineRef.current = drivenLine;

    return () => {
      drivenLine.setMap(null);
    };
  }, [map, mapsLib, drivenSlice]);

  // Pan to stop when selected from the side list
  useEffect(() => {
    if (!map || !selectedStopId || !computedRoute) return;
    const pos = computedRoute.stopPositions[selectedStopId];
    if (pos) {
      map.panTo(pos);
    }
  }, [map, selectedStopId, computedRoute]);

  const handleFitCountry = useCallback(() => {
    if (!map) return;
    if (allBangladeshBounds) {
      map.fitBounds(allBangladeshBounds, 28);
    } else {
      map.setCenter(BANGLADESH_CENTER);
      map.setZoom(7);
    }
  }, [map, allBangladeshBounds]);

  const handleFitRoute = useCallback(() => {
    if (!map || !computedRoute?.bounds) return;
    map.fitBounds(computedRoute.bounds, 36);
  }, [map, computedRoute]);

  const handleCenterBus = useCallback(() => {
    if (!map) return;
    map.panTo(busPosition);
    map.setZoom(11);
  }, [map, busPosition]);

  if (loadingStatus === APILoadingStatus.FAILED || loadingStatus === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="space-y-2">
        <div className="px-3 py-2 rounded-lg bg-amber-950/70 border border-amber-500/40 text-xs text-amber-200">
          Live Google Map could not load. Showing offline Bangladesh map.
        </div>
        {fallbackContent}
      </div>
    );
  }

  const loadedCount = ALL_ROUTE_IDS.filter((id) => Boolean(routesMap[id])).length;

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950">
      <div className="w-full h-[360px] sm:h-[430px]">
        <GoogleMap
          mapId="DEMO_MAP_ID"
          internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          defaultCenter={BANGLADESH_CENTER}
          defaultZoom={7}
          gestureHandling="greedy"
          streetViewControl={false}
          fullscreenControl={false}
          mapTypeControl={true}
          className="w-full h-full"
        >
          {/* Active route stop markers */}
          {computedRoute &&
            gameRoute.stops.map((stop) => {
              const pos = computedRoute.stopPositions[stop.id];
              if (!pos) return null;
              const distFromBus = Math.round(busZ - stop.z);
              const passed = distFromBus < -15;
              return (
                <StopMarkerWithInfo
                  key={stop.id}
                  stop={stop}
                  position={pos}
                  distFromBus={distFromBus}
                  passed={passed}
                  isSelected={selectedStopId === stop.id}
                  onSelect={onSelectStop}
                />
              );
            })}

          {/* Destination Division Terminal Markers for other highways in Entire Bangladesh mode */}
          {viewMode === 'country' &&
            onSelectRoute &&
            ALL_ROUTE_IDS.filter((id) => id !== routeId).map((otherId) => {
              const data = routesMap[otherId];
              if (!data) return null;
              const stops = ROUTES[otherId].stops;
              const destStop = stops[stops.length - 1];
              const pos = data.stopPositions[destStop.id];
              if (!pos) return null;
              return (
                <DivisionHubMarker
                  key={otherId}
                  hubRouteId={otherId}
                  position={pos}
                  distanceText={data.distanceText}
                  durationText={data.durationText}
                  isSelected={inspectedHubId === otherId}
                  onInspect={setInspectedHubId}
                  onDriveRoute={onSelectRoute}
                />
              );
            })}

          {computedRoute && (
            <AdvancedMarker
              position={busPosition}
              zIndex={25}
              title={`${livery.name} (${Math.round(routeProgress * 100)}%)`}
              onClick={handleCenterBus}
            >
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-full border-2 border-white shadow-xl text-white text-[10px] font-bold"
                style={{ backgroundColor: livery.primaryHex }}
              >
                <Bus className="w-3.5 h-3.5 shrink-0" />
                <span>BUS</span>
              </div>
            </AdvancedMarker>
          )}
        </GoogleMap>
      </div>

      {/* Real-world Bangladesh Highway Stats & Quick Camera Controls */}
      <div className="pointer-events-none absolute bottom-3 left-3 right-12 flex flex-wrap items-center justify-between gap-2">
        <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-950/90 border border-slate-700/80 text-[11px] text-slate-200 shadow-lg">
          {viewMode === 'country' && loadedCount > 1 ? (
            <>
              <span className="font-semibold text-emerald-300">
                {loadedCount}/7 Highways
              </span>
              {computedRoute?.distanceText && (
                <>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="font-mono-num text-amber-300">{computedRoute.distanceText}</span>
                </>
              )}
            </>
          ) : computedRoute?.distanceText ? (
            <>
              <span className="font-mono-num font-bold text-emerald-300">
                {computedRoute.distanceText}
              </span>
              {computedRoute.durationText && (
                <>
                  <span className="text-slate-500" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-300">{computedRoute.durationText}</span>
                </>
              )}
            </>
          ) : isComputing ? (
            <span className="text-amber-300">Loading Bangladesh highways...</span>
          ) : (
            <span className="text-slate-400">Bangladesh Highway Network</span>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-1.5">
          {routeError && (
            <button
              type="button"
              onClick={() => setRetryToken((t) => t + 1)}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-semibold flex items-center gap-1 shadow-lg cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          )}
          <button
            type="button"
            onClick={handleCenterBus}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-700 text-amber-300 text-[11px] font-semibold flex items-center gap-1 shadow-lg cursor-pointer"
            title="Zoom to Bus Location"
          >
            <LocateFixed className="w-3.5 h-3.5" />
            <span>Bus</span>
          </button>
          <button
            type="button"
            onClick={handleFitRoute}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-700 text-slate-200 text-[11px] font-semibold flex items-center gap-1 shadow-lg cursor-pointer"
            title="Fit Active Highway"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Route</span>
          </button>
          <button
            type="button"
            onClick={handleFitCountry}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950/90 hover:bg-slate-800 border border-slate-700 text-emerald-300 text-[11px] font-semibold flex items-center gap-1 shadow-lg cursor-pointer"
            title="Fit Entire Bangladesh"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Bangladesh</span>
          </button>
        </div>
      </div>

      {routeError && (
        <div className="absolute top-12 left-3 right-3 px-3 py-1.5 rounded-lg bg-red-950/92 border border-red-400/60 text-xs text-red-100 shadow-lg">
          {routeError}
        </div>
      )}
    </div>
  );
};

export interface BangladeshGoogleMapProps {
  routeId: RouteId;
  liveryId: LiveryId;
  busZ: number;
  viewMode: 'country' | 'route';
  selectedStopId: string | null;
  onSelectStop: (stopId: string | null) => void;
  onSelectRoute?: (id: RouteId) => void;
  fallbackContent: React.ReactNode;
}

export const BangladeshGoogleMap: React.FC<BangladeshGoogleMapProps> = (props) => {
  const apiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || '';
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  if (!apiKey || !isOnline) {
    return (
      <div className="space-y-2">
        <div className="px-3 py-2 rounded-lg bg-slate-950/90 border border-slate-700 text-xs text-slate-300">
          {!isOnline
            ? 'Offline mode: showing schematic Entire Bangladesh highway map.'
            : 'Google Maps API key not active: showing schematic Entire Bangladesh highway map.'}
        </div>
        {props.fallbackContent}
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} language="en" region="BD">
      <BangladeshMapCanvas {...props} />
    </APIProvider>
  );
};

