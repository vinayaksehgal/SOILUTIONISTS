# System Architecture: Chip-to-Cloud-to-Cognition

The **Full-Stack Agronomic Smart Field Manager** operates on a decoupled **"Chip-to-Cloud-to-Cognition"** pipeline designed to bridge the gap between industrial sensor telemetry and actionable, natural-language farmer advisories.

---

## 🏛️ Architecture Overview

The system is organized into three distinct operational layers:

```mermaid
flowchart TD
    subgraph Perception Layer ["1. Perception Layer (Edge Gateway)"]
        S1["RS485 Modbus NPK Probe"] -->|Differential A/B| MAX["MAX485 Transceiver"]
        MAX -->|5V TTL| LS["Bi-Directional Level Shifter"]
        LS -->|3.3V TTL| ESP["ESP32 DevKit V1"]
        S2["Capacitive Moisture v1.2"] -->|Analog ADC1| ESP
        S3["DHT22 (Temp & Hum)"] -->|GPIO Single-Bus| ESP
        S4["BH1750 Ambient Light"] -->|I2C SDA/SCL| ESP
        ESP -->|CRC-16 & 3.5σ Filter| PROC["On-Chip Filtering & StaticJsonDocument"]
    end

    subgraph Transport Layer ["2. Transport Layer (Serverless Cloud Sync)"]
        PROC -->|WSS / SSL TLS 1.2| FB[("Google Firebase Realtime Database")]
        FB -->|Event-Driven WebSocket (onValue)| DB_NODE["Node: /currentSoilData"]
    end

    subgraph Cognition Layer ["3. Cognition Layer (Generative AI Decision Engine)"]
        DB_NODE -->|Context Vector Cv| AI["Google Gemini 1.5 Flash API"]
        AI -->|Context Injection Prompt| PLAN["3-Step Daily Action Plan"]
        AI -->|Interactive Telemetry Query| CHAT["AgriBot Real-Time Assistant"]
        DB_NODE -->|Data Stream| UI["Web Dashboard (Chart.js & Tailwind)"]
    end
```

---

## 1. Perception Layer (Edge Telemetry)

The sensing node acts as the physical interface between the soil environment and the digital cloud:

- **Central Processing Unit:** ESP32 DevKit V1 (Dual-core Xtensa 32-bit LX6 microprocessor operating at 240 MHz). One core manages sensor polling and CRC calculations, while the secondary core handles Wi-Fi encryption and TLS handshakes.
- **Heterogeneous Context Vector ($C_v$):**
  $$C_v = \{N, P, K, \text{pH}, M_{\text{soil}}, T_{\text{amb}}, H_{\text{amb}}, L_{\text{lux}}\}$$
  - **RS485 Modbus RTU NPK Probe:** Industrial-grade differential signaling immune to electromagnetic interference (EMI) over cable runs up to 1,200 meters.
  - **Capacitive Soil Moisture Sensor (v1.2):** Corrosion-resistant dielectric permittivity sensor.
  - **DHT22 Sensor:** High-accuracy capacitive humidity and thermistor ambient temperature sensor for evapotranspiration estimation.
  - **BH1750 Ambient Lux Sensor:** Calibrated optical sensor tracking photosynthetically active radiation (PAR) proxies.

---

## 2. Serverless Transport Layer (Cloud Telemetry)

Unlike traditional IoT systems that rely on client-side HTTP polling (which wastes cellular bandwidth and battery life), this architecture implements a decoupled **Push-Pull** model over **WebSockets**:

- **Edge Serialization:** Data is serialized directly into fixed-buffer JSON on the ESP32 using `StaticJsonDocument<512>`. Pre-allocating fixed memory prevents heap fragmentation crashes during continuous operation.
- **Synchronization Bridge:** Google Firebase Realtime Database acts as the single source of truth.
- **Glass-to-Glass Latency:**
  $$\text{Total Latency} = t_{\text{sensor\_polling}} (500\text{ms}) + t_{\text{ssl\_upload}} (240\text{ms}) + t_{\text{websocket\_sync}} (450\text{ms}) \approx 1.2\text{ seconds}$$

---

## 3. Cognition Layer (Generative AI Decision Engine)

Traditional agronomy systems rely on rigid, static threshold rules (e.g., *"If N < 20, alert user"*), which fail to capture non-linear chemical interactions. The Cognition Layer employs **Context Vector Injection** into **Google Gemini 1.5 Flash**:

1. **Context Construction:** The web application extracts live readings from Firebase and constructs a dynamic state vector.
2. **Crop Envelope Matching:** Evaluates readings against calibrated agronomic thresholds for target crops (Wheat, Rice, Tomato, Maize, Potato).
3. **Lockout Detection:** Identifies nutrient bioavailability lockouts (e.g., high pH precipitating phosphorus into insoluble calcium phosphate).
4. **Natural Language Generation:** Generates a structured 3-step prescriptive intervention specifying exact fertilizers (Urea, DAP, MOP) in kg/hectare.
