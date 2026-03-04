/**
 * @module modal
 * Reusable modal dialog component.
 */

/**
 * Shows a modal dialog.
 * @param {Object} options
 * @param {string} options.title - Modal title
 * @param {string|HTMLElement} options.content - Body content (HTML string or element)
 * @param {string} [options.confirmText='OK'] - Confirm button text
 * @param {string} [options.cancelText='Cancel'] - Cancel button text
 * @param {function} [options.onConfirm] - Called when confirm is clicked
 * @param {function} [options.onCancel] - Called when modal is dismissed
 * @param {boolean} [options.danger=false] - Danger variant (red confirm button)
 * @returns {{ element: HTMLElement, close: function }}
 */
export function showModal(options = {}) {
  const {
    title = '',
    content = '',
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm,
    onCancel,
    danger = false,
  } = options;

  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';

  // Modal card
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  if (title) modal.setAttribute('aria-label', title);

  // Header
  if (title) {
    const header = document.createElement('div');
    header.className = 'modal__header';
    const h2 = document.createElement('h2');
    h2.className = 'modal__title';
    h2.textContent = title;
    header.appendChild(h2);
    modal.appendChild(header);
  }

  // Body
  const body = document.createElement('div');
  body.className = 'modal__body';
  if (typeof content === 'string') {
    body.innerHTML = content;
  } else if (content instanceof HTMLElement) {
    body.appendChild(content);
  }
  modal.appendChild(body);

  // Footer
  const footer = document.createElement('div');
  footer.className = 'modal__footer';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'modal__btn modal__btn--cancel';
  cancelBtn.textContent = cancelText;

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'modal__btn modal__btn--confirm';
  if (danger) confirmBtn.classList.add('modal__btn--danger');
  confirmBtn.textContent = confirmText;

  footer.appendChild(cancelBtn);
  footer.appendChild(confirmBtn);
  modal.appendChild(footer);

  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Trigger fade-in on next frame
  requestAnimationFrame(() => backdrop.classList.add('modal-backdrop--visible'));

  function close() {
    backdrop.classList.remove('modal-backdrop--visible');
    backdrop.addEventListener('transitionend', () => backdrop.remove(), { once: true });
    // Fallback removal if transition doesn't fire
    setTimeout(() => { if (backdrop.parentNode) backdrop.remove(); }, 400);
  }

  cancelBtn.addEventListener('click', () => {
    close();
    if (onCancel) onCancel();
  });

  confirmBtn.addEventListener('click', () => {
    close();
    if (onConfirm) onConfirm();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      close();
      if (onCancel) onCancel();
    }
  });

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKeyDown);
      close();
      if (onCancel) onCancel();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  // Focus the confirm button for keyboard accessibility
  confirmBtn.focus();

  return { element: backdrop, close };
}

/**
 * Convenience wrapper for confirmation dialogs.
 * @param {string} message - Confirmation message
 * @param {function} onConfirm - Called when user confirms
 */
export function showConfirm(message, onConfirm) {
  return showModal({
    title: 'Confirm',
    content: `<p>${message}</p>`,
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger: true,
    onConfirm,
  });
}

/**
 * Convenience wrapper for input prompt dialogs.
 * @param {string} message - Prompt message
 * @param {string} defaultValue - Default input value
 * @param {function} onSubmit - Called with the input value on confirm
 */
export function showPrompt(message, defaultValue = '', onSubmit) {
  const wrapper = document.createElement('div');
  wrapper.className = 'modal__prompt';

  const label = document.createElement('label');
  label.className = 'modal__prompt-label';
  label.textContent = message;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'modal__prompt-input';
  input.value = defaultValue;

  wrapper.appendChild(label);
  wrapper.appendChild(input);

  const { element, close } = showModal({
    title: 'Input',
    content: wrapper,
    confirmText: 'Submit',
    cancelText: 'Cancel',
    onConfirm: () => {
      if (onSubmit) onSubmit(input.value);
    },
  });

  // Focus and select input text after modal appears
  requestAnimationFrame(() => {
    input.focus();
    input.select();
  });

  // Allow Enter key to submit
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      close();
      if (onSubmit) onSubmit(input.value);
    }
  });

  return { element, close };
}
