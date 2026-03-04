/**
 * @module viewer
 * Full-screen slideshow viewer for GuideSnap guides.
 * Loads a guide by ID, renders annotated screenshots, and supports
 * keyboard / touch / button navigation plus a lightbox zoom.
 */

import { annotateStep } from '../core/annotator.js';

// ─── DOM References ──────────────────────────────────────────────────────────

const guideTitle = document.getElementById('guideTitle');
const slideContainer = document.getElementById('slideContainer');
const slideImage = document.getElementById('slideImage');
const slideDescription = document.getElementById('slideDescription');
const clickPulse = document.getElementById('clickPulse');
const stepCounter = document.getElementById('stepCounter');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const closeBtn = document.getElementById('closeBtn');
const lightbox = document.getElementById('lightbox');
const lightboxImage = document.getElementById('lightboxImage');
const emptyState = document.getElementById('emptyState');

// ─── State ───────────────────────────────────────────────────────────────────

let guide = null;
let currentIndex = 0;
const annotatedCache = new Map();

// ─── Initialization ──────────────────────────────────────────────────────────

async function init() {
  const params = new URLSearchParams(window.location.search);
  const guideId = params.get('id');

  if (!guideId) {
    showEmpty();
    return;
  }

  try {
    const response = await sendMessage({ type: 'GET_GUIDE', guideId });
    if (!response || !response.success || !response.guide) {
      showEmpty();
      return;
    }
    guide = response.guide;
  } catch {
    showEmpty();
    return;
  }

  if (!guide.steps || guide.steps.length === 0) {
    guideTitle.textContent = guide.title || 'Untitled Guide';
    showEmpty();
    return;
  }

  guideTitle.textContent = guide.title || 'Untitled Guide';
  currentIndex = 0;

  await displayStep(currentIndex);
  preloadAdjacent();
  bindEvents();
}

function showEmpty() {
  slideContainer.classList.add('hidden');
  emptyState.classList.remove('hidden');
}

// ─── Message Passing ─────────────────────────────────────────────────────────

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

// ─── Step Display ────────────────────────────────────────────────────────────

async function displayStep(index) {
  const step = guide.steps[index];
  if (!step) return;

  // Crossfade out
  slideImage.classList.add('crossfade');

  const dataUrl = await getAnnotatedImage(step);

  // Small delay so the fade-out is visible before swap
  await wait(50);

  slideImage.src = dataUrl;
  slideImage.classList.remove('crossfade');

  // Description
  slideDescription.textContent = step.description || '';

  // Click pulse position
  positionClickPulse(step);

  // Counter
  updateCounter();
}

async function getAnnotatedImage(step) {
  if (annotatedCache.has(step.id)) {
    return annotatedCache.get(step.id);
  }

  if (!step.screenshotDataUrl) return '';

  try {
    const dataUrl = await annotateStep(step.screenshotDataUrl, step);
    annotatedCache.set(step.id, dataUrl);
    return dataUrl;
  } catch {
    // Fallback to raw screenshot on annotation failure
    return step.screenshotDataUrl;
  }
}

function positionClickPulse(step) {
  if (!step.meta?.x || !step.meta?.y || !step.screenshotDataUrl) {
    clickPulse.classList.add('hidden');
    return;
  }

  // Wait for the image to load to compute relative positions
  const img = slideImage;
  if (!img.naturalWidth) {
    clickPulse.classList.add('hidden');
    return;
  }

  const scaleX = img.clientWidth / img.naturalWidth;
  const scaleY = img.clientHeight / img.naturalHeight;

  clickPulse.style.left = `${img.offsetLeft + step.meta.x * scaleX}px`;
  clickPulse.style.top = `${img.offsetTop + step.meta.y * scaleY}px`;
  clickPulse.classList.remove('hidden');
}

function updateCounter() {
  const total = guide.steps.length;
  stepCounter.textContent = `${currentIndex + 1} / ${total}`;
  prevBtn.disabled = currentIndex === 0;
  nextBtn.disabled = currentIndex === total - 1;
}

// ─── Preloading ──────────────────────────────────────────────────────────────

function preloadAdjacent() {
  const steps = guide.steps;
  if (currentIndex + 1 < steps.length) {
    getAnnotatedImage(steps[currentIndex + 1]);
  }
  if (currentIndex - 1 >= 0) {
    getAnnotatedImage(steps[currentIndex - 1]);
  }
}

// ─── Navigation ──────────────────────────────────────────────────────────────

async function goTo(index) {
  if (index < 0 || index >= guide.steps.length || index === currentIndex) return;
  currentIndex = index;
  await displayStep(currentIndex);
  preloadAdjacent();
}

function goNext() {
  goTo(currentIndex + 1);
}

function goPrev() {
  goTo(currentIndex - 1);
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function openLightbox() {
  lightboxImage.src = slideImage.src;
  lightbox.classList.remove('hidden');
}

function closeLightbox() {
  lightbox.classList.add('hidden');
  lightboxImage.src = '';
}

function isLightboxOpen() {
  return !lightbox.classList.contains('hidden');
}

// ─── Close Viewer ────────────────────────────────────────────────────────────

function closeViewer() {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    window.close();
  }
}

// ─── Event Binding ───────────────────────────────────────────────────────────

function bindEvents() {
  // Navigation buttons
  prevBtn.addEventListener('click', goPrev);
  nextBtn.addEventListener('click', goNext);

  // Close
  closeBtn.addEventListener('click', closeViewer);

  // Screenshot click → lightbox
  slideImage.addEventListener('click', openLightbox);

  // Lightbox close
  lightbox.addEventListener('click', closeLightbox);

  // Keyboard
  document.addEventListener('keydown', onKeyDown);

  // Touch / swipe
  bindSwipe();

  // Recalculate pulse on image load / resize
  slideImage.addEventListener('load', () => {
    const step = guide.steps[currentIndex];
    if (step) positionClickPulse(step);
  });

  window.addEventListener('resize', () => {
    const step = guide?.steps?.[currentIndex];
    if (step) positionClickPulse(step);
  });
}

function onKeyDown(e) {
  switch (e.key) {
    case 'Escape':
      if (isLightboxOpen()) {
        closeLightbox();
      } else {
        closeViewer();
      }
      break;
    case 'ArrowLeft':
      goPrev();
      break;
    case 'ArrowRight':
      goNext();
      break;
  }
}

// ─── Swipe Gesture ───────────────────────────────────────────────────────────

function bindSwipe() {
  let startX = 0;
  let startY = 0;
  const SWIPE_THRESHOLD = 50;

  document.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) {
        goNext();
      } else {
        goPrev();
      }
    }
  }, { passive: true });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Start ───────────────────────────────────────────────────────────────────

init();
