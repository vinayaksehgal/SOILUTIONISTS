/**
 * ==============================================================================
 * AgriBot Command Center - Main Application Controller
 * ==============================================================================
 * SOILUTIONISTS (Team 12) - RV College of Engineering
 * Authors: Vinayak Sehgal, Sagnik Nayek, Anshul R Anchan, Nihar Tak
 * ==============================================================================
 */

class AgriBotApp {
  constructor() {
    this.currentData = {};
    this.isFirstLoad = true;
    this.charts = {};
    this.aiEngine = new window.AIAgronomist();
    this.mockGenerator = null;
    this.isSimulationMode = false;

    // Rolling telemetry history for standard deviation calculations
    this.HISTORY_WINDOW = 30;
    this.histories = {
      Moisture: [],
      Sunlight: [],
      Humidity: []
    };

    // Telemetry log for CSV export
    this.telemetryLog = [];
  }

  init() {
    console.log("[AgriBot] System Initializing...");

    // 1. Initialize Theme
    this.initTheme();

    // 2. Initialize Charts
    this.initCharts();

    // 3. Start Realtime Clock
    this.startClock();

    // 4. Setup Event Listeners
    this.setupEventListeners();

    // 5. Connect Firebase or Start Simulation
    this.connectDataSource();
  }

  // ============================================================================
  // DATA SOURCE MANAGEMENT (Firebase vs Simulation)
  // ============================================================================
  connectDataSource() {
    const isDemo = window.appConfig.get("demoMode");
    if (isDemo) {
      this.enableSimulationMode(true);
    } else {
      this.initFirebase();
    }
  }

  initFirebase() {
    const fbUrl = window.appConfig.get("firebaseDbUrl");
    const fbKey = window.appConfig.get("firebaseApiKey");

    try {
      if (!firebase.apps.length) {
        firebase.initializeApp({
          apiKey: fbKey,
          databaseURL: fbUrl
        });
      }

      const db = firebase.database();
      const path = window.appConfig.get("firebasePath") || "/currentSoilData";
      const dataRef = db.ref(path);

      this.updateConnectionStatus("waiting", "Connecting to Firebase...");

      dataRef.on("value", (snapshot) => {
        const val = snapshot.val();
        if (val) {
          this.updateConnectionStatus("live", "Live Firebase Stream");
          this.processTelemetry(val);
        }
      }, (error) => {
        console.warn("[Firebase] Listener error:", error);
        this.updateConnectionStatus("error", "Firebase Disconnected");
        // Prompt to enable simulation
        this.triggerAlert("Firebase Stream", "Offline", "Switched to standby. You can toggle Simulation Mode.", 0);
      });
    } catch (e) {
      console.error("[Firebase] Initialization failed:", e);
      this.updateConnectionStatus("error", "Firebase Config Error");
    }
  }

  enableSimulationMode(enable) {
    this.isSimulationMode = enable;
    window.appConfig.set("demoMode", enable);

    const toggleBtn = document.getElementById("sim-mode-toggle");
    if (toggleBtn) {
      toggleBtn.checked = enable;
    }

    if (enable) {
      if (!this.mockGenerator) {
        this.mockGenerator = new window.MockTelemetryGenerator((data) => {
          this.processTelemetry(data);
        });
      }
      this.mockGenerator.start(3000);
      this.updateConnectionStatus("simulation", "Simulation Mode Active");
    } else {
      if (this.mockGenerator) {
        this.mockGenerator.stop();
      }
      this.initFirebase();
    }
  }

  updateConnectionStatus(status, text) {
    const dot = document.getElementById("connection-status-dot");
    const label = document.getElementById("connection-status-text");
    if (!dot || !label) return;

    dot.className = "pulse-dot " + (status === "live" ? "live" : status === "simulation" ? "simulation" : "disconnected");
    label.textContent = text;
  }

