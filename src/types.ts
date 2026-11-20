export type ZoneHealthStatus = 'Healthy' | 'Monitor' | 'Alert';
export type ValveMode = 'Auto' | 'Manual' | 'Rain-Paused';

export interface FieldZone {
  id: string;
  code: string;
  name: string;
  crop: string;
  areaHa: number;
  soilMoisture: number; // %
  targetMoisture: number; // %
  canopyTempC: number;
  humidity: number; // %
  soilPh: number;
  ecMsCm: number;
  healthStatus: ZoneHealthStatus;
  lastDiseaseNote: string;
  lastScannedAt: string;
  valveMode: ValveMode;
  valveOpen: boolean;
  flowRateLpm: number;
  dailyWaterLiters: number;
  scheduledWindow: string;
  mapCoords: { x: number; y: number; w: number; h: number };
}

export interface RoverState {
  unitName: string;
  activeZoneId: string;
  isPatrolling: boolean;
  batteryPct: number;
  speedMs: number;
  scansToday: number;
  posX: number;
  posY: number;
  headingNote: string;
}

export interface IrrigationRecommendation {
  action: 'Reduce' | 'Maintain' | 'Increase' | 'Pause';
  deltaPercent: number;
  rationale: string;
  suggestedTargetMoisture: number;
}

export interface DiagnosisResult {
  diseaseName: string;
  scientificName: string;
  status: ZoneHealthStatus;
  confidence: number;
  affectedAreaPercent: number;
  pathogenType: string;
  summary: string;
  symptomsObserved: string[];
  treatmentProtocol: string[];
  irrigationRecommendation: IrrigationRecommendation;
  analyzedAt: string;
  matchedTrainingClass?: string;
  trainingSamplesUsed?: number;
}

export interface TrainingSample {
  id: string;
  diseaseLabel: string;
  scientificName: string;
  crop: string;
  pathogenType: 'Fungal' | 'Bacterial' | 'Viral' | 'Nutrient' | 'Pest' | 'None';
  severity: ZoneHealthStatus;
  visualNotes: string;
  imageUrl: string;
  imageBase64?: string;
  mimeType?: string;
  active: boolean;
  addedAt: string;
  source: 'Uploaded Dataset' | 'Custom Upload' | 'Field Scan';
}

export interface ScanRecord {
  id: string;
  zoneId: string;
  zoneName: string;
  crop: string;
  imageUrl: string;
  capturedAt: string;
  source: 'Rover Camera' | 'Mobile Upload' | 'Live Camera';
  diagnosis: DiagnosisResult;
  appliedToIrrigation?: boolean;
}

export interface DailyForecast {
  date: string;
  condition: string;
  weatherCode: number;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  precipProb: number;
  et0Mm: number;
  windMaxKmh: number;
}

export interface WeatherData {
  locationName: string;
  lat: number;
  lon: number;
  fetchedAt: string;
  source: string;
  current: {
    tempC: number;
    humidity: number;
    precipMm: number;
    windKmh: number;
    condition: string;
    weatherCode: number;
  };
  forecast: DailyForecast[];
}

export interface FarmLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  regionLabel: string;
}

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  zoneId: string;
  zoneName: string;
  severity: 'Alert' | 'Monitor' | 'Info';
  category: 'Disease' | 'Irrigation' | 'Weather' | 'Rover';
  createdAt: string;
  acknowledged: boolean;
  pushSent: boolean;
}

export interface OfflineOperation {
  id: string;
  type: 'VALVE_UPDATE' | 'IRRIGATION_RULE' | 'QUEUED_DIAGNOSIS' | 'ALERT_ACK';
  summary: string;
  createdAt: string;
  status: 'Pending' | 'Synced' | 'Failed';
  payload: Record<string, unknown>;
}

export interface HistoricalYieldPoint {
  period: string;
  season: number;
  crop: string;
  yieldTonsHa: number;
  baselineYieldTonsHa: number;
  waterM3Ha: number;
  baselineWaterM3Ha: number;
  earlyDetections: number;
  preventedLossPct: number;
}

export interface NotificationPrefs {
  enabled: boolean;
  criticalDiseaseAlerts: boolean;
  moistureThresholdPct: number;
  rainDelayDigest: boolean;
}

export interface IrrigationGlobalConfig {
  rainSkipThresholdPct: number;
  autoRainDelayEnabled: boolean;
  et0AdaptiveScaling: boolean;
}

export type ActiveTab = 'overview' | 'scanner' | 'irrigation' | 'analytics' | 'alerts';
