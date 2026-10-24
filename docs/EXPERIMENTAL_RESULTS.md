# Experimental Validation, Benchmarking & Results

This document presents the experimental methodology, quantitative validation data, and performance benchmarks conducted during the **Experiential Learning Phase 3** project at RV College of Engineering.

---

## 🧪 1. Soil Sample Controlled Experiment: Electrical Conductivity (EC) Proxy Analysis

To validate sensor sensitivity and uncover the physical mechanisms governing low-cost NPK probes, a controlled experiment was conducted using three identical 500g samples of **Red Loamy Soil** in non-conductive containers.

### Test Matrix & Empirical Readings

| Sample ID | Experimental Condition | Moisture Sensor Reading | NPK Probe (N) Reading | Agronomic Insight & Validation Conclusion |
| :--- | :--- | :--- | :--- | :--- |
| **Sample A** | Dry Soil (Control, No Additives) | **Dry (Low, <5%)** | **~0 mg/kg** | **Ion Mobility Prerequisite:** Confirms that without moisture as a solvent medium, ions cannot become mobile and electrochemical sensors cannot detect nutrient presence. |
| **Sample B** | Dry Soil + 200ml Distilled Water ($0 \text{ TDS}$) | **Wet (High, 56%)** | **~45 mg/kg** | **True Soil Baseline:** Pure solvent introduces zero external ions, providing the ground-truth baseline of mobile soil nutrients. |
| **Sample C** | Dry Soil + 200ml Hard Tap Water ($380 \text{ ppm TDS}$) | **Wet (High, 57%)** | **~112 mg/kg** | **Electrical Conductivity (EC) Proxy:** Demonstrates that probes measure EC as a proxy for NPK. Soluble salts ($\text{Ca}^{2+}, \text{Mg}^{2+}$) in municipal water elevate conductivity, causing an apparent **+148%** measurement spike. |

### Key Takeaway for Agricultural IoT
Low-cost NPK sensors utilize bulk soil electrical conductivity (EC) as a proxy for nutrient concentration. Soil calibration must incorporate baseline irrigation water salinity to prevent fertilizer over-application.

---

## 📊 2. Sensor Accuracy Validation vs. Laboratory Standards

The prototype sensors were evaluated against standard chemical laboratory soil assays (Kjeldahl method for Nitrogen, Bray's method for Phosphorus, and Flame Photometry for Potassium):

| Soil Parameter | Laboratory Standard | Prototype Measured Value | Absolute Error | Relative Variance (%) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nitrogen (N)** | $40.0\text{ mg/kg}$ | $38.0\text{ mg/kg}$ | $-2.0\text{ mg/kg}$ | **5.0%** | Statistically Acceptable |
| **Phosphorus (P)** | $20.0\text{ mg/kg}$ | $21.0\text{ mg/kg}$ | $+1.0\text{ mg/kg}$ | **5.0%** | Statistically Acceptable |
| **Potassium (K)** | $90.0\text{ mg/kg}$ | $84.0\text{ mg/kg}$ | $-6.0\text{ mg/kg}$ | **6.6%** | Statistically Acceptable |
| **Soil pH** | $6.50$ | $6.40$ | $-0.10$ | **1.5%** | High Precision |
| **Soil Moisture** | $45.0\text{ wt\%}$ | $43.8\text{ wt\%}$ | $-1.2\text{ wt\%}$ | **2.6%** | High Stability |

> **Conclusion:** While an overall variance of $5-6\%$ exists, it is well within acceptable agronomic tolerances for field classification (Deficient / Normal / Surplus) and actionable fertilization scheduling.

---

## ⏱️ 3. End-to-End Latency Benchmark

The time required for an in-ground physical parameter change to be reflected on the farmer's web dashboard was profiled over 100 consecutive telemetry cycles:

| Pipeline Stage | Protocol / Technology | Latency |
| :--- | :--- | :--- |
| **Edge Polling & CRC Check** | RS485 Modbus RTU @ 9600 baud | **500 ms** |
| **Cloud Telemetry Upload** | Wi-Fi 802.11n ➔ Firebase REST/WSS (TLS 1.2) | **240 ms** |
| **Client Synchronization** | Firebase Event Listener (`onValueChange`) | **450 ms** |
| **Total Glass-to-Glass Latency** | **Field Sensor ➔ Farmer Screen** | **≈ 1.19 seconds** |

This near-instantaneous latency represents a **>1,000,000x acceleration** compared to traditional government Soil Health Card laboratory turnaround times (7 to 14 days).

---

## 🧠 4. Generative AI Diagnostic Fidelity

The **AI Agronomist** decision engine was benchmarked against 40 synthetic multi-parameter edge cases curated by human agronomy specialists:

- **Phosphorus Lockout Test:** Input $\text{pH} = 8.0$, $P = 22\text{ mg/kg}$.
  - *Expected:* Identify calcium phosphate precipitation; advise sulfur/gypsum before adding DAP.
  - *Result:* **Passed.** Model identified alkaline lockout and warned against adding chemical phosphate.
- **Combined Drought & Heat Stress:** Input $\text{Moisture} = 22\%$, $\text{Temp} = 37^\circ\text{C}$.
  - *Expected:* Prioritize emergency deep irrigation; advise against daytime nitrogen application to avoid leaf burn.
  - *Result:* **Passed.**
- **Overall Diagnostic Accuracy:** **95.0% (38/40 test cases passed)**, achieving expert-level prescriptive advice without requiring human intervention.
