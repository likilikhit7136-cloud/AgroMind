import React, { useState } from 'react';
import {
  BarChart3,
  Bell,
  Camera,
  CloudRain,
  LayoutGrid,
  RefreshCw,
  Sprout,
  WifiOff,
} from 'lucide-react';
import { AlertsSyncView } from './components/AlertsSyncView';
import { AnalyticsView } from './components/AnalyticsView';
import { DiseaseScannerView } from './components/DiseaseScannerView';
import { IrrigationWeatherView } from './components/IrrigationWeatherView';
import { OverviewView } from './components/OverviewView';
import { PWAInstallButton } from './components/PWAInstallButton';
import { useFarmStore } from './hooks/useFarmStore';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import type { ActiveTab } from './types';

const NAV_ITEMS: { id: ActiveTab; label: string; shortLabel: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Field Overview', shortLabel: 'Overview', icon: LayoutGrid },
  { id: 'scanner', label: 'Disease Vision', shortLabel: 'Scan AI', icon: Camera },
  { id: 'irrigation', label: 'Irrigation & Weather', shortLabel: 'Water', icon: CloudRain },
  { id: 'analytics', label: 'Yield Analytics', shortLabel: 'Yields', icon: BarChart3 },
  { id: 'alerts', label: 'Alerts & Sync', shortLabel: 'Alerts', icon: Bell },
];

