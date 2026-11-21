import * as THREE from 'three';
import { RoadSurfaceVariant } from './roadTextures';
import { RouteId, RouteStop } from './types';

export interface RiverBridgeSpec {
  id: string;
  bridgeNameBn: string;
  bridgeSubText: string;
  riverNameBn: string;
  riverWaterHex: string;
  zApproachStart: number; // Less negative (closer to Dhaka start)
  zRiverStart: number;
  zRiverEnd: number;
  zApproachEnd: number; // More negative (further along route)
  deckHeight: number;
  hasRailDeck: boolean;
  isJamuna: boolean;
}

export interface UrbanZoneSpec {
  id: string;
  cityNameBn: string;
  citySubText: string;
  zStart: number; // Less negative
  zEnd: number; // More negative
  density: 'metro' | 'city' | 'town';
  gateZ?: number;
}

const ROUTE_BRIDGES: Record<RouteId, RiverBridgeSpec[]> = {
  panchagarh: [
    {
      id: 'jamuna_bridge',
      bridgeNameBn: 'বঙ্গবন্ধু যমুনা বহুমুখী সেতু',
      bridgeSubText: 'যমুনা নদী · ৪.৮ কি.মি. · রেল ও সড়ক সেতু',
      riverNameBn: 'যমুনা নদী · JAMUNA RIVER',
      riverWaterHex: '#2b6f75',
      zApproachStart: -975,
      zRiverStart: -1045,
      zRiverEnd: -1645,
      zApproachEnd: -1715,
      deckHeight: 6.4,
      hasRailDeck: true,
      isJamuna: true,
    },
  ],
  coxsbazar: [
    {
      id: 'meghna_bridge',
      bridgeNameBn: 'মেঘনা সেতু · N1 মহাসড়ক',
      bridgeSubText: 'মেঘনা নদী · ঢাকা–কুমিল্লা সেতু',
      riverNameBn: 'মেঘনা নদী · MEGHNA RIVER',
      riverWaterHex: '#22616a',
      zApproachStart: -455,
      zRiverStart: -520,
      zRiverEnd: -870,
      zApproachEnd: -935,
      deckHeight: 5.4,
      hasRailDeck: false,
      isJamuna: false,
    },
  ],
  sylhet: [
    {
      id: 'bhairab_bridge',
      bridgeNameBn: 'সৈয়দ নজরুল ইসলাম (ভৈরব) সেতু',
      bridgeSubText: 'মেঘনা নদী · সড়ক ও রেল সেতু',
      riverNameBn: 'মেঘনা নদী · BHAIRAB CROSSING',
      riverWaterHex: '#24646c',
      zApproachStart: -500,
      zRiverStart: -565,
      zRiverEnd: -895,
      zApproachEnd: -960,
      deckHeight: 5.5,
      hasRailDeck: true,
      isJamuna: false,
    },
  ],
  khulna: [
    {
      id: 'padma_bridge_khulna',
      bridgeNameBn: 'পদ্মা বহুমুখী সেতু · N8',
      bridgeSubText: 'পদ্মা নদী · ৬.১৫ কি.মি. · মাওয়া–জাজিরা',
      riverNameBn: 'পদ্মা নদী · PADMA RIVER',
      riverWaterHex: '#245d69',
      zApproachStart: -820,
      zRiverStart: -890,
      zRiverEnd: -1580,
      zApproachEnd: -1650,
      deckHeight: 7.2,
      hasRailDeck: true,
      isJamuna: true,
    },
  ],
  barishal: [
    {
      id: 'padma_bridge_barishal',
      bridgeNameBn: 'পদ্মা বহুমুখী সেতু · N8',
      bridgeSubText: 'পদ্মা নদী · ৬.১৫ কি.মি. · মাওয়া–জাজিরা',
      riverNameBn: 'পদ্মা নদী · PADMA RIVER',
      riverWaterHex: '#245d69',
      zApproachStart: -820,
      zRiverStart: -890,
      zRiverEnd: -1580,
      zApproachEnd: -1650,
      deckHeight: 7.2,
      hasRailDeck: true,
      isJamuna: true,
    },
    {
      id: 'payra_bridge',
      bridgeNameBn: 'পায়রা সেতু · বরিশাল–পটুয়াখালী',
      bridgeSubText: 'পায়রা ও কীর্তনখোলা অববাহিকা · দক্ষিণবঙ্গ',
      riverNameBn: 'পায়রা নদী · PAYRA RIVER',
      riverWaterHex: '#21656f',
      zApproachStart: -3020,
      zRiverStart: -3085,
      zRiverEnd: -3460,
      zApproachEnd: -3525,
      deckHeight: 5.8,
      hasRailDeck: false,
      isJamuna: false,
    },
  ],
  rajshahi: [
    {
      id: 'jamuna_bridge_raj',
      bridgeNameBn: 'বঙ্গবন্ধু যমুনা বহুমুখী সেতু',
      bridgeSubText: 'যমুনা নদী · সিরাজগঞ্জ–রাজশাহী সংযোগ',
      riverNameBn: 'যমুনা নদী · JAMUNA RIVER',
      riverWaterHex: '#2b6f75',
      zApproachStart: -975,
      zRiverStart: -1045,
      zRiverEnd: -1645,
      zApproachEnd: -1715,
      deckHeight: 6.4,
      hasRailDeck: true,
      isJamuna: true,
    },
  ],
  mymensingh: [
    {
      id: 'brahmaputra_bridge',
      bridgeNameBn: 'শম্ভুগঞ্জ ব্রহ্মপুত্র সেতু · N3',
      bridgeSubText: 'পুরাতন ব্রহ্মপুত্র নদ · ময়মনসিংহ',
      riverNameBn: 'ব্রহ্মপুত্র নদ · BRAHMAPUTRA RIVER',
      riverWaterHex: '#286a6b',
      zApproachStart: -2985,
      zRiverStart: -3050,
      zRiverEnd: -3410,
      zApproachEnd: -3475,
      deckHeight: 5.6,
      hasRailDeck: false,
      isJamuna: false,
    },
  ],
};

