import './style.css'
import sampleHero from './assets/hero.png'

type Severity = 'low' | 'medium' | 'high'

type Detection = {
  id: string
  label: string
  confidence: number
  severity: Severity
  x: number
  y: number
  width: number
  height: number
  finding: string
  specialty: string
}

type Measurement = {
  label: string
  value: string
  trend: string
}

type UploadResponse = {
  caseId: string
  imageId: string
  imageUrl: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

type AnalysisResponse = {
  detections: Detection[]
  processingTime: number
  summary: string
  assistant: string
  reportSections: Array<{
    organ: string
    specialty: string
    note: string
  }>
  measurements: Measurement[]
}

type CaseRecord = UploadResponse & {
  detections: Detection[]
  summary: string
  assistant: string
  reportSections: AnalysisResponse['reportSections']
  measurements: Measurement[]
}

type View = 'upload' | 'dashboard'

type State = {
  view: View
  dragActive: boolean
  uploadProgress: number
  uploadError: string
  analyzeError: string
  isUploading: boolean
  isAnalyzing: boolean
  selectedFile: File | null
  selectedCaseId: string | null
  reportHistory: CaseRecord[]
  hoveredDetectionId: string | null
}

const API_BASE_URL = 'http://localhost:5000'
const MAX_FILE_SIZE = 50 * 1024 * 1024
const ACCEPTED_TYPES = ['image/jpeg', 'image/png']

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App root not found')
}

const state: State = {
  view: 'upload',
  dragActive: false,
  uploadProgress: 0,
  uploadError: '',
  analyzeError: '',
  isUploading: false,
  isAnalyzing: false,
  selectedFile: null,
  selectedCaseId: null,
  reportHistory: [],
  hoveredDetectionId: null,
}

let currentViewer: { destroy: () => void } | null = null
let previewObjectUrl: string | null = null

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function severityLabel(severity: Severity) {
  if (severity === 'high') return 'Priority'
  if (severity === 'medium') return 'Review'
  return 'Monitor'
}

function getSelectedCase() {
  return state.reportHistory.find((item) => item.caseId === state.selectedCaseId) ?? null
}

function setSelectedCase(caseId: string) {
  state.selectedCaseId = caseId
  state.view = 'dashboard'
  state.hoveredDetectionId = null
  render()
}

function updateState(partial: Partial<State>) {
  Object.assign(state, partial)
  render()
}