const TAB_TITLES: Record<ActiveTab, { breadcrumb: string; title: string }> = {
  overview: {
    breadcrumb: 'PlantWise / Operations',
    title: 'Field Operations & Autonomous Patrol',
  },
  scanner: {
    breadcrumb: 'PlantWise / Plant Pathology',
    title: 'AI Leaf Disease Vision Lab',
  },
  irrigation: {
    breadcrumb: 'PlantWise / Water Control',
    title: 'Weather-Adaptive Precision Irrigation',
  },
  analytics: {
    breadcrumb: 'PlantWise / Performance',
    title: 'Historical Yield & Water Efficiency',
  },
  alerts: {
    breadcrumb: 'PlantWise / Mobile & Connectivity',
    title: 'Mobile Health Alerts & Offline Sync',
  },
};

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [scannerTargetZoneId, setScannerTargetZoneId] = useState<string | undefined>(undefined);

  const { isOnline, browserOnline, simulatedOffline, toggleSimulatedOffline } = useOnlineStatus();
  const store = useFarmStore(isOnline);

  const handleNavigate = (tab: ActiveTab, zoneId?: string) => {
    if (tab === 'scanner' && zoneId) {
      setScannerTargetZoneId(zoneId);
    }
    setActiveTab(tab);
  };

  const currentMeta = TAB_TITLES[activeTab];

  return (
    <div className="min-h-screen bg-[#F7F8F6] text-[#141A15] flex">
      {/* Desktop Sidebar Navigation (248px) */}
      <aside className="hidden md:flex md:flex-col md:w-62 md:shrink-0 border-r border-[#E4E7E2] bg-white sticky top-0 h-screen">
        <div className="px-6 h-16 flex items-center gap-2.5 border-b border-[#E4E7E2]">
          <div className="w-8 h-8 rounded-lg bg-[#166534] flex items-center justify-center shrink-0">
            <Sprout className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-[#141A15] whitespace-nowrap">
            PlantWise
          </span>
        </div>

        <nav aria-label="Primary workspace navigation" className="flex-1 p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            const badgeCount =
              item.id === 'alerts'
                ? store.unreadAlertsCount + store.pendingSyncCount
                : 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166534] ${
                  isActive
                    ? 'bg-[#EEF5F0] text-[#166534]'
                    : 'text-[#556157] hover:bg-[#F7F8F6] hover:text-[#141A15]'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#166534]' : 'text-[#7A867C]'}`} />
                  <span className="truncate">{item.label}</span>
                </span>
                {badgeCount > 0 && (
                  <span className="font-mono tabular-nums text-xs font-semibold text-[#B91C1C]">
                    {badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quiet Sidebar Connectivity & Install Footer */}
        <div className="p-4 border-t border-[#E4E7E2] space-y-3">
          <div className="text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[#556157]">Field Link</span>
              <span className={isOnline ? 'text-[#15803D] font-medium' : 'text-[#B45309] font-semibold'}>
                {isOnline ? 'Online' : 'Offline Cache'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#556157]">Sync Outbox</span>
              <span className="font-mono tabular-nums text-[#141A15]">
                {store.pendingSyncCount} pending
              </span>
            </div>
          </div>

          <PWAInstallButton compact />
        </div>
      </aside>

      {/* Main Content Shell */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {/* Clean Single-Row Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/95 backdrop-blur-xs border-b border-[#E4E7E2] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-[#556157] truncate">
              {currentMeta.breadcrumb}
            </p>
            <h1 className="text-base sm:text-lg font-bold tracking-tight text-[#141A15] truncate">
              {currentMeta.title}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="md:hidden">
              <PWAInstallButton compact />
            </div>

            {activeTab !== 'scanner' ? (
              <button
                type="button"
                onClick={() => setActiveTab('scanner')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166534] text-white text-xs font-semibold hover:bg-[#14532D] transition-colors whitespace-nowrap shrink-0"
              >
                <Camera className="w-3.5 h-3.5" />
                Scan Leaf
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setActiveTab('irrigation')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4DDD5] bg-white text-[#141A15] text-xs font-semibold hover:bg-[#F1F4F1] transition-colors whitespace-nowrap shrink-0"
              >
                <CloudRain className="w-3.5 h-3.5 text-[#0369A1]" />
                Irrigation Rules
              </button>
            )}
          </div>
        </header>

        {/* Non-Intrusive Offline Connectivity Banner (only when offline or syncing) */}
        {!isOnline && (
          <div className="bg-[#FFFBEB] border-b border-[#FDE68A] px-4 sm:px-6 lg:px-8 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-[#92400E]">
            <div className="flex items-center gap-2">
              <WifiOff className="w-4 h-4 shrink-0" />
              <span>
                <strong>Offline Field Mode</strong> — Cached telemetry active.{' '}
                <span className="font-mono tabular-nums">{store.pendingSyncCount}</span> queued operation
                {store.pendingSyncCount === 1 ? '' : 's'} will sync automatically on reconnect.
              </span>
            </div>
            {simulatedOffline && browserOnline && (
              <button
                type="button"
                onClick={() => toggleSimulatedOffline(false)}
                className="font-semibold underline hover:text-[#78350F] whitespace-nowrap"
              >
                Reconnect Now
              </button>
            )}
          </div>
        )}

        {isOnline && store.isSyncing && (
          <div className="bg-[#EEF5F0] border-b border-[#BBF7D0] px-4 sm:px-6 lg:px-8 py-2 flex items-center gap-2 text-xs text-[#166534] font-medium">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Reconciling offline field queue with server...
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 w-full max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {activeTab === 'overview' && (
            <OverviewView
              zones={store.zones}
              rover={store.rover}
              weather={store.weather}
              unreadAlertsCount={store.unreadAlertsCount}
              onTogglePatrol={store.toggleRoverPatrol}
              onDispatchRover={store.dispatchRoverToZone}
              onToggleValve={store.toggleZoneValve}
              onNavigate={handleNavigate}
            />
          )}

          {activeTab === 'scanner' && (
            <DiseaseScannerView
              zones={store.zones}
              scans={store.scans}
              trainingSamples={store.trainingSamples}
              isOnline={isOnline}
              initialZoneId={scannerTargetZoneId}
              onRunDiagnosis={store.runLeafDiagnosis}
              onApplyIrrigation={store.applyDiagnosisToIrrigation}
              onAddTrainingSamples={store.addTrainingSamples}
              onUpdateTrainingSample={store.updateTrainingSample}
              onDeleteTrainingSample={store.deleteTrainingSample}
            />
          )}

          {activeTab === 'irrigation' && (
            <IrrigationWeatherView
              zones={store.zones}
              weather={store.weather}
              weatherLoading={store.weatherLoading}
              weatherError={store.weatherError}
              selectedLocation={store.selectedLocation}
              irrigationConfig={store.irrigationConfig}
              isOnline={isOnline}
              onSelectLocation={store.setSelectedLocationId}
              onRefreshWeather={() => store.refreshWeather()}
              onUpdateGlobalConfig={store.updateGlobalIrrigationConfig}
              onToggleValve={store.toggleZoneValve}
              onUpdateTargetMoisture={store.updateZoneTargetMoisture}
              onUpdateZoneMode={store.updateZoneMode}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView />}

          {activeTab === 'alerts' && (
            <AlertsSyncView
              alerts={store.alerts}
              offlineQueue={store.offlineQueue}
              pendingSyncCount={store.pendingSyncCount}
              isOnline={isOnline}
              browserOnline={browserOnline}
              simulatedOffline={simulatedOffline}
              isSyncing={store.isSyncing}
              lastSyncedAt={store.lastSyncedAt}
              notifPrefs={store.notifPrefs}
              notificationPermission={store.notificationPermission}
              onToggleSimulatedOffline={toggleSimulatedOffline}
              onSyncNow={store.syncPendingOperations}
              onAcknowledgeAlert={store.acknowledgeAlert}
              onRequestNotificationPermission={store.requestNotificationPermission}
              onUpdateNotifPrefs={store.setNotifPrefs}
              onTriggerTestPush={store.triggerTestPushAlert}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar (Compact, >= 44px touch targets, <= 15% mobile height) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#E4E7E2] grid grid-cols-5 h-16 px-1"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 min-h-[44px] text-[11px] font-medium transition-colors ${
                isActive ? 'text-[#166534]' : 'text-[#556157]'
              }`}
            >
              <Icon className="w-4.5 h-4.5" />
              <span className="whitespace-nowrap">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
