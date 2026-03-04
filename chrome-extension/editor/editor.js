/**
 * @module editor
 * Full-page guide editor for GuideSnap.
 * Manages step list, annotation canvas, step details, and export.
 */

import { createStepList } from '../components/step-list.js';
import { createToolbar, setToolState } from '../components/toolbar.js';
import { showToast } from '../components/toast.js';
import { showConfirm, showPrompt } from '../components/modal.js';
import {
  drawSpotlight,
  drawClickPulse,
  drawArrow,
  drawTextCallout,
  drawStepBadge,
  drawZoomRegion,
} from '../core/annotator.js';
import { updateGuideTimestamp } from '../core/guide-model.js';
import {
  exportAsHTML,
  exportAsPDF,
  exportAsJSON,
  downloadFile,
} from '../core/exporter.js';

// ─── DOM References ──────────────────────────────────────────────────────────

const guideTitle = document.getElementById('guideTitle');
const backBtn = document.getElementById('backBtn');
const saveBtn = document.getElementById('saveBtn');
const exportBtn = document.getElementById('exportBtn');
const exportDropdown = document.getElementById('exportDropdown');
const stepListContainer = document.getElementById('stepList');
const canvasContainer = document.getElementById('canvasContainer');
const canvas = document.getElementById('annotationCanvas');
const ctx = canvas.getContext('2d');
const emptyState = document.getElementById('emptyState');
const toolbarContainer = document.getElementById('toolbarContainer');
const addStepBtn = document.getElementById('addStepBtn');

// Details panel
const stepDetailsPanel = document.getElementById('stepDetails');
const detailsEmpty = stepDetailsPanel.querySelector('.step-details__empty');
const detailsContent = stepDetailsPanel.querySelector('.step-details__content');
const stepDescription = document.getElementById('stepDescription');
const metaUrl = document.getElementById('metaUrl');
const metaTimestamp = document.getElementById('metaTimestamp');
const metaElement = document.getElementById('metaElement');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const deleteStepBtn = document.getElementById('deleteStepBtn');

// ─── State ───────────────────────────────────────────────────────────────────

let guide = null;
let selectedStepId = null;
let activeTool = null;
let arrowStart = null;
let zoomDragStart = null;
let currentZoom = 100;
let screenshotImage = null;
let autoSaveTimer = null;

// ─── Step List ───────────────────────────────────────────────────────────────

const stepList = createStepList(stepListContainer, {
  onSelect: (id) => selectStep(id),
  onReorder: (orderedIds) => handleReorder(orderedIds),
  onDelete: (id) => handleDeleteStep(id),
  onDescriptionChange: (id, desc) => handleDescriptionChange(id, desc),
});

// ─── Toolbar ─────────────────────────────────────────────────────────────────

const toolbar = createToolbar({
  onSpotlight: (active) => {
    activeTool = active ? 'spotlight' : null;
    clearToolStatesExcept(active ? 'spotlight' : null);
  },
  onArrow: () => {
    activeTool = activeTool === 'arrow' ? null : 'arrow';
    arrowStart = null;
    clearToolStatesExcept(activeTool === 'arrow' ? 'arrow' : null);
  },
  onTextCallout: () => {
    activeTool = activeTool === 'textCallout' ? null : 'textCallout';
    clearToolStatesExcept(activeTool === 'textCallout' ? 'textCallout' : null);
  },
  onZoom: () => {
    activeTool = activeTool === 'zoom' ? null : 'zoom';
    zoomDragStart = null;
    clearToolStatesExcept(activeTool === 'zoom' ? 'zoom' : null);
  },
  onUndo: () => handleUndo(),
  onReset: () => handleReset(),
});
toolbarContainer.appendChild(toolbar);

function clearToolStatesExcept(keepTool) {
  for (const t of ['spotlight', 'arrow', 'textCallout', 'zoom']) {
    if (t !== keepTool) {
      setToolState(toolbar, t, false);
    } else {
      setToolState(toolbar, t, true);
    }
  }
}

// ─── Initialization ──────────────────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(window.location.search);
  const guideId = params.get('id');
  if (!guideId) {
    showToast('No guide ID provided', 'error');
    return;
  }

  try {
    guide = await sendMessage({ type: 'GET_GUIDE', guideId });
  } catch {
    showToast('Failed to load guide', 'error');
    return;
  }

  if (!guide) {
    showToast('Guide not found', 'error');
    return;
  }

  guideTitle.textContent = guide.title || 'Untitled Guide';
  stepList.render(guide.steps);
  updateDetailsVisibility();
  startAutoSave();
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(response);
      }
    });
  });
}

// ─── Step Selection & Canvas ─────────────────────────────────────────────────

function getSelectedStep() {
  if (!guide || !selectedStepId) return null;
  return guide.steps.find((s) => s.id === selectedStepId) || null;
}

