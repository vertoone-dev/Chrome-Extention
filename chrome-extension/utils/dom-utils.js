/**
 * DOM utility functions for GuideSnap content scripts.
 * @module dom-utils
 */

/**
 * Returns a human-readable descriptor for a DOM element.
 * Examples: "Button 'Submit'", "Input 'Email'", "Link 'Home'".
 * @param {Element} element - The DOM element to describe.
 * @returns {string} A human-readable descriptor string.
 */
export function getElementDescriptor(element) {
  if (!element || !(element instanceof Element)) {
    return 'Unknown';
  }

  const tag = element.tagName.toLowerCase();
  const label =
    element.getAttribute('aria-label') ||
    element.getAttribute('title') ||
    element.getAttribute('alt') ||
    element.getAttribute('placeholder') ||
    (element.textContent || '').trim().slice(0, 40) ||
    '';

  const suffix = label ? ` '${label}'` : '';

  const tagMap = {
    a: 'Link',
    button: 'Button',
    input: 'Input',
    textarea: 'Textarea',
    select: 'Select',
    img: 'Image',
    h1: 'Heading',
    h2: 'Heading',
    h3: 'Heading',
    h4: 'Heading',
    h5: 'Heading',
    h6: 'Heading',
    label: 'Label',
    nav: 'Navigation',
    section: 'Section',
    form: 'Form',
  };

  if (tag === 'input') {
    const type = element.getAttribute('type') || 'text';
    return `Input[${type}]${suffix}`;
  }

  const friendlyName = tagMap[tag] || tag.charAt(0).toUpperCase() + tag.slice(1);
  return `${friendlyName}${suffix}`;
}

/**
 * Returns the XPath string for a DOM element.
 * @param {Element} element - The DOM element.
 * @returns {string} The XPath string for the element.
 */
export function getXPath(element) {
  if (!element || !(element instanceof Element)) {
    return '';
  }

  if (element.id) {
    return `//*[@id="${element.id}"]`;
  }

  const parts = [];
  let current = element;

  while (current && current.nodeType === Node.ELEMENT_NODE) {
    let index = 1;
    let sibling = current.previousElementSibling;

    while (sibling) {
      if (sibling.tagName === current.tagName) {
        index++;
      }
      sibling = sibling.previousElementSibling;
    }

    const tag = current.tagName.toLowerCase();
    const hasFollowingSibling = current.nextElementSibling &&
      Array.from(current.parentElement?.children || []).filter(
        (c) => c.tagName === current.tagName
      ).length > 1;

    parts.unshift(index > 1 || hasFollowingSibling ? `${tag}[${index}]` : tag);
    current = current.parentElement;
  }

  return '/' + parts.join('/');
}

/**
 * Returns a unique CSS selector for a DOM element.
 * @param {Element} element - The DOM element.
 * @returns {string} A CSS selector that uniquely identifies the element.
 */
export function getCSSSelector(element) {
  if (!element || !(element instanceof Element)) {
    return '';
  }

  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const parts = [];
  let current = element;

  while (current && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      parts.unshift(`#${CSS.escape(current.id)}`);
      break;
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map((c) => `.${CSS.escape(c)}`)
        .join('');
      if (classes) {
        selector += classes;
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(' > ');
}

/**
 * Smoothly scrolls the given element into view.
 * @param {Element} element - The DOM element to scroll to.
 * @returns {Promise<void>} Resolves when the scroll is likely complete.
 */
export function scrollToElement(element) {
  return new Promise((resolve) => {
    if (!element || !(element instanceof Element)) {
      resolve();
      return;
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });

    // Wait for smooth scroll to settle
    let lastY = window.scrollY;
    let stable = 0;
    const check = () => {
      if (window.scrollY === lastY) {
        stable++;
      } else {
        stable = 0;
        lastY = window.scrollY;
      }
      if (stable >= 3) {
        resolve();
      } else {
        requestAnimationFrame(check);
      }
    };
    requestAnimationFrame(check);
  });
}

/**
 * Wrapper for document.elementFromPoint.
 * @param {number} x - X coordinate relative to the viewport.
 * @param {number} y - Y coordinate relative to the viewport.
 * @returns {Element|null} The topmost element at the given point, or null.
 */
export function getElementAtPoint(x, y) {
  return document.elementFromPoint(x, y);
}

/**
 * Gets the visible text content of an element, checking multiple sources.
 * @param {Element} element - The DOM element.
 * @returns {string} The visible text content, or an empty string.
 */
export function getVisibleText(element) {
  if (!element || !(element instanceof Element)) {
    return '';
  }

  // Prefer innerText for visible text
  if (element.innerText && element.innerText.trim()) {
    return element.innerText.trim();
  }

  // For input/textarea elements, check value
  if ('value' in element && element.value) {
    return element.value;
  }

  // Fallback to placeholder
  if (element.placeholder) {
    return element.placeholder;
  }

  // Fallback to aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return ariaLabel;
  }

  return '';
}

/**
 * Returns the bounding client rect of an element relative to the viewport.
 * @param {Element} element - The DOM element.
 * @returns {{x: number, y: number, width: number, height: number, top: number, right: number, bottom: number, left: number} | null}
 *   The bounding rect, or null if the element is invalid.
 */
export function getElementRect(element) {
  if (!element || !(element instanceof Element)) {
    return null;
  }

  const rect = element.getBoundingClientRect();
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.top,
    right: rect.right,
    bottom: rect.bottom,
    left: rect.left,
  };
}
