// background.js — Digital Wellness Break v2.0
// Robust timer using alarms (persists across service worker restarts)

const DEFAULTS = {
  workMinutes: 1,       // Minutes of work before a break
  breakSeconds: 20,      // Duration of the break in seconds
  timerRunning: true,
  sessionStart: null,    // Timestamp when the current work session started
};

// ─── Initialization ───────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  console.log("[BG] Extension installed/updated.");
  const existing = await chrome.storage.local.get(Object.keys(DEFAULTS));
  const settings = { ...DEFAULTS, ...existing };

  // Don't overwrite user-configured values
  if (!existing.workMinutes) settings.workMinutes = DEFAULTS.workMinutes;
  if (!existing.breakSeconds) settings.breakSeconds = DEFAULTS.breakSeconds;

  settings.sessionStart = Date.now();
  settings.timerRunning = true;

  await chrome.storage.local.set(settings);
  scheduleAlarm(settings.workMinutes);
  console.log(`[BG] Timer set for ${settings.workMinutes} minute(s).`);
});

// ─── Alarm Listener ───────────────────────────────────────────────────────────

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "BREAK_ALARM") return;
  console.log("[BG] Break alarm fired.");

  const data = await chrome.storage.local.get(["timerRunning", "workMinutes"]);
  if (!data.timerRunning) {
    console.log("[BG] Timer is paused, skipping break.");
    return;
  }

  triggerBreak();
});

// ─── Schedule / Cancel Alarm ──────────────────────────────────────────────────

function scheduleAlarm(workMinutes) {
  chrome.alarms.clear("BREAK_ALARM", () => {
    chrome.alarms.create("BREAK_ALARM", { delayInMinutes: workMinutes });
    console.log(`[BG] Alarm scheduled in ${workMinutes} minute(s).`);
  });
}

// ─── Trigger Break on Active Tab ─────────────────────────────────────────────

async function triggerBreak() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  const activeTab = tabs[0];

  if (!activeTab || !activeTab.url) {
    console.warn("[BG] No active tab found, rescheduling in 1 min.");
    scheduleAlarm(1);
    return;
  }

  if (activeTab.url.startsWith("chrome://") ||
      activeTab.url.startsWith("edge://") ||
      activeTab.url.startsWith("about:")) {
    console.warn("[BG] Cannot inject on browser-internal pages. Rescheduling.");
    scheduleAlarm(1);
    return;
  }

  console.log(`[BG] Sending SHOW_BREAK to tab: ${activeTab.url}`);

  chrome.tabs.sendMessage(activeTab.id, { action: "SHOW_BREAK" }, (response) => {
    if (chrome.runtime.lastError) {
      console.error("[BG] Message failed:", chrome.runtime.lastError.message);
      // Content script may not have loaded yet; try again in 30s
      chrome.alarms.create("BREAK_ALARM", { delayInMinutes: 0.5 });
    } else {
      console.log("[BG] Break shown:", response);
      // Pause timer while break is active
      chrome.storage.local.set({ timerRunning: false });
    }
  });
}

// ─── Message Handler (from overlay / settings) ───────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    const data = await chrome.storage.local.get(["workMinutes", "breakSeconds"]);

    switch (message.action) {
      case "BREAK_COMPLETED":
      case "SKIP_BREAK": {
        console.log(`[BG] Break ended (${message.action}). Restarting timer.`);
        await chrome.storage.local.set({
          timerRunning: true,
          sessionStart: Date.now(),
        });
        scheduleAlarm(data.workMinutes || DEFAULTS.workMinutes);

        // Tell content script to remove the iframe
        if (sender.tab) {
          chrome.tabs.sendMessage(sender.tab.id, { action: "HIDE_BREAK" });
        }
        sendResponse({ status: "ok" });
        break;
      }

      case "UPDATE_SETTINGS": {
        // message = { action, workMinutes, breakSeconds }
        const newWork = parseInt(message.workMinutes) || DEFAULTS.workMinutes;
        const newBreak = parseInt(message.breakSeconds) || DEFAULTS.breakSeconds;
        await chrome.storage.local.set({
          workMinutes: newWork,
          breakSeconds: newBreak,
          timerRunning: true,
          sessionStart: Date.now(),
        });
        scheduleAlarm(newWork);
        console.log(`[BG] Settings updated: work=${newWork}m, break=${newBreak}s`);
        sendResponse({ status: "ok" });
        break;
      }

      case "GET_STATUS": {
        const status = await chrome.storage.local.get(null);
        // Compute remaining time for the current work session
        const alarms = await chrome.alarms.getAll();
        const breakAlarm = alarms.find(a => a.name === "BREAK_ALARM");
        const remainingMs = breakAlarm
          ? Math.max(0, breakAlarm.scheduledTime - Date.now())
          : 0;
        sendResponse({ ...status, remainingMs });
        break;
      }

      case "PAUSE_TIMER": {
        await chrome.alarms.clear("BREAK_ALARM");
        await chrome.storage.local.set({ timerRunning: false });
        console.log("[BG] Timer paused.");
        sendResponse({ status: "paused" });
        break;
      }

      case "RESUME_TIMER": {
        const resume = await chrome.storage.local.get(["workMinutes"]);
        await chrome.storage.local.set({ timerRunning: true, sessionStart: Date.now() });
        scheduleAlarm(resume.workMinutes || DEFAULTS.workMinutes);
        console.log("[BG] Timer resumed.");
        sendResponse({ status: "resumed" });
        break;
      }

      default:
        sendResponse({ status: "unknown_action" });
    }
  })();

  return true; // Keep channel open for async
});