function selectStep(id) {
  selectedStepId = id;
  stepList.selectStep(id);
  activeTool = null;
  arrowStart = null;
  clearToolStatesExcept(null);
  currentZoom = 100;
  zoomSlider.value = 100;
  zoomValue.textContent = '100%';

  const step = getSelectedStep();
  if (step) {
    renderCanvas(step);
    showStepDetails(step);
  } else {
    updateDetailsVisibility();
  }
}

async function renderCanvas(step) {
  if (!step || !step.screenshotDataUrl) {
    canvas.classList.remove('visible');
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');
  canvas.classList.add('visible');

  const img = await loadImage(step.screenshotDataUrl);
  screenshotImage = img;

  // Size canvas to image, respecting zoom
  const scale = currentZoom / 100;
  canvas.width = img.width;
  canvas.height = img.height;
  canvas.style.width = `${img.width * scale}px`;
  canvas.style.height = `${img.height * scale}px`;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);

  const { annotation, index } = step;

  // Spotlight
  if (annotation?.spotlight) {
    const { x, y, radius } = annotation.spotlight;
    drawSpotlight(ctx, x, y, radius, canvas.width, canvas.height);
  }

  // Click pulse
  if (step.meta?.x && step.meta?.y) {
    drawClickPulse(ctx, step.meta.x, step.meta.y);
  }

  // Arrows
  if (annotation?.arrows?.length) {
    for (const arrow of annotation.arrows) {
      drawArrow(ctx, arrow.fromX, arrow.fromY, arrow.toX, arrow.toY, arrow.color);
    }
  }

  // Text callouts
  if (annotation?.textCallouts?.length) {
    for (const callout of annotation.textCallouts) {
      drawTextCallout(ctx, callout.text, callout.x, callout.y, callout.options);
    }
  }

  // Zoom region
  if (annotation?.zoomRegion) {
    await drawZoomRegion(ctx, annotation.zoomRegion, step.screenshotDataUrl);
  }

  // Step badge
  drawStepBadge(ctx, (index ?? 0) + 1);
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load screenshot'));
    img.src = dataUrl;
  });
}

// ─── Step Details Panel ──────────────────────────────────────────────────────

function showStepDetails(step) {
  detailsEmpty.classList.add('hidden');
  detailsContent.classList.remove('hidden');

  stepDescription.value = step.description || '';
  metaUrl.textContent = step.meta?.url || '—';
  metaUrl.title = step.meta?.url || '';
  metaTimestamp.textContent = step.meta?.timestamp
    ? new Date(step.meta.timestamp).toLocaleString()
    : '—';
  metaElement.textContent = step.meta?.tag
    ? `<${step.meta.tag}>${step.meta.text ? ' "' + step.meta.text.slice(0, 30) + '"' : ''}`
    : '—';
}

function updateDetailsVisibility() {
  if (selectedStepId && getSelectedStep()) {
    detailsEmpty.classList.add('hidden');
    detailsContent.classList.remove('hidden');
  } else {
    detailsEmpty.classList.remove('hidden');
    detailsContent.classList.add('hidden');
    canvas.classList.remove('visible');
    emptyState.classList.remove('hidden');
  }
}

// ─── Canvas Interaction ──────────────────────────────────────────────────────

function getCanvasCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
}

