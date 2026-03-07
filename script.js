/* ═══════════════════════════════════════════════════════════════
   CommuteTrack — script.js
   All logic: time calc, train selection, timeline, table render
═══════════════════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────
   TRAIN SCHEDULE
   Edit this array to add/modify trains.
   Times are in 24-hour "HH:MM" format.
   Colors: "color1" | "color2" | "color3" | "color4"
───────────────────────────────────────────── */
const TRAIN_SCHEDULE = [
  { start: "17:20", end: "19:40", color: "color1", name: "EX-1" },
  { start: "17:25", end: "19:30", color: "color1", name: "EX-2" },
  { start: "17:30", end: "19:40", color: "color1", name: "A1"   },
  { start: "17:40", end: "19:30", color: "color2", name: "B1"   },
  { start: "17:45", end: "19:50", color: "color2", name: "B2"   },
  { start: "17:50", end: "19:45", color: "color2", name: "B3"   },
  { start: "18:00", end: "19:55", color: "color3", name: "C1"   },
  { start: "19:30", end: "21:00", color: "color3", name: "C2"   },
  { start: "19:50", end: "21:30", color: "color4", name: "D1"   },
  // ← Add more trains here
];

/* ─────────────────────────────────────────────
   TIMELINE VISUAL RANGE  (hours, 24h)
───────────────────────────────────────────── */
const TL_START_HOUR = 6;   // 6 AM
const TL_END_HOUR   = 22;  // 10 PM

/* ─────────────────────────────────────────────
   COLOR MAP  (CSS var names → hex for canvas-style drawing)
───────────────────────────────────────────── */
const COLOR_MAP = {
  color1: { bg: "rgba(108,142,245,0.75)", border: "#6c8ef5", text: "#fff" },
  color2: { bg: "rgba(167,139,250,0.75)", border: "#a78bfa", text: "#fff" },
  color3: { bg: "rgba(251,146,60,0.75)",  border: "#fb923c", text: "#fff" },
  color4: { bg: "rgba(52,211,153,0.75)",  border: "#34d399", text: "#0e0f14" },
};

/* ─────────────────────────────────────────────
   UTILITY HELPERS
───────────────────────────────────────────── */