  // ============================================================================
  // TELEMETRY PROCESSING & STATISTICAL ANOMALY DETECTION
  // ============================================================================
  processTelemetry(data) {
    this.currentData = data;
    this.telemetryLog.push({ ...data, loggedAt: new Date().toISOString() });
    if (this.telemetryLog.length > 200) this.telemetryLog.shift();

    // 1. Update Metric Cards
    this.updateCard("val-n", data.N || 0);
    this.updateCard("val-p", data.P || 0);
    this.updateCard("val-k", data.K || 0);
    this.updateCard("val-moist", (Number(data.Moisture || 0)).toFixed(1));
    this.updateCard("val-ph", (Number(data.pH || 0)).toFixed(1));
    this.updateCard("val-temp", (Number(data.Temperature || 0)).toFixed(1));
    this.updateCard("val-lux", Math.round(Number(data.Sunlight || 0)));

    const humVal = data.Humidity || data.humidity || data.humidty || 0;
    this.updateCard("val-humidity", (Number(humVal)).toFixed(1));

    // 2. Statistical Analysis & Anomaly Detection (Moisture, Sunlight, Humidity)
    const metricsToTrack = [
      { key: "Moisture", val: Number(data.Moisture || 0), stdId: "std-moist" },
      { key: "Sunlight", val: Number(data.Sunlight || 0), stdId: "std-lux" },
      { key: "Humidity", val: Number(humVal), stdId: "std-humidity" }
    ];

    metricsToTrack.forEach(m => {
      const hist = this.histories[m.key] || [];
      const prev = hist.length > 0 ? hist[hist.length - 1] : null;
      const priorStats = this.computeStats(hist);

      // Trigger alert if spike exceeds 3.5x - 5.0x standard deviation
      if (prev !== null && priorStats.std > 0.5) {
        const delta = Math.abs(m.val - prev);
        if (delta > 3.5 * priorStats.std) {
          this.triggerAlert(m.key, prev, m.val, priorStats.std);
        }
      }

      const newStats = this.pushHistory(m.key, m.val);
      const stdEl = document.getElementById(m.stdId);
      if (stdEl) stdEl.textContent = (newStats.std || 0).toFixed(2);
    });

    // 3. Update Health Index & Status Badges
    this.updateHealthScore(data);

    // 4. Update Charts
    this.updateCharts(data);

    // 5. Trigger Initial AI Report
    if (this.isFirstLoad) {
      this.aiEngine.generateDailyPlan(this.currentData, false);
      this.isFirstLoad = false;
    }
  }

  computeStats(arr) {
    if (!arr || arr.length === 0) return { mean: 0, std: 0 };
    const n = arr.length;
    const mean = arr.reduce((s, v) => s + v, 0) / n;
    const variance = arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n;
    return { mean, std: Math.sqrt(variance) };
  }

  pushHistory(key, val) {
    if (val === null || val === undefined || isNaN(val)) return { mean: 0, std: 0 };
    if (!this.histories[key]) this.histories[key] = [];
    this.histories[key].push(Number(val));
    if (this.histories[key].length > this.HISTORY_WINDOW) {
      this.histories[key].shift();
    }
    return this.computeStats(this.histories[key]);
  }

  triggerAlert(metric, prev, curr, std) {
    const container = document.getElementById("global-alerts");
    if (!container) return;

    const msg = `${metric} spike detected: ${Number(prev).toFixed(1)} → ${Number(curr).toFixed(1)} (Δ=${Math.abs(curr-prev).toFixed(1)} > 3.5σ)`;
    console.warn("[ALERT]", msg);

    const alertEl = document.createElement("div");
    alertEl.className = "flex items-center justify-between p-3.5 mb-2.5 rounded-xl bg-red-500/10 dark:bg-red-950/40 border border-red-500/30 text-red-700 dark:text-red-300 shadow-lg text-sm backdrop-blur-md transition-all duration-300 pointer-events-auto";
    alertEl.innerHTML = `
      <div class="flex items-center gap-2">
        <span class="text-base">⚠️</span>
        <span class="font-medium">${msg}</span>
      </div>
      <button class="text-red-400 hover:text-red-600 dark:hover:text-red-200 text-xs font-bold uppercase ml-3">✕</button>
    `;

    alertEl.querySelector("button").onclick = () => alertEl.remove();
    container.appendChild(alertEl);

    setTimeout(() => {
      alertEl.classList.add("opacity-0", "translate-y-2");
      setTimeout(() => alertEl.remove(), 400);
    }, 10000);
  }

