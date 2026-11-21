export type LiveryId = 'hanif' | 'shyamoli' | 'ena';
export type RouteId =
  | 'panchagarh'
  | 'coxsbazar'
  | 'sylhet'
  | 'khulna'
  | 'barishal'
  | 'rajshahi'
  | 'mymensingh';
export type CameraMode = 'chase' | 'cockpit' | 'cinematic';
export type TimePhase = 'day' | 'sunset' | 'night';
export type WeatherCondition = 'clear' | 'rain' | 'fog';
export type TrafficDensity = 'low' | 'normal' | 'heavy';

export interface LiveryConfig {
  id: LiveryId;
  name: string;
  banglaName: string;
  subtitle: string;
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  roofHex: string;
  primaryColor: number;
  secondaryColor: number;
  accentColor: number;
  coachModel: string;
}

export interface RouteStop {
  id: string;
  name: string;
  banglaName: string;
  z: number; // Negative Z distance along highway
  type: 'terminal' | 'stand' | 'toll' | 'fuel';
  farePerPassenger: number;
  tollFee?: number;
}

export interface RouteConfig {
  id: RouteId;
  name: string;
  banglaName: string;
  shortLabel: string;
  shortBangla: string;
  regionLabel: string;
  highwayCode: string;
  mapColorHex: string;
  realKm: number;
  totalLengthM: number;
  skyTopHex: number;
  skyHorizonHex: number;
  fogDensity: number;
  stops: RouteStop[];
}

export interface GameHudState {
  speedKmh: number;
  rpm: number; // 0..6000
  gear: string; // 'N' | 'R' | 'D1'..'D6'
  fuel: number; // 0..100
  taka: number;
  passengers: number;
  maxPassengers: number;
  busHealth: number; // 0..100
  distanceDrivenM: number;
  routeProgress: number; // 0..1
  busZ: number;
  nextStopName: string;
  nextStopBangla: string;
  nextStopDistM: number;
  nextStopType: 'terminal' | 'stand' | 'toll' | 'fuel' | 'none';
  atStopAction: 'none' | 'boarding' | 'refueling' | 'toll';
  boardingProgress: number; // 0..1
  speedLimitKmh: number;
  isSpeeding: boolean;
  headlightsOn: boolean;
  wipersOn: boolean;
  leftIndicator: boolean;
  rightIndicator: boolean;
  hazardOn: boolean;
  reverseGear: boolean;
  doorOpen: boolean;
  hornActive: boolean;
  timeMinutes: number; // 0..1439
  timePhase: TimePhase;
  streetLampsOn: boolean;
  weather: WeatherCondition;
  weatherAuto: boolean;
  windshieldWetness: number; // 0..1
  cameraMode: CameraMode;
  rearviewMirrorOn: boolean;
  rearBlindSpot: {
    left: boolean;
    right: boolean;
  };
  trafficDensity: TrafficDensity;
  congestionActive: boolean;
  congestionDistM: number | null;
  liveryId: LiveryId;
  routeId: RouteId;
  steerAngle: number; // -1..1
  alertText: string | null;
  alertTone: 'info' | 'success' | 'warning' | 'danger';
  passengerQuote: {
    speaker: string;
    textBn: string;
    textEn: string;
    category: 'boarding' | 'disembarking' | 'comment';
  } | null;
  tripComplete: boolean;
  stats: {
    totalFareEarned: number;
    totalPenalties: number;
    passengersServed: number;
    tollsPaid: number;
    fuelSpent: number;
  };
}

export interface InputState {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1 (left) .. +1 (right)
  horn: boolean;
  cityHorn: boolean;
}

