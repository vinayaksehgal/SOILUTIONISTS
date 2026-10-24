# Algorithmic Models & Mathematical Formulations

This document provides a formal mathematical and algorithmic explanation of the signal processing, error detection, agronomic fusion, and generative AI prompt injection models utilized across the **SOILUTIONISTS** platform.

---

## 1. Statistical Sliding Window Filter ($>3.5\sigma$ Noise Rejection)

### The Problem
Capacitive soil moisture sensors exhibit high-frequency electrical jitter ($\pm8-10\%$) when deployed in agricultural setups. This noise is primarily induced by electromagnetic interference (EMI) from the shared power rail and transient current surges during ESP32 Wi-Fi transmissions. Naive threshold alerting produces severe "alert fatigue."

### Mathematical Formulation
The edge firmware implements a circular sliding window containing the $N = 30$ most recent sensor readings:
$$\mathcal{W} = \{x_1, x_2, \dots, x_N\}$$

The sample mean $\mu$ and sample standard deviation $\sigma$ are calculated dynamically:
$$\mu = \frac{1}{N} \sum_{i=1}^{N} x_i$$
$$\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^{N} (x_i - \mu)^2}$$

When a new sensor sample $x_{\text{new}}$ is captured:
1. The absolute deviation from the historical mean is determined:
   $$\Delta = |x_{\text{new}} - \mu|$$
2. The outlier rejection condition is evaluated:
   $$\text{Decision}(x_{\text{new}}) = \begin{cases} 
      \mu, & \text{if } \Delta > 3.5\sigma \quad (\text{Transient Noise Detected}) \\
      x_{\text{new}}, & \text{otherwise} \quad (\text{Valid Telemetry})
   \end{cases}$$

This statistical boundary successfully rejects random transient jitter while promptly admitting genuine shifts in soil moisture (e.g., rainfall or irrigation events).

---

## 2. Modbus RTU Cyclic Redundancy Check (CRC-16)

To prevent "ghost readings" caused by inductive motor noise or cable crosstalk over long RS485 bus wires, every frame received from the NPK probe must satisfy the **CRC-16 Modbus Standard** (Polynomial: $x^{16} + x^{15} + x^2 + 1$, corresponding to the reversed representation `0xA001`).

```
Algorithm: Modbus CRC-16 Calculation
Input: Byte array buffer[0 ... len-1]
Output: 16-bit CRC checksum

1. Initialize crc = 0xFFFF
2. For each byte b in buffer:
     crc = crc XOR b
     For bit = 0 to 7:
       If (crc AND 0x0001) != 0:
         crc = (crc >> 1) XOR 0xA001
       Else:
         crc = crc >> 1
3. Return crc
```

If the lower and upper CRC bytes appended to the probe's response stream do not match the calculated CRC-16, the entire frame is rejected.

---

## 3. Multi-Parameter Nutrient Lockout Fusion Logic

A central scientific breakthrough of this research is overcoming the *"isolated parameter fallacy."* Traditional farming sensors alert on single metrics (e.g., "Phosphorus is low"). However, in soil chemistry, nutrient bioavailability is strongly governed by soil pH:

```
           4.0    5.0    6.0    7.0    8.0    9.0    10.0  (Soil pH)
Nitrogen   |======|======|===================|======|=====|
Phosphorus |------|------|===================|------|-----| (Locked < 6.0 and > 7.8)
Potassium  |------|======|===================|======|=====|
Iron/Alum  |=============|-------------------|------|-----| (Toxic < 5.0)
Calcium    |------|------|===================|============|
```

### Key Agronomic Rules Enforced:
1. **Acidic Phosphorus Fixation ($\text{pH} < 6.0$):**
   In acidic soils, soluble phosphorus ions ($\text{H}_2\text{PO}_4^-$) react with active Aluminum ($\text{Al}^{3+}$) and Iron ($\text{Fe}^{3+}$) ions to precipitate insoluble aluminum/iron phosphates.
   - *AI Rule:* Do **not** recommend applying more chemical phosphate fertilizer (DAP). Prescribe **Agricultural Lime ($\text{CaCO}_3$)** to raise pH before fertilizing.
2. **Alkaline Calcium Phosphate Lockout ($\text{pH} > 7.8$):**
   In alkaline soils, phosphate precipitates with calcium to form insoluble Hydroxyapatite or Calcium Phosphate.
   - *AI Rule:* Prescribe **Agricultural Gypsum ($\text{CaSO}_4$)** or **Elemental Sulfur** to reduce alkalinity.

---

## 4. Context Vector Prompt Injection Engine

Instead of generic chatbot queries, the Cognitive Layer injects the unified telemetry vector $C_v$ directly into a constrained system prompt for the **Google Gemini 1.5 Flash** model:

```
[System Prompt Header: Expert Agronomist Persona]
Target Crop: {Crop_Name} (Optimal Envelope: N, P, K, pH, Moisture)
Live Vector: Cv = { N, P, K, pH, Moisture, Temperature, Humidity, Lux }

[Evaluation Directives]
1. Calculate deviation delta from optimal crop baseline.
2. Cross-reference pH for nutrient lockout phenomena.
3. Formulate exactly 3 prioritized, non-generic prescriptive actions (kg/ha dosage).

[Response Format Constraint]
Strict clean HTML formatting (<b>, <ul>, <li>). Maximum 150 words.
```

This dynamic injection anchors the LLM reasoning to empirical sensor measurements, eliminating hallucination risks and delivering reliable guidance to farmers.
