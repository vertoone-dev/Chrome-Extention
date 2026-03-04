/* GuideSnap – Background Service Worker (Manifest V3) */

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let recordingState = {
  state: 'IDLE',       // IDLE | RECORDING | PAUSED | STOPPED
  currentGuide: null,
  activeTabId: null,
  captureMode: 'viewport'
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId() {
  try {
    return crypto.randomUUID();
  } catch (_e) {
    // Fallback for environments where randomUUID is unavailable
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}

function generateDescription(eventType, tag, text) {
  var label = text ? text.trim().substring(0, 40) : '';
  var tagName = (tag || '').toLowerCase();

  switch (eventType) {
    case 'click':
      if (tagName === 'button' || tagName === 'a') {
        return "Click on " + (tagName === 'a' ? 'Link' : 'Button') + (label ? " '" + label + "'" : '');
      }
      if (tagName === 'input') return "Click on Input" + (label ? " '" + label + "'" : '');
      return "Click on " + (tag || 'Element') + (label ? " '" + label + "'" : '');

    case 'input':
    case 'change':
      return "Type in " + (tag || 'Input') + (label ? " '" + label + "'" : '');

    case 'select':
      return "Select option in " + (tag || 'Dropdown') + (label ? " '" + label + "'" : '');

    case 'navigation':
      return "Navigate to " + (label || 'new page');

    case 'scroll':
      return "Scroll on page";

    default:
      return (eventType ? eventType.charAt(0).toUpperCase() + eventType.slice(1) : 'Interact with') +
        ' ' + (tag || 'Element') + (label ? " '" + label + "'" : '');
  }
}

function saveGuideToStorage(guide) {
  return new Promise(function (resolve, reject) {
    var meta = {
      id: guide.id,
      title: guide.title,
      createdAt: guide.createdAt,
      updatedAt: guide.updatedAt,
      stepCount: guide.steps ? guide.steps.length : 0,
      thumbnail: guide.thumbnail || null
    };
    var items = {};
    items['guide_meta_' + guide.id] = meta;
    items['guide_steps_' + guide.id] = guide.steps || [];
    chrome.storage.local.set(items, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(guide.id);
      }
    });
  });
}

function loadGuideFromStorage(id) {
  return new Promise(function (resolve, reject) {
    chrome.storage.local.get(['guide_meta_' + id, 'guide_steps_' + id], function (result) {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      var meta = result['guide_meta_' + id];
      if (!meta) {
        resolve(null);
        return;
      }
      var steps = result['guide_steps_' + id] || [];
      resolve({
        id: meta.id,
        title: meta.title,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        thumbnail: meta.thumbnail || null,
        steps: steps
      });
    });
  });
}

function setBadge(text, color) {
  chrome.action.setBadgeText({ text: text });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color: color });
  }
}

