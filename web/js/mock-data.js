/**
 * ==============================================================================
 * AgriBot Command Center - Synthetic Telemetry Generator (Simulation Mode)
 * ==============================================================================
 * Generates realistic agricultural sensor data when physical ESP32 hardware
 * is offline or for testing algorithmic anomaly detection and AI logic.
 * ==============================================================================
 */

class MockTelemetryGenerator {
  constructor(onDataCallback) {
    this.callback = onDataCallback;
    this.timer = null;
    this.state = {
      N: 48,
      P: 18,
      K: 72,
      Moisture: 52.4,
      pH: 6.4,
      Temperature: 28.2,
      Humidity: 62.0,
      Sunlight: 4200
    };
    this.scenario = "normal"; // "normal", "drought", "acidic_lockout", "nitrogen_low"
  }

  setScenario(scenarioName) {
    this.scenario = scenarioName;
    if (scenarioName === "drought") {
      this.state.Moisture = 28.0;
      this.state.Temperature = 34.5;
    } else if (scenarioName === "acidic_lockout") {
      this.state.pH = 5.2;
      this.state.P = 11;
    } else if (scenarioName === "nitrogen_low") {
      this.state.N = 18;
    } else {
      this.state.Moisture = 52.0;
      this.state.pH = 6.4;
      this.state.N = 48;
      this.state.P = 22;
      this.state.K = 75;
    }
  }

  start(intervalMs = 3000) {
    if (this.timer) return;
    this.emit();
    this.timer = setInterval(() => this.emit(), intervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  emit() {
    // Apply realistic micro-drifts and noise
    const jitter = (min, max) => (Math.random() * (max - min) + min);
    
    // Slight random walk
    this.state.N = Math.max(5, Math.min(150, Math.round(this.state.N + jitter(-2, 2))));
    this.state.P = Math.max(2, Math.min(80, Math.round(this.state.P + jitter(-1, 1))));
    this.state.K = Math.max(10, Math.min(200, Math.round(this.state.K + jitter(-2, 2))));
    
    this.state.Moisture = Math.max(5, Math.min(100, +(this.state.Moisture + jitter(-0.4, 0.4)).toFixed(1)));
    this.state.pH = Math.max(3.5, Math.min(9.5, +(this.state.pH + jitter(-0.05, 0.05)).toFixed(1)));
    this.state.Temperature = Math.max(10, Math.min(48, +(this.state.Temperature + jitter(-0.2, 0.2)).toFixed(1)));
    this.state.Humidity = Math.max(20, Math.min(99, +(this.state.Humidity + jitter(-0.5, 0.5)).toFixed(1)));
    this.state.Sunlight = Math.max(100, Math.min(15000, Math.round(this.state.Sunlight + jitter(-100, 100))));

    // Occasional transient spike to test standard-deviation outlier alert (1 in 20 chance)
    if (Math.random() < 0.05) {
      this.state.Sunlight += 800; // Simulated sudden cloud parting
    }

    const payload = {
      ...this.state,
      timestamp: Math.floor(Date.now() / 1000)
    };

    if (typeof this.callback === "function") {
      this.callback(payload);
    }
  }
}

window.MockTelemetryGenerator = MockTelemetryGenerator;
