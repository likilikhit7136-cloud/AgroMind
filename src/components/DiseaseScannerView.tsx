import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookmarkPlus,
  Camera,
  Check,
  Database,
  Droplets,
  Edit3,
  Loader2,
  Plus,
  ScanLine,
  Search,
  Trash2,
  Upload,
  WifiOff,
} from 'lucide-react';
import { ROVER_CAMERA_SAMPLES } from '../data/farmSeed';
import type { FieldZone, ScanRecord, TrainingSample, ZoneHealthStatus } from '../types';

interface DiseaseScannerViewProps {
  zones: FieldZone[];
  scans: ScanRecord[];
  trainingSamples: TrainingSample[];
  isOnline: boolean;
  initialZoneId?: string;
  onRunDiagnosis: (params: {
    imageBase64: string;
    previewUrl: string;
    mimeType: string;
    zoneId: string;
    source: ScanRecord['source'];
  }) => Promise<{ queued?: boolean; scan?: ScanRecord; error?: string }>;
  onApplyIrrigation: (scanId: string) => void;
  onAddTrainingSamples: (
    samples: Array<Omit<TrainingSample, 'id' | 'addedAt'>>
  ) => Promise<{ ok: boolean; error?: string }>;
  onUpdateTrainingSample: (id: string, patch: Partial<TrainingSample>) => Promise<void>;
  onDeleteTrainingSample: (id: string) => Promise<void>;
}

async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve({ base64, mimeType: blob.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error('Failed to encode selected image.'));
    reader.readAsDataURL(blob);
  });
}

function readFileAsDataUrl(file: File): Promise<{ dataUrl: string; base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = String(reader.result ?? '');
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      resolve({ dataUrl, base64, mimeType: file.type || 'image/jpeg' });
    };
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

function statusColorClass(status: ZoneHealthStatus): string {
  if (status === 'Alert') return 'text-[#B91C1C] font-semibold';
  if (status === 'Monitor') return 'text-[#B45309] font-semibold';
  return 'text-[#15803D] font-semibold';
}

