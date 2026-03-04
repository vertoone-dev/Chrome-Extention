(function () {
  'use strict';

  var recIndicator = null;

  function createPulse(x, y) {
    var el = document.createElement('div');
    el.className = 'gs-click-pulse';
    el.style.left = (x + window.scrollX) + 'px';
    el.style.top = (y + window.scrollY) + 'px';
    document.documentElement.appendChild(el);

    el.addEventListener('animationend', function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    });
  }

  function showRecordingIndicator() {
    if (recIndicator) return;

    recIndicator = document.createElement('div');
    recIndicator.className = 'gs-rec-indicator';

    var dot = document.createElement('span');
    dot.className = 'gs-rec-dot';

    var label = document.createElement('span');
    label.className = 'gs-rec-label';
    label.textContent = 'REC';

    recIndicator.appendChild(dot);
    recIndicator.appendChild(label);
    document.documentElement.appendChild(recIndicator);
  }

  function hideRecordingIndicator() {
    if (recIndicator && recIndicator.parentNode) {
      recIndicator.parentNode.removeChild(recIndicator);
    }
    recIndicator = null;
  }

  function handleClick(e) {
    createPulse(e.clientX, e.clientY);
  }

  var isActive = false;

  function startOverlay() {
    if (isActive) return;
    isActive = true;
    document.addEventListener('click', handleClick, true);
    showRecordingIndicator();
  }

  function stopOverlay() {
    if (!isActive) return;
    isActive = false;
    document.removeEventListener('click', handleClick, true);
    hideRecordingIndicator();

    // Clean up any remaining pulse elements
    var pulses = document.querySelectorAll('.gs-click-pulse');
    for (var i = 0; i < pulses.length; i++) {
      if (pulses[i].parentNode) pulses[i].parentNode.removeChild(pulses[i]);
    }
  }

  chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    switch (message.type) {
      case 'START_RECORDING':
        startOverlay();
        break;
      case 'STOP_RECORDING':
        stopOverlay();
        break;
      case 'PAUSE_RECORDING':
        hideRecordingIndicator();
        break;
      case 'RESUME_RECORDING':
        showRecordingIndicator();
        break;
      case 'TOGGLE_INDICATOR':
        if (recIndicator) {
          hideRecordingIndicator();
        } else if (isActive) {
          showRecordingIndicator();
        }
        break;
    }
  });
})();