  updateHealthScore(data) {
    const crop = window.appConfig.getCurrentCropProfile();
    let score = 100;

    // Deduct points for deviations from optimal crop envelope
    if (data.Moisture < crop.optimalMoisture[0] || data.Moisture > crop.optimalMoisture[1]) score -= 20;
    if (data.pH < crop.optimalPH[0] || data.pH > crop.optimalPH[1]) score -= 25;
    if (data.N < crop.optimalN[0]) score -= 20;
    if (data.P < crop.optimalP[0]) score -= 15;
    if (data.K < crop.optimalK[0]) score -= 15;

    score = Math.max(15, Math.min(100, score));

    const scoreEl = document.getElementById("health-score-val");
    const ringEl = document.getElementById("health-score-ring");
    const badgeEl = document.getElementById("health-score-badge");

    if (scoreEl) scoreEl.textContent = score + "%";
    if (ringEl) {
      const offset = 283 - (283 * score) / 100;
      ringEl.style.strokeDashoffset = offset;
      ringEl.style.stroke = score > 75 ? "#10b981" : score > 50 ? "#f59e0b" : "#ef4444";
    }

    if (badgeEl) {
      if (score > 75) {
        badgeEl.className = "status-pill good";
        badgeEl.textContent = "Optimal";
      } else if (score > 50) {
        badgeEl.className = "status-pill warning";
        badgeEl.textContent = "Attention Needed";
      } else {
        badgeEl.className = "status-pill danger";
        badgeEl.textContent = "Stress Alert";
      }
    }
  }