export const LIVERIES: Record<LiveryId, LiveryConfig> = {
  hanif: {
    id: 'hanif',
    name: 'Hanif Enterprise',
    banglaName: 'হানিফ এন্টারপ্রাইজ',
    subtitle: 'Scania K410 · AC Business Class',
    primaryHex: '#0F3D91',
    secondaryHex: '#F97316',
    accentHex: '#FACC15',
    roofHex: '#F8FAFC',
    primaryColor: 0x0f3d91,
    secondaryColor: 0xf97316,
    accentColor: 0xfacc15,
    coachModel: 'SCANIA AC',
  },
  shyamoli: {
    id: 'shyamoli',
    name: 'Shyamoli Paribahan',
    banglaName: 'শ্যামলী পরিবহন',
    subtitle: 'Hyundai Universe · Sleeper Coach',
    primaryHex: '#B91C1C',
    secondaryHex: '#F8FAFC',
    accentHex: '#1E293B',
    roofHex: '#FFFFFF',
    primaryColor: 0xb91c1c,
    secondaryColor: 0xf8fafc,
    accentColor: 0x1e293b,
    coachModel: 'HYUNDAI VIP',
  },
  ena: {
    id: 'ena',
    name: 'Ena Transport',
    banglaName: 'এনা ট্রান্সপোর্ট',
    subtitle: 'Hino 1J Super · Non-Stop Express',
    primaryHex: '#047857',
    secondaryHex: '#FBBF24',
    accentHex: '#ECFDF5',
    roofHex: '#F1F5F9',
    primaryColor: 0x047857,
    secondaryColor: 0xfbbf24,
    accentColor: 0xecfdf5,
    coachModel: 'HINO 1J AC',
  },
};

