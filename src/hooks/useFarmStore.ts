import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FALLBACK_WEATHER,
  FARM_LOCATIONS,
  INITIAL_ALERTS,
  INITIAL_ROVER,
  INITIAL_SCANS,
  INITIAL_TRAINING_SAMPLES,
  INITIAL_ZONES,
} from '../data/farmSeed';
import type {
  AlertItem,
  DiagnosisResult,
  FarmLocation,
  FieldZone,
  IrrigationGlobalConfig,
  NotificationPrefs,
  OfflineOperation,
  RoverState,
  ScanRecord,
  TrainingSample,
  ValveMode,
  WeatherData,
} from '../types';

const STORAGE_KEYS = {
  zones: 'plantwise_zones_v1',
  scans: 'plantwise_scans_v1',
  alerts: 'plantwise_alerts_v1',
  queue: 'plantwise_offline_queue_v1',
  weather: 'plantwise_weather_cache_v1',
  locationId: 'plantwise_location_id_v1',
  irrigationConfig: 'plantwise_irrigation_cfg_v1',
  notifPrefs: 'plantwise_notif_prefs_v1',
  lastSync: 'plantwise_last_sync_v1',
  trainingSamples: 'plantwise_training_samples_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Handle storage full gracefully
  }
}

export function useFarmStore(isOnline: boolean) {
  const [zones, setZones] = useState<FieldZone[]>(() => readStorage(STORAGE_KEYS.zones, INITIAL_ZONES));
  const [rover, setRover] = useState<RoverState>(INITIAL_ROVER);
  const [scans, setScans] = useState<ScanRecord[]>(() => readStorage(STORAGE_KEYS.scans, INITIAL_SCANS));
  const [trainingSamples, setTrainingSamples] = useState<TrainingSample[]>(() =>
    readStorage(STORAGE_KEYS.trainingSamples, INITIAL_TRAINING_SAMPLES)
  );
  const [alerts, setAlerts] = useState<AlertItem[]>(() => readStorage(STORAGE_KEYS.alerts, INITIAL_ALERTS));
  const [offlineQueue, setOfflineQueue] = useState<OfflineOperation[]>(() =>
    readStorage(STORAGE_KEYS.queue, [])
  );
  const [selectedLocationId, setSelectedLocationId] = useState<string>(() =>
    readStorage(STORAGE_KEYS.locationId, FARM_LOCATIONS[0].id)
  );
  const [weather, setWeather] = useState<WeatherData>(() =>
    readStorage(STORAGE_KEYS.weather, FALLBACK_WEATHER)
  );
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  const [irrigationConfig, setIrrigationConfig] = useState<IrrigationGlobalConfig>(() =>
    readStorage(STORAGE_KEYS.irrigationConfig, {
      rainSkipThresholdPct: 60,
      autoRainDelayEnabled: true,
      et0AdaptiveScaling: true,
    })
  );
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(() =>
    readStorage(STORAGE_KEYS.notifPrefs, {
      enabled: typeof Notification !== 'undefined' && Notification.permission === 'granted',
      criticalDiseaseAlerts: true,
      moistureThresholdPct: 45,
      rainDelayDigest: true,
    })
  );
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | 'unsupported'>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );
  const [lastSyncedAt, setLastSyncedAt] = useState<string>(() =>
    readStorage(STORAGE_KEYS.lastSync, new Date().toISOString())
  );
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedLocation: FarmLocation =
    FARM_LOCATIONS.find((l) => l.id === selectedLocationId) ?? FARM_LOCATIONS[0];

  // Persist local-first state to localStorage
  useEffect(() => writeStorage(STORAGE_KEYS.zones, zones), [zones]);
  useEffect(() => writeStorage(STORAGE_KEYS.scans, scans), [scans]);
  useEffect(() => writeStorage(STORAGE_KEYS.alerts, alerts), [alerts]);
  useEffect(() => writeStorage(STORAGE_KEYS.queue, offlineQueue), [offlineQueue]);
  useEffect(() => writeStorage(STORAGE_KEYS.weather, weather), [weather]);
  useEffect(() => writeStorage(STORAGE_KEYS.locationId, selectedLocationId), [selectedLocationId]);
  useEffect(() => writeStorage(STORAGE_KEYS.irrigationConfig, irrigationConfig), [irrigationConfig]);
  useEffect(() => writeStorage(STORAGE_KEYS.notifPrefs, notifPrefs), [notifPrefs]);
  useEffect(() => writeStorage(STORAGE_KEYS.lastSync, lastSyncedAt), [lastSyncedAt]);

  // Browser push notification helper
  const fireDeviceNotification = useCallback(
    (title: string, body: string): boolean => {
      if (typeof Notification === 'undefined') return false;
      if (Notification.permission === 'granted' && notifPrefs.enabled) {
        try {
          new Notification(title, {
            body,
            icon: '/pwa-192x192.png',
            badge: '/pwa-192x192.png',
          });
          return true;
        } catch {
          return false;
        }
      }
      return false;
    },
    [notifPrefs.enabled]
  );

  const requestNotificationPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') {
      setNotificationPermission('unsupported');
      return 'unsupported' as const;
    }
    const result = await Notification.requestPermission();
    setNotificationPermission(result);
    if (result === 'granted') {
      setNotifPrefs((prev) => ({ ...prev, enabled: true }));
    }
    return result;
  }, []);

  const addAlert = useCallback(
    (alertInput: Omit<AlertItem, 'id' | 'createdAt' | 'acknowledged' | 'pushSent'>) => {
      const pushed = fireDeviceNotification(alertInput.title, alertInput.message);
      const next: AlertItem = {
        ...alertInput,
        id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        createdAt: 'Just now',
        acknowledged: false,
        pushSent: pushed,
      };
      setAlerts((prev) => [next, ...prev]);
      return next;
    },
    [fireDeviceNotification]
  );

  const enqueueOperation = useCallback(
    (
      type: OfflineOperation['type'],
      summary: string,
      payload: Record<string, unknown>,
      immediateOnline: boolean
    ) => {
      const op: OfflineOperation = {
        id: `op-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        type,
        summary,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: immediateOnline ? 'Synced' : 'Pending',
        payload,
      };
      setOfflineQueue((prev) => [op, ...prev.slice(0, 29)]);
      if (immediateOnline) {
        setLastSyncedAt(new Date().toISOString());
      }
      return op;
    },
    []
  );

  // Fetch live weather from server Open-Meteo proxy
  const refreshWeather = useCallback(
    async (loc: FarmLocation = selectedLocation) => {
      if (!isOnline) {
        setWeatherError('Offline mode active — displaying cached field station forecast.');
        return;
      }
      setWeatherLoading(true);
      setWeatherError(null);
      try {
        const params = new URLSearchParams({
          lat: String(loc.lat),
          lon: String(loc.lon),
          name: loc.name,
        });
        const res = await fetch(`/api/weather?${params.toString()}`);
        if (!res.ok) {
          throw new Error('Weather service unavailable');
        }
        const data = (await res.json()) as WeatherData;
        setWeather(data);
        setLastSyncedAt(new Date().toISOString());
      } catch {
        setWeatherError('Live weather unreachable — showing last cached forecast.');
      } finally {
        setWeatherLoading(false);
      }
    },
    [isOnline, selectedLocation]
  );

  useEffect(() => {
    refreshWeather(selectedLocation);
  }, [selectedLocation, refreshWeather]);

  // Live rover patrol movement & gradual soil moisture dynamics
  useEffect(() => {
    if (!rover.isPatrolling) return;
    const interval = setInterval(() => {
      setZones((currentZones) => {
        // Slightly update soil moisture if a valve is actively watering
        return currentZones.map((z) => {
          if (z.valveOpen) {
            const nextMoisture = Math.min(82, Math.round((z.soilMoisture + 0.4) * 10) / 10);
            return {
              ...z,
              soilMoisture: nextMoisture,
              dailyWaterLiters: z.dailyWaterLiters + Math.round(z.flowRateLpm / 12),
            };
          }
          return z;
        });
      });

      setRover((prev) => {
        const activeZone = zones.find((z) => z.id === prev.activeZoneId) ?? zones[0];
        if (!activeZone) return prev;
        const { x, y, w, h } = activeZone.mapCoords;
        const minX = x + 22;
        const maxX = x + w - 22;
        const minY = y + 36;
        const maxY = y + h - 22;

        let nextX = prev.posX + 18;
        let nextY = prev.posY;
        if (nextX > maxX) {
          nextX = minX;
          nextY = prev.posY + 22;
        }
        if (nextY > maxY) {
          // Move to next zone in patrol loop
          const idx = zones.findIndex((z) => z.id === activeZone.id);
          const nextZone = zones[(idx + 1) % zones.length];
          return {
            ...prev,
            activeZoneId: nextZone.id,
            posX: nextZone.mapCoords.x + 28,
            posY: nextZone.mapCoords.y + 44,
            scansToday: prev.scansToday + 1,
            batteryPct: Math.max(24, prev.batteryPct - (prev.scansToday % 8 === 0 ? 1 : 0)),
            headingNote: `Scanning canopy rows in ${nextZone.name}`,
          };
        }

        return {
          ...prev,
          posX: Math.max(minX, Math.min(maxX, nextX)),
          posY: Math.max(minY, Math.min(maxY, nextY)),
        };
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [rover.isPatrolling, zones]);

  // Rover controls
  const toggleRoverPatrol = useCallback(() => {
    setRover((prev) => ({
      ...prev,
      isPatrolling: !prev.isPatrolling,
      speedMs: !prev.isPatrolling ? 1.2 : 0,
      headingNote: !prev.isPatrolling
        ? `Resumed autonomous scan in ${zones.find((z) => z.id === prev.activeZoneId)?.name ?? 'field'}`
        : 'Rover paused at current row waypoint',
    }));
  }, [zones]);

  const dispatchRoverToZone = useCallback(
    (zoneId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      setRover((prev) => ({
        ...prev,
        activeZoneId: target.id,
        isPatrolling: true,
        speedMs: 1.4,
        posX: target.mapCoords.x + Math.round(target.mapCoords.w / 2),
        posY: target.mapCoords.y + Math.round(target.mapCoords.h / 2) + 8,
        headingNote: `Dispatched to ${target.name} for optical inspection`,
      }));
    },
    [zones]
  );

  // Irrigation controls (work seamlessly offline & queue sync)
  const toggleZoneValve = useCallback(
    (zoneId: string) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      const nextOpen = !target.valveOpen;

      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? {
                ...z,
                valveOpen: nextOpen,
                valveMode: nextOpen ? 'Manual' : z.valveMode === 'Manual' ? 'Auto' : z.valveMode,
                scheduledWindow: nextOpen ? 'Active now · 15m override' : '06:00 – 06:40',
              }
            : z
        )
      );

      enqueueOperation(
        'VALVE_UPDATE',
        `${nextOpen ? 'Opened' : 'Closed'} drip valve in ${target.name}`,
        { zoneId, valveOpen: nextOpen },
        isOnline
      );
    },
    [zones, enqueueOperation, isOnline]
  );

  const updateZoneTargetMoisture = useCallback(
    (zoneId: string, targetMoisture: number) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      setZones((prev) =>
        prev.map((z) => (z.id === zoneId ? { ...z, targetMoisture } : z))
      );
      enqueueOperation(
        'IRRIGATION_RULE',
        `Set moisture setpoint to ${targetMoisture}% in ${target.name}`,
        { zoneId, targetMoisture },
        isOnline
      );
    },
    [zones, enqueueOperation, isOnline]
  );

  const updateZoneMode = useCallback(
    (zoneId: string, valveMode: ValveMode) => {
      const target = zones.find((z) => z.id === zoneId);
      if (!target) return;
      setZones((prev) =>
        prev.map((z) =>
          z.id === zoneId
            ? {
                ...z,
                valveMode,
                valveOpen: valveMode === 'Rain-Paused' ? false : z.valveOpen,
                scheduledWindow:
                  valveMode === 'Rain-Paused'
                    ? 'Deferred · Rain forecast'
                    : valveMode === 'Manual'
                      ? 'Manual control active'
                      : '06:00 – 06:40',
              }
            : z
        )
      );
      enqueueOperation(
        'IRRIGATION_RULE',
        `Changed ${target.name} irrigation mode to ${valveMode}`,
        { zoneId, valveMode },
        isOnline
      );
    },
    [zones, enqueueOperation, isOnline]
  );

  const updateGlobalIrrigationConfig = useCallback(
    (patch: Partial<IrrigationGlobalConfig>) => {
      setIrrigationConfig((prev) => {
        const next = { ...prev, ...patch };
        // Apply rain delay automatically to zones when next 48h rain probability exceeds threshold
        const upcomingRainProb = Math.max(
          weather.forecast[0]?.precipProb ?? 0,
          weather.forecast[1]?.precipProb ?? 0
        );
        if (next.autoRainDelayEnabled && upcomingRainProb >= next.rainSkipThresholdPct) {
          setZones((zPrev) =>
            zPrev.map((z) =>
              z.valveMode === 'Auto' && z.soilMoisture >= z.targetMoisture - 6
                ? {
                    ...z,
                    valveMode: 'Rain-Paused',
                    valveOpen: false,
                    scheduledWindow: `Deferred · ${upcomingRainProb}% rain`,
                  }
                : z
            )
          );
        } else if (!next.autoRainDelayEnabled) {
          setZones((zPrev) =>
            zPrev.map((z) =>
              z.valveMode === 'Rain-Paused'
                ? { ...z, valveMode: 'Auto', scheduledWindow: '06:00 – 06:40' }
                : z
            )
          );
        }
        return next;
      });

      enqueueOperation(
        'IRRIGATION_RULE',
        'Updated global weather-adaptive irrigation rules',
        patch as Record<string, unknown>,
        isOnline
      );
    },
    [weather.forecast, enqueueOperation, isOnline]
  );

  // Real AI Plant Pathology Diagnosis (or queue offline)
  const runLeafDiagnosis = useCallback(
    async (params: {
      imageBase64: string;
      previewUrl: string;
      mimeType: string;
      zoneId: string;
      source: ScanRecord['source'];
    }): Promise<{ queued?: boolean; scan?: ScanRecord; error?: string }> => {
      const zone = zones.find((z) => z.id === params.zoneId) ?? zones[0];
      const weatherSummary = `${weather.current.condition}, ${weather.current.tempC}°C, ${weather.current.humidity}% RH`;

      if (!isOnline) {
        enqueueOperation(
          'QUEUED_DIAGNOSIS',
          `Queued leaf scan for ${zone.name} (${zone.crop}) — will run AI analysis when online`,
          {
            imageBase64: params.imageBase64,
            previewUrl: params.previewUrl,
            mimeType: params.mimeType,
            zoneId: zone.id,
            source: params.source,
          },
          false
        );
        return { queued: true };
      }

      try {
        const res = await fetch('/api/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: params.imageBase64,
            mimeType: params.mimeType,
            cropType: zone.crop,
            zoneName: zone.name,
            moisture: zone.soilMoisture,
            humidity: zone.humidity,
            weatherSummary,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          return { error: data?.error || `Diagnosis failed (HTTP ${res.status})` };
        }

        const diagnosis = data as DiagnosisResult;
        const newScan: ScanRecord = {
          id: `scan-${Date.now()}`,
          zoneId: zone.id,
          zoneName: zone.name,
          crop: zone.crop,
          imageUrl: params.previewUrl,
          capturedAt: 'Just now',
          source: params.source,
          diagnosis,
          appliedToIrrigation: false,
        };

        setScans((prev) => [newScan, ...prev]);
        setRover((prev) => ({ ...prev, scansToday: prev.scansToday + 1 }));
        setZones((prev) =>
          prev.map((z) =>
            z.id === zone.id
              ? {
                  ...z,
                  healthStatus: diagnosis.status,
                  lastDiseaseNote: `${diagnosis.diseaseName} (${diagnosis.confidence}% conf.)`,
                  lastScannedAt: 'Just now',
                }
              : z
          )
        );

        if (diagnosis.status === 'Alert' || diagnosis.status === 'Monitor') {
          addAlert({
            title: `${diagnosis.diseaseName} Detected in ${zone.name}`,
            message: `${diagnosis.summary} Recommended irrigation: ${diagnosis.irrigationRecommendation.action} (${diagnosis.irrigationRecommendation.deltaPercent}%).`,
            zoneId: zone.id,
            zoneName: zone.name,
            severity: diagnosis.status === 'Alert' ? 'Alert' : 'Monitor',
            category: 'Disease',
          });
        }

        setLastSyncedAt(new Date().toISOString());
        return { scan: newScan };
      } catch (err) {
        return {
          error:
            err instanceof Error
              ? err.message
              : 'Network error while reaching AI plant pathology service.',
        };
      }
    },
    [zones, weather.current, isOnline, enqueueOperation, addAlert]
  );

  const applyDiagnosisToIrrigation = useCallback(
    (scanId: string) => {
      const scan = scans.find((s) => s.id === scanId);
      if (!scan) return;
      const rec = scan.diagnosis.irrigationRecommendation;
      const clampedTarget = Math.max(25, Math.min(80, Math.round(rec.suggestedTargetMoisture)));

      setZones((prev) =>
        prev.map((z) =>
          z.id === scan.zoneId
            ? {
                ...z,
                targetMoisture: clampedTarget,
                valveOpen: rec.action === 'Pause' ? false : z.valveOpen,
                valveMode: rec.action === 'Pause' ? 'Rain-Paused' : 'Auto',
                scheduledWindow:
                  rec.action === 'Pause'
                    ? 'Paused · Disease control'
                    : `Adjusted (${rec.deltaPercent > 0 ? '+' : ''}${rec.deltaPercent}%)`,
              }
            : z
        )
      );

      setScans((prev) =>
        prev.map((s) => (s.id === scanId ? { ...s, appliedToIrrigation: true } : s))
      );

      enqueueOperation(
        'IRRIGATION_RULE',
        `Applied pathology irrigation adjustment (${rec.action}, target ${clampedTarget}%) to ${scan.zoneName}`,
        { scanId, zoneId: scan.zoneId, targetMoisture: clampedTarget },
        isOnline
      );
    },
    [scans, enqueueOperation, isOnline]
  );

  const acknowledgeAlert = useCallback(
    (alertId: string) => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, acknowledged: true } : a))
      );
      enqueueOperation('ALERT_ACK', 'Acknowledged field health alert', { alertId }, isOnline);
    },
    [enqueueOperation, isOnline]
  );

  const triggerTestPushAlert = useCallback(() => {
    addAlert({
      title: 'PlantWise Mobile Health Alert Verified',
      message: 'Real-time disease and irrigation alerts are active for this device.',
      zoneId: zones[0]?.id ?? 'zone-a',
      zoneName: zones[0]?.name ?? 'North Greenhouse',
      severity: 'Info',
      category: 'Rover',
    });
  }, [addAlert, zones]);

  // Sync queued offline operations back to server (including queued AI leaf diagnoses!)
  const syncPendingOperations = useCallback(async () => {
    if (!isOnline || isSyncing) return;
    const pendingOps = offlineQueue.filter((op) => op.status === 'Pending');
    if (pendingOps.length === 0) {
      setLastSyncedAt(new Date().toISOString());
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Process any queued leaf diagnosis images via /api/diagnose
      const diagnosisOps = pendingOps.filter((op) => op.type === 'QUEUED_DIAGNOSIS');
      const succeededIds = new Set<string>();

      for (const op of diagnosisOps) {
        const p = op.payload as {
          imageBase64: string;
          previewUrl: string;
          mimeType: string;
          zoneId: string;
          source: ScanRecord['source'];
        };
        const result = await runLeafDiagnosis(p);
        if (result.scan) {
          succeededIds.add(op.id);
        }
      }

      // 2. Sync remaining metadata / valve operations in batch to /api/sync
      const standardOps = pendingOps.filter((op) => op.type !== 'QUEUED_DIAGNOSIS');
      if (standardOps.length > 0) {
        const res = await fetch('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ operations: standardOps }),
        });
        if (res.ok) {
          const data = await res.json();
          const syncedIds: string[] = data.syncedIds ?? [];
          syncedIds.forEach((id) => succeededIds.add(id));
        }
      }

      setOfflineQueue((prev) =>
        prev.map((op) => (succeededIds.has(op.id) ? { ...op, status: 'Synced' } : op))
      );
      setLastSyncedAt(new Date().toISOString());
    } catch {
      // Keep pending if sync failed transiently
    } finally {
      setIsSyncing(false);
    }
  }, [isOnline, isSyncing, offlineQueue, runLeafDiagnosis]);

  // Auto-sync when connectivity is restored
  const prevOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (!prevOnlineRef.current && isOnline) {
      syncPendingOperations();
      refreshWeather(selectedLocation);
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, syncPendingOperations, refreshWeather, selectedLocation]);

  useEffect(() => writeStorage(STORAGE_KEYS.trainingSamples, trainingSamples), [trainingSamples]);

  // Hydrate server-side custom training library when online
  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    fetch('/api/training-samples')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && Array.isArray(data.samples) && data.samples.length > 0) {
          setTrainingSamples(data.samples as TrainingSample[]);
        }
      })
      .catch(() => {
        // Keep local cache silently if unreachable
      });
    return () => {
      cancelled = true;
    };
  }, [isOnline]);

  const addTrainingSamples = useCallback(
    async (
      newSamples: Array<Omit<TrainingSample, 'id' | 'addedAt'>>
    ): Promise<{ ok: boolean; error?: string }> => {
      const optimistic: TrainingSample[] = newSamples.map((s) => ({
        ...s,
        id: `train-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        addedAt: 'Just now',
      }));

      setTrainingSamples((prev) => [...optimistic, ...prev]);

      if (!isOnline) {
        enqueueOperation(
          'IRRIGATION_RULE',
          `Queued ${optimistic.length} custom leaf training image(s) for server sync`,
          { count: optimistic.length },
          false
        );
        return { ok: true };
      }

      try {
        const res = await fetch('/api/training-samples', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ samples: optimistic }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return { ok: false, error: err?.error || 'Failed to save training data to server.' };
        }
        const data = await res.json();
        if (Array.isArray(data.samples)) {
          setTrainingSamples(data.samples as TrainingSample[]);
        }
        setLastSyncedAt(new Date().toISOString());
        return { ok: true };
      } catch {
        return { ok: false, error: 'Saved locally; server sync will retry when online.' };
      }
    },
    [isOnline, enqueueOperation]
  );

  const updateTrainingSample = useCallback(
    async (id: string, patch: Partial<TrainingSample>) => {
      setTrainingSamples((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
      if (!isOnline) return;
      try {
        const res = await fetch(`/api/training-samples/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.sample) {
            setTrainingSamples((prev) =>
              prev.map((s) => (s.id === id ? (data.sample as TrainingSample) : s))
            );
          }
        }
      } catch {
        // Keep optimistic state
      }
    },
    [isOnline]
  );

  const deleteTrainingSample = useCallback(
    async (id: string) => {
      setTrainingSamples((prev) => prev.filter((s) => s.id !== id));
      if (!isOnline) return;
      try {
        await fetch(`/api/training-samples/${encodeURIComponent(id)}`, { method: 'DELETE' });
      } catch {
        // Keep optimistic removal
      }
    },
    [isOnline]
  );

  const pendingSyncCount = offlineQueue.filter((op) => op.status === 'Pending').length;
  const unreadAlertsCount = alerts.filter((a) => !a.acknowledged).length;

  return {
    zones,
    rover,
    scans,
    trainingSamples,
    alerts,
    offlineQueue,
    pendingSyncCount,
    unreadAlertsCount,
    weather,
    weatherLoading,
    weatherError,
    selectedLocation,
    setSelectedLocationId,
    refreshWeather,
    irrigationConfig,
    updateGlobalIrrigationConfig,
    notifPrefs,
    setNotifPrefs,
    notificationPermission,
    requestNotificationPermission,
    triggerTestPushAlert,
    lastSyncedAt,
    isSyncing,
    syncPendingOperations,
    toggleRoverPatrol,
    dispatchRoverToZone,
    toggleZoneValve,
    updateZoneTargetMoisture,
    updateZoneMode,
    runLeafDiagnosis,
    applyDiagnosisToIrrigation,
    acknowledgeAlert,
    addTrainingSamples,
    updateTrainingSample,
    deleteTrainingSample,
  };
}
