/** @file Popup UI controller for GuideSnap */

const recordBtn = document.getElementById('recordBtn');
const recordBtnLabel = recordBtn.querySelector('.record-btn-label');
const captureMode = document.getElementById('captureMode');
const stepCounter = document.getElementById('stepCounter');
const stepCounterText = stepCounter.querySelector('.step-counter-text');
const guideList = document.getElementById('guideList');
const guideCount = document.getElementById('guideCount');
const emptyState = document.getElementById('emptyState');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');

let isRecording = false;
let pollTimer = null;

/* ===== Helpers ===== */

function sendMessage(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      resolve(response);
    });
  });
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ===== UI State ===== */

function setRecordingUI(recording, stepCount = 0) {
  isRecording = recording;

  if (recording) {
    recordBtn.classList.add('recording');
    recordBtnLabel.textContent = 'Stop Recording';
    stepCounter.classList.remove('hidden');
    stepCounterText.textContent = `${stepCount} step${stepCount !== 1 ? 's' : ''}`;
    startPolling();
  } else {
    recordBtn.classList.remove('recording');
    recordBtnLabel.textContent = 'Start Recording';
    stepCounter.classList.add('hidden');
    stopPolling();
  }
}

/* ===== Polling ===== */

function startPolling() {
  stopPolling();
  pollTimer = setInterval(async () => {
    const state = await sendMessage('GET_STATE');
    if (state && state.recording) {
      const count = state.stepCount || 0;
      stepCounterText.textContent = `${count} step${count !== 1 ? 's' : ''}`;
    } else {
      setRecordingUI(false);
    }
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

/* ===== Record Button ===== */

recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    await sendMessage('START_RECORDING');
    setRecordingUI(true);
  } else {
    await sendMessage('STOP_RECORDING');
    setRecordingUI(false);
    loadGuides();
  }
});

/* ===== Capture Mode Toggle ===== */

captureMode.addEventListener('click', (e) => {
  const option = e.target.closest('.capture-mode-option');
  if (!option) return;

  captureMode.querySelectorAll('.capture-mode-option').forEach((btn) => {
    btn.classList.remove('active');
  });
  option.classList.add('active');

  chrome.storage.local.set({ captureMode: option.dataset.mode });
});

function restoreCaptureMode() {
  chrome.storage.local.get('captureMode', (result) => {
    const mode = result.captureMode || 'viewport';
    captureMode.querySelectorAll('.capture-mode-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
  });
}

/* ===== Guide List ===== */

async function loadGuides() {
  const response = await sendMessage('LIST_GUIDES');
  const guides = (response && response.guides) || [];

  guideCount.textContent = guides.length;
  guideList.innerHTML = '';

  if (guides.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }

  emptyState.classList.add('hidden');

  guides.forEach((guide) => {
    const card = document.createElement('div');
    card.className = 'guide-card';

    const thumbSrc = guide.thumbnail || '../assets/icons/icon48.png';
    const steps = guide.steps ? guide.steps.length : 0;
    const date = guide.createdAt ? formatDate(guide.createdAt) : '';

    card.innerHTML = `
      <img class="guide-card-thumb" src="${thumbSrc}" alt="" />
      <div class="guide-card-info">
        <div class="guide-card-title">${escapeHtml(guide.title || 'Untitled Guide')}</div>
        <div class="guide-card-meta">${steps} step${steps !== 1 ? 's' : ''} &middot; ${date}</div>
      </div>
      <div class="guide-card-actions">
        <button class="open-btn" title="Open" data-id="${guide.id}">&#9998;</button>
        <button class="delete-btn" title="Delete" data-id="${guide.id}">&times;</button>
      </div>
    `;

    card.querySelector('.open-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openGuide(guide.id);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteGuide(guide.id);
    });

    card.addEventListener('click', () => openGuide(guide.id));

    guideList.appendChild(card);
  });
}

function escapeHtml(text) {
  const el = document.createElement('span');
  el.textContent = text;
  return el.innerHTML;
}

function openGuide(guideId) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`editor/editor.html?id=${guideId}`) });
}

async function deleteGuide(guideId) {
  if (!confirm('Delete this guide? This cannot be undone.')) return;
  await sendMessage('DELETE_GUIDE', { guideId });
  loadGuides();
}

/* ===== Import ===== */

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);
    await sendMessage('IMPORT_GUIDE', { guide: data });
    loadGuides();
  } catch {
    alert('Invalid guide file.');
  }

  importFile.value = '';
});

/* ===== Init ===== */

async function init() {
  restoreCaptureMode();

  const state = await sendMessage('GET_STATE');
  if (state && state.recording) {
    setRecordingUI(true, state.stepCount || 0);
  }

  loadGuides();
}

document.addEventListener('DOMContentLoaded', init);