/** Parse "HH:MM" or "H:MM" → total minutes since midnight */
function parseTime(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

/** Convert total minutes since midnight → "H:MM AM/PM" */
function formatTime12(mins) {
  const h24 = Math.floor(mins / 60) % 24;
  const m   = mins % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12  = h24 % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

/** Convert total minutes → percentage position on timeline */
function minsToPercent(mins) {
  const total = (TL_END_HOUR - TL_START_HOUR) * 60;
  const offset = mins - TL_START_HOUR * 60;
  return Math.min(100, Math.max(0, (offset / total) * 100));
}

/** Get current time as minutes since midnight */
function nowMins() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes() + n.getSeconds() / 60;
}

/* ─────────────────────────────────────────────
   CORE CALCULATION
   Returns an object with all computed times.
───────────────────────────────────────────── */
function calculate() {
  const arrivalStr = document.getElementById("arrivalTime").value;
  const workHours  = parseFloat(document.getElementById("workHours").value)  || 9;
  const walkMins   = parseInt(document.getElementById("walkTime").value)     || 0;
  const bufferMins = parseInt(document.getElementById("bufferTime").value)   || 0;
  const busMins    = parseInt(document.getElementById("busDuration").value)  || 0;

  if (!arrivalStr) return null;

  const arrivalMins    = parseTime(arrivalStr);
  const workEndMins    = arrivalMins + workHours * 60;
  const officeLeave    = workEndMins + bufferMins;   // after buffer
  const stationArrival = officeLeave + walkMins;     // after walking

  // Find earliest train that departs AT or AFTER stationArrival
  let bestTrain = null;
  let bestIdx   = -1;

  for (let i = 0; i < TRAIN_SCHEDULE.length; i++) {
    const t = TRAIN_SCHEDULE[i];
    const dep = parseTime(t.start);
    if (dep >= stationArrival) {
      if (!bestTrain || dep < parseTime(bestTrain.start)) {
        bestTrain = t;
        bestIdx   = i;
      }
    }
  }

  const homeETA = bestTrain
    ? parseTime(bestTrain.end) + busMins
    : null;

  return {
    arrivalMins,
    workEndMins,
    officeLeave,
    stationArrival,
    bestTrain,
    bestIdx,
    homeETA,
    walkMins,
    bufferMins,
    busMins,
  };
}

/* ─────────────────────────────────────────────
   UPDATE SUMMARY CARD
───────────────────────────────────────────── */
function updateSummary(calc) {
  if (!calc) return;
  const { arrivalMins, workEndMins, stationArrival, bestTrain, homeETA } = calc;

  document.getElementById("sumArrival").textContent  = formatTime12(arrivalMins);
  document.getElementById("sumLeave").textContent    = formatTime12(calc.officeLeave);
  document.getElementById("sumStation").textContent  = formatTime12(stationArrival);
  document.getElementById("sumTrain").textContent    = bestTrain ? formatTime12(parseTime(bestTrain.start)) : "—";
  document.getElementById("sumTrainEnd").textContent = bestTrain ? formatTime12(parseTime(bestTrain.end))   : "—";
  document.getElementById("sumHome").textContent     = homeETA   ? formatTime12(homeETA)                    : "—";

  const warn = document.getElementById("warningBanner");
  warn.style.display = bestTrain ? "none" : "block";
}

/* ─────────────────────────────────────────────
   RENDER TIMELINE
───────────────────────────────────────────── */
function renderTimeline(calc) {
  const container = document.getElementById("timelineContainer");
  container.innerHTML = ""; // clear

  const totalHours = TL_END_HOUR - TL_START_HOUR;

  /* — Hour lines & labels — */
  for (let h = TL_START_HOUR; h <= TL_END_HOUR; h++) {
    const pct = ((h - TL_START_HOUR) / totalHours) * 100;

    const line = document.createElement("div");
    line.className = "tl-hour-line";
    line.style.left = `${pct}%`;
    container.appendChild(line);

    const lbl = document.createElement("div");
    lbl.className = "tl-hour-label";
    lbl.style.left = `${pct}%`;
    const disp = h < 12 ? `${h}AM` : h === 12 ? "12PM" : `${h - 12}PM`;
    lbl.textContent = disp;
    container.appendChild(lbl);
  }

  if (!calc) return;

  const { arrivalMins, workEndMins, officeLeave, stationArrival, bestTrain, bestIdx, walkMins, bufferMins } = calc;

  /* ── Work block ── */
  const wLeft  = minsToPercent(arrivalMins);
  const wRight = minsToPercent(officeLeave);
  const wWidth = wRight - wLeft;
  if (wWidth > 0) {
    const wb = document.createElement("div");
    wb.className = "tl-work-block";
    wb.style.left  = `${wLeft}%`;
    wb.style.width = `${wWidth}%`;
    wb.textContent = wWidth > 4 ? "WORK" : "";
    container.appendChild(wb);

    // Label: arrival
    addLabel(container, arrivalMins, 16, formatTime12(arrivalMins), "var(--accent2)", "");
    // Label: leave office
    addLabel(container, officeLeave, 16, "Leave " + formatTime12(officeLeave), "var(--accent2)", "");
  }

  /* ── Walk block (+ buffer already included in officeLeave) ── */
  if (walkMins > 0) {
    const walkLeft  = minsToPercent(officeLeave);
    const walkRight = minsToPercent(stationArrival);
    const walkW = walkRight - walkLeft;
    if (walkW > 0) {
      const wb2 = document.createElement("div");
      wb2.className = "tl-walk-block";
      wb2.style.left  = `${walkLeft}%`;
      wb2.style.width = `${walkW}%`;
      wb2.textContent = walkW > 3 ? "WALK" : "";
      container.appendChild(wb2);
    }
    // Station arrival label
    addLabel(container, stationArrival, 16, "Station " + formatTime12(stationArrival), "var(--accent)", "");
  }

  /* ── Train bars ── */
  TRAIN_SCHEDULE.forEach((t, i) => {
    const depMins = parseTime(t.start);
    const arrMins = parseTime(t.end);
    const left  = minsToPercent(depMins);
    const right = minsToPercent(arrMins);
    const width = right - left;
    if (width <= 0) return;

    const isBest   = i === bestIdx;
    const isMissed = depMins < stationArrival;

    const cm = COLOR_MAP[t.color] || COLOR_MAP.color1;
    const bar = document.createElement("div");
    bar.className = `tl-train-bar${isBest ? " best" : isMissed ? " missed" : ""}`;
    bar.style.left       = `${left}%`;
    bar.style.width      = `${width}%`;
    bar.style.background = cm.bg;
    bar.style.border     = `1px solid ${cm.border}`;
    bar.style.color      = cm.text;
    bar.textContent      = width > 3 ? (isBest ? `★ ${t.name || t.start}` : (t.name || t.start)) : "";
    bar.title            = `${t.name || ""} ${formatTime12(depMins)} → ${formatTime12(arrMins)}`;

    // Stagger overlapping trains vertically a bit
    const overlap = TRAIN_SCHEDULE.slice(0, i).some(prev => {
      const pd = parseTime(prev.start);
      const pa = parseTime(prev.end);
      return pd < arrMins && pa > depMins;
    });
    if (overlap) {
      const base = isBest ? 88 : 96;
      bar.style.top = `${base + 32}px`;
    }

    container.appendChild(bar);

    if (isBest) {
      addLabel(container, depMins, isBest ? 140 : 130,
        `🚆 ${formatTime12(depMins)}`, "var(--accent)", "");
    }
  });

  /* ── NOW line ── */
  const now = nowMins();
  const nowPct = minsToPercent(now);
  if (nowPct >= 0 && nowPct <= 100) {
    const nowLine = document.createElement("div");
    nowLine.className = "tl-now-line";
    nowLine.style.left = `${nowPct}%`;
    container.appendChild(nowLine);

    const nowLbl = document.createElement("div");
    nowLbl.className = "tl-now-label";
    nowLbl.style.left = `${nowPct}%`;
    nowLbl.textContent = "NOW";
    container.appendChild(nowLbl);
  }
}

/** Helper: add a floating label on the timeline */
function addLabel(container, timeMins, topPx, text, color, bg) {
  const pct = minsToPercent(timeMins);
  const el  = document.createElement("div");
  el.className = "tl-label";
  el.style.left       = `${pct}%`;
  el.style.top        = `${topPx}px`;
  el.style.color      = color;
  el.style.background = bg || "transparent";
  el.textContent      = text;
  container.appendChild(el);
}

/* ─────────────────────────────────────────────
   RENDER SCHEDULE TABLE
───────────────────────────────────────────── */
function renderTable(calc) {
  const tbody = document.getElementById("scheduleBody");
  tbody.innerHTML = "";

  TRAIN_SCHEDULE.forEach((t, i) => {
    const depMins = parseTime(t.start);
    const arrMins = parseTime(t.end);
    const durMins = arrMins - depMins;
    const h = Math.floor(durMins / 60);
    const m = durMins % 60;
    const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;

    const isBest   = calc && i === calc.bestIdx;
    const isMissed = calc && depMins < calc.stationArrival;

    const cm = COLOR_MAP[t.color] || COLOR_MAP.color1;

    const tr = document.createElement("tr");
    if (isBest)        tr.className = "best-row";
    else if (isMissed) tr.className = "missed-row";

    let statusHtml = "";
    if (isBest)        statusHtml = `<span class="status-badge status-best">Best ★</span>`;
    else if (isMissed) statusHtml = `<span class="status-badge status-missed">Missed</span>`;
    else               statusHtml = `<span class="status-badge status-ok">Available</span>`;

    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${formatTime12(depMins)}</td>
      <td>${formatTime12(arrMins)}</td>
      <td>${durStr}</td>
      <td><span class="color-dot" style="background:${cm.border};"></span>${t.color}</td>
      <td>${statusHtml}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* ─────────────────────────────────────────────
   LIVE CLOCK
───────────────────────────────────────────── */
function updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, "0");
  const mm  = String(now.getMinutes()).padStart(2, "0");
  const ss  = String(now.getSeconds()).padStart(2, "0");
  document.getElementById("liveClock").textContent = `${hh}:${mm}:${ss}`;
}

/* ─────────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────────── */
function initTheme() {
  const saved = localStorage.getItem("ct_theme") || "dark";
  document.documentElement.setAttribute("data-theme", saved);
  document.querySelector(".theme-icon").textContent = saved === "dark" ? "☀" : "◑";
}

document.getElementById("themeToggle").addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next    = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("ct_theme", next);
  document.querySelector(".theme-icon").textContent = next === "dark" ? "☀" : "◑";
});

