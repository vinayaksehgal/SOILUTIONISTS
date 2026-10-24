# ESP32 Smart Field Manager - Edge Gateway Firmware

This directory contains the production-ready C++ firmware for the **ESP32 DevKit V1** edge gateway developed as part of the **SOILUTIONISTS (Team 12)** project at RV College of Engineering.

---

## 🛠️ Hardware Requirements

| Component | Interface | ESP32 GPIO | Operating Voltage | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **RS485 Modbus NPK Probe** | Serial (UART2) | `GPIO 16 (RX2)`, `GPIO 17 (TX2)` | 12V (Sensor), 5V (MAX485) | Interfaced via Bi-Directional Logic Level Shifter |
| **MAX485 DE/RE Pins** | Digital Output | `GPIO 4` | 5V | Direction control pin (`HIGH` = TX, `LOW` = RX) |
| **Capacitive Moisture v1.2** | Analog (ADC1) | `GPIO 34` | 3.3V | Corrosion-resistant, 12-bit ADC input |
| **DHT22 Sensor** | Single-Bus Digital | `GPIO 23` | 3.3V | Ambient temperature & relative humidity |
| **BH1750 Ambient Light** | I2C | `GPIO 21 (SDA)`, `GPIO 22 (SCL)` | 3.3V | Sunlight lux intensity |
| **Status LED** | Digital Output | `GPIO 2` | 3.3V | Flashes on every telemetry cycle |

> ⚠️ **Important Electrical Safety Notice:**
> The RS485 MAX485 module outputs 5V TTL levels on the `RO` pin. Direct connection to the ESP32 (3.3V tolerant) will cause irreversible damage to the microcontroller. **Always route through a bi-directional logic level shifter.**

---

## 📦 Required Arduino Libraries

Install these libraries via the **Arduino IDE Library Manager** (`Ctrl+Shift+I` / `Cmd+Shift+I`):

1. **`Firebase ESP32 Client`** by *Mobizt* (v4.x+)
2. **`ArduinoJson`** by *Benoît Blanchon* (v6.x or v7.x)
3. **`DHT sensor library`** by *Adafruit*
4. **`Adafruit Unified Sensor`** by *Adafruit*
5. **`BH1750`** by *Christopher Laws*

---

## 🚀 Flashing & Setup Guide

1. Open `esp32_smart_field_manager.ino` in the Arduino IDE.
2. Duplicate `config.h.example` and rename the copy to `config.h`.
3. Fill in your network credentials and Firebase database URL:
   ```cpp
   #define WIFI_SSID     "Your_WiFi_Name"
   #define WIFI_PASSWORD "Your_WiFi_Password"
   #define FIREBASE_HOST "https://your-project-default-rtdb.firebaseio.com/"
   #define FIREBASE_AUTH "Your_Firebase_Secret_Or_Token"
   ```
4. In the Arduino IDE menu, configure your board settings:
   - **Board**: `ESP32 Dev Module`
   - **Upload Speed**: `921600` (or `115200` if unstable)
   - **Flash Frequency**: `80MHz`
   - **Partition Scheme**: `Default 4MB with spiffs (1.2MB APP/1.5MB SPIFFS)`
   - **Port**: Select your ESP32 COM port (e.g., `COM3`, `COM5`)
5. Click **Upload** (`Ctrl+U`).
6. Open the **Serial Monitor** at `115200 baud` to view connection diagnostics, CRC validation logs, and telemetry frames.

---

## 🔬 Embedded Algorithmic Features

### 1. Statistical Sliding Window Filter ($>3.5\sigma$)
Capacitive moisture sensors frequently exhibit electrical jitter ($\pm8-10\%$) due to shared power rails and RF radiation from the ESP32's Wi-Fi transmission. The firmware maintains a circular buffer of 30 historical samples and computes:
$$\mu = \frac{1}{N}\sum_{i=1}^{N} x_i, \quad \sigma = \sqrt{\frac{1}{N}\sum_{i=1}^{N} (x_i - \mu)^2}$$
Any incoming sample where $|x_{\text{new}} - \mu| > 3.5\sigma$ is identified as an electrical transient artifact and clamped to $\mu$.

### 2. Modbus CRC-16 Frame Verification
All serial byte streams from the RS485 NPK probe are verified using the polynomial $0xA001$ before accepting readings. Corrupted or incomplete frames are discarded to prevent "ghost readings" from polluting cloud records.

### 3. Static Memory Allocation (`StaticJsonDocument`)
To eliminate the heap fragmentation and out-of-memory crashes that occur during continuous TLS/SSL handshakes with Firebase, the firmware preallocates a static 512-byte JSON document (`StaticJsonDocument<512>`), enabling 24/7 continuous operation.
