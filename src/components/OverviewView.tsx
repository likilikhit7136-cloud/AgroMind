import React, { useState } from 'react';
import {
  ArrowRight,
  Camera,
  Droplets,
  Navigation,
  Pause,
  Play,
  Sprout,
} from 'lucide-react';
import { ROVER_HERO_IMAGE } from '../data/farmSeed';
import type { ActiveTab, FieldZone, RoverState, WeatherData } from '../types';

interface OverviewViewProps {
  zones: FieldZone[];
  rover: RoverState;
  weather: WeatherData;
  unreadAlertsCount: number;
  onTogglePatrol: () => void;
  onDispatchRover: (zoneId: string) => void;
  onToggleValve: (zoneId: string) => void;
  onNavigate: (tab: ActiveTab, zoneId?: string) => void;
}

function statusTextClass(status: FieldZone['healthStatus']): string {
  if (status === 'Alert') return 'text-[#B91C1C] font-semibold';
  if (status === 'Monitor') return 'text-[#B45309] font-semibold';
  return 'text-[#15803D] font-medium';
}

function zoneMapFill(zone: FieldZone, isSelected: boolean): string {
  if (zone.healthStatus === 'Alert') return isSelected ? '#FEE2E2' : '#FEF2F2';
  if (zone.healthStatus === 'Monitor') return isSelected ? '#FEF3C7' : '#FFFBEB';
  return isSelected ? '#DCFCE7' : '#F0FDF4';
}