const ROUTE_URBAN_ZONES: Record<RouteId, UrbanZoneSpec[]> = {
  panchagarh: [
    {
      id: 'dhaka_gabtoli_urban',
      cityNameBn: 'ঢাকা মহানগর · গাবতলী',
      citySubText: 'DHAKA METRO · N5 HIGHWAY',
      zStart: 40,
      zEnd: -250,
      density: 'metro',
      gateZ: -170,
    },
    {
      id: 'bogura_urban',
      cityNameBn: 'বগুড়া শহর · উত্তরবঙ্গ',
      citySubText: 'BOGURA CITY · N5',
      zStart: -1980,
      zEnd: -2300,
      density: 'city',
      gateZ: -2020,
    },
    {
      id: 'rangpur_urban',
      cityNameBn: 'রংপুর মহানগর',
      citySubText: 'RANGPUR CITY CORPORATION',
      zStart: -2720,
      zEnd: -3020,
      density: 'city',
      gateZ: -2760,
    },
    {
      id: 'bhaulaganj_town',
      cityNameBn: 'ভাউলাগঞ্জ বাজার',
      citySubText: 'BHAULAGANJ BAZAR',
      zStart: -3960,
      zEnd: -4180,
      density: 'town',
    },
    {
      id: 'panchagarh_urban',
      cityNameBn: 'পঞ্চগড় শহর',
      citySubText: 'PANCHAGARH TOWN · N5 END',
      zStart: -4980,
      zEnd: -5220,
      density: 'city',
      gateZ: -5010,
    },
  ],
  coxsbazar: [
    {
      id: 'dhaka_sayedabad_urban',
      cityNameBn: 'ঢাকা মহানগর · সায়েদাবাদ',
      citySubText: 'DHAKA METRO · N1 HIGHWAY',
      zStart: 40,
      zEnd: -240,
      density: 'metro',
      gateZ: -165,
    },
    {
      id: 'cumilla_urban',
      cityNameBn: 'কুমিল্লা শহর',
      citySubText: 'CUMILLA · N1 HIGHWAY',
      zStart: -1040,
      zEnd: -1300,
      density: 'city',
      gateZ: -1075,
    },
    {
      id: 'feni_town',
      cityNameBn: 'ফেনী শহর',
      citySubText: 'FENI HIGHWAY',
      zStart: -2540,
      zEnd: -2780,
      density: 'town',
    },
    {
      id: 'chattogram_urban',
      cityNameBn: 'চট্টগ্রাম মহানগর · সিটি গেট',
      citySubText: 'CHATTOGRAM PORT CITY',
      zStart: -3390,
      zEnd: -3720,
      density: 'metro',
      gateZ: -3430,
    },
    {
      id: 'coxs_urban',
      cityNameBn: 'কক্সবাজার শহর',
      citySubText: "COX'S BAZAR SEA CITY",
      zStart: -4400,
      zEnd: -4640,
      density: 'city',
      gateZ: -4440,
    },
  ],
  sylhet: [
    {
      id: 'dhaka_mohakhali_urban',
      cityNameBn: 'ঢাকা মহানগর · মহাখালী',
      citySubText: 'DHAKA METRO · N2 HIGHWAY',
      zStart: 40,
      zEnd: -240,
      density: 'metro',
      gateZ: -165,
    },
    {
      id: 'bhairab_town',
      cityNameBn: 'ভৈরব বন্দর শহর',
      citySubText: 'BHAIRAB · N2',
      zStart: -970,
      zEnd: -1160,
      density: 'town',
    },
    {
      id: 'shaistaganj_town',
      cityNameBn: 'শায়েস্তাগঞ্জ · হবিগঞ্জ',
      citySubText: 'SHAISTAGANJ · TEA VALLEY',
      zStart: -3220,
      zEnd: -3420,
      density: 'town',
    },
    {
      id: 'sylhet_urban',
      cityNameBn: 'সিলেট মহানগর · কদমতলী',
      citySubText: 'SYLHET CITY · N2',
      zStart: -4000,
      zEnd: -4240,
      density: 'city',
      gateZ: -4035,
    },
  ],
  khulna: [
    {
      id: 'dhaka_jatrabari_urban',
      cityNameBn: 'ঢাকা মহানগর · যাত্রাবাড়ী',
      citySubText: 'DHAKA METRO · N8 EXPRESSWAY',
      zStart: 40,
      zEnd: -250,
      density: 'metro',
      gateZ: -165,
    },
    {
      id: 'bhanga_town',
      cityNameBn: 'ভাঙ্গা · ফরিদপুর মোড়',
      citySubText: 'BHANGA INTERCHANGE · N8',
      zStart: -1690,
      zEnd: -1860,
      density: 'town',
    },
    {
      id: 'jashore_urban',
      cityNameBn: 'যশোর শহর · রাজপথ',
      citySubText: 'JASHORE CITY · N7',
      zStart: -3190,
      zEnd: -3450,
      density: 'city',
      gateZ: -3220,
    },
    {
      id: 'khulna_urban',
      cityNameBn: 'খুলনা মহানগর · সোনাডাঙ্গা',
      citySubText: 'KHULNA CITY CORPORATION',
      zStart: -4380,
      zEnd: -4640,
      density: 'metro',
      gateZ: -4410,
    },
  ],
  barishal: [
    {
      id: 'dhaka_south_urban',
      cityNameBn: 'ঢাকা মহানগর · মাওয়া রোড',
      citySubText: 'DHAKA METRO · N8 HIGHWAY',
      zStart: 40,
      zEnd: -250,
      density: 'metro',
      gateZ: -165,
    },
    {
      id: 'gaurnadi_town',
      cityNameBn: 'গৌরনদী বাজার',
      citySubText: 'GAURNADI · BARISHAL HIGHWAY',
      zStart: -1990,
      zEnd: -2170,
      density: 'town',
    },
    {
      id: 'barishal_urban',
      cityNameBn: 'বরিশাল মহানগর · নথুল্লাবাদ',
      citySubText: 'BARISHAL CITY CORPORATION',
      zStart: -2660,
      zEnd: -2930,
      density: 'city',
      gateZ: -2695,
    },
    {
      id: 'kuakata_urban',
      cityNameBn: 'কুয়াকাটা · সাগরকন্যা',
      citySubText: 'KUAKATA COASTAL TOWN',
      zStart: -4310,
      zEnd: -4540,
      density: 'town',
      gateZ: -4340,
    },
  ],
  rajshahi: [
    {
      id: 'dhaka_gabtoli_raj_urban',
      cityNameBn: 'ঢাকা মহানগর · গাবতলী',
      citySubText: 'DHAKA METRO · N5 / N6',
      zStart: 40,
      zEnd: -250,
      density: 'metro',
      gateZ: -170,
    },
    {
      id: 'hatikumrul_town',
      cityNameBn: 'হাটিকুমরুল গোলচত্বর',
      citySubText: 'SIRAJGANJ INTERCHANGE · N6',
      zStart: -1950,
      zEnd: -2150,
      density: 'town',
    },
    {
      id: 'natore_urban',
      cityNameBn: 'নাটোর · বনপাড়া শহর',
      citySubText: 'NATORE BONPARA · N6',
      zStart: -2810,
      zEnd: -3040,
      density: 'city',
      gateZ: -2840,
    },
    {
      id: 'rajshahi_urban',
      cityNameBn: 'রাজশাহী মহানগর · পদ্মাপাড়',
      citySubText: 'RAJSHAHI SILK CITY',
      zStart: -4090,
      zEnd: -4340,
      density: 'metro',
      gateZ: -4120,
    },
  ],
  mymensingh: [
    {
      id: 'dhaka_mohakhali_mym_urban',
      cityNameBn: 'ঢাকা মহানগর · উত্তরা',
      citySubText: 'DHAKA METRO · N3 HIGHWAY',
      zStart: 40,
      zEnd: -240,
      density: 'metro',
      gateZ: -165,
    },
    {
      id: 'gazipur_urban',
      cityNameBn: 'গাজীপুর মহানগর · চৌরাস্তা',
      citySubText: 'GAZIPUR CITY · N3',
      zStart: -730,
      zEnd: -970,
      density: 'city',
      gateZ: -760,
    },
    {
      id: 'trishal_town',
      cityNameBn: 'ত্রিশাল বাজার',
      citySubText: 'TRISHAL · MYMENSINGH',
      zStart: -2330,
      zEnd: -2520,
      density: 'town',
    },
    {
      id: 'mymensingh_urban',
      cityNameBn: 'ময়মনসিংহ মহানগর',
      citySubText: 'MYMENSINGH CITY CORPORATION',
      zStart: -3600,
      zEnd: -3840,
      density: 'city',
      gateZ: -3630,
    },
  ],
};

