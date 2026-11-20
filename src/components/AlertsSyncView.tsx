import React, { useState } from 'react';
import {
  Bell,
  Check,
  CloudOff,
  RefreshCw,
  Send,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { AlertItem, NotificationPrefs, OfflineOperation } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface AlertsSyncViewProps {
  alerts: AlertItem[];
  offlineQueue: OfflineOperation[];
  pendingSyncCount: number;
  isOnline: boolean;
  browserOnline: boolean;
  simulatedOffline: boolean;
  isSyncing: boolean;
  lastSyncedAt: string;
  notifPrefs: NotificationPrefs;
  notificationPermission: NotificationPermission | 'unsupported';
  onToggleSimulatedOffline: (next?: boolean) => void;
  onSyncNow: () => void;
  onAcknowledgeAlert: (alertId: string) => void;
  onRequestNotificationPermission: () => Promise<NotificationPermission | 'unsupported'>;
  onUpdateNotifPrefs: React.Dispatch<React.SetStateAction<NotificationPrefs>>;
  onTriggerTestPush: () => void;
}

export const AlertsSyncView: React.FC<AlertsSyncViewProps> = ({
  alerts,
  offlineQueue,
  pendingSyncCount,
  isOnline,
  browserOnline,
  simulatedOffline,
  isSyncing,
  lastSyncedAt,
  notifPrefs,
  notificationPermission,
  onToggleSimulatedOffline,
  onSyncNow,
  onAcknowledgeAlert,
  onRequestNotificationPermission,
  onUpdateNotifPrefs,
  onTriggerTestPush,
}) => {
  const [alertFilter, setAlertFilter] = useState<'All' | 'Unread' | 'Alert'>('All');

  const filteredAlerts = alerts.filter((a) => {
    if (alertFilter === 'Unread') return !a.acknowledged;
    if (alertFilter === 'Alert') return a.severity === 'Alert';
    return true;
  });

  const formattedLastSync = (() => {
    const d = new Date(lastSyncedAt);
    if (Number.isNaN(d.getTime())) return 'Recently';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  })();

  return (
    <div className="space-y-6">
      {/* Top Grid: Mobile Push Notifications (iOS & Android) + Offline Field Sync Engine */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Mobile Push Notifications & Cross-Platform PWA */}
        <div className="lg:col-span-6 bg-white border border-[#E4E7E2] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E4E7E2]">
              <div>
                <h2 className="text-base font-semibold text-[#141A15]">
                  Mobile Health Alerts (iOS &amp; Android)
                </h2>
                <p className="mt-0.5 text-xs text-[#556157]">
                  Receive instant push notifications when Rover 03 flags plant pathology or soil stress.
                </p>
              </div>
              <Smartphone className="w-5 h-5 text-[#166534] shrink-0" />
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-[#556157]">Device Push Permission</span>
                <span
                  className={
                    notificationPermission === 'granted'
                      ? 'text-[#15803D] font-semibold'
                      : notificationPermission === 'denied'
                        ? 'text-[#B91C1C] font-semibold'
                        : 'text-[#B45309] font-semibold'
                  }
                >
                  {notificationPermission === 'granted'
                    ? 'Authorized'
                    : notificationPermission === 'denied'
                      ? 'Blocked in Browser Settings'
                      : notificationPermission === 'unsupported'
                        ? 'Install to Home Screen for iOS Push'
                        : 'Not Yet Enabled'}
                </span>
              </div>

              <div className="space-y-3 pt-2 border-t border-[#E4E7E2]">
                <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
                  <span className="text-[#141A15] font-medium">
                    Instant Plant Disease Pathology Alerts
                  </span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.criticalDiseaseAlerts}
                    onChange={(e) =>
                      onUpdateNotifPrefs((p) => ({ ...p, criticalDiseaseAlerts: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#166534]"
                  />
                </label>

                <label className="flex items-center justify-between gap-3 text-xs cursor-pointer">
                  <span className="text-[#141A15] font-medium">
                    Weather Rain-Delay Savings Summary
                  </span>
                  <input
                    type="checkbox"
                    checked={notifPrefs.rainDelayDigest}
                    onChange={(e) =>
                      onUpdateNotifPrefs((p) => ({ ...p, rainDelayDigest: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#166534]"
                  />
                </label>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <label htmlFor="moisture-alert-threshold" className="text-[#141A15] font-medium">
                      Low Soil Moisture Alert Trigger
                    </label>
                    <span className="font-mono tabular-nums text-[#0369A1] font-semibold">
                      &lt; {notifPrefs.moistureThresholdPct}%
                    </span>
                  </div>
                  <input
                    id="moisture-alert-threshold"
                    type="range"
                    min={25}
                    max={60}
                    value={notifPrefs.moistureThresholdPct}
                    onChange={(e) =>
                      onUpdateNotifPrefs((p) => ({
                        ...p,
                        moistureThresholdPct: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-[#166534] cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#E4E7E2] flex flex-wrap items-center gap-2.5">
            {notificationPermission !== 'granted' && (
              <button
                type="button"
                onClick={onRequestNotificationPermission}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166534] text-white text-xs font-semibold hover:bg-[#14532D] transition-colors whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5" />
                Enable Push Alerts
              </button>
            )}
            <button
              type="button"
              onClick={onTriggerTestPush}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D4DDD5] bg-white text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap"
            >
              <Send className="w-3.5 h-3.5 text-[#166534]" />
              Send Test Alert
            </button>
            <PWAInstallButton compact showAlwaysInSettings />
          </div>
        </div>

        {/* Offline Sync & Connectivity Gap Resilience */}
        <div className="lg:col-span-6 bg-white border border-[#E4E7E2] rounded-xl p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E4E7E2]">
              <div>
                <h2 className="text-base font-semibold text-[#141A15]">
                  Offline Field Sync &amp; Local Cache
                </h2>
                <p className="mt-0.5 text-xs text-[#556157]">
                  Valve overrides and camera leaf scans persist locally during remote signal drops and sync automatically on reconnect.
                </p>
              </div>
              {isOnline ? (
                <Wifi className="w-5 h-5 text-[#15803D] shrink-0" />
              ) : (
                <WifiOff className="w-5 h-5 text-[#B45309] shrink-0" />
              )}
            </div>

            <div className="mt-4 grid grid-cols-3 gap-4 pb-4 border-b border-[#E4E7E2]">
              <div>
                <p className="text-xs text-[#556157]">Connection</p>
                <p
                  className={`mt-1 text-sm font-semibold ${
                    isOnline ? 'text-[#15803D]' : 'text-[#B45309]'
                  }`}
                >
                  {isOnline ? 'Connected' : 'Offline Mode'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#556157]">Pending Outbox</p>
                <p className="mt-1 text-sm font-semibold font-mono tabular-nums text-[#141A15]">
                  {pendingSyncCount} action{pendingSyncCount === 1 ? '' : 's'}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#556157]">Last Synced</p>
                <p className="mt-1 text-sm font-semibold font-mono tabular-nums text-[#141A15]">
                  {formattedLastSync}
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#141A15]">
                  Simulate Remote Connectivity Gap
                </p>
                <p className="text-xs text-[#556157]">
                  Test offline valve toggles and queued leaf scans without disconnecting your device.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={simulatedOffline}
                onClick={() => onToggleSimulatedOffline()}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  simulatedOffline ? 'bg-[#B45309]' : 'bg-[#D4DDD5]'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs transition-transform ${
                    simulatedOffline ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {!browserOnline && (
              <p className="mt-3 text-xs text-[#B45309] font-medium">
                Device network is currently offline — local cache is serving all field telemetry.
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-[#556157]">
              Service worker caches app shell, weather snapshots, and field logs locally.
            </span>
            <button
              type="button"
              onClick={onSyncNow}
              disabled={!isOnline || isSyncing}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166534] text-white text-xs font-semibold hover:bg-[#14532D] disabled:opacity-50 transition-colors whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      </section>

      {/* Active Alerts List */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-[#141A15]">Instant Field Health Alerts</h2>
            <p className="text-xs text-[#556157]">
              Pathology detections, moisture thresholds, and weather rain-delay notifications.
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#F1F4F1] rounded-lg">
            {(['All', 'Unread', 'Alert'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setAlertFilter(tab)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  alertFilter === tab
                    ? 'bg-white text-[#141A15] shadow-xs'
                    : 'text-[#556157] hover:text-[#141A15]'
                }`}
              >
                {tab === 'Alert' ? 'Critical' : tab}
              </button>
            ))}
          </div>
        </div>

        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#556157]">
            No alerts in this view. Send a test alert or analyze a leaf sample to verify notifications.
          </div>
        ) : (
          <div className="divide-y divide-[#E4E7E2]">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className="px-6 py-4 flex flex-wrap items-start justify-between gap-4 hover:bg-[#FAFBF9]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={
                        alert.severity === 'Alert'
                          ? 'text-[#B91C1C] font-semibold'
                          : alert.severity === 'Monitor'
                            ? 'text-[#B45309] font-semibold'
                            : 'text-[#0369A1] font-semibold'
                      }
                    >
                      {alert.severity === 'Alert' ? 'Critical Alert' : alert.severity}
                    </span>
                    <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                    <span className="text-[#556157]">{alert.category}</span>
                    <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                    <span className="text-[#556157]">{alert.zoneName}</span>
                    <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                    <span className="text-[#556157] font-mono tabular-nums">{alert.createdAt}</span>
                    {alert.pushSent && (
                      <>
                        <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                        <span className="text-[#15803D]">Push delivered</span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-[#141A15]">{alert.title}</h3>
                  <p className="mt-0.5 text-xs text-[#556157] leading-relaxed">{alert.message}</p>
                </div>

                <div className="shrink-0">
                  {alert.acknowledged ? (
                    <span className="inline-flex items-center gap-1 text-xs text-[#556157]">
                      <Check className="w-3.5 h-3.5 text-[#15803D]" />
                      Acknowledged
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAcknowledgeAlert(alert.id)}
                      className="px-3 py-1.5 rounded-lg border border-[#D4DDD5] bg-white text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sync Operation Log */}
      <section className="bg-white border border-[#E4E7E2] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E4E7E2]">
          <h2 className="text-base font-semibold text-[#141A15]">Offline Sync Activity Log</h2>
          <p className="text-xs text-[#556157]">
            Recent field commands queued offline or reconciled with the central server.
          </p>
        </div>

        {offlineQueue.length === 0 ? (
          <div className="p-8 text-center text-xs text-[#556157] flex flex-col items-center gap-2">
            <CloudOff className="w-5 h-5 text-[#9CA89E]" />
            <span>
              No field sync operations recorded yet. Toggle a valve or switch on Simulated Offline Mode to test local queuing.
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E4E7E2] bg-[#FAFBF9] text-xs font-medium text-[#556157]">
                  <th className="py-2.5 px-6">Time</th>
                  <th className="py-2.5 px-4">Operation</th>
                  <th className="py-2.5 px-4">Summary</th>
                  <th className="py-2.5 px-6 text-right">Sync State</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E4E7E2] text-xs">
                {offlineQueue.map((op) => (
                  <tr key={op.id}>
                    <td className="py-3 px-6 font-mono tabular-nums text-[#556157] whitespace-nowrap">
                      {op.createdAt}
                    </td>
                    <td className="py-3 px-4 font-medium text-[#141A15] whitespace-nowrap">
                      {op.type === 'VALVE_UPDATE'
                        ? 'Valve Control'
                        : op.type === 'IRRIGATION_RULE'
                          ? 'Irrigation Rule'
                          : op.type === 'QUEUED_DIAGNOSIS'
                            ? 'Leaf AI Scan'
                            : 'Alert Ack'}
                    </td>
                    <td className="py-3 px-4 text-[#2A332C]">{op.summary}</td>
                    <td className="py-3 px-6 text-right font-semibold whitespace-nowrap">
                      <span
                        className={
                          op.status === 'Synced'
                            ? 'text-[#15803D]'
                            : op.status === 'Pending'
                              ? 'text-[#B45309]'
                              : 'text-[#B91C1C]'
                        }
                      >
                        {op.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