function zoneMapStroke(zone: FieldZone, isSelected: boolean): string {
  if (isSelected) return '#166534';
  if (zone.healthStatus === 'Alert') return '#FCA5A5';
  if (zone.healthStatus === 'Monitor') return '#FCD34D';
  return '#BBF7D0';
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  zones,
  rover,
  weather,
  unreadAlertsCount,
  onTogglePatrol,
  onDispatchRover,
  onToggleValve,
  onNavigate,
}) => {
  const [selectedZoneId, setSelectedZoneId] = useState<string>(rover.activeZoneId || zones[0]?.id);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? zones[0];
  const avgMoisture = Math.round(
    zones.reduce((acc, z) => acc + z.soilMoisture, 0) / Math.max(1, zones.length)
  );
  const healthyCount = zones.filter((z) => z.healthStatus === 'Healthy').length;
  const activeValvesCount = zones.filter((z) => z.valveOpen).length;
  const totalDailyLiters = zones.reduce((acc, z) => acc + z.dailyWaterLiters, 0);
  const rainPausedZones = zones.filter((z) => z.valveMode === 'Rain-Paused').length;
  const weeklyLitersSaved = 14820 + rainPausedZones * 2940;

  return (
    <div className="space-y-6">
      {/* 4-Column Agronomic KPI Row */}
      <section aria-label="Farm key indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">Crop Canopy Health</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#141A15]">
              {healthyCount}/{zones.length}
            </span>
            <span className="text-xs text-[#556157]">zones nominal</span>
          </div>
          <p className="mt-2 text-xs text-[#556157]">
            {unreadAlertsCount > 0
              ? `${unreadAlertsCount} active health alert${unreadAlertsCount > 1 ? 's' : ''} require review`
              : 'All scouted zones within nominal range'}
          </p>
        </div>

        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">Average Soil Moisture</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#141A15]">
              {avgMoisture}%
            </span>
            <span className="text-xs text-[#0369A1] font-medium">
              {activeValvesCount} valve{activeValvesCount === 1 ? '' : 's'} active
            </span>
          </div>
          <p className="mt-2 text-xs text-[#556157] font-mono tabular-nums">
            Today&apos;s delivery · {totalDailyLiters.toLocaleString()} L
          </p>
        </div>

        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">Weather Water Savings</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#15803D]">
              {weeklyLitersSaved.toLocaleString()} L
            </span>
            <span className="text-xs text-[#556157]">last 7 days</span>
          </div>
          <p className="mt-2 text-xs text-[#556157]">
            {weather.current.condition} · <span className="font-mono tabular-nums">{weather.current.tempC}°C</span> ·{' '}
            <span className="font-mono tabular-nums">{weather.forecast[1]?.precipProb ?? 0}%</span> rain tomorrow
          </p>
        </div>

        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">{rover.unitName} Field Patrol</p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-bold font-mono tabular-nums text-[#141A15]">
              {rover.scansToday}
            </span>
            <span className="text-xs text-[#556157]">leaf frames today</span>
          </div>
          <p className="mt-2 text-xs text-[#556157] font-mono tabular-nums">
            Battery {rover.batteryPct}% · {rover.isPatrolling ? `${rover.speedMs.toFixed(1)} m/s` : 'Paused'}
          </p>
        </div>
      </section>

      {/* Main Split: Spatial Field Map + Rover Hardware & Selected Zone Panel */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Interactive Field Map & Autonomous Rover Patrol */}
        <div className="lg:col-span-7 bg-white border border-[#E4E7E2] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#141A15]">
                  Live Field Plot &amp; Autonomous Patrol
                </h2>
                <p className="mt-0.5 text-xs text-[#556157]">
                  Select any plot to inspect moisture, dispatch {rover.unitName}, or trigger leaf pathology scan.
                </p>
              </div>
              <button
                type="button"
                onClick={onTogglePatrol}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap shrink-0"
              >
                {rover.isPatrolling ? (
                  <>
                    <Pause className="w-3.5 h-3.5 text-[#556157]" />
                    Pause Patrol
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 text-[#166534]" />
                    Resume Patrol
                  </>
                )}
              </button>
            </div>

            {/* Interactive SVG Agricultural Plot Canvas */}
            <div className="mt-5 rounded-lg border border-[#E4E7E2] bg-[#FAFBF9] p-3 overflow-x-auto">
              <svg
                viewBox="0 0 660 290"
                className="w-full h-auto min-w-[480px]"
                role="img"
                aria-label="Interactive agricultural field map showing six monitored crop zones and autonomous rover location"
              >
                {/* Subtle field row guide lines */}
                <defs>
                  <pattern id="cropRows" width="16" height="16" patternUnits="userSpaceOnUse">
                    <path d="M 0 8 L 16 8" stroke="#141A15" strokeOpacity="0.045" strokeWidth="1" />
                  </pattern>
                </defs>
                <rect x="0" y="0" width="660" height="290" fill="#FAFBF9" rx="6" />

                {/* Irrigation main manifold pipe */}
                <line x1="12" y1="144" x2="648" y2="144" stroke="#CBD5E1" strokeWidth="3" strokeDasharray="6 4" />

                {zones.map((zone) => {
                  const isSelected = zone.id === selectedZone?.id;
                  const { x, y, w, h } = zone.mapCoords;
                  return (
                    <g
                      key={zone.id}
                      onClick={() => setSelectedZoneId(zone.id)}
                      className="cursor-pointer"
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${zone.name}, ${zone.crop}, status ${zone.healthStatus}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedZoneId(zone.id);
                        }
                      }}
                    >
                      <rect
                        x={x}
                        y={y}
                        width={w}
                        height={h}
                        rx="6"
                        fill={zoneMapFill(zone, isSelected)}
                        stroke={zoneMapStroke(zone, isSelected)}
                        strokeWidth={isSelected ? 2 : 1}
                      />
                      <rect x={x} y={y} width={w} height={h} rx="6" fill="url(#cropRows)" pointerEvents="none" />

                      {/* Zone Header */}
                      <text
                        x={x + 12}
                        y={y + 22}
                        fontSize="11"
                        fontWeight="600"
                        fill="#141A15"
                        fontFamily="Plus Jakarta Sans, sans-serif"
                      >
                        {zone.code} · {zone.name}
                      </text>
                      <text
                        x={x + 12}
                        y={y + 38}
                        fontSize="10"
                        fill="#556157"
                        fontFamily="DM Sans, sans-serif"
                      >
                        {zone.crop}
                      </text>

                      {/* Moisture & Status inline telemetry */}
                      <text
                        x={x + 12}
                        y={y + h - 14}
                        fontSize="11"
                        fontWeight="500"
                        fill="#141A15"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {zone.soilMoisture}% SM · {zone.canopyTempC}°C
                      </text>

                      <text
                        x={x + w - 12}
                        y={y + h - 14}
                        textAnchor="end"
                        fontSize="10"
                        fontWeight="600"
                        fill={
                          zone.healthStatus === 'Alert'
                            ? '#B91C1C'
                            : zone.healthStatus === 'Monitor'
                              ? '#B45309'
                              : '#15803D'
                        }
                        fontFamily="DM Sans, sans-serif"
                      >
                        {zone.valveOpen ? 'Watering' : zone.healthStatus}
                      </text>
                    </g>
                  );
                })}

                {/* Autonomous Rover Marker */}
                <g
                  style={{
                    transform: `translate(${rover.posX}px, ${rover.posY}px)`,
                    transition: 'transform 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                >
                  <circle r="14" fill="#166534" fillOpacity="0.16" />
                  <circle r="8" fill="#166534" stroke="#FFFFFF" strokeWidth="2.5" />
                  <text
                    x="13"
                    y="4"
                    fontSize="10"
                    fontWeight="600"
                    fill="#141A15"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {rover.unitName}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3 text-xs text-[#556157]">
            <span>{rover.headingNote}</span>
            <div className="flex items-center gap-4">
              <span>Nominal</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#B45309] font-medium">Monitor</span>
              <span aria-hidden="true">·</span>
              <span className="text-[#B91C1C] font-medium">Pathology Alert</span>
            </div>
          </div>
        </div>

        {/* Selected Zone Inspector + Rover Field Visual */}
        <div className="lg:col-span-5 bg-white border border-[#E4E7E2] rounded-xl overflow-hidden flex flex-col justify-between">
          <div>
            <div className="relative h-48 bg-[#1B261E] overflow-hidden">
              {!heroImgFailed ? (
                <img
                  src={ROVER_HERO_IMAGE}
                  alt="PlantWise autonomous agricultural robot rover operating between irrigated crop rows"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-[#1F2E23] text-white/80 p-4">
                  <Sprout className="w-8 h-8 mb-2" />
                  <span className="text-xs font-medium">PlantWise Autonomous Field Unit</span>
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              <div className="absolute bottom-3.5 left-4 right-4 text-white">
                <p className="text-xs text-white/80 font-mono tabular-nums">
                  {selectedZone.code} · {selectedZone.areaHa} ha · Last scan {selectedZone.lastScannedAt}
                </p>
                <h3 className="mt-0.5 text-lg font-semibold leading-snug">
                  {selectedZone.name} — {selectedZone.crop}
                </h3>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between text-sm pb-3 border-b border-[#E4E7E2]">
                <span className="text-[#556157]">Health Assessment</span>
                <span className={statusTextClass(selectedZone.healthStatus)}>
                  {selectedZone.healthStatus}
                </span>
              </div>

              <p className="text-sm text-[#2A332C] leading-relaxed">
                {selectedZone.lastDiseaseNote}
              </p>

              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <p className="text-xs text-[#556157]">Soil Moisture</p>
                  <p className="mt-0.5 text-base font-semibold font-mono tabular-nums text-[#141A15]">
                    {selectedZone.soilMoisture}%
                  </p>
                  <p className="text-xs text-[#556157] font-mono tabular-nums">
                    Target {selectedZone.targetMoisture}%
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#556157]">Canopy / RH</p>
                  <p className="mt-0.5 text-base font-semibold font-mono tabular-nums text-[#141A15]">
                    {selectedZone.canopyTempC}°C
                  </p>
                  <p className="text-xs text-[#556157] font-mono tabular-nums">
                    {selectedZone.humidity}% humidity
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#556157]">Soil Chemistry</p>
                  <p className="mt-0.5 text-base font-semibold font-mono tabular-nums text-[#141A15]">
                    pH {selectedZone.soilPh}
                  </p>
                  <p className="text-xs text-[#556157] font-mono tabular-nums">
                    EC {selectedZone.ecMsCm} mS
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="px-5 pb-5 pt-3 border-t border-[#E4E7E2] flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('scanner', selectedZone.id)}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#166534] text-white text-xs font-medium hover:bg-[#14532D] transition-colors whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5" />
              Inspect Leaf Sample
            </button>
            <button
              type="button"
              onClick={() => onDispatchRover(selectedZone.id)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap"
            >
              <Navigation className="w-3.5 h-3.5 text-[#556157]" />
              Send Rover
            </button>
            <button
              type="button"
              onClick={() => onToggleValve(selectedZone.id)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap"
            >
              <Droplets className="w-3.5 h-3.5 text-[#0369A1]" />
              {selectedZone.valveOpen ? 'Stop Valve' : 'Water Now'}
            </button>
          </div>
        </div>
      </section>

      {/* High-Density Crop Zones Condition Table */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#141A15]">Field Zone Telemetry</h2>
            <p className="text-xs text-[#556157]">
              Real-time moisture, microclimate, pathology status, and drip valve state across all 6 blocks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('irrigation')}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#166534] hover:underline whitespace-nowrap shrink-0"
          >
            Manage Irrigation Rules
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4E7E2] bg-[#FAFBF9] text-xs font-medium text-[#556157]">
                <th className="py-3 px-6">Zone &amp; Crop</th>
                <th className="py-3 px-4">Health Status</th>
                <th className="py-3 px-4 text-right">Moisture / Target</th>
                <th className="py-3 px-4 text-right">Canopy / RH</th>
                <th className="py-3 px-4">Irrigation Valve</th>
                <th className="py-3 px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7E2] text-sm">
              {zones.map((zone) => (
                <tr
                  key={zone.id}
                  onClick={() => setSelectedZoneId(zone.id)}
                  className={`cursor-pointer transition-colors ${
                    zone.id === selectedZone?.id ? 'bg-[#F3F6F3]' : 'hover:bg-[#FAFBF9]'
                  }`}
                >
                  <td className="py-3.5 px-6">
                    <div className="font-medium text-[#141A15]">{zone.name}</div>
                    <div className="text-xs text-[#556157]">
                      {zone.code} · {zone.crop} · <span className="font-mono tabular-nums">{zone.areaHa} ha</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className={`text-xs ${statusTextClass(zone.healthStatus)}`}>
                      {zone.healthStatus}
                    </div>
                    <div className="text-xs text-[#556157] truncate max-w-[220px]">
                      {zone.lastDiseaseNote}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums">
                    <span className="font-medium text-[#141A15]">{zone.soilMoisture}%</span>
                    <span className="text-xs text-[#556157]"> / {zone.targetMoisture}%</span>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono tabular-nums text-[#2A332C]">
                    {zone.canopyTempC}°C · {zone.humidity}%
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    <div className={zone.valveOpen ? 'font-semibold text-[#0369A1]' : 'text-[#2A332C]'}>
                      {zone.valveOpen ? 'Open · Watering' : zone.valveMode}
                    </div>
                    <div className="text-[#556157]">{zone.scheduledWindow}</div>
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleValve(zone.id);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-white transition-colors whitespace-nowrap"
                    >
                      {zone.valveOpen ? 'Close Valve' : 'Water 15m'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
