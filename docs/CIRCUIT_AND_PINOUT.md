# Circuit Schematics, Pinout & Hardware Specification

This document details the physical electrical wiring, voltage level translation, and Bill of Materials (BOM) for the **SOILUTIONISTS (Team 12)** Smart Field Manager.

---

## ⚡ Power Distribution Network

Agricultural environments commonly provide 12V DC power from tractors, solar arrays, or lead-acid batteries. The hardware stack employs a dual-stage stepped power rail:

```
[12V DC Adapter / Solar Battery]
          │
          ├──► (12V Rail) ──► NPK Sensor VCC (Brown Wire)
          │
    [LM2596 Buck Converter #1]
          │
          ├──► (5V Rail)  ──► MAX485 VCC & Level Shifter HV
          │
    [Buck Converter #2 / Linear Regulator]
          │
          └──► (3.3V Rail) ──► ESP32 3V3, DHT22, Moisture v1.2, BH1750, Level Shifter LV
```

---

## 🔌 Complete Hardware Pinout Table

| Subsystem | Component Pin | Target ESP32 / Power Pin | Voltage | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Power Input** | 12V DC (+) | 12V Rail Input | 12V DC | System power supply |
| | GND (-) | Common Ground Rail | 0V | Common system ground |
| **NPK Probe** | VCC (Brown) | 12V Rail | 12V DC | Industrial probe power |
| | GND (Black) | Common Ground | 0V | Common ground |
| | A (Yellow) | MAX485 Pin A | RS485 Diff+ | Differential line positive |
| | B (Blue) | MAX485 Pin B | RS485 Diff- | Differential line negative |
| **MAX485 Module** | VCC | 5V Rail | 5V DC | Required for differential transceivers |
| | GND | Common Ground | 0V | Common ground |
| | RO (Receiver Out) | Level Shifter HV1 ➔ LV1 ➔ `GPIO 16 (RX2)` | 5V ➔ 3.3V | Steps down 5V UART to ESP32 RX |
| | DI (Driver In) | Level Shifter LV2 ➔ HV2 ➔ `GPIO 17 (TX2)` | 3.3V ➔ 5V | Steps up 3.3V UART to MAX485 TX |
| | DE / RE | `GPIO 4` | 3.3V | Transmit (`HIGH`) / Receive (`LOW`) toggle |
| **Capacitive Moisture** | VCC | 3.3V Rail | 3.3V DC | Corrosion-resistant sensor |
| | GND | Common Ground | 0V | Common ground |
| | AOUT | `GPIO 34 (ADC1_CH6)` | 0 - 3.3V | 12-bit Analog voltage input |
| **DHT22** | VCC | 3.3V Rail | 3.3V DC | Temperature & humidity |
| | GND | Common Ground | 0V | Common ground |
| | DATA | `GPIO 23` | 3.3V Logic | Single-bus digital I/O (10k pullup) |
| **BH1750 Light** | VCC | 3.3V Rail | 3.3V DC | Lux sensor |
| | GND | Common Ground | 0V | Common ground |
| | SDA | `GPIO 21` | 3.3V Logic | I2C Data line |
| | SCL | `GPIO 22` | 3.3V Logic | I2C Clock line |

---

## 🛡️ Critical Design Consideration: Logic Level Shifting

> ⚠️ **Microcontroller Protection:**  
> The MAX485 transceiver operates on **5V logic**, while the ESP32 GPIOs are strictly **3.3V tolerant**. Feeding a 5V TTL signal from the MAX485 `RO` pin directly into the ESP32 `GPIO 16` causes electrical stress, gate oxide breakdown, and eventual destruction of the ESP32.
>
> A **4-channel bi-directional MOSFET level shifter** is placed in-line:
> - **High Voltage (HV):** Connected to the 5V rail.
> - **Low Voltage (LV):** Connected to the 3.3V rail.
> - `RO (5V)` passes through HV1 to LV1 (`GPIO 16`, 3.3V).
> - `GPIO 17 (3.3V)` passes through LV2 to HV2 (`DI`, 5V).

---

## 💰 Bill of Materials (BOM) & Cost Breakdown

Commercial agricultural NPK analyzers typically retail for **$500 to $1,500 USD** (₹40,000 to ₹1,20,000). The prototype described herein democratizes precision farming at a fraction of that cost:

| Component | Quantity | Unit Cost (INR) | Unit Cost (USD) | Function |
| :--- | :--- | :--- | :--- | :--- |
| **ESP32 DevKit V1** | 1 | ₹350 | ~$4.20 | Dual-core Edge Gateway & Wi-Fi Client |
| **RS485 Modbus NPK Probe** | 1 | ₹2,600 | ~$31.00 | Industrial N-P-K & soil chemical probe |
| **MAX485 TTL-to-RS485 Module**| 1 | ₹60 | ~$0.75 | Differential serial transceiver |
| **Bi-Directional Level Shifter**| 1 | ₹50 | ~$0.60 | 3.3V ⇄ 5V signal safety barrier |
| **Capacitive Soil Moisture v1.2**| 1 | ₹120 | ~$1.45 | Corrosion-proof moisture measurement |
| **DHT22 Temperature & Humidity**| 1 | ₹180 | ~$2.15 | Ambient environmental tracking |
| **BH1750 Ambient Light Sensor**| 1 | ₹110 | ~$1.30 | Solar irradiance & lux tracking |
| **LM2596 Step-Down Converters**| 2 | ₹180 | ~$2.15 | High-efficiency DC-DC regulation |
| **Prototyping PCB & Enclosure**| 1 | ₹350 | ~$4.20 | Weatherproof housing & wiring bus |
| **Total Prototype Cost** | — | **≈ ₹4,000** | **≈ $47.80** | **~90% Savings vs Commercial Analysers** |