export function getRiverBridgeZones(routeId: RouteId = 'panchagarh'): RiverBridgeSpec[] {
  return ROUTE_BRIDGES[routeId] ?? [];
}

export function getUrbanZones(routeId: RouteId = 'panchagarh'): UrbanZoneSpec[] {
  return ROUTE_URBAN_ZONES[routeId] ?? [];
}

export function isInsideRiverSpan(z: number, routeId: RouteId = 'panchagarh', pad = 0): boolean {
  const bridges = ROUTE_BRIDGES[routeId] ?? [];
  for (const b of bridges) {
    if (z <= b.zRiverStart + pad && z >= b.zRiverEnd - pad) {
      return true;
    }
  }
  return false;
}

export function isInsideBridgeApproach(z: number, routeId: RouteId = 'panchagarh', pad = 0): boolean {
  const bridges = ROUTE_BRIDGES[routeId] ?? [];
  for (const b of bridges) {
    if (z <= b.zApproachStart + pad && z >= b.zApproachEnd - pad) {
      return true;
    }
  }
  return false;
}

export function isInsideUrbanZone(z: number, routeId: RouteId = 'panchagarh'): UrbanZoneSpec | null {
  const zones = ROUTE_URBAN_ZONES[routeId] ?? [];
  for (const u of zones) {
    if (z <= u.zStart && z >= u.zEnd) {
      return u;
    }
  }
  return null;
}

