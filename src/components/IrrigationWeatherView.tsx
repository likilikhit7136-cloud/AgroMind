import React from 'react';
import {
  CloudRain,
  Droplets,
  MapPin,
  RefreshCw,
  Sun,
  Wind,
} from 'lucide-react';
import { FARM_LOCATIONS } from '../data/farmSeed';
import type {
  FarmLocation,
  FieldZone,
  IrrigationGlobalConfig,
  ValveMode,
  WeatherData,
} from '../types';

interface IrrigationWeatherViewProps {
  zones: FieldZone[];
  weather: WeatherData;
  weatherLoading: boolean;
  weatherError: string | null;
  selectedLocation: FarmLocation;
  irrigationConfig: IrrigationGlobalConfig;
  isOnline: boolean;
  onSelectLocation: (locationId: string) => void;
  onRefreshWeather: () => void;
  onUpdateGlobalConfig: (patch: Partial<IrrigationGlobalConfig>) => void;
  onToggleValve: (zoneId: string) => void;
  onUpdateTargetMoisture: (zoneId: string, moisture: number) => void;
  onUpdateZoneMode: (zoneId: string, mode: ValveMode) => void;
}

function formatDayLabel(isoDate: string, idx: number): string {
  if (idx === 0) return 'Today';
  if (idx === 1) return 'Tomorrow';
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export const IrrigationWeatherView: React.FC<IrrigationWeatherViewProps> = ({
  zones,
  weather,
  weatherLoading,
  weatherError,
  selectedLocation,
  irrigationConfig,
  isOnline,
  onSelectLocation,
  onRefreshWeather,
  onUpdateGlobalConfig,
  onToggleValve,
  onUpdateTargetMoisture,
  onUpdateZoneMode,
}) => {
  const maxNext48hRainProb = Math.max(
    weather.forecast[0]?.precipProb ?? 0,
    weather.forecast[1]?.precipProb ?? 0
  );
  const rainDelayTriggered =
    irrigationConfig.autoRainDelayEnabled &&
    maxNext48hRainProb >= irrigationConfig.rainSkipThresholdPct;

  const avgEt0 =
    weather.forecast.length > 0
      ? Math.round(
          (weather.forecast.slice(0, 3).reduce((acc, d) => acc + d.et0Mm, 0) /
            Math.min(3, weather.forecast.length)) *
            10
        ) / 10
      : 3.2;

  const rainPausedCount = zones.filter((z) => z.valveMode === 'Rain-Paused').length;
  const projectedRainSavingsLiters = rainPausedCount * 2940 + (rainDelayTriggered ? 4120 : 0);

  return (
    <div className="space-y-6">
      {/* Live Agricultural Weather & Evapotranspiration Forecast */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-[#E4E7E2]">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#556157]">
              <MapPin className="w-3.5 h-3.5 text-[#166534]" />
              <span>{selectedLocation.regionLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{weather.source}</span>
            </div>
            <h2 className="mt-1 text-lg font-bold text-[#141A15]">
              Precision Weather &amp; Evapotranspiration (ET₀)
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Select farm location"
              value={selectedLocation.id}
              onChange={(e) => onSelectLocation(e.target.value)}
              className="rounded-lg border border-[#D4DDD5] bg-white px-3 py-2 text-xs font-medium text-[#141A15] focus:outline-none focus:border-[#166534]"
            >
              {FARM_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onRefreshWeather}
              disabled={weatherLoading || !isOnline}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${weatherLoading ? 'animate-spin' : ''}`} />
              Refresh Forecast
            </button>
          </div>
        </div>

        {weatherError && (
          <p className="mt-4 text-xs text-[#B45309] font-medium">
            {weatherError}
          </p>
        )}

        {/* Current Microclimate Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 pb-5 border-b border-[#E4E7E2]">
          <div>
            <p className="text-xs text-[#556157]">Current Field Temp</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#141A15]">
              {weather.current.tempC}°C
            </p>
            <p className="text-xs text-[#556157]">{weather.current.condition}</p>
          </div>
          <div>
            <p className="text-xs text-[#556157]">Relative Humidity</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#141A15]">
              {weather.current.humidity}%
            </p>
            <p className="text-xs text-[#556157]">
              Wind {weather.current.windKmh} km/h
            </p>
          </div>
          <div>
            <p className="text-xs text-[#556157]">3-Day Mean FAO ET₀</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#0369A1]">
              {avgEt0} mm/d
            </p>
            <p className="text-xs text-[#556157]">Crop water demand index</p>
          </div>
          <div>
            <p className="text-xs text-[#556157]">Rain-Delay Water Saved</p>
            <p className="mt-1 text-2xl font-bold font-mono tabular-nums text-[#15803D]">
              {projectedRainSavingsLiters.toLocaleString()} L
            </p>
            <p className="text-xs text-[#556157]">
              Peak 48h rain probability: <span className="font-mono tabular-nums">{maxNext48hRainProb}%</span>
            </p>
          </div>
        </div>

        {/* 7-Day Forecast Grid */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {weather.forecast.map((day, idx) => {
            const skipDay =
              irrigationConfig.autoRainDelayEnabled &&
              day.precipProb >= irrigationConfig.rainSkipThresholdPct;
            return (
              <div
                key={day.date}
                className={`rounded-lg border p-3.5 ${
                  skipDay ? 'border-[#BAE6FD] bg-[#F0F9FF]' : 'border-[#E4E7E2] bg-[#FAFBF9]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-[#141A15] truncate">
                    {formatDayLabel(day.date, idx)}
                  </span>
                  {day.precipProb >= 45 ? (
                    <CloudRain className="w-3.5 h-3.5 text-[#0369A1] shrink-0" />
                  ) : (
                    <Sun className="w-3.5 h-3.5 text-[#B45309] shrink-0" />
                  )}
                </div>

                <p className="mt-2 text-sm font-bold font-mono tabular-nums text-[#141A15]">
                  {day.tempMaxC}° <span className="font-normal text-[#556157]">/ {day.tempMinC}°</span>
                </p>

                <div className="mt-2 space-y-1 text-[11px] font-mono tabular-nums text-[#556157]">
                  <div className="flex justify-between">
                    <span>Rain</span>
                    <span className={day.precipProb >= 50 ? 'text-[#0369A1] font-semibold' : ''}>
                      {day.precipProb}% ({day.precipMm}mm)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>ET₀</span>
                    <span>{day.et0Mm} mm</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="inline-flex items-center gap-0.5">
                      <Wind className="w-2.5 h-2.5" /> Wind
                    </span>
                    <span>{day.windMaxKmh} km/h</span>
                  </div>
                </div>

                <p
                  className={`mt-2.5 pt-2 border-t text-[11px] font-medium ${
                    skipDay
                      ? 'border-[#BAE6FD] text-[#0369A1]'
                      : 'border-[#E4E7E2] text-[#556157]'
                  }`}
                >
                  {skipDay ? 'Auto Rain-Skip' : 'Scheduled Drip'}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Automated Weather-Adaptive Rule Controls */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
          <div>
            <h2 className="text-base font-semibold text-[#141A15]">
              Precision Automation Rules
            </h2>
            <p className="mt-1 text-xs text-[#556157] leading-relaxed">
              Automatically defer watering ahead of forecast rainfall and scale cycle runtime using daily FAO evapotranspiration.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <label htmlFor="rain-threshold" className="font-medium text-[#141A15]">
                Auto Rain-Skip Threshold
              </label>
              <span className="font-mono tabular-nums font-semibold text-[#0369A1]">
                &ge; {irrigationConfig.rainSkipThresholdPct}% chance
              </span>
            </div>
            <input
              id="rain-threshold"
              type="range"
              min={30}
              max={90}
              step={5}
              value={irrigationConfig.rainSkipThresholdPct}
              onChange={(e) =>
                onUpdateGlobalConfig({ rainSkipThresholdPct: Number(e.target.value) })
              }
              className="w-full accent-[#166534] cursor-pointer"
            />
            <p className="text-[11px] text-[#556157]">
              {rainDelayTriggered
                ? `Active: Forecast (${maxNext48hRainProb}%) exceeds threshold — eligible zones deferred.`
                : `Standby: Next 48h peak rain probability (${maxNext48hRainProb}%) is below threshold.`}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row lg:justify-end">
            <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#141A15] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={irrigationConfig.autoRainDelayEnabled}
                onChange={(e) =>
                  onUpdateGlobalConfig({ autoRainDelayEnabled: e.target.checked })
                }
                className="w-4 h-4 rounded accent-[#166534]"
              />
              Weather Rain-Delay
            </label>
            <label className="inline-flex items-center gap-2.5 text-xs font-medium text-[#141A15] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={irrigationConfig.et0AdaptiveScaling}
                onChange={(e) =>
                  onUpdateGlobalConfig({ et0AdaptiveScaling: e.target.checked })
                }
                className="w-4 h-4 rounded accent-[#166534]"
              />
              ET₀ Volume Scaling
            </label>
          </div>
        </div>
      </section>

      {/* Per-Zone Drip Valve & Target Moisture Matrix */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#141A15]">
              Automated Zone Valves &amp; Moisture Setpoints
            </h2>
            <p className="text-xs text-[#556157]">
              All valve overrides work offline and synchronize automatically when connectivity resumes.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#556157]">
            {zones.filter((z) => z.valveOpen).length} of {zones.length} valves open
          </span>
        </div>

        <div className="divide-y divide-[#E4E7E2]">
          {zones.map((zone) => {
            const moistureDelta = Math.round((zone.soilMoisture - zone.targetMoisture) * 10) / 10;
            return (
              <div
                key={zone.id}
                className="px-6 py-4 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
              >
                <div className="lg:col-span-3">
                  <div className="font-medium text-sm text-[#141A15]">{zone.name}</div>
                  <div className="text-xs text-[#556157]">
                    {zone.code} · {zone.crop} · {zone.scheduledWindow}
                  </div>
                </div>

                {/* Live Moisture Bar & Target */}
                <div className="lg:col-span-4 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums">
                    <span className="text-[#141A15] font-medium">
                      Current {zone.soilMoisture}%
                    </span>
                    <span
                      className={
                        moistureDelta < -5
                          ? 'text-[#B45309] font-medium'
                          : moistureDelta > 8
                            ? 'text-[#0369A1] font-medium'
                            : 'text-[#556157]'
                      }
                    >
                      Target {zone.targetMoisture}% ({moistureDelta > 0 ? '+' : ''}
                      {moistureDelta}%)
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label={`Target moisture setpoint for ${zone.name}`}
                    min={30}
                    max={75}
                    value={zone.targetMoisture}
                    onChange={(e) => onUpdateTargetMoisture(zone.id, Number(e.target.value))}
                    className="w-full accent-[#0369A1] cursor-pointer"
                  />
                </div>

                {/* Mode Segmented Control */}
                <div className="lg:col-span-3 flex items-center gap-1 p-1 bg-[#F1F4F1] rounded-lg w-fit">
                  {(['Auto', 'Manual', 'Rain-Paused'] as ValveMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => onUpdateZoneMode(zone.id, mode)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        zone.valveMode === mode
                          ? 'bg-white text-[#141A15] shadow-xs'
                          : 'text-[#556157] hover:text-[#141A15]'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {/* Manual Watering Override */}
                <div className="lg:col-span-2 flex lg:justify-end">
                  <button
                    type="button"
                    onClick={() => onToggleValve(zone.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                      zone.valveOpen
                        ? 'bg-[#0369A1] text-white hover:bg-[#075985]'
                        : 'border border-[#D4DDD5] bg-white text-[#141A15] hover:bg-[#F1F4F1]'
                    }`}
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    {zone.valveOpen ? 'Stop Valve' : 'Water 15m'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
