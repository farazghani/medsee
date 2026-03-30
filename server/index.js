const express = require('express')
const cors = require('cors')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { randomUUID } = require('crypto')

const app = express()
const PORT = process.env.PORT || 5000
const uploadsDir = path.join(__dirname, 'uploads')

fs.mkdirSync(uploadsDir, { recursive: true })

const cases = new Map()

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir)
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase() || '.png'
    callback(null, `${randomUUID()}${extension}`)
  },
})

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, callback) => {
    if (['image/jpeg', 'image/png'].includes(file.mimetype)) {
      callback(null, true)
      return
    }

    callback(new Error('Invalid file type. Only JPEG and PNG uploads are allowed.'))
  },
})

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  }),
)
app.use(express.json())
app.use('/uploads', express.static(uploadsDir))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.post('/api/upload', (req, res) => {
  upload.single('scan')(req, res, (error) => {
    if (error) {
      const message =
        error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE'
          ? 'File too large. The maximum supported size is 50MB.'
          : error.message

      res.status(400).json({ error: message })
      return
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded.' })
      return
    }

    const caseId = randomUUID()
    const record = {
      caseId,
      imageId: req.file.filename,
      imageUrl: `/uploads/${req.file.filename}`,
      fileName: req.file.originalname,
      fileSize: req.file.size,
      mimeType: req.file.mimetype,
      uploadedAt: new Date().toISOString(),
    }

    cases.set(caseId, record)
    res.status(201).json(record)
  })
})

app.post('/api/detect', async (req, res) => {
  const { caseId } = req.body || {}
  if (!caseId || !cases.has(caseId)) {
    res.status(404).json({ error: 'Case not found.' })
    return
  }

  const currentCase = cases.get(caseId)
  const analysis = await generateAnalysis(currentCase.fileName)
  const payload = { ...currentCase, ...analysis }
  cases.set(caseId, payload)
  res.json(analysis)
})

app.use((error, _req, res, _next) => {
  console.error(error)
  res.status(500).json({ error: 'Unexpected server error.' })
})

app.listen(PORT, () => {
  console.log(`MedSee server listening on http://localhost:${PORT}`)
})

function generateAnalysis(fileName) {
  const profile = pickProfile(fileName)
  const detections = buildDetections(profile)
  const measurements = [
    {
      label: 'Detected findings',
      value: String(detections.length),
      trend: `${detections.filter((item) => item.severity !== 'low').length} require review`,
    },
    {
      label: 'Highest confidence',
      value: `${Math.round(Math.max(...detections.map((item) => item.confidence)) * 100)}%`,
      trend: detections[0].label,
    },
    {
      label: 'Processing band',
      value: `${Math.round(1.7 + Math.random() * 1.3)}s`,
      trend: 'Mock AI inference',
    },
    {
      label: 'Image quality',
      value: profile.quality,
      trend: profile.qualityNote,
    },
  ]

  return new Promise((resolve) => {
    const processingTime = Number((1.6 + Math.random() * 1.7).toFixed(2))
    setTimeout(() => {
      resolve({
        detections,
        processingTime,
        summary: profile.summary,
        assistant: profile.assistant,
        reportSections: profile.reportSections,
        measurements,
      })
    }, processingTime * 500)
  })
}

function pickProfile(fileName) {
  const normalized = fileName.toLowerCase()
  if (normalized.includes('spine') || normalized.includes('verte')) {
    return {
      summary:
        'The mock analysis suggests mild thoracic spinal irregularity with preserved gross alignment. No acute destructive pattern is highlighted, but a focused specialist review is recommended.',
      assistant:
        'Correlate the thoracic signal irregularity with symptoms and prior exams. Consider follow-up review of the highlighted vertebral and spinal cord regions.',
      quality: 'High',
      qualityNote: 'Good contrast retention',
      reportSections: [
        {
          organ: 'Vertebrae',
          specialty: 'Musculoskeletal',
          note: 'Vertebral alignment is largely maintained with subtle curvature change in the thoracic segment.',
        },
        {
          organ: 'Spinal Cord',
          specialty: 'Neurological',
          note: 'A faint signal prominence is flagged centrally and should be correlated with prior MRI sequences.',
        },
        {
          organ: 'Coronary Arteries',
          specialty: 'Cardiovascular',
          note: 'No dedicated cardiovascular assessment is implied from this study; incidental review is unremarkable in mock output.',
        },
      ],
      findings: [
        ['Spinal Cord', 'Subtle signal irregularity through the thoracic region.', 'Neurological', 'medium', 0.44, 0.18, 0.12, 0.48],
        ['Vertebrae', 'Mild alignment change without acute compression.', 'Musculoskeletal', 'low', 0.4, 0.28, 0.18, 0.44],
        ['Kidney', 'Incidental soft-tissue silhouette preserved.', 'Abdominal', 'low', 0.18, 0.56, 0.16, 0.16],
      ],
    }
  }

  if (normalized.includes('chest') || normalized.includes('lung')) {
    return {
      summary:
        'Mock review highlights a focal pulmonary opacity with mild asymmetry in the lower lobe. Findings are non-diagnostic and intended only to simulate an AI triage workflow.',
      assistant:
        'Recommend correlation with symptoms, oxygenation status, and any prior chest imaging. Lower lobe opacity is the primary AI-prioritized region.',
      quality: 'Moderate',
      qualityNote: 'Slight motion artifact',
      reportSections: [
        {
          organ: 'Lung Base',
          specialty: 'Pulmonary',
          note: 'A focal lower lobe opacity is identified with mild surrounding haziness.',
        },
        {
          organ: 'Pleura',
          specialty: 'Thoracic',
          note: 'No large pleural collection is suggested in this mock result.',
        },
      ],
      findings: [
        ['Lower Lobe', 'Focal opacity with surrounding low-grade haze.', 'Pulmonary', 'high', 0.52, 0.47, 0.2, 0.18],
        ['Hilum', 'Slight contour prominence on the right side.', 'Thoracic', 'medium', 0.44, 0.28, 0.14, 0.16],
      ],
    }
  }

  return {
    summary:
      'The uploaded study passed intake validation and the mock model identified a small number of candidate regions for review. Use the viewer and findings list to inspect each suggested area.',
    assistant:
      'The current output is a simulated inference pass. Review the listed findings, confidence values, and contextual notes before final interpretation.',
    quality: 'Stable',
    qualityNote: 'No upload corruption',
    reportSections: [
      {
        organ: 'Primary Region',
        specialty: 'General Imaging',
        note: 'A focal region of interest is highlighted with moderate confidence for clinician review.',
      },
      {
        organ: 'Adjacent Tissue',
        specialty: 'General Imaging',
        note: 'Surrounding structures remain broadly preserved in this simulated output.',
      },
    ],
    findings: [
      ['Primary Region', 'Localized feature contrast difference identified.', 'General Imaging', 'medium', 0.34, 0.22, 0.24, 0.2],
      ['Secondary Region', 'Low-priority morphology variation detected.', 'General Imaging', 'low', 0.6, 0.56, 0.16, 0.18],
    ],
  }
}

function buildDetections(profile) {
  return profile.findings.map((finding, index) => {
    const [label, description, specialty, severity, x, y, width, height] = finding
    return {
      id: `det-${index + 1}-${randomUUID().slice(0, 8)}`,
      label,
      confidence: Number((0.78 + Math.random() * 0.19).toFixed(2)),
      severity,
      x,
      y,
      width,
      height,
      finding: description,
      specialty,
    }
  })
}
