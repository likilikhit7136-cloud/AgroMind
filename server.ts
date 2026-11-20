import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

interface ServerTrainingSample {
  id: string;
  diseaseLabel: string;
  scientificName: string;
  crop: string;
  pathogenType: string;
  severity: 'Healthy' | 'Monitor' | 'Alert';
  visualNotes: string;
  imageUrl: string;
  imageBase64?: string;
  mimeType?: string;
  active: boolean;
  addedAt: string;
  source: 'Uploaded Dataset' | 'Custom Upload' | 'Field Scan';
}

const TRAINING_STORE_PATH = path.resolve(__dirname, '.plantwise-training-dataset.json');

const DEFAULT_TRAINING_SAMPLES: ServerTrainingSample[] = [
  {
    id: 'train-00586-4',
    diseaseLabel: 'Maize Leaf Blight (Bipolaris / Turcicum)',
    scientificName: 'Exserohilum turcicum / Bipolaris maydis',
    crop: 'Maize / Corn',
    pathogenType: 'Fungal',
    severity: 'Alert',
    visualNotes:
      'Distinct tan-to-gray oval necrotic lesions bounded by dark brown margins and faint chlorotic yellow halos between parallel maize veins.',
    imageUrl: '/assets/aistudio/00586_4_6fe5cb29.jpg',
    mimeType: 'image/jpeg',
    active: true,
    addedAt: new Date().toISOString(),
    source: 'Uploaded Dataset',
  },
  {
    id: 'train-00587-0',
    diseaseLabel: 'Maize Midrib Brown Spot & Rust',
    scientificName: 'Physoderma maydis / Puccinia sorghi',
    crop: 'Maize / Corn',
    pathogenType: 'Fungal',
    severity: 'Alert',
    visualNotes:
      'Dense linear clusters of tiny reddish-brown pustules and sunken dark spots running tightly along the pale central leaf midrib (horizontal view).',
    imageUrl: '/assets/aistudio/00587_0_bb596865.jpg',
    mimeType: 'image/jpeg',
    active: true,
    addedAt: new Date().toISOString(),
    source: 'Uploaded Dataset',
  },
  {
    id: 'train-00587-1',
    diseaseLabel: 'Maize Midrib Brown Spot & Rust',
    scientificName: 'Physoderma maydis / Puccinia sorghi',
    crop: 'Maize / Corn',
    pathogenType: 'Fungal',
    severity: 'Alert',
    visualNotes:
      'Vertical orientation reference showing reddish-brown Physoderma / rust lesions hugging both flanks of the maize leaf midrib.',
    imageUrl: '/assets/aistudio/00587_1_460d72bb.jpg',
    mimeType: 'image/jpeg',
    active: true,
    addedAt: new Date().toISOString(),
    source: 'Uploaded Dataset',
  },
  {
    id: 'train-00587-2',
    diseaseLabel: 'Maize Midrib Brown Spot & Rust',
    scientificName: 'Physoderma maydis / Puccinia sorghi',
    crop: 'Maize / Corn',
    pathogenType: 'Fungal',
    severity: 'Alert',
    visualNotes:
      'Mirrored vertical angle augmentation of maize midrib spotting and small circular brown necrotic lesions near the sheath junction.',
    imageUrl: '/assets/aistudio/00587_2_e776a041.jpg',
    mimeType: 'image/jpeg',
    active: true,
    addedAt: new Date().toISOString(),
    source: 'Uploaded Dataset',
  },
  {
    id: 'train-00587-3',
    diseaseLabel: 'Maize Midrib Brown Spot & Rust',
    scientificName: 'Physoderma maydis / Puccinia sorghi',
    crop: 'Maize / Corn',
    pathogenType: 'Fungal',
    severity: 'Alert',
    visualNotes:
      'Inverted horizontal augmentation training the vision model for rotation-invariant detection of maize midrib rust and brown spot.',
    imageUrl: '/assets/aistudio/00587_3_1d75eb1d.jpg',
    mimeType: 'image/jpeg',
    active: true,
    addedAt: new Date().toISOString(),
    source: 'Uploaded Dataset',
  },
];

