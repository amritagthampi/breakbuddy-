// overlay.js — Digital Wellness Break v2.0
console.log("[Overlay] Initialized.");

// ── Fetch configurable break duration from storage ──────────────────────────
let BREAK_SECONDS = 20; // default, overridden below
chrome.storage.local.get(["breakSeconds"], (data) => {
  if (data.breakSeconds) BREAK_SECONDS = data.breakSeconds;
});

// ── DOM refs ─────────────────────────────────────────────────────────────────
const screens = {
  intro:   document.getElementById("screen-intro"),
  breathe: document.getElementById("screen-breathe"),
  done:    document.getElementById("screen-done"),
};

const startBtn  = document.getElementById("startBtn");
const skipBtn   = document.getElementById("skipBtn");
const doneBtn   = document.getElementById("doneBtn");

const breathRing       = document.getElementById("breathRing");
const breathCount      = document.getElementById("breath-count");
const breathInstruction = document.getElementById("breathInstruction");
const phaseLabel       = document.getElementById("phase-label");
const progressBar      = document.getElementById("progressBar");
const roundLabel       = document.getElementById("roundLabel");

// ── Screen helpers ────────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove("active"));
  screens[name].classList.add("active");
}

// ── Breathing exercise ────────────────────────────────────────────────────────
// Box breathing: 4 in, 4 hold, 4 out, 4 hold
const PHASES = [
  { name: "Inhale",    label: "BREATHE IN",  cls: "inhale",  duration: 4 },
  { name: "Hold",      label: "HOLD",        cls: "hold",    duration: 4 },
  { name: "Exhale",    label: "BREATHE OUT", cls: "exhale",  duration: 4 },
  { name: "Hold",      label: "HOLD",        cls: "hold",    duration: 4 },
];

const TOTAL_ROUNDS = 3;
let currentPhase = 0;
let currentRound = 1;
let countdownInterval = null;
let totalElapsed = 0;
let totalDuration = 0; // computed from PHASES × rounds

function computeTotalDuration() {
  return PHASES.reduce((s, p) => s + p.duration, 0) * TOTAL_ROUNDS;
}

function startBreathing() {
  showScreen("breathe");
  totalDuration = computeTotalDuration();
  totalElapsed = 0;
  currentPhase = 0;
  currentRound = 1;
  runPhase();
}

function runPhase() {
  const phase = PHASES[currentPhase];
  let timeLeft = phase.duration;

  // Update UI for phase
  phaseLabel.textContent = `Round ${currentRound} of ${TOTAL_ROUNDS}`;
  breathInstruction.textContent = phase.label;
  roundLabel.textContent = `Round ${currentRound} of ${TOTAL_ROUNDS}`;

  breathRing.classList.remove("inhale", "hold", "exhale");
  // Slight delay so CSS transition fires
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      breathRing.classList.add(phase.cls);
    });
  });

  breathCount.textContent = timeLeft;

  countdownInterval = setInterval(() => {
    timeLeft--;
    totalElapsed++;
    breathCount.textContent = Math.max(timeLeft, 0);

    // Update progress bar
    progressBar.style.width = `${(totalElapsed / totalDuration) * 100}%`;

    if (timeLeft <= 0) {
      clearInterval(countdownInterval);
      advancePhase();
    }
  }, 1000);
}

function advancePhase() {
  currentPhase++;
  if (currentPhase >= PHASES.length) {
    currentPhase = 0;
    currentRound++;
  }

  if (currentRound > TOTAL_ROUNDS) {
    finishBreathing();
    return;
  }

  runPhase();
}

function finishBreathing() {
  breathRing.classList.remove("inhale", "hold", "exhale");
  progressBar.style.width = "100%";
  setTimeout(() => showScreen("done"), 300);
}

// ── Button handlers ───────────────────────────────────────────────────────────
startBtn.addEventListener("click", () => {
  startBreathing();
});

skipBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "SKIP_BREAK" });
});

doneBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ action: "BREAK_COMPLETED" });
});
