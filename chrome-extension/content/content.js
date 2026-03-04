(function () {
  'use strict';

  let isRecording = false;
  let lastScrollY = 0;
  const SCROLL_MILESTONE = 500;
  let scrollTimeout = null;
  let pendingInput = null;

  function getElementDescriptor(el) {
    if (!el) return '';
    const parts = [el.tagName.toLowerCase()];
    if (el.id) parts.push('#' + el.id);
    if (el.className && typeof el.className === 'string') {
      parts.push('.' + el.className.trim().split(/\s+/).join('.'));
    }
    if (el.getAttribute('aria-label')) {
      parts.push('[aria-label="' + el.getAttribute('aria-label') + '"]');
    }
    if (el.placeholder) parts.push('[placeholder="' + el.placeholder + '"]');
    return parts.join('');
  }

  function getElementText(el) {
    if (!el) return '';
    var text = el.innerText || el.textContent || '';
    return text.trim().substring(0, 120);
  }

  function sendStep(payload) {
    chrome.runtime.sendMessage({
      type: 'CAPTURE_STEP',
      payload: Object.assign({
        url: location.href,
        pageTitle: document.title,
        timestamp: Date.now()
      }, payload)
    });
  }

  function handleClick(e) {
    if (!isRecording) return;

    var target = e.target;
    try {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) { /* ignore */ }

    sendStep({
      eventType: 'click',
      x: e.clientX,
      y: e.clientY,
      tag: target.tagName.toLowerCase(),
      text: getElementText(target),
      placeholder: target.placeholder || '',
      descriptor: getElementDescriptor(target)
    });
  }

  function flushPendingInput() {
    if (!pendingInput) return;
    sendStep({
      eventType: 'input',
      x: 0,
      y: 0,
      tag: pendingInput.tag,
      text: pendingInput.value,
      placeholder: pendingInput.placeholder,
      descriptor: pendingInput.descriptor
    });
    pendingInput = null;
  }

  function handleInput(e) {
    if (!isRecording) return;
    var target = e.target;
    var tagName = target.tagName.toLowerCase();
    if (tagName !== 'input' && tagName !== 'textarea' && !target.isContentEditable) return;

    pendingInput = {
      tag: tagName,
      value: target.value || target.textContent || '',
      placeholder: target.placeholder || '',
      descriptor: getElementDescriptor(target)
    };
  }

  function handleBlur(e) {
    if (!isRecording) return;
    flushPendingInput();
  }

  function handleKeydown(e) {
    if (!isRecording) return;
    if (e.key === 'Enter') {
      flushPendingInput();
    }
  }

  function handleScroll() {
    if (!isRecording) return;

    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(function () {
      var currentY = window.scrollY;
      if (Math.abs(currentY - lastScrollY) >= SCROLL_MILESTONE) {
        lastScrollY = currentY;
        sendStep({
          eventType: 'scroll',
          x: 0,
          y: currentY,
          tag: '',
          text: 'Scrolled to ' + currentY + 'px'
        });
      }
    }, 300);
  }

  var lastUrl = location.href;
  function handleNavigation() {
    if (!isRecording) return;
    var currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      sendStep({
        eventType: 'navigation',
        x: 0,
        y: 0,
        tag: '',
        text: 'Navigated to ' + currentUrl
      });
    }
  }

  function startListeners() {
    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('keydown', handleKeydown, true);
    window.addEventListener('scroll', handleScroll, { passive: true });
  }

  function stopListeners() {
    document.removeEventListener('click', handleClick, true);
    document.removeEventListener('input', handleInput, true);
    document.removeEventListener('blur', handleBlur, true);
    document.removeEventListener('keydown', handleKeydown, true);
    window.removeEventListener('scroll', handleScroll);
    if (scrollTimeout) {
      clearTimeout(scrollTimeout);
      scrollTimeout = null;
    }
    pendingInput = null;
  }

  // Poll for SPA-style navigation changes
  var navInterval = null;

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
      case 'START_RECORDING':
        isRecording = true;
        lastScrollY = window.scrollY;
        lastUrl = location.href;
        startListeners();
        navInterval = setInterval(handleNavigation, 1000);
        sendResponse({ status: 'recording' });
        break;

      case 'STOP_RECORDING':
        isRecording = false;
        stopListeners();
        if (navInterval) {
          clearInterval(navInterval);
          navInterval = null;
        }
        sendResponse({ status: 'stopped' });
        break;

      case 'PAUSE_RECORDING':
        isRecording = false;
        sendResponse({ status: 'paused' });
        break;

      case 'RESUME_RECORDING':
        isRecording = true;
        sendResponse({ status: 'recording' });
        break;
    }
  });
})();
