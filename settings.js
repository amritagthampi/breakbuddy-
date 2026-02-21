// settings.js — Digital Wellness Break v2.0
const workSlider  = document.getElementById("workSlider");
const breakSlider = document.getElementById("breakSlider");
const workVal     = document.getElementById("workVal");
const breakVal    = document.getElementById("breakVal");
const saveBtn     = document.getElementById("saveBtn");
const pauseBtn    = document.getElementById("pauseBtn");
const statusDot   = document.getElementById("statusDot");
const statusText  = document.getElementById("statusText");
const nextBreak   = document.getElementById("nextBreak");
const hint        = document.getElementById("hint");

let timerRunning = true;

// ── Load current settings & status ──────────────────────────────────────────
chrome.runtime.sendMessage({ action: "GET_STATUS" }, (res) => {
  if (!res) return;

  const workMin  = res.workMinutes  || 25;
  const breakSec = res.breakSeconds || 20;

  workSlider.value  = workMin;
  breakSlider.value = breakSec;
  workVal.textContent  = `${workMin} min`;
  breakVal.textContent = `${breakSec} sec`;

  timerRunning = res.timerRunning !== false;
  updateStatusUI(timerRunning, res.remainingMs);
});

function updateStatusUI(running, remainingMs) {
  timerRunning = running;
  if (running) {
    statusDot.classList.remove("paused");
    statusText.textContent = "Timer running";
    pauseBtn.textContent = "Pause";
    pauseBtn.classList.remove("active");

    if (remainingMs > 0) {
      const mins = Math.floor(remainingMs / 60000);
      const secs = Math.floor((remainingMs % 60000) / 1000);
      nextBreak.textContent = `Next break in ${mins}m ${secs}s`;
    } else {
      nextBreak.textContent = "";
    }
  } else {
    statusDot.classList.add("paused");
    statusText.textContent = "Paused";
    pauseBtn.textContent = "Resume";
    pauseBtn.classList.add("active");
    nextBreak.textContent = "";
  }
}

// ── Slider live update ───────────────────────────────────────────────────────
workSlider.addEventListener("input", () => {
  workVal.textContent = `${workSlider.value} min`;
});
breakSlider.addEventListener("input", () => {
  breakVal.textContent = `${breakSlider.value} sec`;
});

// ── Save button ───────────────────────────────────────────────────────────────
saveBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({
    action: "UPDATE_SETTINGS",
    workMinutes:  parseInt(workSlider.value),
    breakSeconds: parseInt(breakSlider.value),
  }, (res) => {
    hint.textContent = "✓ Saved! Timer restarted.";
    hint.className = "hint success";
    updateStatusUI(true, parseInt(workSlider.value) * 60 * 1000);
    setTimeout(() => { hint.textContent = ""; hint.className = "hint"; }, 2500);
  });
});

// ── Pause / Resume ────────────────────────────────────────────────────────────
pauseBtn.addEventListener("click", () => {
  if (timerRunning) {
    chrome.runtime.sendMessage({ action: "PAUSE_TIMER" }, () => {
      updateStatusUI(false, 0);
    });
  } else {
    chrome.runtime.sendMessage({ action: "RESUME_TIMER" }, (res) => {
      const remainingMs = parseInt(workSlider.value) * 60 * 1000;
      updateStatusUI(true, remainingMs);
    });
  }
});
