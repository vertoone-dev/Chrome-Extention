/**
 * @module step-list
 * Drag-and-drop step list container for the editor.
 */

import { createStepCard, updateStepCard } from './step-card.js';

/**
 * Creates and manages the step list with drag-and-drop reordering.
 * @param {HTMLElement} container - DOM element to render the list into
 * @param {Object} callbacks
 * @param {function} callbacks.onReorder - Called with new ordered array of step IDs
 * @param {function} callbacks.onSelect - Called with stepId on selection
 * @param {function} callbacks.onDelete - Called with stepId on delete
 * @param {function} callbacks.onDescriptionChange - Called with (stepId, description)
 * @returns {{ render: function, getOrder: function, selectStep: function, addStep: function, removeStep: function }}
 */
export function createStepList(container, callbacks = {}) {
  let currentSteps = [];
  let selectedId = null;

  const list = document.createElement('div');
  list.className = 'step-list';
  container.appendChild(list);

  const emptyState = document.createElement('div');
  emptyState.className = 'step-list__empty';
  emptyState.innerHTML =
    '<span class="step-list__empty-icon">📷</span>' +
    '<p>No steps yet</p>' +
    '<p class="step-list__empty-hint">Start recording to capture steps</p>';

  // Drag-and-drop state
  let draggedId = null;

  list.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = _getCardUnderPointer(e.clientY);
    if (target && target.dataset.stepId !== draggedId) {
      const rect = target.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (e.clientY < midY) {
        list.insertBefore(_getDraggedCard(), target);
      } else {
        list.insertBefore(_getDraggedCard(), target.nextSibling);
      }
    }
  });

  list.addEventListener('drop', (e) => {
    e.preventDefault();
    _commitReorder();
  });

  function _getDraggedCard() {
    return list.querySelector(`[data-step-id="${draggedId}"]`);
  }

  function _getCardUnderPointer(clientY) {
    const cards = [...list.querySelectorAll('.step-card:not(.step-card--dragging)')];
    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return card;
    }
    return null;
  }

  function _commitReorder() {
    const cards = list.querySelectorAll('.step-card');
    const newOrder = [...cards].map((c) => c.dataset.stepId);
    if (callbacks.onReorder) callbacks.onReorder(newOrder);
    draggedId = null;
  }

  function _cardCallbacks() {
    return {
      onSelect: (id) => {
        selectStep(id);
        if (callbacks.onSelect) callbacks.onSelect(id);
      },
      onDelete: (id) => {
        if (callbacks.onDelete) callbacks.onDelete(id);
      },
      onDescriptionChange: (id, desc) => {
        if (callbacks.onDescriptionChange) callbacks.onDescriptionChange(id, desc);
      },
      onDragStart: (id) => {
        draggedId = id;
      },
      onDragEnd: () => {
        draggedId = null;
      },
    };
  }

  function _updateEmptyState() {
    const cards = list.querySelectorAll('.step-card');
    if (cards.length === 0) {
      if (!list.contains(emptyState)) list.appendChild(emptyState);
    } else {
      if (list.contains(emptyState)) list.removeChild(emptyState);
    }
  }

  /* ── Public API ── */

  /** Renders the full list of steps, replacing existing cards. */
  function render(steps) {
    currentSteps = steps;
    list.innerHTML = '';
    const cbs = _cardCallbacks();
    steps.forEach((step) => {
      const card = createStepCard(step, cbs);
      if (step.id === selectedId) card.classList.add('step-card--selected');
      list.appendChild(card);
    });
    _updateEmptyState();
  }

  /** Returns the current ordered array of step IDs based on DOM order. */
  function getOrder() {
    return [...list.querySelectorAll('.step-card')].map((c) => c.dataset.stepId);
  }

  /** Selects a step by ID, updating visual state. */
  function selectStep(id) {
    selectedId = id;
    list.querySelectorAll('.step-card').forEach((card) => {
      card.classList.toggle('step-card--selected', card.dataset.stepId === id);
    });
  }

  /** Appends a single new step card to the list. */
  function addStep(step) {
    currentSteps.push(step);
    const card = createStepCard(step, _cardCallbacks());
    if (list.contains(emptyState)) list.removeChild(emptyState);
    list.appendChild(card);
  }

  /** Removes a step card by ID. */
  function removeStep(id) {
    currentSteps = currentSteps.filter((s) => s.id !== id);
    const card = list.querySelector(`[data-step-id="${id}"]`);
    if (card) card.remove();
    if (selectedId === id) selectedId = null;
    _updateEmptyState();
  }

  _updateEmptyState();

  return { render, getOrder, selectStep, addStep, removeStep };
}