function sendToTab(tabId, message) {
  return new Promise(function (resolve) {
    chrome.tabs.sendMessage(tabId, message, function (response) {
      // Ignore errors – content script may not be injected yet
      if (chrome.runtime.lastError) { /* noop */ }
      resolve(response);
    });
  });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  var type = message.type;
  var payload = message.payload || {};

  switch (type) {

    // -----------------------------------------------------------------------
    // Recording controls
    // -----------------------------------------------------------------------
    case 'START_RECORDING': {
      chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        try {
          var tab = tabs[0];
          if (!tab) {
            sendResponse({ success: false, error: 'No active tab found' });
            return;
          }

          var guideId = generateId();
          var now = new Date().toISOString();
          recordingState.state = 'RECORDING';
          recordingState.activeTabId = tab.id;
          recordingState.currentGuide = {
            id: guideId,
            title: 'Untitled Guide',
            createdAt: now,
            updatedAt: now,
            steps: [],
            thumbnail: null
          };

          setBadge('REC', '#FF0000');
          sendToTab(tab.id, { type: 'START_RECORDING' });
          sendResponse({ success: true, guideId: guideId });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      });
      return true; // async
    }

    case 'STOP_RECORDING': {
      (async function () {
        try {
          var guide = recordingState.currentGuide;
          if (recordingState.activeTabId) {
            sendToTab(recordingState.activeTabId, { type: 'STOP_RECORDING' });
          }

          if (guide) {
            guide.updatedAt = new Date().toISOString();
            if (guide.steps.length > 0 && !guide.thumbnail) {
              guide.thumbnail = guide.steps[0].screenshotDataUrl || null;
            }
            await saveGuideToStorage(guide);
          }

          var guideId = guide ? guide.id : null;

          recordingState.state = 'STOPPED';
          recordingState.currentGuide = null;
          recordingState.activeTabId = null;
          setBadge('', null);

          sendResponse({ success: true, guideId: guideId });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // async
    }

    case 'PAUSE_RECORDING': {
      recordingState.state = 'PAUSED';
      if (recordingState.activeTabId) {
        sendToTab(recordingState.activeTabId, { type: 'PAUSE_RECORDING' });
      }
      setBadge('||', '#FFA500');
      sendResponse({ success: true });
      return false;
    }

    case 'RESUME_RECORDING': {
      recordingState.state = 'RECORDING';
      if (recordingState.activeTabId) {
        sendToTab(recordingState.activeTabId, { type: 'RESUME_RECORDING' });
      }
      setBadge('REC', '#FF0000');
      sendResponse({ success: true });
      return false;
    }

    // -----------------------------------------------------------------------
    // Step capture
    // -----------------------------------------------------------------------
    case 'CAPTURE_STEP': {
      (async function () {
        try {
          if (recordingState.state !== 'RECORDING' || !recordingState.currentGuide) {
            sendResponse({ success: false, error: 'Not recording' });
            return;
          }

          var tabId = sender.tab ? sender.tab.id : recordingState.activeTabId;
          var screenshotDataUrl = null;
          try {
            screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
          } catch (capErr) {
            console.warn('GuideSnap: screenshot capture failed', capErr);
          }

          var stepIndex = recordingState.currentGuide.steps.length;
          var step = {
            id: generateId(),
            index: stepIndex,
            screenshotDataUrl: screenshotDataUrl,
            annotation: {
              spotlight: payload.x != null && payload.y != null
                ? { x: payload.x, y: payload.y, radius: 50 }
                : null,
              arrows: [],
              textCallouts: [],
              zoomRegion: null
            },
            description: generateDescription(payload.eventType, payload.tag, payload.text),
            meta: {
              x: payload.x,
              y: payload.y,
              tag: payload.tag,
              text: payload.text,
              url: payload.url,
              pageTitle: payload.pageTitle,
              eventType: payload.eventType,
              timestamp: payload.timestamp
            }
          };

          recordingState.currentGuide.steps.push(step);
          recordingState.currentGuide.updatedAt = new Date().toISOString();

          setBadge(String(recordingState.currentGuide.steps.length), '#FF0000');

          if (tabId) {
            sendToTab(tabId, {
              type: 'STEP_CAPTURED',
              payload: { stepId: step.id, index: step.index, description: step.description }
            });
          }

          sendResponse({ success: true, step: { id: step.id, index: step.index, description: step.description } });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // async
    }

    // -----------------------------------------------------------------------
    // State query
    // -----------------------------------------------------------------------
    case 'GET_STATE': {
      sendResponse({
        success: true,
        state: recordingState.state,
        stepCount: recordingState.currentGuide ? recordingState.currentGuide.steps.length : 0,
        guideId: recordingState.currentGuide ? recordingState.currentGuide.id : null,
        activeTabId: recordingState.activeTabId,
        captureMode: recordingState.captureMode
      });
      return false;
    }

    // -----------------------------------------------------------------------
    // Guide CRUD
    // -----------------------------------------------------------------------
    case 'GET_GUIDE': {
      loadGuideFromStorage(payload.id).then(function (guide) {
        sendResponse({ success: true, guide: guide });
      }).catch(function (err) {
        sendResponse({ success: false, error: err.message });
      });
      return true; // async
    }

    case 'LIST_GUIDES': {
      chrome.storage.local.get(null, function (items) {
        try {
          var guides = [];
          var keys = Object.keys(items);
          for (var i = 0; i < keys.length; i++) {
            if (keys[i].indexOf('guide_meta_') === 0) {
              var meta = items[keys[i]];
              guides.push({
                id: meta.id,
                title: meta.title,
                stepCount: meta.stepCount || 0,
                createdAt: meta.createdAt,
                thumbnail: meta.thumbnail || null
              });
            }
          }
          guides.sort(function (a, b) {
            return new Date(b.createdAt) - new Date(a.createdAt);
          });
          sendResponse({ success: true, guides: guides });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      });
      return true; // async
    }

    case 'DELETE_GUIDE': {
      chrome.storage.local.remove(['guide_meta_' + payload.id, 'guide_steps_' + payload.id], function () {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true; // async
    }

    case 'SAVE_GUIDE': {
      var guideToSave = payload.guide;
      if (!guideToSave || !guideToSave.id) {
        sendResponse({ success: false, error: 'Invalid guide object' });
        return false;
      }
      guideToSave.updatedAt = new Date().toISOString();
      saveGuideToStorage(guideToSave).then(function () {
        sendResponse({ success: true });
      }).catch(function (err) {
        sendResponse({ success: false, error: err.message });
      });
      return true; // async
    }

    case 'IMPORT_GUIDE': {
      (async function () {
        try {
          var parsed = typeof payload.guideJson === 'string'
            ? JSON.parse(payload.guideJson)
            : payload.guideJson;

          var newId = generateId();
          var now = new Date().toISOString();
          parsed.id = newId;
          parsed.createdAt = now;
          parsed.updatedAt = now;
          if (parsed.steps) {
            for (var i = 0; i < parsed.steps.length; i++) {
              parsed.steps[i].id = generateId();
              parsed.steps[i].index = i;
            }
          }
          await saveGuideToStorage(parsed);
          sendResponse({ success: true, guideId: newId });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // async
    }

    case 'DUPLICATE_GUIDE': {
      (async function () {
        try {
          var original = await loadGuideFromStorage(payload.id);
          if (!original) {
            sendResponse({ success: false, error: 'Guide not found' });
            return;
          }
          var newId = generateId();
          var now = new Date().toISOString();
          var clone = JSON.parse(JSON.stringify(original));
          clone.id = newId;
          clone.title = original.title + ' (Copy)';
          clone.createdAt = now;
          clone.updatedAt = now;
          if (clone.steps) {
            for (var i = 0; i < clone.steps.length; i++) {
              clone.steps[i].id = generateId();
            }
          }
          await saveGuideToStorage(clone);
          sendResponse({ success: true, guideId: newId });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // async
    }

    case 'RENAME_GUIDE': {
      (async function () {
        try {
          var metaKey = 'guide_meta_' + payload.id;
          chrome.storage.local.get([metaKey], function (result) {
            var meta = result[metaKey];
            if (!meta) {
              sendResponse({ success: false, error: 'Guide not found' });
              return;
            }
            meta.title = payload.title;
            meta.updatedAt = new Date().toISOString();
            var update = {};
            update[metaKey] = meta;
            chrome.storage.local.set(update, function () {
              if (chrome.runtime.lastError) {
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
              } else {
                sendResponse({ success: true });
              }
            });
          });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      })();
      return true; // async
    }

    default:
      sendResponse({ success: false, error: 'Unknown message type: ' + type });
      return false;
  }
});

// ---------------------------------------------------------------------------
// Keyboard command handler
// ---------------------------------------------------------------------------

chrome.commands.onCommand.addListener(function (command) {
  if (command !== 'toggle-recording') return;

  if (recordingState.state === 'IDLE' || recordingState.state === 'STOPPED') {
    // Start recording on active tab
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var tab = tabs[0];
      if (!tab) return;

      var guideId = generateId();
      var now = new Date().toISOString();
      recordingState.state = 'RECORDING';
      recordingState.activeTabId = tab.id;
      recordingState.currentGuide = {
        id: guideId,
        title: 'Untitled Guide',
        createdAt: now,
        updatedAt: now,
        steps: [],
        thumbnail: null
      };

      setBadge('REC', '#FF0000');
      sendToTab(tab.id, { type: 'START_RECORDING' });
    });
  } else if (recordingState.state === 'RECORDING') {
    // Stop recording
    (async function () {
      try {
        if (recordingState.activeTabId) {
          sendToTab(recordingState.activeTabId, { type: 'STOP_RECORDING' });
        }
        var guide = recordingState.currentGuide;
        if (guide) {
          guide.updatedAt = new Date().toISOString();
          if (guide.steps.length > 0 && !guide.thumbnail) {
            guide.thumbnail = guide.steps[0].screenshotDataUrl || null;
          }
          await saveGuideToStorage(guide);
        }
        recordingState.state = 'STOPPED';
        recordingState.currentGuide = null;
        recordingState.activeTabId = null;
        setBadge('', null);
      } catch (err) {
        console.error('GuideSnap: error stopping recording via command', err);
      }
    })();
  }
});

// ---------------------------------------------------------------------------
// Tab navigation handler – capture navigation steps while recording
// ---------------------------------------------------------------------------

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
  if (
    recordingState.state !== 'RECORDING' ||
    !recordingState.currentGuide ||
    tabId !== recordingState.activeTabId
  ) {
    return;
  }

  // Only react when the page has finished loading after a navigation
  if (changeInfo.status !== 'complete') return;

  (async function () {
    try {
      var screenshotDataUrl = null;
      try {
        screenshotDataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      } catch (_e) { /* ignore capture errors */ }

      var stepIndex = recordingState.currentGuide.steps.length;
      var step = {
        id: generateId(),
        index: stepIndex,
        screenshotDataUrl: screenshotDataUrl,
        annotation: {
          spotlight: null,
          arrows: [],
          textCallouts: [],
          zoomRegion: null
        },
        description: generateDescription('navigation', null, tab.url),
        meta: {
          x: null,
          y: null,
          tag: null,
          text: tab.title || '',
          url: tab.url,
          pageTitle: tab.title || '',
          eventType: 'navigation',
          timestamp: Date.now()
        }
      };

      recordingState.currentGuide.steps.push(step);
      recordingState.currentGuide.updatedAt = new Date().toISOString();

      setBadge(String(recordingState.currentGuide.steps.length), '#FF0000');

      sendToTab(tabId, {
        type: 'STEP_CAPTURED',
        payload: { stepId: step.id, index: step.index, description: step.description }
      });
    } catch (err) {
      console.error('GuideSnap: error capturing navigation step', err);
    }
  })();
});
