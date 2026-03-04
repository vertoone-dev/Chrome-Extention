/**
 * @module step-card
 * Renders a single step card DOM element for the editor step list.
 */

/**
 * Creates a step card DOM element for the editor step list.
 * @param {import('../core/guide-model.js').Step} step - Step object
 * @param {Object} callbacks
 * @param {function} callbacks.onSelect - Called when the card is clicked
 * @param {function} callbacks.onDelete - Called when the delete button is clicked
 * @param {function} callbacks.onDescriptionChange - Called with new description text
 * @param {function} callbacks.onDragStart - Called when drag begins
 * @param {function} callbacks.onDragEnd - Called when drag ends
 * @returns {HTMLElement}
 */
export function createStepCard(step, callbacks = {}) {
  const card = document.createElement('div');
  card.className = 'step-card';
  card.dataset.stepId = step.id;
  card.draggable = true;

  // Drag handle
  const dragHandle = document.createElement('div');
  dragHandle.className = 'step-card__drag-handle';
  dragHandle.textContent = '☰';
  dragHandle.title = 'Drag to reorder';

  // Thumbnail
  const thumbnail = document.createElement('div');
  thumbnail.className = 'step-card__thumbnail';
  if (step.screenshotDataUrl) {
    const img = document.createElement('img');
    img.src = step.screenshotDataUrl;
    img.alt = `Step ${step.index + 1} screenshot`;
    img.draggable = false;
    thumbnail.appendChild(img);
  }

  // Step number badge
  const badge = document.createElement('span');
  badge.className = 'step-card__badge';
  badge.textContent = step.index + 1;

  // Description
  const description = document.createElement('div');
  description.className = 'step-card__description';
  description.textContent = step.description || `Step ${step.index + 1}`;
  description.title = 'Click to edit description';

  description.addEventListener('click', (e) => {
    e.stopPropagation();
    _startEditing(description, step, callbacks.onDescriptionChange);
  });

  // Delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'step-card__delete-btn';
  deleteBtn.innerHTML = '&#128465;'; // 🗑 trash icon
  deleteBtn.title = 'Delete step';
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (callbacks.onDelete) callbacks.onDelete(step.id);
  });

  // Card click → select
  card.addEventListener('click', () => {
    if (callbacks.onSelect) callbacks.onSelect(step.id);
  });

  // Drag events
  card.addEventListener('dragstart', (e) => {
    card.classList.add('step-card--dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', step.id);
    if (callbacks.onDragStart) callbacks.onDragStart(step.id, e);
  });

  card.addEventListener('dragend', (e) => {
    card.classList.remove('step-card--dragging');
    if (callbacks.onDragEnd) callbacks.onDragEnd(step.id, e);
  });

  card.appendChild(dragHandle);
  card.appendChild(thumbnail);
  badge && thumbnail.appendChild(badge);
  card.appendChild(description);
  card.appendChild(deleteBtn);

  return card;
}

/**
 * Updates an existing card element with new step data.
 * @param {HTMLElement} cardElement - The card DOM element to update
 * @param {import('../core/guide-model.js').Step} step - Updated step object
 */
export function updateStepCard(cardElement, step) {
  if (!cardElement) return;

  cardElement.dataset.stepId = step.id;

  const badge = cardElement.querySelector('.step-card__badge');
  if (badge) badge.textContent = step.index + 1;

  const desc = cardElement.querySelector('.step-card__description');
  if (desc) desc.textContent = step.description || `Step ${step.index + 1}`;

  const thumbnail = cardElement.querySelector('.step-card__thumbnail');
  if (thumbnail) {
    let img = thumbnail.querySelector('img');
    if (step.screenshotDataUrl) {
      if (!img) {
        img = document.createElement('img');
        img.draggable = false;
        thumbnail.prepend(img);
      }
      img.src = step.screenshotDataUrl;
      img.alt = `Step ${step.index + 1} screenshot`;
    } else if (img) {
      img.remove();
    }
  }
}

/* ── Private helpers ── */

function _startEditing(descriptionEl, step, onChange) {
  if (descriptionEl.querySelector('input')) return;

  const currentText = step.description || '';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'step-card__description-input';
  input.value = currentText;
  input.placeholder = `Step ${step.index + 1}`;

  const commit = () => {
    const newText = input.value.trim();
    descriptionEl.textContent = newText || `Step ${step.index + 1}`;
    if (onChange && newText !== currentText) {
      onChange(step.id, newText);
    }
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') {
      input.value = currentText;
      input.blur();
    }
  });
  input.addEventListener('click', (e) => e.stopPropagation());

  descriptionEl.textContent = '';
  descriptionEl.appendChild(input);
  input.focus();
  input.select();
}