function render() {
  currentViewer?.destroy()
  currentViewer = null

  const currentCase = getSelectedCase()
  app!.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <div>
            <p class="eyebrow">MedSee.ai</p>
            <h1>Imaging Intelligence Workspace</h1>
          </div>
        </div>
        <div class="topbar-actions">
          <span class="status-pill">Phase 1 + 2 MVP</span>
          <span class="status-dot"></span>
        </div>
      </header>
      ${
        state.view === 'upload' || !currentCase
          ? renderUploadView()
          : renderDashboardView(currentCase)
      }
    </div>
  `

  if (state.view === 'upload' || !currentCase) {
    bindUploadView()
  } else {
    bindDashboardView(currentCase)
  }
}

function renderUploadView() {
  const previewUrl = previewObjectUrl ?? ''

  return `
    <main class="upload-page">
      <section class="hero-panel">
        <div class="hero-copy">
          <p class="eyebrow">Radiology Intake</p>
          <h2>Upload an MRI or X-ray and generate a structured AI-assisted report.</h2>
          <p class="hero-text">
            Start with a JPEG or PNG scan. The workflow validates the study, stores it on the backend,
            runs mock detection, and builds a clinician-facing dashboard with findings, measurements,
            and exportable notes.
          </p>
          <div class="hero-stats">
            <div>
              <strong>50MB</strong>
              <span>Max upload</span>
            </div>
            <div>
              <strong>2 pages</strong>
              <span>Intake + dashboard</span>
            </div>
            <div>
              <strong>AI ready</strong>
              <span>Mock inference flow</span>
            </div>
          </div>
        </div>
        <aside class="hero-card">
          <div class="hero-card-panel">
            <span class="panel-label">Workflow</span>
            <ol>
              <li>Upload scan</li>
              <li>Validate image</li>
              <li>Analyze findings</li>
              <li>Review report</li>
            </ol>
          </div>
          <div class="hero-card-panel muted">
            <span class="panel-label">Supported</span>
            <p>JPEG and PNG studies with responsive preview, upload progress, and error handling.</p>
          </div>
        </aside>
      </section>
      <section class="intake-grid">
        <div class="dropzone-card">
          <label class="dropzone ${state.dragActive ? 'is-dragging' : ''}" for="scan-input">
            <input id="scan-input" type="file" accept="image/png,image/jpeg" />
            <span class="dropzone-badge">New case</span>
            <h3>Drop medical imaging here</h3>
            <p>or click to select a file from disk</p>
            <div class="dropzone-meta">
              <span>JPEG / PNG</span>
              <span>Up to 50MB</span>
            </div>
          </label>
          ${
            state.uploadError
              ? `<p class="message error">${escapeHtml(state.uploadError)}</p>`
              : ''
          }
          ${
            state.isUploading
              ? `
                <div class="progress-block">
                  <div class="progress-row">
                    <span>Uploading study</span>
                    <strong>${state.uploadProgress}%</strong>
                  </div>
                  <div class="progress-track"><span style="width:${state.uploadProgress}%"></span></div>
                </div>
              `
              : ''
          }
          <div class="action-row">
            <button class="secondary-button" id="sample-button" type="button">Load sample state</button>
            <button class="primary-button" id="upload-button" type="button" ${
              state.selectedFile && !state.isUploading ? '' : 'disabled'
            }>
              ${state.isUploading ? 'Uploading...' : 'Upload & Analyze'}
            </button>
          </div>
        </div>
        <div class="preview-card">
          <div class="card-head">
            <div>
              <p class="eyebrow">Preview</p>
              <h3>${state.selectedFile ? escapeHtml(state.selectedFile.name) : 'No file selected'}</h3>
            </div>
            ${
              state.selectedFile
                ? `<span class="status-pill subtle">${formatBytes(state.selectedFile.size)}</span>`
                : ''
            }
          </div>
          ${
            state.selectedFile
              ? `
                <div class="preview-image-wrap">
                  <img class="preview-image" src="${previewUrl}" alt="Selected medical scan preview" />
                </div>
                <dl class="preview-details">
                  <div><dt>Type</dt><dd>${escapeHtml(state.selectedFile.type || 'Unknown')}</dd></div>
                  <div><dt>Last updated</dt><dd>${formatDate(new Date(state.selectedFile.lastModified).toISOString())}</dd></div>
                </dl>
              `
              : `
                <div class="empty-preview">
                  <div class="scan-silhouette" aria-hidden="true"></div>
                  <p>Select a study to preview it here before sending it to the backend.</p>
                </div>
              `
          }
        </div>
      </section>
    </main>
  `
}

function renderDashboardView(currentCase: CaseRecord) {
  const avgConfidence = currentCase.detections.length
    ? Math.round(
        (currentCase.detections.reduce((total, item) => total + item.confidence, 0) /
          currentCase.detections.length) *
          100,
      )
    : 0

  const selectedFinding = currentCase.detections.find(
    (item) => item.id === state.hoveredDetectionId,
  )

  return `
    <main class="dashboard-page">
      <section class="dashboard-toolbar">
        <div>
          <p class="eyebrow">Case report</p>
          <h2>${escapeHtml(currentCase.fileName.replace(/\.[^.]+$/, '') || 'Untitled study')}</h2>
        </div>
        <div class="toolbar-actions">
          <button class="secondary-button" id="history-button" type="button" ${
            state.reportHistory.length > 1 ? '' : 'disabled'
          }>Previous Reports</button>
          <button class="primary-button" id="new-scan-button" type="button">Add More Scans</button>
        </div>
      </section>

      ${
        state.analyzeError ? `<p class="message error dashboard-error">${escapeHtml(state.analyzeError)}</p>` : ''
      }

      <section class="dashboard-grid">
        <article class="panel report-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Generated report</p>
              <h3>Clinical narrative</h3>
            </div>
            <span class="status-pill subtle">${currentCase.detections.length} findings</span>
          </div>
          <div class="report-highlight">
            <span>/organ</span>
            <div class="organ-menu">
              ${currentCase.reportSections
                .map(
                  (section) => `
                    <button class="organ-item" type="button" data-organ="${escapeHtml(section.organ)}">
                      <strong>${escapeHtml(section.organ)}</strong>
                      <span>${escapeHtml(section.specialty)}</span>
                    </button>
                  `,
                )
                .join('')}
            </div>
          </div>
          <div class="report-lines">
            ${currentCase.reportSections
              .map(
                (section) => `
                  <div class="report-section">
                    <h4>${escapeHtml(section.organ)}</h4>
                    <p>${escapeHtml(section.note)}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
          <button class="primary-button" id="export-button" type="button">Export Report</button>
        </article>

        <article class="panel metrics-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Measurements</p>
              <h3>AI generated metrics</h3>
            </div>
            <span class="ai-tag">AI generated</span>
          </div>
          <div class="metrics-grid">
            ${currentCase.measurements
              .map(
                (item) => `
                  <div class="metric-card">
                    <span>${escapeHtml(item.label)}</span>
                    <strong>${escapeHtml(item.value)}</strong>
                    <small>${escapeHtml(item.trend)}</small>
                  </div>
                `,
              )
              .join('')}
          </div>
          <div class="assistant-card">
            <h3>AI Assistant</h3>
            <p>${escapeHtml(currentCase.assistant)}</p>
          </div>
        </article>

        <article class="panel viewer-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Study viewer</p>
              <h3>Whole image review</h3>
            </div>
            <span class="status-pill subtle">${formatDate(currentCase.uploadedAt)}</span>
          </div>
          <div class="viewer-stage">
            <canvas id="scan-canvas" width="880" height="660"></canvas>
            ${
              state.isAnalyzing
                ? `<div class="viewer-overlay">Analyzing study...</div>`
                : selectedFinding
                  ? `<div class="viewer-overlay compact">${escapeHtml(selectedFinding.label)} · ${Math.round(selectedFinding.confidence * 100)}%</div>`
                  : ''
            }
          </div>
          <div class="viewer-actions">
            <button class="secondary-button" id="zoom-in-button" type="button">Zoom In</button>
            <button class="secondary-button" id="zoom-out-button" type="button">Zoom Out</button>
            <button class="secondary-button" id="reset-view-button" type="button">Reset View</button>
            <button class="primary-button" id="analyze-button" type="button" ${
              state.isAnalyzing ? 'disabled' : ''
            }>${state.isAnalyzing ? 'Analyzing...' : 'Run Analysis'}</button>
          </div>
        </article>

        <article class="panel summary-panel">
          <div class="panel-heading">
            <div>
              <p class="eyebrow">Case intelligence</p>
              <h3>Detection summary</h3>
            </div>
            <span class="status-pill subtle">${avgConfidence}% avg confidence</span>
          </div>
          <div class="summary-copy">
            <p>${escapeHtml(currentCase.summary)}</p>
          </div>
          <div class="summary-stats">
            <div><span>Image</span><strong>${escapeHtml(currentCase.fileName)}</strong></div>
            <div><span>File size</span><strong>${formatBytes(currentCase.fileSize)}</strong></div>
            <div><span>Study type</span><strong>${escapeHtml(currentCase.mimeType)}</strong></div>
            <div><span>Processing</span><strong>${currentCase.detections.length ? 'Completed' : 'Pending'}</strong></div>
          </div>
          <div class="findings-list">
            ${currentCase.detections
              .map(
                (item) => `
                  <button
                    class="finding-item ${state.hoveredDetectionId === item.id ? 'active' : ''}"
                    type="button"
                    data-detection-id="${item.id}"
                  >
                    <div>
                      <strong>${escapeHtml(item.label)}</strong>
                      <span>${escapeHtml(item.finding)}</span>
                    </div>
                    <div class="finding-meta">
                      <em class="severity ${item.severity}">${severityLabel(item.severity)}</em>
                      <span>${Math.round(item.confidence * 100)}%</span>
                    </div>
                  </button>
                `,
              )
              .join('')}
          </div>
        </article>
      </section>
    </main>
  `
}

function bindUploadView() {
  const input = document.querySelector<HTMLInputElement>('#scan-input')
  const uploadButton = document.querySelector<HTMLButtonElement>('#upload-button')
  const sampleButton = document.querySelector<HTMLButtonElement>('#sample-button')
  const dropzone = document.querySelector<HTMLLabelElement>('.dropzone')

  input?.addEventListener('change', () => {
    const file = input.files?.[0] ?? null
    handleFileSelection(file)
  })

  sampleButton?.addEventListener('click', () => {
    const sampleCase: CaseRecord = {
      caseId: 'sample-case',
      imageId: 'sample-image',
      imageUrl: sampleHero,
      fileName: 'whole-spine-mri.png',
      fileSize: 2_580_000,
      mimeType: 'image/png',
      uploadedAt: new Date().toISOString(),
      detections: [
        {
          id: 'sample-1',
          label: 'Spinal Cord',
          confidence: 0.96,
          severity: 'medium',
          x: 0.44,
          y: 0.18,
          width: 0.12,
          height: 0.5,
          finding: 'Subtle signal irregularity through the thoracic region.',
          specialty: 'Neurological',
        },
        {
          id: 'sample-2',
          label: 'Vertebrae',
          confidence: 0.92,
          severity: 'low',
          x: 0.4,
          y: 0.28,
          width: 0.18,
          height: 0.44,
          finding: 'Mild alignment change without acute compression.',
          specialty: 'Musculoskeletal',
        },
      ],
      summary:
        'Mock review indicates mild thoracic spinal irregularity with preserved overall alignment. Findings should be correlated with formal radiology review.',
      assistant:
        'Recommend correlating the thoracic signal irregularity with symptoms and prior imaging. No urgent compressive pattern is suggested in this mock output.',
      reportSections: [
        {
          organ: 'Vertebrae',
          specialty: 'Musculoskeletal',
          note: 'Mild thoracic curvature change is visible without acute vertebral body collapse.',
        },
        {
          organ: 'Spinal Cord',
          specialty: 'Neurological',
          note: 'Subtle signal prominence is present centrally and merits comparison with prior sequences.',
        },
      ],
      measurements: [
        { label: 'Detected findings', value: '2', trend: '1 medium priority' },
        { label: 'Highest confidence', value: '96%', trend: 'Spinal Cord' },
        { label: 'Study integrity', value: 'Stable', trend: 'No upload loss' },
      ],
    }

    state.reportHistory = [sampleCase]
    setSelectedCase(sampleCase.caseId)
  })

  uploadButton?.addEventListener('click', async () => {
    if (!state.selectedFile || state.isUploading) return

    updateState({
      isUploading: true,
      uploadError: '',
      analyzeError: '',
      uploadProgress: 0,
    })

    try {
      const uploadedCase = await uploadFile(state.selectedFile)
      const record: CaseRecord = {
        ...uploadedCase,
        detections: [],
        summary: 'Analysis has not been run yet.',
        assistant: 'Run the AI workflow to generate an assistant summary for this study.',
        reportSections: [],
        measurements: [],
      }
      state.reportHistory.unshift(record)
      state.selectedCaseId = record.caseId
      state.view = 'dashboard'
      render()
      await runAnalysis(record.caseId)
    } catch (error) {
      updateState({
        isUploading: false,
        uploadError: error instanceof Error ? error.message : 'Upload failed.',
      })
    }
  })

  for (const eventName of ['dragenter', 'dragover']) {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault()
      updateState({ dragActive: true })
    })
  }

  for (const eventName of ['dragleave', 'drop']) {
    dropzone?.addEventListener(eventName, (event) => {
      event.preventDefault()
      updateState({ dragActive: false })
    })
  }

  dropzone?.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0] ?? null
    handleFileSelection(file)
  })
}