function smoothCos01(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1);
  return 0.5 - 0.5 * Math.cos(c * Math.PI);
}

export function getRoadY(z: number, routeId: RouteId = 'panchagarh'): number {
  const bridges = ROUTE_BRIDGES[routeId] ?? [];
  for (const b of bridges) {
    if (z <= b.zApproachStart && z >= b.zApproachEnd) {
      if (z > b.zRiverStart) {
        const t = (b.zApproachStart - z) / Math.max(1, b.zApproachStart - b.zRiverStart);
        return b.deckHeight * smoothCos01(t);
      }
      if (z < b.zRiverEnd) {
        const t = (z - b.zApproachEnd) / Math.max(1, b.zRiverEnd - b.zApproachEnd);
        return b.deckHeight * smoothCos01(t);
      }
      const spanT = (b.zRiverStart - z) / Math.max(1, b.zRiverStart - b.zRiverEnd);
      const camber = Math.sin(spanT * Math.PI) * 0.72;
      return b.deckHeight + camber;
    }
  }
  return 0;
}

export interface RoadRepairZone {
  zStart: number; // Less negative
  zEnd: number; // More negative
}

const ROUTE_REPAIR_ZONES: Record<RouteId, RoadRepairZone[]> = {
  panchagarh: [
    { zStart: -630, zEnd: -715 },
    { zStart: -2355, zEnd: -2440 },
  ],
  coxsbazar: [
    { zStart: -1445, zEnd: -1530 },
    { zStart: -3035, zEnd: -3120 },
  ],
  sylhet: [
    { zStart: -1395, zEnd: -1480 },
    { zStart: -2805, zEnd: -2890 },
  ],
  khulna: [
    { zStart: -2140, zEnd: -2225 },
    { zStart: -3640, zEnd: -3725 },
  ],
  barishal: [
    { zStart: -2310, zEnd: -2395 },
    { zStart: -3860, zEnd: -3945 },
  ],
  rajshahi: [
    { zStart: -2320, zEnd: -2405 },
    { zStart: -3320, zEnd: -3405 },
  ],
  mymensingh: [
    { zStart: -1240, zEnd: -1325 },
    { zStart: -2640, zEnd: -2725 },
  ],
};

