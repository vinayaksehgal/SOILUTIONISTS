# AgriBot Command Center - Web Dashboard

This directory houses the frontend web dashboard for the **SOILUTIONISTS (Team 12)** Smart Field Manager.

---

## 🌟 Key Features

- **Real-Time Data Visualization:** Sub-second telemetry visualization for N, P, K, Soil Moisture, pH, Temperature, Relative Humidity, and Sunlight Intensity via Chart.js.
- **AI Agronomist Engine:** Implements Context Vector Injection with Google Gemini 1.5 to provide structured, prescriptive 3-step daily action plans with specific chemical dosages (Urea, DAP, MOP).
- **Interactive AgriBot Chatbot:** Natural language conversation grounded in real-time soil chemistry.
- **Offline Simulation Mode:** An embedded synthetic telemetry engine allows evaluators to simulate normal growth, drought stress, acidic lockout, and nitrogen deficiency scenarios without physical ESP32 hardware.
- **Multi-Crop Profiles:** Preconfigured agronomic envelopes for Wheat, Rice, Tomato, Maize, and Potato.
- **Settings & Security:** Allows custom Firebase endpoints and Google Gemini API keys to be configured via the UI and stored safely in browser `localStorage`.
- **Telemetry Export:** One-click CSV export of historical field telemetry.
- **Aesthetic Modes:** Full dark/light mode toggle with responsive glassmorphic cards.

---

## 🚀 Running Locally

The dashboard is built using standard Vanilla HTML5, modern CSS3, and ES6 JavaScript. No Node.js build process is required:

```bash
# Option 1: Open index.html directly in Google Chrome, Edge, or Firefox
start index.html

# Option 2: Run a lightweight local HTTP server
python -m http.server 8000
# Visit http://localhost:8000
```

---

## 🌐 Deploying to GitHub Pages

This repository includes a GitHub Actions workflow (`.github/workflows/deploy-pages.yml`). When pushed to GitHub:
1. In your GitHub repository, navigate to **Settings** > **Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Any push to `main` will automatically deploy the live dashboard!