function bindDashboardView(currentCase: CaseRecord) {
  const analyzeButton = document.querySelector<HTMLButtonElement>('#analyze-button')
  const newScanButton = document.querySelector<HTMLButtonElement>('#new-scan-button')
  const historyButton = document.querySelector<HTMLButtonElement>('#history-button')
  const exportButton = document.querySelector<HTMLButtonElement>('#export-button')
  const zoomInButton = document.querySelector<HTMLButtonElement>('#zoom-in-button')
  const zoomOutButton = document.querySelector<HTMLButtonElement>('#zoom-out-button')
  const resetViewButton = document.querySelector<HTMLButtonElement>('#reset-view-button')

  analyzeButton?.addEventListener('click', () => {
    void runAnalysis(currentCase.caseId)
  })

  newScanButton?.addEventListener('click', () => {
    updateState({
      view: 'upload',
      selectedFile: null,
      uploadError: '',
      analyzeError: '',
      uploadProgress: 0,
      isUploading: false,
      isAnalyzing: false,
    })
  })

  historyButton?.addEventListener('click', () => {
    if (state.reportHistory.length < 2 || !state.selectedCaseId) return
    const currentIndex = state.reportHistory.findIndex((item) => item.caseId === state.selectedCaseId)
    const nextIndex = currentIndex === state.reportHistory.length - 1 ? 0 : currentIndex + 1
    setSelectedCase(state.reportHistory[nextIndex].caseId)
  })

  exportButton?.addEventListener('click', () => {
    const lines = [
      `MedSee.ai Report`,
      `Case: ${currentCase.fileName}`,
      `Uploaded: ${formatDate(currentCase.uploadedAt)}`,
      '',
      'Summary',
      currentCase.summary,
      '',
      'Findings',
      ...currentCase.detections.map(
        (item) =>
          `- ${item.label} (${Math.round(item.confidence * 100)}% confidence, ${item.severity}): ${item.finding}`,
      ),
      '',
      'Assistant',
      currentCase.assistant,
    ]

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${currentCase.fileName.replace(/\.[^.]+$/, '')}-report.txt`
    link.click()
    URL.revokeObjectURL(link.href)
  })

  for (const element of document.querySelectorAll<HTMLButtonElement>('[data-detection-id]')) {
    element.addEventListener('mouseenter', () => {
      updateState({ hoveredDetectionId: element.dataset.detectionId ?? null })
    })
    element.addEventListener('focus', () => {
      updateState({ hoveredDetectionId: element.dataset.detectionId ?? null })
    })
    element.addEventListener('mouseleave', () => {
      updateState({ hoveredDetectionId: null })
    })
    element.addEventListener('blur', () => {
      updateState({ hoveredDetectionId: null })
    })
    element.addEventListener('click', () => {
      updateState({
        hoveredDetectionId:
          state.hoveredDetectionId === element.dataset.detectionId ? null : element.dataset.detectionId ?? null,
      })
    })
  }

  const viewer = createViewer(currentCase)
  currentViewer = viewer

  zoomInButton?.addEventListener('click', () => viewer.zoom(1.15))
  zoomOutButton?.addEventListener('click', () => viewer.zoom(1 / 1.15))
  resetViewButton?.addEventListener('click', () => viewer.reset())
}

function handleFileSelection(file: File | null) {
  if (previewObjectUrl) {
    URL.revokeObjectURL(previewObjectUrl)
    previewObjectUrl = null
  }

  if (!file) {
    updateState({ selectedFile: null, uploadError: '' })
    return
  }

  if (!ACCEPTED_TYPES.includes(file.type)) {
    updateState({
      selectedFile: null,
      uploadError: 'Invalid file type. Upload a JPEG or PNG image.',
    })
    return
  }

  if (file.size > MAX_FILE_SIZE) {
    updateState({
      selectedFile: null,
      uploadError: 'File too large. The maximum supported size is 50MB.',
    })
    return
  }

  previewObjectUrl = URL.createObjectURL(file)
  updateState({
    selectedFile: file,
    uploadError: '',
    uploadProgress: 0,
  })
}

function uploadFile(file: File) {
  return new Promise<UploadResponse>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/api/upload`)
    xhr.responseType = 'json'

    xhr.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return
      const progress = Math.round((event.loaded / event.total) * 100)
      updateState({ uploadProgress: progress })
    })

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.response as UploadResponse)
        updateState({ isUploading: false, uploadProgress: 100 })
        return
      }

      reject(new Error(xhr.response?.error ?? 'Upload failed.'))
    })

    xhr.addEventListener('error', () => {
      reject(new Error('Unable to reach the upload service at localhost:5000.'))
    })

    const data = new FormData()
    data.append('scan', file)
    xhr.send(data)
  })
}

