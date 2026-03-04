/**
 * @module toast
 * Notification toast component.
 */

/** Toast type → icon and color mapping */
const TOAST_CONFIG = {
  success: { icon: '✓', colorVar: '--color-success' },
  error:   { icon: '✕', colorVar: '--color-error' },
  warning: { icon: '⚠', colorVar: '--color-warning' },
  info:    { icon: 'ℹ', colorVar: '--color-primary' },
};

let containerEl = null;

/**
 * Returns (or creates) the shared toast container element.
 * @returns {HTMLElement}
 */
function getContainer() {
  if (containerEl && document.body.contains(containerEl)) return containerEl;

  containerEl = document.createElement('div');
  containerEl.className = 'toast-container';
  document.body.appendChild(containerEl);
  return containerEl;
}

/**
 * Shows a toast notification.
 * @param {string} message - Notification message
 * @param {'success'|'error'|'warning'|'info'} [type='info'] - Toast type
 * @param {number} [duration=3000] - Auto-dismiss delay in ms
 * @returns {{ dismiss: function }} Controls for the toast
 */
export function showToast(message, type = 'info', duration = 3000) {
  const config = TOAST_CONFIG[type] || TOAST_CONFIG.info;
  const container = getContainer();

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;

  const icon = document.createElement('span');
  icon.className = 'toast__icon';
  icon.textContent = config.icon;

  const text = document.createElement('span');
  text.className = 'toast__message';
  text.textContent = message;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast__close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Dismiss';
  closeBtn.addEventListener('click', dismiss);

  toast.appendChild(icon);
  toast.appendChild(text);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  // Trigger slide-in on next frame
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  let timer = null;
  if (duration > 0) {
    timer = setTimeout(dismiss, duration);
  }

  function dismiss() {
    if (timer) clearTimeout(timer);
    timer = null;
    toast.classList.remove('toast--visible');
    toast.classList.add('toast--hiding');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    // Fallback removal
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 400);
  }

  return { dismiss };
}
