import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Download } from 'lucide-react';
import { HISTORICAL_YIELD_DATA } from '../data/farmSeed';

const CROPS = [
  'All Crops',
  'Roma Tomatoes',
  'Sweet Bell Peppers',
  'Buttercup Squash',
  'Pinot Noir Grapes',
] as const;

const SEASONS = ['All Seasons', '2023', '2024', '2025', '2026'] as const;

export const AnalyticsView: React.FC = () => {
  const [cropFilter, setCropFilter] = useState<(typeof CROPS)[number]>('All Crops');
  const [seasonFilter, setSeasonFilter] = useState<(typeof SEASONS)[number]>('All Seasons');

  const filteredData = useMemo(() => {
    return HISTORICAL_YIELD_DATA.filter((row) => {
      const matchCrop = cropFilter === 'All Crops' || row.crop === cropFilter;
      const matchSeason = seasonFilter === 'All Seasons' || String(row.season) === seasonFilter;
      return matchCrop && matchSeason;
    });
  }, [cropFilter, seasonFilter]);

  // Aggregate by season for multi-year overview when All Crops is selected
  const chartSeries = useMemo(() => {
    if (cropFilter !== 'All Crops') {
      return filteredData.map((d) => ({
        label: String(d.season),
        yieldTonsHa: d.yieldTonsHa,
        baselineYieldTonsHa: d.baselineYieldTonsHa,
        waterM3Ha: d.waterM3Ha,
        earlyDetections: d.earlyDetections,
        preventedLossPct: d.preventedLossPct,
      }));
    }
    const seasons = Array.from(new Set(filteredData.map((d) => d.season))).sort();
    return seasons.map((season) => {
      const rows = filteredData.filter((d) => d.season === season);
      const count = Math.max(1, rows.length);
      return {
        label: String(season),
        yieldTonsHa: Math.round((rows.reduce((s, r) => s + r.yieldTonsHa, 0) / count) * 10) / 10,
        baselineYieldTonsHa:
          Math.round((rows.reduce((s, r) => s + r.baselineYieldTonsHa, 0) / count) * 10) / 10,
        waterM3Ha: Math.round(rows.reduce((s, r) => s + r.waterM3Ha, 0) / count),
        earlyDetections: rows.reduce((s, r) => s + r.earlyDetections, 0),
        preventedLossPct:
          Math.round((rows.reduce((s, r) => s + r.preventedLossPct, 0) / count) * 10) / 10,
      };
    });
  }, [filteredData, cropFilter]);

  const summary = useMemo(() => {
    if (filteredData.length === 0) {
      return {
        avgYield: 0,
        yieldLiftPct: 0,
        waterReductionPct: 0,
        totalDetections: 0,
      };
    }
    const avgYield =
      filteredData.reduce((s, r) => s + r.yieldTonsHa, 0) / filteredData.length;
    const avgBaseYield =
      filteredData.reduce((s, r) => s + r.baselineYieldTonsHa, 0) / filteredData.length;
    const avgWater =
      filteredData.reduce((s, r) => s + r.waterM3Ha, 0) / filteredData.length;
    const avgBaseWater =
      filteredData.reduce((s, r) => s + r.baselineWaterM3Ha, 0) / filteredData.length;
    const totalDetections = filteredData.reduce((s, r) => s + r.earlyDetections, 0);

    return {
      avgYield: Math.round(avgYield * 10) / 10,
      yieldLiftPct: Math.round(((avgYield - avgBaseYield) / Math.max(0.1, avgBaseYield)) * 1000) / 10,
      waterReductionPct: Math.round(((avgBaseWater - avgWater) / Math.max(1, avgBaseWater)) * 1000) / 10,
      totalDetections,
    };
  }, [filteredData]);

  const handleExportCsv = () => {
    const headers = [
      'Period',
      'Season',
      'Crop',
      'Yield (tons/ha)',
      'Baseline Yield (tons/ha)',
      'Water Used (m3/ha)',
      'Baseline Water (m3/ha)',
      'Early Disease Detections',
      'Prevented Crop Loss (%)',
    ];
    const rows = filteredData.map((r) =>
      [
        r.period,
        r.season,
        r.crop,
        r.yieldTonsHa,
        r.baselineYieldTonsHa,
        r.waterM3Ha,
        r.baselineWaterM3Ha,
        r.earlyDetections,
        r.preventedLossPct,
      ].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `plantwise-yield-analytics-${seasonFilter.toLowerCase().replace(/\s+/g, '-')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Filter Toolbar */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#F1F4F1] rounded-lg overflow-x-auto max-w-full">
            {CROPS.map((crop) => (
              <button
                key={crop}
                type="button"
                onClick={() => setCropFilter(crop)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  cropFilter === crop
                    ? 'bg-white text-[#141A15] shadow-xs'
                    : 'text-[#556157] hover:text-[#141A15]'
                }`}
              >
                {crop}
              </button>
            ))}
          </div>

          <select
            aria-label="Filter season"
            value={seasonFilter}
            onChange={(e) => setSeasonFilter(e.target.value as (typeof SEASONS)[number])}
            className="rounded-lg border border-[#D4DDD5] bg-white px-3 py-2 text-xs font-medium text-[#141A15] focus:outline-none focus:border-[#166534]"
          >
            {SEASONS.map((s) => (
              <option key={s} value={s}>
                {s === 'All Seasons' ? 'All Seasons (2023–2026)' : `Season ${s}`}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4DDD5] bg-white text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-[#166534]" />
          Download CSV
        </button>
      </section>

      {/* Summary KPIs */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">Mean Crop Yield</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#141A15]">
            {summary.avgYield} <span className="text-sm font-normal text-[#556157]">t/ha</span>
          </p>
          <p className="mt-1.5 text-xs text-[#15803D] font-medium font-mono tabular-nums">
            +{summary.yieldLiftPct}% vs pre-robot baseline
          </p>
        </div>

        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">Irrigation Water Saved</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0369A1]">
            -{summary.waterReductionPct}%
          </p>
          <p className="mt-1.5 text-xs text-[#556157]">
            Weather &amp; ET₀ drip optimization
          </p>
        </div>

        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">Early Pathology Catches</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#141A15]">
            {summary.totalDetections}
          </p>
          <p className="mt-1.5 text-xs text-[#556157]">
            Identified prior to visible canopy loss
          </p>
        </div>

        <div className="bg-white border border-[#E4E7E2] rounded-xl p-5">
          <p className="text-xs font-medium text-[#556157]">Water Productivity Gain</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#15803D]">
            +41.6%
          </p>
          <p className="mt-1.5 text-xs text-[#556157]">
            Harvested kilograms per cubic meter
          </p>
        </div>
      </section>

      {/* Dual Charts Grid */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white border border-[#E4E7E2] rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#141A15]">
              Historical Yield vs. Irrigation Water Usage
            </h2>
            <p className="text-xs text-[#556157]">
              Multi-season output (tons/ha) plotted against water volume applied (m³/ha).
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7E2" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#556157' }}
                  axisLine={{ stroke: '#E4E7E2' }}
                  tickLine={false}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: '#556157' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 't/ha', angle: -90, position: 'insideLeft', style: { fontSize: 11, fill: '#556157' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: '#0369A1' }}
                  axisLine={false}
                  tickLine={false}
                  label={{ value: 'm³/ha', angle: 90, position: 'insideRight', style: { fontSize: 11, fill: '#0369A1' } }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E4E7E2',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  yAxisId="left"
                  dataKey="yieldTonsHa"
                  name="Smart Rover Yield (t/ha)"
                  fill="#166534"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                />
                <Bar
                  yAxisId="left"
                  dataKey="baselineYieldTonsHa"
                  name="Pre-Automation Baseline (t/ha)"
                  fill="#CBD5E1"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={44}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="waterM3Ha"
                  name="Water Used (m³/ha)"
                  stroke="#0369A1"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0369A1' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-[#E4E7E2] rounded-xl p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-[#141A15]">
              Early Disease Detection Impact
            </h2>
            <p className="text-xs text-[#556157]">
              Annual pathology catches and estimated crop loss prevented (%).
            </p>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartSeries} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E4E7E2" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: '#556157' }}
                  axisLine={{ stroke: '#E4E7E2' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#556157' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#FFFFFF',
                    borderColor: '#E4E7E2',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar
                  dataKey="earlyDetections"
                  name="Early Detections"
                  fill="#15803D"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="preventedLossPct"
                  name="Prevented Loss (%)"
                  fill="#B45309"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* Historical Yield Ledger Table */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E7E2]">
          <h2 className="text-base font-semibold text-[#141A15]">Season Yield &amp; Water Ledger</h2>
          <p className="text-xs text-[#556157]">
            Verified harvest records comparing PlantWise autonomous scouting &amp; drip control against historical farm baselines.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E4E7E2] bg-[#FAFBF9] text-xs font-medium text-[#556157]">
                <th className="py-3 px-6">Period</th>
                <th className="py-3 px-4">Crop Variety</th>
                <th className="py-3 px-4 text-right">Yield (t/ha)</th>
                <th className="py-3 px-4 text-right">Baseline (t/ha)</th>
                <th className="py-3 px-4 text-right">Water (m³/ha)</th>
                <th className="py-3 px-4 text-right">Early Detections</th>
                <th className="py-3 px-6 text-right">Prevented Loss</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E7E2] text-sm">
              {filteredData.map((row) => (
                <tr key={`${row.period}-${row.crop}`} className="hover:bg-[#FAFBF9]">
                  <td className="py-3 px-6 font-mono tabular-nums text-xs font-medium text-[#141A15]">
                    {row.period}
                  </td>
                  <td className="py-3 px-4 text-[#141A15] font-medium">{row.crop}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#15803D]">
                    {row.yieldTonsHa.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#556157]">
                    {row.baselineYieldTonsHa.toFixed(1)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#0369A1]">
                    {row.waterM3Ha.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-[#141A15]">
                    {row.earlyDetections}
                  </td>
                  <td className="py-3 px-6 text-right font-mono tabular-nums text-[#B45309] font-medium">
                    +{row.preventedLossPct.toFixed(1)}%
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