async function runAnalysis(caseId: string) {
  updateState({
    isUploading: false,
    isAnalyzing: true,
    analyzeError: '',
  })

  try {
    const response = await fetch(`${API_BASE_URL}/api/detect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ caseId }),
    })

    const payload = (await response.json()) as AnalysisResponse & { error?: string }
    if (!response.ok) {
      throw new Error(payload.error ?? 'Analysis failed.')
    }

    state.reportHistory = state.reportHistory.map((item) =>
      item.caseId === caseId ? { ...item, ...payload } : item,
    )
    updateState({ isAnalyzing: false })
  } catch (error) {
    updateState({
      isAnalyzing: false,
      analyzeError: error instanceof Error ? error.message : 'Analysis failed.',
    })
  }
}

function createViewer(currentCase: CaseRecord) {
  const canvas = document.querySelector<HTMLCanvasElement>('#scan-canvas')
  if (!canvas) {
    return {
      zoom() {},
      reset() {},
      destroy() {},
    }
  }

  const context = canvas.getContext('2d')
  if (!context) {
    return {
      zoom() {},
      reset() {},
      destroy() {},
    }
  }

  const viewerCanvas = canvas
  const viewerContext = context

  const image = new Image()
  image.crossOrigin = 'anonymous'

  let scale = 1
  let offsetX = 0
  let offsetY = 0
  let isDragging = false
  let lastX = 0
  let lastY = 0

  function draw() {
    viewerContext.clearRect(0, 0, viewerCanvas.width, viewerCanvas.height)
    viewerContext.fillStyle = '#061f20'
    viewerContext.fillRect(0, 0, viewerCanvas.width, viewerCanvas.height)

    if (!image.complete || !image.naturalWidth) return

    const fit = Math.min(
      viewerCanvas.width / image.naturalWidth,
      viewerCanvas.height / image.naturalHeight,
    )
    const drawWidth = image.naturalWidth * fit * scale
    const drawHeight = image.naturalHeight * fit * scale
    const baseX = (viewerCanvas.width - drawWidth) / 2 + offsetX
    const baseY = (viewerCanvas.height - drawHeight) / 2 + offsetY

    viewerContext.save()
    viewerContext.shadowColor = 'rgba(89, 225, 197, 0.25)'
    viewerContext.shadowBlur = 30
    viewerContext.drawImage(image, baseX, baseY, drawWidth, drawHeight)
    viewerContext.restore()

    for (const detection of currentCase.detections) {
      const x = baseX + detection.x * drawWidth
      const y = baseY + detection.y * drawHeight
      const width = detection.width * drawWidth
      const height = detection.height * drawHeight
      const isActive = state.hoveredDetectionId === detection.id

      viewerContext.save()
      viewerContext.strokeStyle =
        detection.severity === 'high'
          ? '#ff7c76'
          : detection.severity === 'medium'
            ? '#ffd166'
            : '#61e4b4'
      viewerContext.lineWidth = isActive ? 5 : 3
      viewerContext.fillStyle = isActive
        ? 'rgba(255, 255, 255, 0.12)'
        : 'rgba(255, 255, 255, 0.05)'
      viewerContext.strokeRect(x, y, width, height)
      viewerContext.fillRect(x, y, width, height)

      const label = `${detection.label} ${Math.round(detection.confidence * 100)}%`
      viewerContext.font = '16px "Trebuchet MS", "Avenir Next", sans-serif'
      const labelWidth = viewerContext.measureText(label).width + 20
      viewerContext.fillStyle = '#091214'
      viewerContext.fillRect(x, Math.max(8, y - 34), labelWidth, 28)
      viewerContext.fillStyle = '#f5fffb'
      viewerContext.fillText(label, x + 10, Math.max(27, y - 15))
      viewerContext.restore()
    }
  }

  function clampPan() {
    offsetX = Math.max(-viewerCanvas.width * 0.4, Math.min(viewerCanvas.width * 0.4, offsetX))
    offsetY = Math.max(-viewerCanvas.height * 0.4, Math.min(viewerCanvas.height * 0.4, offsetY))
  }

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault()
    scale *= event.deltaY < 0 ? 1.08 : 1 / 1.08
    scale = Math.min(4, Math.max(1, scale))
    draw()
  }

  const handleMouseDown = (event: MouseEvent) => {
    isDragging = true
    lastX = event.clientX
    lastY = event.clientY
  }

  const handleMouseUp = () => {
    isDragging = false
  }

  const handleMouseMove = (event: MouseEvent) => {
    if (!isDragging) return
    offsetX += event.clientX - lastX
    offsetY += event.clientY - lastY
    lastX = event.clientX
    lastY = event.clientY
    clampPan()
    draw()
  }

  viewerCanvas.addEventListener('wheel', handleWheel)
  viewerCanvas.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mouseup', handleMouseUp)
  window.addEventListener('mousemove', handleMouseMove)

  image.addEventListener('load', draw)
  image.src = currentCase.imageUrl.startsWith('http')
    ? currentCase.imageUrl
    : `${API_BASE_URL}${currentCase.imageUrl}`

  return {
    zoom(multiplier: number) {
      scale = Math.min(4, Math.max(1, scale * multiplier))
      draw()
    },
    reset() {
      scale = 1
      offsetX = 0
      offsetY = 0
      draw()
    },
    destroy() {
      viewerCanvas.removeEventListener('wheel', handleWheel)
      viewerCanvas.removeEventListener('mousedown', handleMouseDown)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('mousemove', handleMouseMove)
    },
  }
}

render()