function loadTrainingSamples(): ServerTrainingSample[] {
  try {
    if (fs.existsSync(TRAINING_STORE_PATH)) {
      const raw = fs.readFileSync(TRAINING_STORE_PATH, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed as ServerTrainingSample[];
      }
    }
  } catch (err) {
    console.error('Failed to read training store, falling back to defaults:', err);
  }
  return [...DEFAULT_TRAINING_SAMPLES];
}

function saveTrainingSamples(samples: ServerTrainingSample[]) {
  try {
    fs.writeFileSync(TRAINING_STORE_PATH, JSON.stringify(samples, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist training store:', err);
  }
}

function resolveSampleImageBase64(sample: ServerTrainingSample): { data: string; mimeType: string } | null {
  if (sample.imageBase64) {
    const cleaned = sample.imageBase64.includes(',')
      ? sample.imageBase64.split(',')[1]
      : sample.imageBase64;
    return { data: cleaned, mimeType: sample.mimeType || 'image/jpeg' };
  }
  if (sample.imageUrl && sample.imageUrl.startsWith('/')) {
    const relativePath = sample.imageUrl.replace(/^\/+/, '');
    const candidates = [
      path.resolve(__dirname, 'public', relativePath),
      path.resolve(__dirname, relativePath),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        const bytes = fs.readFileSync(candidate);
        const ext = path.extname(candidate).toLowerCase();
        const mimeType =
          ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        return { data: bytes.toString('base64'), mimeType };
      }
    }
  }
  return null;
}

function selectBalancedTrainingSamples(
  samples: ServerTrainingSample[],
  maxExamples = 6
): ServerTrainingSample[] {
  const active = samples.filter((s) => s.active);
  if (active.length <= maxExamples) return active;
  // Pick at least one per unique diseaseLabel first, then fill remaining slots
  const byClass = new Map<string, ServerTrainingSample[]>();
  for (const s of active) {
    const list = byClass.get(s.diseaseLabel) ?? [];
    list.push(s);
    byClass.set(s.diseaseLabel, list);
  }
  const selected: ServerTrainingSample[] = [];
  let round = 0;
  while (selected.length < maxExamples) {
    let added = false;
    for (const list of byClass.values()) {
      if (list[round] && selected.length < maxExamples) {
        selected.push(list[round]);
        added = true;
      }
    }
    if (!added) break;
    round++;
  }
  return selected;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Clear sky';
  if (code <= 3) return 'Partly cloudy';
  if (code <= 48) return 'Morning fog';
  if (code <= 57) return 'Light drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow / sleet';
  if (code <= 82) return 'Rain showers';
  if (code <= 99) return 'Thunderstorm';
  return 'Variable conditions';
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  let trainingSamples: ServerTrainingSample[] = loadTrainingSamples();

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      serverTime: new Date().toISOString(),
      activeTrainingSamples: trainingSamples.filter((s) => s.active).length,
    });
  });

  // Custom Disease Training Dataset CRUD
  app.get('/api/training-samples', (_req, res) => {
    const publicSamples = trainingSamples.map(({ imageBase64: _b64, ...rest }) => rest);
    res.json({
      samples: publicSamples,
      activeCount: trainingSamples.filter((s) => s.active).length,
      classes: Array.from(new Set(trainingSamples.filter((s) => s.active).map((s) => s.diseaseLabel))),
    });
  });

  app.post('/api/training-samples', (req, res) => {
    const incoming = Array.isArray(req.body?.samples)
      ? req.body.samples
      : req.body?.sample
        ? [req.body.sample]
        : [];
    if (incoming.length === 0) {
      res.status(400).json({ error: 'Provide at least one training sample.' });
      return;
    }

    const created: ServerTrainingSample[] = [];
    for (const item of incoming) {
      if (!item?.diseaseLabel || (!item?.imageUrl && !item?.imageBase64)) continue;
      const sample: ServerTrainingSample = {
        id: item.id || `train-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        diseaseLabel: String(item.diseaseLabel).trim(),
        scientificName: String(item.scientificName || 'Custom field reference').trim(),
        crop: String(item.crop || 'Maize / Corn').trim(),
        pathogenType: String(item.pathogenType || 'Fungal'),
        severity:
          item.severity === 'Healthy' || item.severity === 'Monitor' || item.severity === 'Alert'
            ? item.severity
            : 'Alert',
        visualNotes: String(item.visualNotes || '').trim(),
        imageUrl: item.imageUrl || (item.imageBase64 ? `data:${item.mimeType || 'image/jpeg'};base64,${item.imageBase64}` : ''),
        imageBase64: item.imageBase64,
        mimeType: item.mimeType || 'image/jpeg',
        active: item.active !== false,
        addedAt: new Date().toISOString(),
        source: item.source || 'Custom Upload',
      };
      created.push(sample);
    }

    trainingSamples = [...created, ...trainingSamples];
    saveTrainingSamples(trainingSamples);

    res.status(201).json({
      createdCount: created.length,
      samples: trainingSamples.map(({ imageBase64: _b64, ...rest }) => rest),
    });
  });

  app.patch('/api/training-samples/:id', (req, res) => {
    const { id } = req.params;
    const idx = trainingSamples.findIndex((s) => s.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'Training sample not found.' });
      return;
    }
    const patch = req.body ?? {};
    const existing = trainingSamples[idx];
    trainingSamples[idx] = {
      ...existing,
      diseaseLabel: typeof patch.diseaseLabel === 'string' ? patch.diseaseLabel.trim() : existing.diseaseLabel,
      scientificName:
        typeof patch.scientificName === 'string' ? patch.scientificName.trim() : existing.scientificName,
      crop: typeof patch.crop === 'string' ? patch.crop.trim() : existing.crop,
      pathogenType: typeof patch.pathogenType === 'string' ? patch.pathogenType : existing.pathogenType,
      severity:
        patch.severity === 'Healthy' || patch.severity === 'Monitor' || patch.severity === 'Alert'
          ? patch.severity
          : existing.severity,
      visualNotes: typeof patch.visualNotes === 'string' ? patch.visualNotes.trim() : existing.visualNotes,
      active: typeof patch.active === 'boolean' ? patch.active : existing.active,
    };
    saveTrainingSamples(trainingSamples);
    const { imageBase64: _b64, ...clean } = trainingSamples[idx];
    res.json({ sample: clean });
  });

  app.delete('/api/training-samples/:id', (req, res) => {
    const { id } = req.params;
    const before = trainingSamples.length;
    trainingSamples = trainingSamples.filter((s) => s.id !== id);
    if (trainingSamples.length === before) {
      res.status(404).json({ error: 'Training sample not found.' });
      return;
    }
    saveTrainingSamples(trainingSamples);
    res.json({ deletedId: id, remaining: trainingSamples.length });
  });

  // AI Plant Disease Diagnosis via Gemini Vision (server-side with Multimodal Few-Shot Training)
  app.post('/api/diagnose', async (req, res) => {
    try {
      const {
        imageBase64,
        mimeType = 'image/jpeg',
        cropType = 'Unknown Crop',
        zoneName = 'Field Zone',
        moisture,
        humidity,
        weatherSummary,
      } = req.body ?? {};

      if (!imageBase64 || typeof imageBase64 !== 'string') {
        res.status(400).json({ error: 'An image payload (imageBase64) is required for diagnosis.' });
        return;
      }

      const cleanedBase64 = imageBase64.includes(',')
        ? imageBase64.split(',')[1]
        : imageBase64;

      const ai = getGeminiClient();

      // Build multimodal few-shot training reference parts from active farm dataset
      const selectedRefs = selectBalancedTrainingSamples(trainingSamples, 6);
      const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
      let loadedRefCount = 0;

      if (selectedRefs.length > 0) {
        parts.push({
          text:
            'CUSTOM FARM TRAINING LIBRARY: Below are labeled disease reference images trained by the farm operator. Compare the target camera frame closely against these visual lesion patterns, vein distributions, and orientation-augmented examples. If the target frame matches one of these trained disease classes, prioritize its exact disease label in diseaseName and set matchedTrainingClass to that exact label; otherwise set matchedTrainingClass to "None".',
        });

        for (const ref of selectedRefs) {
          const encoded = resolveSampleImageBase64(ref);
          if (!encoded) continue;
          loadedRefCount++;
          parts.push({
            text: `Training Reference #${loadedRefCount} — Trained Label: "${ref.diseaseLabel}" | Scientific: "${ref.scientificName}" | Crop: "${ref.crop}" | Pathogen: ${ref.pathogenType} | Severity: ${ref.severity} | Visual Cues: ${ref.visualNotes}`,
          });
          parts.push({
            inlineData: {
              mimeType: encoded.mimeType,
              data: encoded.data,
            },
          });
        }
      }

      const promptText = [
        `TARGET CAMERA FRAME TO DIAGNOSE — Field zone "${zoneName}" (${cropType}).`,
        moisture !== undefined ? `Current soil moisture: ${moisture}%.` : '',
        humidity !== undefined ? `Canopy relative humidity: ${humidity}%.` : '',
        weatherSummary ? `Local forecast context: ${weatherSummary}.` : '',
        'Provide a concise, practical agronomic plant pathology assessment suitable for a farm operator.',
        'If the target leaf matches one of the Custom Farm Training Library examples above, use its trained label and note the matching lesion morphology.',
        'If foliage is healthy with no visible disease lesions or pests, set status to "Healthy", diseaseName to "Healthy Foliage", pathogenType to "None", affectedAreaPercent to 0, and matchedTrainingClass to "None".',
        'If early or mild symptoms appear, set status to "Monitor". If active fungal/bacterial/viral infection or significant stress is present, set status to "Alert".',
        'Include an actionable irrigation adjustment tailored to prevent pathogen spread or alleviate water stress.',
      ]
        .filter(Boolean)
        .join(' ');

      parts.push({ text: promptText });
      parts.push({
        inlineData: {
          mimeType,
          data: cleanedBase64,
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: {
          parts,
        },
        config: {
          systemInstruction:
            'You are an expert agricultural plant pathologist and precision irrigation agronomist integrated with an autonomous field scouting robot. You have been conditioned on the farm operator custom visual training library. Return accurate, concise, field-actionable JSON matching the schema.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              diseaseName: {
                type: Type.STRING,
                description: 'Common name of the detected plant disease (matching the trained label if applicable) or "Healthy Foliage".',
              },
              scientificName: {
                type: Type.STRING,
                description: 'Pathogen Latin name or "No pathogen detected".',
              },
              matchedTrainingClass: {
                type: Type.STRING,
                description: 'Exact Trained Label from the Custom Farm Training Library if matched, or "None".',
              },
              status: {
                type: Type.STRING,
                description: 'One of: Healthy, Monitor, Alert',
              },
              confidence: {
                type: Type.NUMBER,
                description: 'Diagnostic confidence percentage from 0 to 100.',
              },
              affectedAreaPercent: {
                type: Type.NUMBER,
                description: 'Estimated percentage of visible leaf canopy affected (0-100).',
              },
              pathogenType: {
                type: Type.STRING,
                description: 'One of: Fungal, Bacterial, Viral, Nutrient, Pest, None',
              },
              summary: {
                type: Type.STRING,
                description: '2-sentence plain-English agronomic finding for the farmer.',
              },
              symptomsObserved: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 specific visual symptoms visible in the image.',
              },
              treatmentProtocol: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 prioritized field actions or organic/targeted treatments.',
              },
              irrigationRecommendation: {
                type: Type.OBJECT,
                properties: {
                  action: {
                    type: Type.STRING,
                    description: 'One of: Reduce, Maintain, Increase, Pause',
                  },
                  deltaPercent: {
                    type: Type.NUMBER,
                    description: 'Suggested percentage change in watering volume (e.g. -25, 0, 15).',
                  },
                  rationale: {
                    type: Type.STRING,
                    description: 'Why this watering adjustment helps control disease or stress.',
                  },
                  suggestedTargetMoisture: {
                    type: Type.NUMBER,
                    description: 'Recommended soil moisture setpoint percentage (25-80).',
                  },
                },
                required: ['action', 'deltaPercent', 'rationale', 'suggestedTargetMoisture'],
              },
            },
            required: [
              'diseaseName',
              'scientificName',
              'matchedTrainingClass',
              'status',
              'confidence',
              'affectedAreaPercent',
              'pathogenType',
              'summary',
              'symptomsObserved',
              'treatmentProtocol',
              'irrigationRecommendation',
            ],
          },
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'Model returned an empty pathology response.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      const normalizedStatus =
        parsed.status === 'Alert' || parsed.status === 'Monitor' || parsed.status === 'Healthy'
          ? parsed.status
          : 'Monitor';

      res.json({
        ...parsed,
        status: normalizedStatus,
        trainingSamplesUsed: loadedRefCount,
        analyzedAt: new Date().toISOString(),
      });
    } catch (error: unknown) {
      const err = error as { status?: number; message?: string };
      console.error('Plant diagnosis error:', err);
      const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
      res.status(status).json({
        error:
          err?.message ||
          'Unable to complete plant disease analysis. Check your API key in Settings > Secrets and try again.',
      });
    }
  });

  // Live Agricultural Weather & FAO Evapotranspiration Forecast (Open-Meteo)
  app.get('/api/weather', async (req, res) => {
    try {
      const lat = Number(req.query.lat ?? 36.6777);
      const lon = Number(req.query.lon ?? -121.6555);
      const locationName = String(req.query.name ?? 'Salinas Valley, CA');

      const params = new URLSearchParams({
        latitude: String(lat),
        longitude: String(lon),
        current: 'temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code',
        daily:
          'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,wind_speed_10m_max',
        timezone: 'auto',
        forecast_days: '7',
      });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 7000);

      const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        throw new Error(`Weather provider responded with HTTP ${upstream.status}`);
      }

      const data = await upstream.json();
      const daily = data.daily ?? {};
      const dates: string[] = daily.time ?? [];

      const forecast = dates.map((dateStr: string, idx: number) => ({
        date: dateStr,
        condition: weatherCodeToLabel(Number(daily.weather_code?.[idx] ?? 0)),
        weatherCode: Number(daily.weather_code?.[idx] ?? 0),
        tempMaxC: Math.round((Number(daily.temperature_2m_max?.[idx] ?? 22)) * 10) / 10,
        tempMinC: Math.round((Number(daily.temperature_2m_min?.[idx] ?? 11)) * 10) / 10,
        precipMm: Math.round((Number(daily.precipitation_sum?.[idx] ?? 0)) * 10) / 10,
        precipProb: Math.round(Number(daily.precipitation_probability_max?.[idx] ?? 0)),
        et0Mm: Math.round((Number(daily.et0_fao_evapotranspiration?.[idx] ?? 3.8)) * 10) / 10,
        windMaxKmh: Math.round(Number(daily.wind_speed_10m_max?.[idx] ?? 14)),
      }));

      res.json({
        locationName,
        lat,
        lon,
        fetchedAt: new Date().toISOString(),
        source: 'Open-Meteo Agricultural Forecast',
        current: {
          tempC: Math.round(Number(data.current?.temperature_2m ?? 19.4) * 10) / 10,
          humidity: Math.round(Number(data.current?.relative_humidity_2m ?? 58)),
          precipMm: Math.round(Number(data.current?.precipitation ?? 0) * 10) / 10,
          windKmh: Math.round(Number(data.current?.wind_speed_10m ?? 11)),
          condition: weatherCodeToLabel(Number(data.current?.weather_code ?? 1)),
          weatherCode: Number(data.current?.weather_code ?? 1),
        },
        forecast,
      });
    } catch (error: unknown) {
      const err = error as { message?: string };
      console.error('Weather fetch error:', err?.message);
      res.status(502).json({
        error: 'Live weather station temporarily unreachable. Cached forecast will be used.',
      });
    }
  });

  // Offline Sync Reconciliation Endpoint
  app.post('/api/sync', (req, res) => {
    const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
    const syncedAt = new Date().toISOString();
    res.json({
      syncedCount: operations.length,
      syncedIds: operations.map((op: { id?: string }) => op.id).filter(Boolean),
      syncedAt,
    });
  });

  const httpServer = http.createServer(app);

  if (!isProduction) {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`PlantWise server running on http://0.0.0.0:${PORT}`);
  });
}

createApp();