export const ROUTES: Record<RouteId, RouteConfig> = {
  panchagarh: {
    id: 'panchagarh',
    name: 'Dhaka → Jamuna Bridge → Bogura → Rangpur → Panchagarh',
    banglaName: 'ঢাকা → যমুনা সেতু → বগুড়া → রংপুর → পঞ্চগড়',
    shortLabel: 'Dhaka – Panchagarh',
    shortBangla: 'ঢাকা–পঞ্চগড়',
    regionLabel: 'North Bengal (Rangpur Div.)',
    highwayCode: 'N5 Highway',
    mapColorHex: '#38bdf8',
    realKm: 395,
    totalLengthM: 5200,
    skyTopHex: 0x387ec2,
    skyHorizonHex: 0xd1e7f0,
    fogDensity: 0.0019,
    stops: [
      { id: 'dhaka_gabtoli', name: 'Gabtoli Terminal, Dhaka', banglaName: 'গাবতলী টার্মিনাল, ঢাকা', z: -90, type: 'terminal', farePerPassenger: 130 },
      { id: 'jamuna_toll', name: 'Jamuna Bridge Toll Plaza', banglaName: 'যমুনা সেতু টোল প্লাজা', z: -920, type: 'toll', farePerPassenger: 0, tollFee: 250 },
      { id: 'bogura_pump', name: 'Bogura Padma Petrol Pump', banglaName: 'বগুড়া পদ্মা পেট্রোল পাম্প', z: -2140, type: 'fuel', farePerPassenger: 0 },
      { id: 'rangpur_stand', name: 'Rangpur Modern Mor Stand', banglaName: 'রংপুর মডার্ন মোড়', z: -2860, type: 'stand', farePerPassenger: 180 },
      { id: 'rangpur_pump', name: 'Rangpur Meghna Petrol Pump', banglaName: 'রংপুর মেঘনা পেট্রোল পাম্প', z: -3460, type: 'fuel', farePerPassenger: 0 },
      { id: 'bhaulaganj_stand', name: 'Bhaulaganj Bazar Stand', banglaName: 'ভাউলাগঞ্জ বাজার স্ট্যান্ড', z: -4060, type: 'stand', farePerPassenger: 160 },
      { id: 'bhaulaganj_pump', name: 'Bhaulaganj Petrol Pump', banglaName: 'ভাউলাগঞ্জ পেট্রোল পাম্প', z: -4540, type: 'fuel', farePerPassenger: 0 },
      { id: 'panchagarh_term', name: 'Panchagarh Central Terminal', banglaName: 'পঞ্চগড় কেন্দ্রীয় টার্মিনাল', z: -5140, type: 'terminal', farePerPassenger: 240 },
    ],
  },
  coxsbazar: {
    id: 'coxsbazar',
    name: "Dhaka → Meghna Bridge → Cumilla → Chattogram → Cox's Bazar",
    banglaName: 'ঢাকা → কুমিল্লা → চট্টগ্রাম → কক্সবাজার',
    shortLabel: "Dhaka – Cox's Bazar",
    shortBangla: 'ঢাকা–কক্সবাজার',
    regionLabel: 'Southeast Coast (Chattogram Div.)',
    highwayCode: 'N1 Highway',
    mapColorHex: '#f97316',
    realKm: 390,
    totalLengthM: 4600,
    skyTopHex: 0x3b82c4,
    skyHorizonHex: 0xcbe4f2,
    fogDensity: 0.002,
    stops: [
      { id: 'sayedabad', name: 'Sayedabad Terminal', banglaName: 'সায়েদাবাদ টার্মিনাল', z: -90, type: 'terminal', farePerPassenger: 120 },
      { id: 'cumilla', name: 'Cumilla Highway Stand', banglaName: 'কুমিল্লা হাইওয়ে স্ট্যান্ড', z: -1160, type: 'stand', farePerPassenger: 150 },
      { id: 'padma_fuel', name: 'Padma Petrol & CNG Pump', banglaName: 'পদ্মা পেট্রোল পাম্প', z: -1850, type: 'fuel', farePerPassenger: 0 },
      { id: 'feni_toll', name: 'Feni Highway Toll Plaza', banglaName: 'ফেনী টোল প্লাজা', z: -2650, type: 'toll', farePerPassenger: 0, tollFee: 250 },
      { id: 'chattogram', name: 'Chattogram City Gate', banglaName: 'চট্টগ্রাম সিটি গেট', z: -3550, type: 'stand', farePerPassenger: 180 },
      { id: 'coxs_pump', name: 'Lohagara Petrol Pump', banglaName: 'লোহাগাড়া পেট্রোল পাম্প', z: -4050, type: 'fuel', farePerPassenger: 0 },
      { id: 'coxs_term', name: "Cox's Bazar Terminal", banglaName: 'কক্সবাজার টার্মিনাল', z: -4550, type: 'terminal', farePerPassenger: 220 },
    ],
  },
  sylhet: {
    id: 'sylhet',
    name: 'Dhaka → Bhairab Bridge → Shaistaganj → Sreemangal → Sylhet',
    banglaName: 'ঢাকা → ভৈরব → শায়েস্তাগঞ্জ → শ্রীমঙ্গল → সিলেট',
    shortLabel: 'Dhaka – Sylhet',
    shortBangla: 'ঢাকা–সিলেট',
    regionLabel: 'Northeast Tea Valley (Sylhet Div.)',
    highwayCode: 'N2 Highway',
    mapColorHex: '#10b981',
    realKm: 245,
    totalLengthM: 4200,
    skyTopHex: 0x2f78b8,
    skyHorizonHex: 0xd4ebe4,
    fogDensity: 0.0021,
    stops: [
      { id: 'mohakhali', name: 'Mohakhali Bus Terminal', banglaName: 'মহাখালী বাস টার্মিনাল', z: -90, type: 'terminal', farePerPassenger: 110 },
      { id: 'bhairab', name: 'Bhairab Bridge Stand', banglaName: 'ভৈরব ব্রিজ স্ট্যান্ড', z: -1040, type: 'stand', farePerPassenger: 140 },
      { id: 'meghna_fuel', name: 'Surma Petrol & CNG Pump', banglaName: 'সুরমা পেট্রোল পাম্প', z: -1750, type: 'fuel', farePerPassenger: 0 },
      { id: 'sherpur_toll', name: 'Sherpur Toll Plaza', banglaName: 'শেরপুর টোল প্লাজা', z: -2520, type: 'toll', farePerPassenger: 0, tollFee: 200 },
      { id: 'habiganj', name: 'Shaistaganj Tea Stand', banglaName: 'শায়েস্তাগঞ্জ স্ট্যান্ড', z: -3320, type: 'stand', farePerPassenger: 160 },
      { id: 'sylhet_pump', name: 'Sherpur Petrol Pump', banglaName: 'শেরপুর পেট্রোল পাম্প', z: -3740, type: 'fuel', farePerPassenger: 0 },
      { id: 'sylhet_term', name: 'Kadamtali Terminal, Sylhet', banglaName: 'কদমতলী টার্মিনাল, সিলেট', z: -4150, type: 'terminal', farePerPassenger: 200 },
    ],
  },
  khulna: {
    id: 'khulna',
    name: 'Dhaka → Padma Bridge → Bhanga → Jashore → Khulna',
    banglaName: 'ঢাকা → পদ্মা সেতু → ভাঙ্গা → যশোর → খুলনা',
    shortLabel: 'Dhaka – Khulna',
    shortBangla: 'ঢাকা–খুলনা',
    regionLabel: 'Southwest Delta (Khulna Div.)',
    highwayCode: 'N8 / N7 Highway',
    mapColorHex: '#a855f7',
    realKm: 270,
    totalLengthM: 4600,
    skyTopHex: 0x367fc0,
    skyHorizonHex: 0xd3e9ef,
    fogDensity: 0.0019,
    stops: [
      { id: 'jatrabari_khulna', name: 'Sayedabad / Jatrabari Terminal', banglaName: 'সায়েদাবাদ / যাত্রাবাড়ী টার্মিনাল', z: -90, type: 'terminal', farePerPassenger: 120 },
      { id: 'padma_toll_khulna', name: 'Padma Bridge Mawa Toll Plaza', banglaName: 'পদ্মা সেতু মাওয়া টোল প্লাজা', z: -760, type: 'toll', farePerPassenger: 0, tollFee: 300 },
      { id: 'bhanga_stand', name: 'Bhanga Expressway Stand', banglaName: 'ভাঙ্গা এক্সপ্রেসওয়ে মোড়', z: -1760, type: 'stand', farePerPassenger: 150 },
      { id: 'faridpur_pump', name: 'Modhumati Petrol & CNG Pump', banglaName: 'মধুমতি পেট্রোল পাম্প', z: -2420, type: 'fuel', farePerPassenger: 0 },
      { id: 'jashore_stand', name: 'Jashore Rain-Tree Highway Stand', banglaName: 'যশোর রাজপথ বাস স্ট্যান্ড', z: -3320, type: 'stand', farePerPassenger: 170 },
      { id: 'noapara_pump', name: 'Noapara Padma Petrol Pump', banglaName: 'নওয়াপাড়া পেট্রোল পাম্প', z: -3950, type: 'fuel', farePerPassenger: 0 },
      { id: 'khulna_term', name: 'Sonadanga Terminal, Khulna', banglaName: 'সোনাডাঙ্গা টার্মিনাল, খুলনা', z: -4540, type: 'terminal', farePerPassenger: 210 },
    ],
  },
  barishal: {
    id: 'barishal',
    name: 'Dhaka → Padma Bridge → Barishal → Patuakhali → Kuakata',
    banglaName: 'ঢাকা → পদ্মা সেতু → বরিশাল → পটুয়াখালী → কুয়াকাটা',
    shortLabel: 'Dhaka – Kuakata',
    shortBangla: 'ঢাকা–বরিশাল–কুয়াকাটা',
    regionLabel: 'Southern Riverlands (Barishal Div.)',
    highwayCode: 'N8 Coastal',
    mapColorHex: '#ec4899',
    realKm: 295,
    totalLengthM: 4500,
    skyTopHex: 0x327ec2,
    skyHorizonHex: 0xd0e8f2,
    fogDensity: 0.002,
    stops: [
      { id: 'gulistan_barishal', name: 'Jatrabari South Terminal', banglaName: 'যাত্রাবাড়ী দক্ষিণ টার্মিনাল', z: -90, type: 'terminal', farePerPassenger: 120 },
      { id: 'padma_toll_barishal', name: 'Padma Bridge Mawa Toll Plaza', banglaName: 'পদ্মা সেতু মাওয়া টোল প্লাজা', z: -760, type: 'toll', farePerPassenger: 0, tollFee: 300 },
      { id: 'gaurnadi_pump', name: 'Gaurnadi Highway Petrol Pump', banglaName: 'গৌরনদী পেট্রোল পাম্প', z: -2060, type: 'fuel', farePerPassenger: 0 },
      { id: 'barishal_stand', name: 'Nathullabad Terminal, Barishal', banglaName: 'নথুল্লাবাদ টার্মিনাল, বরিশাল', z: -2780, type: 'stand', farePerPassenger: 170 },
      { id: 'patuakhali_pump', name: 'Lebukhali Payra Petrol Pump', banglaName: 'লেবুখালী পায়রা পেট্রোল পাম্প', z: -3680, type: 'fuel', farePerPassenger: 0 },
      { id: 'kuakata_term', name: 'Kuakata Sea Beach Terminal', banglaName: 'কুয়াকাটা সমুদ্র সৈকত টার্মিনাল', z: -4440, type: 'terminal', farePerPassenger: 230 },
    ],
  },
  rajshahi: {
    id: 'rajshahi',
    name: 'Dhaka → Jamuna Bridge → Sirajganj → Natore → Rajshahi',
    banglaName: 'ঢাকা → যমুনা সেতু → সিরাজগঞ্জ → নাটোর → রাজশাহী',
    shortLabel: 'Dhaka – Rajshahi',
    shortBangla: 'ঢাকা–রাজশাহী',
    regionLabel: 'Western Padma Plains (Rajshahi Div.)',
    highwayCode: 'N6 Highway',
    mapColorHex: '#eab308',
    realKm: 260,
    totalLengthM: 4300,
    skyTopHex: 0x3b81bf,
    skyHorizonHex: 0xd7ebd9,
    fogDensity: 0.0018,
    stops: [
      { id: 'gabtoli_raj', name: 'Gabtoli Terminal, Dhaka', banglaName: 'গাবতলী টার্মিনাল, ঢাকা', z: -90, type: 'terminal', farePerPassenger: 120 },
      { id: 'jamuna_toll_raj', name: 'Jamuna Bridge Toll Plaza', banglaName: 'যমুনা সেতু টোল প্লাজা', z: -920, type: 'toll', farePerPassenger: 0, tollFee: 250 },
      { id: 'hatikumrul_pump', name: 'Hatikumrul Padma Petrol Pump', banglaName: 'হাটিকুমরুল পেট্রোল পাম্প', z: -2040, type: 'fuel', farePerPassenger: 0 },
      { id: 'natore_stand', name: 'Natore Bonpara Stand', banglaName: 'নাটোর বনপাড়া বাস স্ট্যান্ড', z: -2920, type: 'stand', farePerPassenger: 160 },
      { id: 'baneshwar_pump', name: 'Baneshwar Mango Bazar Pump', banglaName: 'বানেশ্বর পেট্রোল পাম্প', z: -3620, type: 'fuel', farePerPassenger: 0 },
      { id: 'rajshahi_term', name: 'Shiroil Bus Terminal, Rajshahi', banglaName: 'শিরোইল বাস টার্মিনাল, রাজশাহী', z: -4240, type: 'terminal', farePerPassenger: 210 },
    ],
  },
  mymensingh: {
    id: 'mymensingh',
    name: 'Dhaka → Gazipur → Bhawal Sal Forest → Brahmaputra → Mymensingh',
    banglaName: 'ঢাকা → গাজীপুর → ভাওয়াল গড় → ব্রহ্মপুত্র → ময়মনসিংহ',
    shortLabel: 'Dhaka – Mymensingh',
    shortBangla: 'ঢাকা–ময়মনসিংহ',
    regionLabel: 'North-Central Sal Belt (Mymensingh Div.)',
    highwayCode: 'N3 Highway',
    mapColorHex: '#14b8a6',
    realKm: 135,
    totalLengthM: 3800,
    skyTopHex: 0x307ab8,
    skyHorizonHex: 0xd2ebdf,
    fogDensity: 0.002,
    stops: [
      { id: 'mohakhali_mym', name: 'Mohakhali Terminal, Dhaka', banglaName: 'মহাখালী টার্মিনাল, ঢাকা', z: -90, type: 'terminal', farePerPassenger: 100 },
      { id: 'gazipur_stand', name: 'Gazipur Chowrasta Stand', banglaName: 'গাজীপুর চৌরাস্তা স্ট্যান্ড', z: -840, type: 'stand', farePerPassenger: 120 },
      { id: 'bhaluka_pump', name: 'Bhaluka Sal-Forest Petrol Pump', banglaName: 'ভালুকা পেট্রোল পাম্প', z: -1680, type: 'fuel', farePerPassenger: 0 },
      { id: 'trishal_stand', name: 'Trishal Nazrul Stand', banglaName: 'ত্রিশাল নজরুল স্ট্যান্ড', z: -2420, type: 'stand', farePerPassenger: 140 },
      { id: 'brahmaputra_toll', name: 'Brahmaputra Bridge Toll Plaza', banglaName: 'ব্রহ্মপুত্র সেতু টোল প্লাজা', z: -2920, type: 'toll', farePerPassenger: 0, tollFee: 150 },
      { id: 'mymensingh_term', name: 'Maskanda Terminal, Mymensingh', banglaName: 'মাসকান্দা টার্মিনাল, ময়মনসিংহ', z: -3740, type: 'terminal', farePerPassenger: 180 },
    ],
  },
};
