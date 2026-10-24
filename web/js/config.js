/**
 * ==============================================================================
 * AgriBot Command Center - Configuration & Settings Store
 * ==============================================================================
 * Manages Firebase Realtime Database parameters, Google Gemini API keys,
 * and user-selected crop profiles with browser localStorage persistence.
 * ==============================================================================
 */

const DEFAULT_CONFIG = {
  // Google Gemini API Configuration
  geminiApiKey: "AIzaSyCmkonrkXQX_AbRZHuUD4IVFjOWY7hNLMg",
  geminiModel: "gemini-1.5-flash",
  
  // Firebase Realtime Database Configuration
  firebaseApiKey: "AIzaSyB-aOxXWe0oLcqOgzZFlJIlFUQx-vaDZPU",
  firebaseDbUrl: "https://esp-unboxing-default-rtdb.firebaseio.com/",
  firebasePath: "/currentSoilData",
  
  // Dashboard Defaults
  cropType: "Wheat",
  demoMode: false,
  theme: "light"
};

// Optimal Agronomic Thresholds by Crop Type
const CROP_PROFILES = {
  "Wheat": {
    name: "Wheat (Triticum aestivum)",
    optimalN: [40, 70],
    optimalP: [15, 30],
    optimalK: [50, 90],
    optimalMoisture: [45, 65],
    optimalPH: [6.0, 7.5],
    description: "Requires balanced nitrogen during tillering; vulnerable to waterlogging."
  },
  "Rice": {
    name: "Rice (Paddy)",
    optimalN: [50, 90],
    optimalP: [20, 35],
    optimalK: [60, 100],
    optimalMoisture: [70, 90],
    optimalPH: [5.5, 6.8],
    description: "High moisture and nitrogen requirements; sensitive to salinity."
  },
  "Tomato": {
    name: "Tomato (Solanum lycopersicum)",
    optimalN: [35, 65],
    optimalP: [25, 45],
    optimalK: [70, 120],
    optimalMoisture: [50, 70],
    optimalPH: [6.0, 6.8],
    description: "High potassium consumer during flowering/fruiting; prone to blossom end rot if calcium/pH deficient."
  },
  "Maize": {
    name: "Maize (Corn)",
    optimalN: [60, 100],
    optimalP: [20, 40],
    optimalK: [60, 90],
    optimalMoisture: [50, 70],
    optimalPH: [5.8, 7.0],
    description: "Heavy nitrogen feeder with high biomass production rate."
  },
  "Potato": {
    name: "Potato (Solanum tuberosum)",
    optimalN: [40, 70],
    optimalP: [30, 50],
    optimalK: [80, 130],
    optimalMoisture: [60, 80],
    optimalPH: [5.0, 6.5],
    description: "Prefers slightly acidic soil to inhibit common scab disease."
  }
};

class ConfigManager {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const saved = localStorage.getItem("agribot_config");
      if (saved) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("Could not load config from localStorage, using defaults", e);
    }
    return { ...DEFAULT_CONFIG };
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    try {
      localStorage.setItem("agribot_config", JSON.stringify(this.config));
    } catch (e) {
      console.error("Failed to save config to localStorage", e);
    }
  }

  get(key) {
    return this.config[key];
  }

  set(key, value) {
    this.config[key] = value;
    this.saveConfig(this.config);
  }

  getGeminiUrl() {
    const key = this.config.geminiApiKey;
    const model = this.config.geminiModel;
    return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
  }

  getCurrentCropProfile() {
    return CROP_PROFILES[this.config.cropType] || CROP_PROFILES["Wheat"];
  }
}

window.appConfig = new ConfigManager();