  updateCard(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  // ============================================================================
  // CHART.JS VISUALIZATION SUITE
  // ============================================================================
  initCharts() {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    const gridColor = isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.05)";
    const textColor = isDark ? "#94a3b8" : "#64748b";

    const defaultOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: textColor, font: { family: "Inter", size: 11 } } }
      },
      scales: {
        x: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } },
        y: { grid: { color: gridColor }, ticks: { color: textColor, font: { size: 10 } } }
      }
    };

    // 1. Live Moisture & Temp Chart
    const ctxMain = document.getElementById("mainChart")?.getContext("2d");
    if (ctxMain) {
      this.charts.main = new Chart(ctxMain, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "Moisture (%)", borderColor: "#0ea5e9", backgroundColor: "rgba(14, 165, 233, 0.1)", fill: true, tension: 0.35, data: [] },
            { label: "Temp (°C)", borderColor: "#ef4444", fill: false, tension: 0.35, data: [] }
          ]
        },
        options: defaultOptions
      });
    }

    // 2. NPK Nutrient Balance Chart
    const ctxNpk = document.getElementById("npkChart")?.getContext("2d");
    if (ctxNpk) {
      this.charts.npk = new Chart(ctxNpk, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "Nitrogen (mg/kg)", borderColor: "#3b82f6", tension: 0.35, data: [] },
            { label: "Phosphorus (mg/kg)", borderColor: "#f59e0b", tension: 0.35, data: [] },
            { label: "Potassium (mg/kg)", borderColor: "#10b981", tension: 0.35, data: [] }
          ]
        },
        options: defaultOptions
      });
    }

    // 3. Humidity & Variance Chart
    const ctxHum = document.getElementById("humidityChart")?.getContext("2d");
    if (ctxHum) {
      this.charts.humidity = new Chart(ctxHum, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "Humidity (%)", borderColor: "#06b6d4", tension: 0.35, data: [] },
            { label: "Humidity Std Dev", borderColor: "#a5f3fc", borderDash: [4, 4], fill: false, data: [] }
          ]
        },
        options: defaultOptions
      });
    }

    // 4. pH & Sunlight Intensity Chart
    const ctxEnv = document.getElementById("envChart")?.getContext("2d");
    if (ctxEnv) {
      this.charts.env = new Chart(ctxEnv, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "Soil pH", borderColor: "#8b5cf6", yAxisID: "y", tension: 0.35, data: [] },
            { label: "Sunlight (Lux)", borderColor: "#eab308", yAxisID: "y1", tension: 0.35, data: [] }
          ]
        },
        options: {
          ...defaultOptions,
          scales: {
            ...defaultOptions.scales,
            y: { ...defaultOptions.scales.y, position: "left", title: { display: true, text: "pH", color: textColor } },
            y1: { ...defaultOptions.scales.y, position: "right", grid: { drawOnChartArea: false }, title: { display: true, text: "Lux", color: textColor } }
          }
        }
      });
    }
  }

  updateCharts(data) {
    const timeLabel = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const maxDataPoints = 12;

    const pushDataPoint = (chart, values) => {
      if (!chart) return;
      if (chart.data.labels.length >= maxDataPoints) {
        chart.data.labels.shift();
        chart.data.datasets.forEach(ds => ds.data.shift());
      }
      chart.data.labels.push(timeLabel);
      values.forEach((val, idx) => {
        if (chart.data.datasets[idx]) chart.data.datasets[idx].data.push(val);
      });
      chart.update("none");
    };

    // Main Chart: Moisture, Temp
    pushDataPoint(this.charts.main, [Number(data.Moisture || 0), Number(data.Temperature || 0)]);

    // NPK Chart: N, P, K
    pushDataPoint(this.charts.npk, [Number(data.N || 0), Number(data.P || 0), Number(data.K || 0)]);

    // Humidity Chart: Hum, Std
    const hum = data.Humidity || data.humidity || data.humidty || 0;
    const humStats = this.computeStats(this.histories.Humidity || []);
    pushDataPoint(this.charts.humidity, [Number(hum), humStats.std || 0]);

    // Env Chart: pH, Sunlight
    pushDataPoint(this.charts.env, [Number(data.pH || 0), Number(data.Sunlight || 0)]);
  }

  // ============================================================================
  // EVENT LISTENERS & UI HELPERS
  // ============================================================================
  setupEventListeners() {
    // Regenerate AI Plan Button
    const regenBtn = document.getElementById("regen-plan-btn");
    if (regenBtn) {
      regenBtn.addEventListener("click", () => {
        this.aiEngine.generateDailyPlan(this.currentData, true);
      });
    }

    // Chatbot send button and Enter key
    const chatInput = document.getElementById("chat-input");
    const chatSendBtn = document.getElementById("chat-send-btn");
    const sendHandler = () => {
      const query = chatInput?.value?.trim();
      if (query) {
        chatInput.value = "";
        this.aiEngine.askAssistant(query, this.currentData);
      }
    };

    if (chatSendBtn) chatSendBtn.addEventListener("click", sendHandler);
    if (chatInput) {
      chatInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") sendHandler();
      });
    }

    // Quick prompt buttons in chat
    document.querySelectorAll(".quick-prompt-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const text = e.target.textContent.trim().replace(/^['"]|['"]$/g, "");
        if (chatInput) chatInput.value = text;
        sendHandler();
      });
    });

    // Crop Selector dropdown
    const cropSelect = document.getElementById("crop-selector");
    if (cropSelect) {
      cropSelect.value = window.appConfig.get("cropType");
      cropSelect.addEventListener("change", (e) => {
        window.appConfig.set("cropType", e.target.value);
        this.updateHealthScore(this.currentData);
        this.aiEngine.generateDailyPlan(this.currentData, true);
      });
    }

    // Simulation Mode Switch
    const simToggle = document.getElementById("sim-mode-toggle");
    if (simToggle) {
      simToggle.checked = window.appConfig.get("demoMode");
      simToggle.addEventListener("change", (e) => {
        this.enableSimulationMode(e.target.checked);
      });
    }

    // Simulation Scenario Buttons
    document.querySelectorAll("[data-sim-scenario]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const scenario = e.currentTarget.getAttribute("data-sim-scenario");
        if (this.mockGenerator) {
          this.mockGenerator.setScenario(scenario);
          this.mockGenerator.emit();
        }
      });
    });

    // Theme Toggle
    const themeBtn = document.getElementById("theme-toggle-btn");
    if (themeBtn) {
      themeBtn.addEventListener("click", () => this.toggleTheme());
    }

    // Settings Modal
    const settingsBtn = document.getElementById("open-settings-btn");
    const settingsModal = document.getElementById("settings-modal");
    const closeSettingsBtn = document.getElementById("close-settings-btn");
    const saveSettingsBtn = document.getElementById("save-settings-btn");

    if (settingsBtn && settingsModal) {
      settingsBtn.addEventListener("click", () => {
        document.getElementById("cfg-gemini-key").value = window.appConfig.get("geminiApiKey") || "";
        document.getElementById("cfg-gemini-model").value = window.appConfig.get("geminiModel") || "gemini-1.5-flash";
        document.getElementById("cfg-firebase-url").value = window.appConfig.get("firebaseDbUrl") || "";
        settingsModal.classList.add("active");
      });
    }

    if (closeSettingsBtn && settingsModal) {
      closeSettingsBtn.addEventListener("click", () => settingsModal.classList.remove("active"));
    }

    if (saveSettingsBtn && settingsModal) {
      saveSettingsBtn.addEventListener("click", () => {
        const gKey = document.getElementById("cfg-gemini-key")?.value?.trim();
        const gModel = document.getElementById("cfg-gemini-model")?.value?.trim();
        const fbUrl = document.getElementById("cfg-firebase-url")?.value?.trim();

        window.appConfig.saveConfig({
          geminiApiKey: gKey,
          geminiModel: gModel,
          firebaseDbUrl: fbUrl
        });

        settingsModal.classList.remove("active");
        alert("Settings saved successfully to local storage!");
      });
    }

    // Export Telemetry to CSV
    const exportBtn = document.getElementById("export-csv-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", () => this.exportCSV());
    }
  }

  exportCSV() {
    if (this.telemetryLog.length === 0) {
      alert("No telemetry recorded yet to export.");
      return;
    }

    const headers = ["Timestamp", "LoggedAt", "Nitrogen_mg_kg", "Phosphorus_mg_kg", "Potassium_mg_kg", "Moisture_pct", "pH", "Temperature_C", "Humidity_pct", "Sunlight_Lux"];
    const rows = this.telemetryLog.map(d => [
      d.timestamp || "",
      d.loggedAt || "",
      d.N || 0,
      d.P || 0,
      d.K || 0,
      d.Moisture || 0,
      d.pH || 0,
      d.Temperature || 0,
      d.Humidity || d.humidity || 0,
      d.Sunlight || 0
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `agribot_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  initTheme() {
    const savedTheme = window.appConfig.get("theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    window.appConfig.set("theme", next);

    // Re-init charts with proper theme contrast
    this.initCharts();
    if (this.currentData.Temperature) {
      this.updateCharts(this.currentData);
    }
  }

  startClock() {
    const clockEl = document.getElementById("realtime-clock");
    if (!clockEl) return;
    setInterval(() => {
      clockEl.textContent = new Date().toLocaleTimeString();
    }, 1000);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  window.app = new AgriBotApp();
  window.app.init();
});