/* ─────────────────────────────────────────────
   LOCAL STORAGE — persist inputs
───────────────────────────────────────────── */
const INPUTS_KEY = "ct_inputs";

function saveInputs() {
  const data = {
    arrivalTime: document.getElementById("arrivalTime").value,
    workHours:   document.getElementById("workHours").value,
    walkTime:    document.getElementById("walkTime").value,
    bufferTime:  document.getElementById("bufferTime").value,
    busDuration: document.getElementById("busDuration").value,
  };
  localStorage.setItem(INPUTS_KEY, JSON.stringify(data));
}

function loadInputs() {
  try {
    const saved = JSON.parse(localStorage.getItem(INPUTS_KEY));
    if (!saved) return;
    if (saved.arrivalTime) document.getElementById("arrivalTime").value = saved.arrivalTime;
    if (saved.workHours)   document.getElementById("workHours").value   = saved.workHours;
    if (saved.walkTime)    document.getElementById("walkTime").value    = saved.walkTime;
    if (saved.bufferTime)  document.getElementById("bufferTime").value  = saved.bufferTime;
    if (saved.busDuration) document.getElementById("busDuration").value = saved.busDuration;
  } catch (_) { /* ignore */ }
}

/* ─────────────────────────────────────────────
   MAIN UPDATE LOOP
   Called on input change and every 30 seconds.
───────────────────────────────────────────── */
function update() {
  const calc = calculate();
  updateSummary(calc);
  renderTimeline(calc);
  renderTable(calc);
  saveInputs();
}

/* ─────────────────────────────────────────────
   INIT
───────────────────────────────────────────── */
function init() {
  initTheme();
  loadInputs();
  update();

  // Listen to all input changes
  ["arrivalTime", "workHours", "walkTime", "bufferTime", "busDuration"]
    .forEach(id => document.getElementById(id).addEventListener("input", update));

  // Live clock every second
  updateClock();
  setInterval(updateClock, 1000);

  // Re-run full update every 60 seconds to keep NOW line moving
  setInterval(update, 60_000);
}

document.addEventListener("DOMContentLoaded", init);