export function getRepairZones(routeId: RouteId = 'panchagarh'): RoadRepairZone[] {
  return ROUTE_REPAIR_ZONES[routeId] ?? [];
}

export function getRoadSurfaceVariantAt(
  z: number,
  routeId: RouteId,
  stops: RouteStop[]
): RoadSurfaceVariant {
  // 1. Bridge surfaces (Jamuna / Padma / Meghna / Bhairab / Payra / Brahmaputra decks)
  if (isInsideBridgeApproach(z, routeId, -6)) {
    return 'bridge';
  }

  // 2. Concrete road sections (Toll plazas, fuel pump approaches, main Dhaka terminal apron)
  for (const s of stops) {
    const pad = s.type === 'toll' ? 32 : s.type === 'fuel' ? 22 : s.z > -160 ? 26 : 0;
    if (pad > 0 && Math.abs(z - s.z) <= pad) {
      return 'concrete';
    }
  }

  // 3. Road construction & repair zones
  const repairs = ROUTE_REPAIR_ZONES[routeId] ?? [];
  for (const rz of repairs) {
    if (z <= rz.zStart && z >= rz.zEnd) {
      return 'repair';
    }
  }

  // 4. Urban zones: Dhaka metro, regional cities, towns & busy markets
  const urban = isInsideUrbanZone(z, routeId);
  if (urban) {
    for (const s of stops) {
      if (s.type === 'stand' && Math.abs(z - s.z) <= 45) {
        return 'market';
      }
    }
    if (urban.density === 'metro') return 'dhaka';
    if (urban.density === 'town') return 'market';
    return 'town';
  }

  // 5. Narrow local village roads & natural rural stretches per region
  if (routeId === 'panchagarh') {
    if ((z <= -3540 && z >= -3955) || (z <= -4200 && z >= -4960)) {
      return 'domar_local';
    }
    if (z <= -1720 && z >= -3539) {
      return 'rural';
    }
    return 'highway';
  }

  if (routeId === 'coxsbazar') {
    if (z <= -3730 && z >= -4390) {
      return 'domar_local';
    }
    if ((z <= -1875 && z >= -2535) || (z <= -2785 && z >= -3030)) {
      return 'rural';
    }
    return 'highway';
  }

  if (routeId === 'khulna') {
    if (z <= -3460 && z >= -4360) {
      return 'domar_local';
    }
    if (z <= -1870 && z >= -3180) {
      return 'rural';
    }
    return 'highway';
  }

  if (routeId === 'barishal') {
    if (z <= -3540 && z >= -4300) {
      return 'domar_local';
    }
    if (z <= -1660 && z >= -2650) {
      return 'rural';
    }
    return 'highway';
  }

  if (routeId === 'rajshahi') {
    if (z <= -3050 && z >= -4080) {
      return 'domar_local';
    }
    if (z <= -1720 && z >= -2800) {
      return 'rural';
    }
    return 'highway';
  }

  if (routeId === 'mymensingh') {
    if (z <= -1350 && z >= -2320) {
      return 'rural';
    }
    if (z <= -2530 && z >= -2960) {
      return 'domar_local';
    }
    return 'highway';
  }

  // sylhet
  if (z <= -3430 && z >= -3990) {
    return 'domar_local';
  }
  if ((z <= -1780 && z >= -2480) || (z <= -2900 && z >= -3215)) {
    return 'rural';
  }
  return 'highway';
}

export function getRoadSlopeAngle(z: number, routeId: RouteId = 'panchagarh'): number {
  const dz = 0.75;
  const yAhead = getRoadY(z - dz, routeId);
  const yBehind = getRoadY(z + dz, routeId);
  return Math.atan2(yAhead - yBehind, 2 * dz);
}