canvas.addEventListener('mousedown', (e) => {
  if (!activeTool || !selectedStepId) return;
  const step = getSelectedStep();
  if (!step) return;

  const coords = getCanvasCoords(e);

  if (activeTool === 'zoom') {
    zoomDragStart = coords;
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (!activeTool || !selectedStepId) return;
  const step = getSelectedStep();
  if (!step) return;
  if (!step.annotation) {
    step.annotation = { spotlight: null, arrows: [], textCallouts: [], zoomRegion: null };
  }

  const coords = getCanvasCoords(e);

  if (activeTool === 'spotlight') {
    step.annotation.spotlight = { x: coords.x, y: coords.y, radius: 80 };
    renderCanvas(step);
  } else if (activeTool === 'arrow') {
    if (!arrowStart) {
      arrowStart = coords;
    } else {
      step.annotation.arrows = step.annotation.arrows || [];
      step.annotation.arrows.push({
        fromX: arrowStart.x,
        fromY: arrowStart.y,
        toX: coords.x,
        toY: coords.y,
        color: '#ef4444',
      });
      arrowStart = null;
      renderCanvas(step);
    }
  } else if (activeTool === 'textCallout') {
    showPrompt('Enter callout text:', '', (text) => {
      if (!text) return;
      step.annotation.textCallouts = step.annotation.textCallouts || [];
      step.annotation.textCallouts.push({ text, x: coords.x, y: coords.y, options: {} });
      renderCanvas(step);
    });
  } else if (activeTool === 'zoom' && zoomDragStart) {
    const region = {
      x: Math.min(zoomDragStart.x, coords.x),
      y: Math.min(zoomDragStart.y, coords.y),
      width: Math.abs(coords.x - zoomDragStart.x),
      height: Math.abs(coords.y - zoomDragStart.y),
      scale: 2,
    };
    if (region.width > 10 && region.height > 10) {
      step.annotation.zoomRegion = region;
      renderCanvas(step);
    }
    zoomDragStart = null;
  }
});

// ─── Annotation Actions ──────────────────────────────────────────────────────

function handleUndo() {
  const step = getSelectedStep();
  if (!step?.annotation) return;

  const ann = step.annotation;
  if (ann.zoomRegion) {
    ann.zoomRegion = null;
  } else if (ann.textCallouts?.length) {
    ann.textCallouts.pop();
  } else if (ann.arrows?.length) {
    ann.arrows.pop();
  } else if (ann.spotlight) {
    ann.spotlight = null;
  }
  renderCanvas(step);
}

function handleReset() {
  const step = getSelectedStep();
  if (!step) return;

  step.annotation = { spotlight: null, arrows: [], textCallouts: [], zoomRegion: null };
  renderCanvas(step);
}

// ─── Step List Handlers ──────────────────────────────────────────────────────

function handleReorder(orderedIds) {
  if (!guide) return;
  const stepMap = new Map(guide.steps.map((s) => [s.id, s]));
  guide.steps = orderedIds.map((id, i) => {
    const step = stepMap.get(id);
    if (step) step.index = i;
    return step;
  }).filter(Boolean);
}

function handleDeleteStep(id) {
  showConfirm('Delete this step? This cannot be undone.', () => {
    if (!guide) return;
    guide.steps = guide.steps.filter((s) => s.id !== id);
    guide.steps.forEach((s, i) => (s.index = i));
    stepList.removeStep(id);

    if (selectedStepId === id) {
      selectedStepId = null;
      updateDetailsVisibility();
    }
    updateGuideTimestamp(guide);
  });
}

function handleDescriptionChange(id, desc) {
  if (!guide) return;
  const step = guide.steps.find((s) => s.id === id);
  if (step) step.description = desc;
}

// ─── Details Panel Events ────────────────────────────────────────────────────

stepDescription.addEventListener('input', () => {
  const step = getSelectedStep();
  if (step) {
    step.description = stepDescription.value;
  }
});

zoomSlider.addEventListener('input', () => {
  currentZoom = parseInt(zoomSlider.value, 10);
  zoomValue.textContent = `${currentZoom}%`;
  const step = getSelectedStep();
  if (step) renderCanvas(step);
});

deleteStepBtn.addEventListener('click', () => {
  if (selectedStepId) handleDeleteStep(selectedStepId);
});

// ─── Export ──────────────────────────────────────────────────────────────────

exportBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  exportDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (e) => {
  if (!exportDropdown.contains(e.target) && e.target !== exportBtn) {
    exportDropdown.classList.add('hidden');
  }
});

exportDropdown.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-export]');
  if (!btn || !guide) return;
  exportDropdown.classList.add('hidden');

  const format = btn.dataset.export;
  try {
    if (format === 'html') {
      const html = exportAsHTML(guide);
      downloadFile(html, `${guide.title || 'guide'}.html`, 'text/html');
      showToast('Exported as HTML', 'success');
    } else if (format === 'pdf') {
      const blob = await exportAsPDF(guide);
      downloadFile(blob, `${guide.title || 'guide'}.pdf`, 'application/pdf');
      showToast('Exported as PDF', 'success');
    } else if (format === 'json') {
      const json = exportAsJSON(guide);
      downloadFile(json, `${guide.title || 'guide'}.json`, 'application/json');
      showToast('Exported as JSON', 'success');
    } else if (format === 'link') {
      showToast('Link copied to clipboard', 'info');
    }
  } catch (err) {
    showToast(`Export failed: ${err.message}`, 'error');
  }
});

// ─── Save ────────────────────────────────────────────────────────────────────

saveBtn.addEventListener('click', () => saveGuide());

async function saveGuide() {
  if (!guide) return;
  updateGuideTimestamp(guide);
  try {
    await sendMessage({ type: 'SAVE_GUIDE', guide });
    showToast('Guide saved', 'success');
  } catch {
    showToast('Failed to save guide', 'error');
  }
}

// ─── Title Editing ───────────────────────────────────────────────────────────

guideTitle.addEventListener('blur', () => {
  if (!guide) return;
  const newTitle = guideTitle.textContent.trim();
  if (newTitle && newTitle !== guide.title) {
    guide.title = newTitle;
    updateGuideTimestamp(guide);
  }
});

guideTitle.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    guideTitle.blur();
  }
});

// ─── Auto-Save ───────────────────────────────────────────────────────────────

function startAutoSave() {
  autoSaveTimer = setInterval(() => {
    if (guide) saveGuide();
  }, 30_000);
}

// ─── Back Button ─────────────────────────────────────────────────────────────

backBtn.addEventListener('click', () => {
  if (autoSaveTimer) clearInterval(autoSaveTimer);
  window.history.back();
});

// ─── Add Step (placeholder) ──────────────────────────────────────────────────

addStepBtn.addEventListener('click', () => {
  showToast('Start recording to add new steps', 'info');
});

// ─── Boot ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