export const DiseaseScannerView: React.FC<DiseaseScannerViewProps> = ({
  zones,
  scans,
  trainingSamples,
  isOnline,
  initialZoneId,
  onRunDiagnosis,
  onApplyIrrigation,
  onAddTrainingSamples,
  onUpdateTrainingSample,
  onDeleteTrainingSample,
}) => {
  const [subTab, setSubTab] = useState<'scanner' | 'training'>('scanner');
  const [selectedZoneId, setSelectedZoneId] = useState<string>(initialZoneId || zones[1]?.id || zones[0]?.id);
  const [previewUrl, setPreviewUrl] = useState<string>(ROVER_CAMERA_SAMPLES[0].imageUrl);
  const [uploadedBase64, setUploadedBase64] = useState<string | null>(null);
  const [uploadedMimeType, setUploadedMimeType] = useState<string>('image/jpeg');
  const [captureSource, setCaptureSource] = useState<ScanRecord['source']>('Rover Camera');
  const [activeScan, setActiveScan] = useState<ScanRecord | null>(scans[0] ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [queuedNotice, setQueuedNotice] = useState<string | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'All' | ZoneHealthStatus>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [savedScanIds, setSavedScanIds] = useState<Record<string, boolean>>({});

  // Training Dataset Upload & Edit states
  const [pendingTrainFiles, setPendingTrainFiles] = useState<
    Array<{ name: string; dataUrl: string; base64: string; mimeType: string }>
  >([]);
  const [trainLabel, setTrainLabel] = useState('');
  const [trainScientific, setTrainScientific] = useState('');
  const [trainCrop, setTrainCrop] = useState('Maize / Corn');
  const [trainPathogen, setTrainPathogen] = useState<TrainingSample['pathogenType']>('Fungal');
  const [trainSeverity, setTrainSeverity] = useState<ZoneHealthStatus>('Alert');
  const [trainNotes, setTrainNotes] = useState('');
  const [trainSaving, setTrainSaving] = useState(false);
  const [trainFeedback, setTrainFeedback] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editScientific, setEditScientific] = useState('');
  const [editCrop, setEditCrop] = useState('');
  const [editNotes, setEditNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const trainFileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (initialZoneId) {
      setSelectedZoneId(initialZoneId);
      const matchedSample = ROVER_CAMERA_SAMPLES.find((s) => s.zoneId === initialZoneId);
      if (matchedSample) {
        setPreviewUrl(matchedSample.imageUrl);
        setUploadedBase64(null);
        setCaptureSource('Rover Camera');
      }
    }
  }, [initialZoneId]);

  useEffect(() => {
    if (activeScan) {
      const updated = scans.find((s) => s.id === activeScan.id);
      if (updated) setActiveScan(updated);
    }
  }, [scans, activeScan]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const startLiveCamera = async () => {
    setErrorMsg(null);
    setQueuedNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      });
    } catch {
      setErrorMsg('Camera access unavailable in this browser. Upload a leaf image or select a rover camera frame.');
    }
  };

  const captureFromVideo = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setPreviewUrl(dataUrl);
    setUploadedBase64(dataUrl.split(',')[1]);
    setUploadedMimeType('image/jpeg');
    setCaptureSource('Live Camera');
    stopLiveCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setQueuedNotice(null);
    readFileAsDataUrl(file).then(({ dataUrl, base64, mimeType }) => {
      setPreviewUrl(dataUrl);
      setUploadedBase64(base64);
      setUploadedMimeType(mimeType);
      setCaptureSource('Mobile Upload');
    });
  };

  const handleSelectRoverSample = (sample: (typeof ROVER_CAMERA_SAMPLES)[number]) => {
    stopLiveCamera();
    setErrorMsg(null);
    setQueuedNotice(null);
    setSelectedZoneId(sample.zoneId);
    setPreviewUrl(sample.imageUrl);
    setUploadedBase64(null);
    setUploadedMimeType('image/jpeg');
    setCaptureSource('Rover Camera');
  };

  const handleAnalyze = async () => {
    setErrorMsg(null);
    setQueuedNotice(null);
    setIsAnalyzing(true);
    try {
      let base64 = uploadedBase64;
      let mimeType = uploadedMimeType;
      if (!base64) {
        const encoded = await urlToBase64(previewUrl);
        base64 = encoded.base64;
        mimeType = encoded.mimeType;
      }

      const result = await onRunDiagnosis({
        imageBase64: base64,
        previewUrl,
        mimeType,
        zoneId: selectedZoneId,
        source: captureSource,
      });

      if (result.queued) {
        setQueuedNotice(
          'Offline mode active — this leaf image has been stored in the Offline Sync Queue and will be analyzed automatically once connectivity returns.'
        );
      } else if (result.error) {
        setErrorMsg(result.error);
      } else if (result.scan) {
        setActiveScan(result.scan);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to process leaf image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveScanToTraining = async (scan: ScanRecord) => {
    try {
      const encoded = await urlToBase64(scan.imageUrl);
      await onAddTrainingSamples([
        {
          diseaseLabel: scan.diagnosis.diseaseName,
          scientificName: scan.diagnosis.scientificName,
          crop: scan.crop,
          pathogenType: (['Fungal', 'Bacterial', 'Viral', 'Nutrient', 'Pest', 'None'].includes(
            scan.diagnosis.pathogenType
          )
            ? scan.diagnosis.pathogenType
            : 'Fungal') as TrainingSample['pathogenType'],
          severity: scan.diagnosis.status,
          visualNotes: scan.diagnosis.symptomsObserved.join(' · '),
          imageUrl: scan.imageUrl,
          imageBase64: encoded.base64,
          mimeType: encoded.mimeType,
          active: true,
          source: 'Field Scan',
        },
      ]);
      setSavedScanIds((prev) => ({ ...prev, [scan.id]: true }));
    } catch {
      setErrorMsg('Could not add this scan frame to the training library.');
    }
  };

  const handleTrainFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setTrainFeedback(null);
    const loaded = await Promise.all(
      files.map(async (f) => {
        const res = await readFileAsDataUrl(f);
        return { name: f.name, ...res };
      })
    );
    setPendingTrainFiles((prev) => [...prev, ...loaded]);
    if (trainFileInputRef.current) trainFileInputRef.current.value = '';
  };

  const handleSubmitTrainingBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pendingTrainFiles.length === 0 || !trainLabel.trim()) {
      setTrainFeedback('Select at least one leaf photo and enter a disease label.');
      return;
    }
    setTrainSaving(true);
    setTrainFeedback(null);
    const payload: Array<Omit<TrainingSample, 'id' | 'addedAt'>> = pendingTrainFiles.map((f) => ({
      diseaseLabel: trainLabel.trim(),
      scientificName: trainScientific.trim() || 'Custom field reference',
      crop: trainCrop.trim() || 'Maize / Corn',
      pathogenType: trainPathogen,
      severity: trainSeverity,
      visualNotes:
        trainNotes.trim() || `Operator-labeled ${trainLabel.trim()} leaf reference (${f.name}).`,
      imageUrl: f.dataUrl,
      imageBase64: f.base64,
      mimeType: f.mimeType,
      active: true,
      source: 'Custom Upload',
    }));

    const res = await onAddTrainingSamples(payload);
    setTrainSaving(false);
    if (res.ok) {
      setPendingTrainFiles([]);
      setTrainLabel('');
      setTrainScientific('');
      setTrainNotes('');
      setTrainFeedback(
        `Added ${payload.length} labeled reference photo${payload.length > 1 ? 's' : ''} to the live AI pathology module.`
      );
    } else {
      setTrainFeedback(res.error || 'Unable to save training batch.');
    }
  };

  const startEditingSample = (sample: TrainingSample) => {
    setEditingId(sample.id);
    setEditLabel(sample.diseaseLabel);
    setEditScientific(sample.scientificName);
    setEditCrop(sample.crop);
    setEditNotes(sample.visualNotes);
  };

  const saveSampleEdit = async (id: string) => {
    await onUpdateTrainingSample(id, {
      diseaseLabel: editLabel.trim() || 'Unlabeled Disease',
      scientificName: editScientific.trim(),
      crop: editCrop.trim(),
      visualNotes: editNotes.trim(),
    });
    setEditingId(null);
  };

  const testTrainingSampleInScanner = (sample: TrainingSample) => {
    stopLiveCamera();
    setErrorMsg(null);
    setQueuedNotice(null);
    setPreviewUrl(sample.imageUrl);
    setUploadedBase64(null);
    setUploadedMimeType(sample.mimeType || 'image/jpeg');
    setCaptureSource('Rover Camera');
    setSubTab('scanner');
  };

  const activeTrainingCount = trainingSamples.filter((s) => s.active).length;
  const trainedClasses = Array.from(
    new Set(trainingSamples.filter((s) => s.active).map((s) => s.diseaseLabel))
  );

  const filteredScans = scans.filter((scan) => {
    const matchesStatus = statusFilter === 'All' || scan.diagnosis.status === statusFilter;
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      scan.diagnosis.diseaseName.toLowerCase().includes(q) ||
      scan.zoneName.toLowerCase().includes(q) ||
      scan.crop.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? zones[0];

  return (
    <div className="space-y-6">
      {/* Mode Switcher Bar: Live Leaf Scanner vs Custom Training Dataset */}
      <div className="bg-white border border-[#E4E7E2] rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-[#F1F4F1] rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('scanner')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'scanner'
                ? 'bg-white text-[#141A15] shadow-xs'
                : 'text-[#556157] hover:text-[#141A15]'
            }`}
          >
            <ScanLine className="w-3.5 h-3.5 text-[#166534]" />
            Live Leaf Scanner
          </button>
          <button
            type="button"
            onClick={() => setSubTab('training')}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'training'
                ? 'bg-white text-[#141A15] shadow-xs'
                : 'text-[#556157] hover:text-[#141A15]'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-[#166534]" />
            Training Dataset ({activeTrainingCount} Active)
          </button>
        </div>

        <div className="text-xs text-[#556157] flex flex-wrap items-center gap-2">
          <span>
            Active visual references:{' '}
            <strong className="font-mono tabular-nums text-[#141A15]">{activeTrainingCount}</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Trained classes:{' '}
            <strong className="font-mono tabular-nums text-[#141A15]">{trainedClasses.length}</strong>
          </span>
          {subTab === 'scanner' && (
            <>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => setSubTab('training')}
                className="text-[#166534] font-medium hover:underline whitespace-nowrap"
              >
                Manage Training Data
              </button>
            </>
          )}
        </div>
      </div>

      {subTab === 'training' ? (
        <div className="space-y-6">
          {/* Training Summary & Add Custom Photos Form */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Trained Classes Overview & Model Conditioning Status */}
            <div className="lg:col-span-5 bg-white border border-[#E4E7E2] rounded-xl p-6 space-y-5">
              <div className="pb-4 border-b border-[#E4E7E2]">
                <h2 className="text-base font-semibold text-[#141A15]">
                  Custom Disease Model Conditioning
                </h2>
                <p className="mt-1 text-xs text-[#556157] leading-relaxed">
                  Every active reference image below is injected as multimodal visual training context into the PlantWise pathology engine during leaf diagnosis.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-[#556157]">Total Samples</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#141A15]">
                    {trainingSamples.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#556157]">Active in AI</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#15803D]">
                    {activeTrainingCount}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[#556157]">Disease Classes</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#141A15]">
                    {trainedClasses.length}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t border-[#E4E7E2]">
                <h3 className="text-xs font-semibold text-[#141A15]">Active Trained Disease Classes</h3>
                {trainedClasses.length === 0 ? (
                  <p className="mt-2 text-xs text-[#556157]">
                    No active training samples enabled. Toggle on at least one sample below or upload labeled photos.
                  </p>
                ) : (
                  <ul className="mt-2.5 divide-y divide-[#E4E7E2] text-xs">
                    {trainedClasses.map((cls) => {
                      const count = trainingSamples.filter(
                        (s) => s.active && s.diseaseLabel === cls
                      ).length;
                      return (
                        <li key={cls} className="py-2 flex items-center justify-between gap-2">
                          <span className="font-medium text-[#141A15]">{cls}</span>
                          <span className="font-mono tabular-nums text-[#556157] shrink-0">
                            {count} image{count === 1 ? '' : 's'}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Right: Upload New Labeled Training Batch */}
            <form
              onSubmit={handleSubmitTrainingBatch}
              className="lg:col-span-7 bg-white border border-[#E4E7E2] rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E4E7E2]">
                <div>
                  <h2 className="text-base font-semibold text-[#141A15]">
                    Add Training Disease Photos
                  </h2>
                  <p className="mt-0.5 text-xs text-[#556157]">
                    Upload one or multiple photos of the same plant disease (including rotated angles) and label them.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => trainFileInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap"
                >
                  <Upload className="w-3.5 h-3.5 text-[#166534]" />
                  Select Photos
                </button>
                <input
                  ref={trainFileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleTrainFilesSelected}
                  className="hidden"
                />
              </div>

              {pendingTrainFiles.length > 0 && (
                <div className="flex flex-wrap gap-2.5">
                  {pendingTrainFiles.map((f, idx) => (
                    <div
                      key={`${f.name}-${idx}`}
                      className="relative w-16 h-16 rounded-lg overflow-hidden border border-[#E4E7E2]"
                    >
                      <img
                        src={f.dataUrl}
                        alt={f.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPendingTrainFiles((prev) => prev.filter((_, i) => i !== idx))
                        }
                        aria-label={`Remove ${f.name}`}
                        className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded p-0.5 text-[10px]"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-medium text-[#556157] mb-1">
                    Disease Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={trainLabel}
                    onChange={(e) => setTrainLabel(e.target.value)}
                    placeholder="e.g., Northern Corn Leaf Blight"
                    className="w-full rounded-lg border border-[#D4DDD5] px-3 py-2 text-xs text-[#141A15] focus:outline-none focus:border-[#166534]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#556157] mb-1">
                    Scientific / Pathogen Name
                  </label>
                  <input
                    type="text"
                    value={trainScientific}
                    onChange={(e) => setTrainScientific(e.target.value)}
                    placeholder="e.g., Exserohilum turcicum"
                    className="w-full rounded-lg border border-[#D4DDD5] px-3 py-2 text-xs text-[#141A15] focus:outline-none focus:border-[#166534]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#556157] mb-1">
                    Crop Type
                  </label>
                  <input
                    type="text"
                    value={trainCrop}
                    onChange={(e) => setTrainCrop(e.target.value)}
                    placeholder="e.g., Maize / Corn"
                    className="w-full rounded-lg border border-[#D4DDD5] px-3 py-2 text-xs text-[#141A15] focus:outline-none focus:border-[#166534]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-[#556157] mb-1">
                      Pathogen Class
                    </label>
                    <select
                      value={trainPathogen}
                      onChange={(e) =>
                        setTrainPathogen(e.target.value as TrainingSample['pathogenType'])
                      }
                      className="w-full rounded-lg border border-[#D4DDD5] bg-white px-2.5 py-2 text-xs text-[#141A15] focus:outline-none focus:border-[#166534]"
                    >
                      <option value="Fungal">Fungal</option>
                      <option value="Bacterial">Bacterial</option>
                      <option value="Viral">Viral</option>
                      <option value="Nutrient">Nutrient</option>
                      <option value="Pest">Pest</option>
                      <option value="None">Healthy / None</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#556157] mb-1">
                      Severity
                    </label>
                    <select
                      value={trainSeverity}
                      onChange={(e) => setTrainSeverity(e.target.value as ZoneHealthStatus)}
                      className="w-full rounded-lg border border-[#D4DDD5] bg-white px-2.5 py-2 text-xs text-[#141A15] focus:outline-none focus:border-[#166534]"
                    >
                      <option value="Alert">Alert</option>
                      <option value="Monitor">Monitor</option>
                      <option value="Healthy">Healthy</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#556157] mb-1">
                  Key Visual Diagnostic Cues
                </label>
                <textarea
                  rows={2}
                  value={trainNotes}
                  onChange={(e) => setTrainNotes(e.target.value)}
                  placeholder="Describe lesion color, shape, border halo, or midrib clustering to guide visual matching..."
                  className="w-full rounded-lg border border-[#D4DDD5] px-3 py-2 text-xs text-[#141A15] focus:outline-none focus:border-[#166534]"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-[#15803D] font-medium">{trainFeedback ?? ''}</p>
                <button
                  type="submit"
                  disabled={trainSaving || pendingTrainFiles.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#166534] text-white text-xs font-semibold hover:bg-[#14532D] disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {trainSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  Train {pendingTrainFiles.length > 0 ? `${pendingTrainFiles.length} Photo${pendingTrainFiles.length > 1 ? 's' : ''}` : 'Photos'}
                </button>
              </div>
            </form>
          </section>

          {/* Trained Reference Library Table / Cards */}
          <section className="bg-white border border-[#E4E7E2] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#141A15]">
                  Trained Leaf Reference Library
                </h2>
                <p className="text-xs text-[#556157]">
                  Your 5 uploaded maize leaf pathology samples are pre-loaded and active. Edit labels, toggle active status, or test any image in the scanner.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#556157]">
                {activeTrainingCount} of {trainingSamples.length} active
              </span>
            </div>

            <div className="divide-y divide-[#E4E7E2]">
              {trainingSamples.map((sample) => {
                const isEditing = editingId === sample.id;
                return (
                  <div
                    key={sample.id}
                    className="px-6 py-4 flex flex-col sm:flex-row sm:items-start gap-4 hover:bg-[#FAFBF9]"
                  >
                    <img
                      src={sample.imageUrl}
                      alt={sample.diseaseLabel}
                      referrerPolicy="no-referrer"
                      className="w-24 h-24 rounded-lg object-cover border border-[#E4E7E2] shrink-0"
                    />

                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={editLabel}
                              onChange={(e) => setEditLabel(e.target.value)}
                              className="rounded-lg border border-[#D4DDD5] px-2.5 py-1.5 text-xs text-[#141A15]"
                              placeholder="Disease label"
                            />
                            <input
                              type="text"
                              value={editScientific}
                              onChange={(e) => setEditScientific(e.target.value)}
                              className="rounded-lg border border-[#D4DDD5] px-2.5 py-1.5 text-xs text-[#141A15]"
                              placeholder="Scientific name"
                            />
                            <input
                              type="text"
                              value={editCrop}
                              onChange={(e) => setEditCrop(e.target.value)}
                              className="rounded-lg border border-[#D4DDD5] px-2.5 py-1.5 text-xs text-[#141A15]"
                              placeholder="Crop"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            className="w-full rounded-lg border border-[#D4DDD5] px-2.5 py-1.5 text-xs text-[#141A15]"
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => saveSampleEdit(sample.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#166534] text-white text-xs font-semibold hover:bg-[#14532D]"
                            >
                              Save Changes
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-3 py-1.5 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#556157]"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className={statusColorClass(sample.severity)}>
                              {sample.severity}
                            </span>
                            <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                            <span className="text-[#556157]">{sample.crop}</span>
                            <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                            <span className="text-[#556157]">{sample.pathogenType}</span>
                            <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                            <span className="text-[#556157]">{sample.source}</span>
                          </div>
                          <h3 className="mt-1 text-sm font-semibold text-[#141A15]">
                            {sample.diseaseLabel}
                          </h3>
                          <p className="text-xs italic text-[#556157]">{sample.scientificName}</p>
                          <p className="mt-1.5 text-xs text-[#2A332C] leading-relaxed">
                            {sample.visualNotes}
                          </p>
                        </>
                      )}
                    </div>

                    {!isEditing && (
                      <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0">
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-[#141A15] cursor-pointer whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={sample.active}
                            onChange={(e) =>
                              onUpdateTrainingSample(sample.id, { active: e.target.checked })
                            }
                            className="w-4 h-4 accent-[#166534]"
                          />
                          Active in Model
                        </label>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => testTrainingSampleInScanner(sample)}
                            className="px-2.5 py-1.5 rounded-lg border border-[#D4DDD5] bg-white text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] whitespace-nowrap"
                          >
                            Test Scan
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditingSample(sample)}
                            aria-label={`Edit ${sample.diseaseLabel}`}
                            className="p-1.5 rounded-lg border border-[#D4DDD5] bg-white text-[#556157] hover:text-[#141A15]"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteTrainingSample(sample.id)}
                            aria-label={`Remove ${sample.diseaseLabel}`}
                            className="p-1.5 rounded-lg border border-[#D4DDD5] bg-white text-[#556157] hover:text-[#B91C1C]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Main Vision Analysis Split */}
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left: Camera Frame & Sample Input */}
            <div className="lg:col-span-6 bg-white border border-[#E4E7E2] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#141A15]">
                      Camera Input &amp; Rover Optical Frames
                    </h2>
                    <p className="mt-0.5 text-xs text-[#556157]">
                      Capture live foliage, upload a field photo, or test a rover or custom-trained leaf frame.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5 text-[#556157]" />
                      Upload Photo
                    </button>
                    <button
                      type="button"
                      onClick={cameraActive ? stopLiveCamera : startLiveCamera}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D4DDD5] text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] transition-colors whitespace-nowrap"
                    >
                      <Camera className="w-3.5 h-3.5 text-[#556157]" />
                      {cameraActive ? 'Cancel Camera' : 'Live Camera'}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </div>
                </div>

                {/* Viewport */}
                <div className="mt-4 relative aspect-[4/3] rounded-lg overflow-hidden border border-[#E4E7E2] bg-[#141A15]">
                  {cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-4 inset-x-0 flex justify-center">
                        <button
                          type="button"
                          onClick={captureFromVideo}
                          className="px-5 py-2.5 rounded-lg bg-[#166534] text-white text-xs font-semibold hover:bg-[#14532D] transition-colors"
                        >
                          Capture Leaf Frame
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <img
                        src={previewUrl}
                        alt={`Plant leaf sample from ${selectedZone?.name ?? 'field zone'}`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent px-4 py-3 text-white flex items-center justify-between text-xs">
                        <span>
                          {captureSource} · {selectedZone?.name}
                        </span>
                        <span className="font-mono tabular-nums">
                          {selectedZone?.soilMoisture}% SM · {selectedZone?.humidity}% RH
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Quick Rover & Trained Dataset Captures */}
                <div className="mt-4">
                  <p className="text-xs font-medium text-[#556157] mb-2">
                    Recent Field &amp; Trained Dataset Captures
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {ROVER_CAMERA_SAMPLES.map((sample) => {
                      const isActive = previewUrl === sample.imageUrl && !uploadedBase64;
                      return (
                        <button
                          key={sample.id}
                          type="button"
                          onClick={() => handleSelectRoverSample(sample)}
                          className={`text-left rounded-lg overflow-hidden border transition-colors ${
                            isActive
                              ? 'border-[#166534] ring-1 ring-[#166534]'
                              : 'border-[#E4E7E2] hover:border-[#9CA89E]'
                          }`}
                        >
                          <img
                            src={sample.imageUrl}
                            alt={sample.label}
                            referrerPolicy="no-referrer"
                            className="w-full h-14 object-cover"
                          />
                          <div className="p-2 bg-white">
                            <p className="text-[11px] font-medium text-[#141A15] truncate">
                              {sample.crop}
                            </p>
                            <p className="text-[10px] text-[#556157] truncate">
                              {sample.label}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Zone Context & Analyze Trigger */}
              <div className="mt-5 pt-4 border-t border-[#E4E7E2] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <label htmlFor="scan-zone-select" className="text-xs font-medium text-[#556157] whitespace-nowrap">
                    Field Zone
                  </label>
                  <select
                    id="scan-zone-select"
                    value={selectedZoneId}
                    onChange={(e) => setSelectedZoneId(e.target.value)}
                    className="rounded-lg border border-[#D4DDD5] bg-white px-3 py-2 text-xs font-medium text-[#141A15] focus:outline-none focus:border-[#166534]"
                  >
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.code} — {z.name} ({z.crop})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || cameraActive}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#166534] text-white text-xs font-semibold hover:bg-[#14532D] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing Leaf...
                    </>
                  ) : isOnline ? (
                    <>
                      <ScanLine className="w-4 h-4" />
                      Analyze Leaf Sample
                    </>
                  ) : (
                    <>
                      <WifiOff className="w-4 h-4" />
                      Queue Offline Scan
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right: Structured AI Pathology Diagnosis Report */}
            <div className="lg:col-span-6 bg-white border border-[#E4E7E2] rounded-xl p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E4E7E2]">
                  <div>
                    <p className="text-xs text-[#556157]">
                      AI Pathology Assessment · {activeScan ? `${activeScan.zoneName} · ${activeScan.capturedAt}` : 'Ready to inspect'}
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-[#141A15]">
                      {isAnalyzing
                        ? 'Matching Against Trained Library...'
                        : activeScan
                          ? activeScan.diagnosis.diseaseName
                          : 'Select a Leaf Frame to Analyze'}
                    </h2>
                    {activeScan && !isAnalyzing && (
                      <p className="mt-0.5 text-xs italic text-[#556157]">
                        {activeScan.diagnosis.scientificName} · {activeScan.diagnosis.pathogenType}
                      </p>
                    )}
                  </div>

                  {activeScan && !isAnalyzing && (
                    <div className="text-right shrink-0">
                      <div className={`text-sm ${statusColorClass(activeScan.diagnosis.status)}`}>
                        {activeScan.diagnosis.status}
                      </div>
                      <div className="text-xs font-mono tabular-nums text-[#556157]">
                        {activeScan.diagnosis.confidence}% confidence
                      </div>
                    </div>
                  )}
                </div>

                {errorMsg && (
                  <div className="mt-4 p-4 rounded-lg border border-[#FECACA] bg-[#FEF2F2] text-xs text-[#991B1B] flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Analysis Error</p>
                      <p className="mt-0.5">{errorMsg}</p>
                    </div>
                  </div>
                )}

                {queuedNotice && (
                  <div className="mt-4 p-4 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] text-xs text-[#92400E] flex items-start gap-2.5">
                    <WifiOff className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Saved to Offline Queue</p>
                      <p className="mt-0.5">{queuedNotice}</p>
                    </div>
                  </div>
                )}

                {isAnalyzing ? (
                  <div className="mt-6 space-y-4 animate-pulse">
                    <div className="h-4 bg-[#EEF1ED] rounded w-5/6" />
                    <div className="h-4 bg-[#EEF1ED] rounded w-3/4" />
                    <div className="grid grid-cols-3 gap-4 pt-4">
                      <div className="h-14 bg-[#EEF1ED] rounded" />
                      <div className="h-14 bg-[#EEF1ED] rounded" />
                      <div className="h-14 bg-[#EEF1ED] rounded" />
                    </div>
                    <div className="h-24 bg-[#EEF1ED] rounded mt-4" />
                  </div>
                ) : activeScan ? (
                  <div className="mt-5 space-y-5">
                    {activeScan.diagnosis.matchedTrainingClass &&
                      activeScan.diagnosis.matchedTrainingClass !== 'None' && (
                        <div className="text-xs text-[#15803D] font-medium flex flex-wrap items-center gap-2">
                          <span>
                            Matched Custom Trained Class:{' '}
                            <strong>{activeScan.diagnosis.matchedTrainingClass}</strong>
                          </span>
                          {typeof activeScan.diagnosis.trainingSamplesUsed === 'number' && (
                            <>
                              <span aria-hidden="true" className="text-[#9CA89E]">·</span>
                              <span className="font-mono tabular-nums text-[#556157]">
                                {activeScan.diagnosis.trainingSamplesUsed} references checked
                              </span>
                            </>
                          )}
                        </div>
                      )}

                    <p className="text-sm text-[#2A332C] leading-relaxed">
                      {activeScan.diagnosis.summary}
                    </p>

                    {/* Quantitative Leaf Diagnostics */}
                    <div className="grid grid-cols-3 gap-4 py-3.5 border-y border-[#E4E7E2]">
                      <div>
                        <p className="text-xs text-[#556157]">Affected Canopy</p>
                        <p className="mt-0.5 text-lg font-semibold font-mono tabular-nums text-[#141A15]">
                          {activeScan.diagnosis.affectedAreaPercent}%
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#556157]">Pathogen Class</p>
                        <p className="mt-0.5 text-lg font-semibold text-[#141A15]">
                          {activeScan.diagnosis.pathogenType}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-[#556157]">Target Moisture</p>
                        <p className="mt-0.5 text-lg font-semibold font-mono tabular-nums text-[#0369A1]">
                          {activeScan.diagnosis.irrigationRecommendation.suggestedTargetMoisture}%
                        </p>
                      </div>
                    </div>

                    {/* Observed Symptoms & Field Treatment */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div>
                        <h3 className="text-xs font-semibold text-[#141A15]">Observed Visual Cues</h3>
                        <ul className="mt-2 space-y-1.5 text-xs text-[#556157] list-disc list-inside leading-relaxed">
                          {activeScan.diagnosis.symptomsObserved.map((item, idx) => (
                            <li key={idx}>{item}</li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h3 className="text-xs font-semibold text-[#141A15]">Recommended Intervention</h3>
                        <ul className="mt-2 space-y-1.5 text-xs text-[#2A332C] list-decimal list-inside leading-relaxed">
                          {activeScan.diagnosis.treatmentProtocol.map((step, idx) => (
                            <li key={idx}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Actionable Irrigation Sync & Continuous Training Footer */}
              {activeScan && !isAnalyzing && (
                <div className="mt-6 pt-4 border-t border-[#E4E7E2] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[#141A15]">
                        Precision Irrigation Adjustment:{' '}
                        <span className="text-[#0369A1]">
                          {activeScan.diagnosis.irrigationRecommendation.action} (
                          {activeScan.diagnosis.irrigationRecommendation.deltaPercent > 0 ? '+' : ''}
                          {activeScan.diagnosis.irrigationRecommendation.deltaPercent}%)
                        </span>
                      </p>
                      <p className="mt-0.5 text-xs text-[#556157]">
                        {activeScan.diagnosis.irrigationRecommendation.rationale}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={savedScanIds[activeScan.id]}
                        onClick={() => handleSaveScanToTraining(activeScan)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#D4DDD5] bg-white text-xs font-medium text-[#141A15] hover:bg-[#F1F4F1] disabled:opacity-60 transition-colors whitespace-nowrap"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5 text-[#166534]" />
                        {savedScanIds[activeScan.id] ? 'Saved to Training' : 'Add to Training'}
                      </button>

                      <button
                        type="button"
                        disabled={activeScan.appliedToIrrigation}
                        onClick={() => onApplyIrrigation(activeScan.id)}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                          activeScan.appliedToIrrigation
                            ? 'bg-[#EEF5F0] text-[#15803D] cursor-default'
                            : 'bg-[#0369A1] text-white hover:bg-[#075985]'
                        }`}
                      >
                        {activeScan.appliedToIrrigation ? (
                          <>
                            <Check className="w-3.5 h-3.5" />
                            Applied to Zone
                          </>
                        ) : (
                          <>
                            <Droplets className="w-3.5 h-3.5" />
                            Apply to Zone Valve
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Historical Scan Archive with Search & Segmented Status Filter */}
          <section className="bg-white border border-[#E4E7E2] rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-[#E4E7E2] flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-[#141A15]">Field Scan Log</h2>
                <p className="text-xs text-[#556157]">
                  Click any previous inspection to reopen pathology findings and irrigation rules.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#556157] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter crop or disease..."
                    className="pl-8 pr-3 py-1.5 rounded-lg border border-[#D4DDD5] text-xs text-[#141A15] placeholder:text-[#7A867C] focus:outline-none focus:border-[#166534] w-48"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#F1F4F1] rounded-lg">
                  {(['All', 'Alert', 'Monitor', 'Healthy'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        statusFilter === tab
                          ? 'bg-white text-[#141A15] shadow-xs'
                          : 'text-[#556157] hover:text-[#141A15]'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {filteredScans.length === 0 ? (
              <div className="p-10 text-center text-sm text-[#556157]">
                No scan records match your current filter. Select a frame above and click Analyze Leaf Sample.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#E4E7E2] bg-[#FAFBF9] text-xs font-medium text-[#556157]">
                      <th className="py-3 px-6">Sample &amp; Zone</th>
                      <th className="py-3 px-4">Diagnosis</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Confidence</th>
                      <th className="py-3 px-4 text-right">Affected Area</th>
                      <th className="py-3 px-6 text-right">Irrigation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E4E7E2] text-sm">
                    {filteredScans.map((scan) => (
                      <tr
                        key={scan.id}
                        onClick={() => {
                          setActiveScan(scan);
                          setPreviewUrl(scan.imageUrl);
                          setSelectedZoneId(scan.zoneId);
                        }}
                        className={`cursor-pointer transition-colors ${
                          activeScan?.id === scan.id ? 'bg-[#F3F6F3]' : 'hover:bg-[#FAFBF9]'
                        }`}
                      >
                        <td className="py-3 px-6">
                          <div className="flex items-center gap-3">
                            <img
                              src={scan.imageUrl}
                              alt={scan.diagnosis.diseaseName}
                              referrerPolicy="no-referrer"
                              className="w-10 h-10 rounded-md object-cover border border-[#E4E7E2] shrink-0"
                            />
                            <div>
                              <div className="font-medium text-[#141A15]">{scan.zoneName}</div>
                              <div className="text-xs text-[#556157]">
                                {scan.crop} · {scan.source} · {scan.capturedAt}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-[#141A15]">{scan.diagnosis.diseaseName}</div>
                          <div className="text-xs text-[#556157]">{scan.diagnosis.scientificName}</div>
                        </td>
                        <td className={`py-3 px-4 text-xs ${statusColorClass(scan.diagnosis.status)}`}>
                          {scan.diagnosis.status}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#141A15]">
                          {scan.diagnosis.confidence}%
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-[#556157]">
                          {scan.diagnosis.affectedAreaPercent}%
                        </td>
                        <td className="py-3 px-6 text-right text-xs">
                          <span className={scan.appliedToIrrigation ? 'text-[#15803D] font-medium' : 'text-[#556157]'}>
                            {scan.appliedToIrrigation
                              ? 'Applied'
                              : `${scan.diagnosis.irrigationRecommendation.action} (${scan.diagnosis.irrigationRecommendation.deltaPercent}%)`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
