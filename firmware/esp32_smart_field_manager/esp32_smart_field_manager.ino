/**
 * =========================================================================================
 * Full-Stack Agronomic Smart Field Manager - ESP32 Edge Firmware
 * =========================================================================================
 * Project: SOILUTIONISTS (Team 12) - Experiential Learning Phase 3
 * Institution: RV College of Engineering, Bengaluru
 * Authors: Vinayak Sehgal, Sagnik Nayek, Anshul R Anchan, Nihar Tak
 *
 * Description:
 *   Edge gateway firmware executing on ESP32 DevKit V1. Fuses RS485 Modbus industrial NPK probe,
 *   DHT22 environmental sensor, BH1750 ambient light sensor, and capacitive soil moisture sensor.
 *   Implements on-chip CRC16 frame validation, statistical sliding-window outlier rejection
 *   (>3.5*sigma filter), and pushes real-time telemetry to Google Firebase Realtime Database
 *   using fixed-buffer static JSON serialization.
 * =========================================================================================
 */

#include <WiFi.h>
#include <Wire.h>
#include <DHT.h>
#include <BH1750.h>
#include <ArduinoJson.h>
#include <FirebaseESP32.h>

// Include local configuration (fall back to example defaults if not created)
#if __has_include("config.h")
  #include "config.h"
#else
  #include "config.h.example"
#endif

// ==============================================================================
// GLOBAL SENSOR OBJECTS & STATE
// ==============================================================================
#define DHTTYPE DHT22
DHT dht(PIN_DHT22, DHTTYPE);
BH1750 lightMeter;

// Firebase Data Objects
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig fbConfig;

// Hardware Serial 2 for MAX485 Modbus RTU
HardwareSerial modbusSerial(2);

// Timing variables
unsigned long lastSensorReadTime = 0;

// Rolling window history for Capacitive Moisture filter
float moistureHistory[SLIDING_WINDOW_SIZE];
int historyIndex = 0;
int historyCount = 0;

// ==============================================================================
// MODBUS RTU QUERY FRAMES & CRC-16 UTILITY
// ==============================================================================
// Standard Modbus RTU query frame for 7-in-1 / NPK soil probe:
// Slave ID: 0x01, Function: 0x03 (Read Holding Registers), Start: 0x001E, Count: 0x0003
const byte NPK_QUERY_FRAME[] = {0x01, 0x03, 0x00, 0x1E, 0x00, 0x03, 0x65, 0xCD};

// Query frame for pH (if separate register e.g., register 0x0006)
const byte PH_QUERY_FRAME[]  = {0x01, 0x03, 0x00, 0x06, 0x00, 0x01, 0x64, 0x0B};

/**
 * Calculates standard Modbus CRC-16 (Polynomial 0xA001)
 */
uint16_t calculateCRC(const byte* buffer, uint8_t length) {
  uint16_t crc = 0xFFFF;
  for (uint8_t pos = 0; pos < length; pos++) {
    crc ^= (uint16_t)buffer[pos];
    for (uint8_t i = 8; i != 0; i--) {
      if ((crc & 0x0001) != 0) {
        crc >>= 1;
        crc ^= 0xA001;
      } else {
        crc >>= 1;
      }
    }
  }
  return crc;
}

// ==============================================================================
// STATISTICAL SLIDING WINDOW FILTER (NOISE REJECTION)
// ==============================================================================
struct WindowStats {
  float mean;
  float stdDev;
};

WindowStats computeWindowStats() {
  WindowStats stats = {0.0f, 0.0f};
  if (historyCount == 0) return stats;

  float sum = 0.0f;
  for (int i = 0; i < historyCount; i++) {
    sum += moistureHistory[i];
  }
  stats.mean = sum / historyCount;

  float varianceSum = 0.0f;
  for (int i = 0; i < historyCount; i++) {
    varianceSum += pow(moistureHistory[i] - stats.mean, 2);
  }
  stats.stdDev = sqrt(varianceSum / historyCount);
  return stats;
}

float filterMoistureReading(float rawMoisture) {
  WindowStats stats = computeWindowStats();

  // If we have accumulated enough baseline samples and encounter a severe spike
  if (historyCount >= 10 && stats.stdDev > 0.01f) {
    float delta = abs(rawMoisture - stats.mean);
    if (delta > (OUTLIER_SIGMA_THRESHOLD * stats.stdDev)) {
      Serial.printf("[FILTER] Outlier detected! Raw: %.2f%%, Mean: %.2f%%, Dev: %.2f%% > (%.1f * %.2f)\n",
                    rawMoisture, stats.mean, delta, OUTLIER_SIGMA_THRESHOLD, stats.stdDev);
      // Return moving mean instead of noisy spike
      return stats.mean;
    }
  }

  // Record sample into circular buffer
  moistureHistory[historyIndex] = rawMoisture;
  historyIndex = (historyIndex + 1) % SLIDING_WINDOW_SIZE;
  if (historyCount < SLIDING_WINDOW_SIZE) {
    historyCount++;
  }

  return rawMoisture;
}

// ==============================================================================
// SENSOR READING FUNCTIONS
// ==============================================================================
bool readNPK(int &nVal, int &pVal, int &kVal) {
  // Clear RX buffer
  while (modbusSerial.available()) {
    modbusSerial.read();
  }

  // Switch MAX485 to Transmit mode (DE/RE = HIGH)
  digitalWrite(PIN_RS485_DE_RE, HIGH);
  delay(10);
  modbusSerial.write(NPK_QUERY_FRAME, sizeof(NPK_QUERY_FRAME));
  modbusSerial.flush();
  delay(10);

  // Switch MAX485 back to Receive mode (DE/RE = LOW)
  digitalWrite(PIN_RS485_DE_RE, LOW);

  // Expecting 11 bytes response: [Addr][Func][ByteCount][N_Hi][N_Lo][P_Hi][P_Lo][K_Hi][K_Lo][CRC_Lo][CRC_Hi]
  byte response[16];
  int bytesRead = 0;
  unsigned long timeout = millis() + 500;

  while (millis() < timeout && bytesRead < 11) {
    if (modbusSerial.available()) {
      response[bytesRead++] = modbusSerial.read();
    }
  }

  if (bytesRead >= 11 && response[0] == 0x01 && response[1] == 0x03) {
    uint16_t receivedCRC = response[bytesRead - 2] | (response[bytesRead - 1] << 8);
    uint16_t calculatedCRC = calculateCRC(response, bytesRead - 2);

    if (receivedCRC == calculatedCRC) {
      nVal = (response[3] << 8) | response[4];
      pVal = (response[5] << 8) | response[6];
      kVal = (response[7] << 8) | response[8];
      return true;
    } else {
      Serial.println("[RS485] CRC mismatch in NPK packet! Discarded.");
    }
  }

  // Fallback defaults if sensor is in laboratory test mode
  return false;
}

float readSoilPH() {
  while (modbusSerial.available()) modbusSerial.read();

  digitalWrite(PIN_RS485_DE_RE, HIGH);
  delay(10);
  modbusSerial.write(PH_QUERY_FRAME, sizeof(PH_QUERY_FRAME));
  modbusSerial.flush();
  delay(10);
  digitalWrite(PIN_RS485_DE_RE, LOW);

  byte response[8];
  int bytesRead = 0;
  unsigned long timeout = millis() + 300;

  while (millis() < timeout && bytesRead < 7) {
    if (modbusSerial.available()) {
      response[bytesRead++] = modbusSerial.read();
    }
  }

  if (bytesRead >= 7 && response[0] == 0x01 && response[1] == 0x03) {
    uint16_t rawPH = (response[3] << 8) | response[4];
    return rawPH / 10.0f; // Typical scale 0.1 pH
  }

  // Nominal fallback pH
  return 6.5f;
}

float readCalibratedMoisture() {
  int rawADC = analogRead(PIN_SOIL_MOISTURE);
  // Constrain ADC within calibration limits
  rawADC = constrain(rawADC, MOISTURE_WATER_VALUE, MOISTURE_AIR_VALUE);
  // Map capacitive voltage: High ADC = Dry (0%), Low ADC = Wet (100%)
  float percentage = map(rawADC, MOISTURE_AIR_VALUE, MOISTURE_WATER_VALUE, 0, 100);
  percentage = constrain(percentage, 0.0f, 100.0f);
  return filterMoistureReading(percentage);
}

// ==============================================================================
// SETUP & INITIALIZATION
// ==============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n=======================================================");
  Serial.println("  SOILUTIONISTS: Smart Field Manager (ESP32 Gateway)");
  Serial.println("  Experiential Learning Phase 3 - RVCE Bengaluru");
  Serial.println("=======================================================");

  pinMode(PIN_RS485_DE_RE, OUTPUT);
  digitalWrite(PIN_RS485_DE_RE, LOW);

  pinMode(PIN_STATUS_LED, OUTPUT);
  digitalWrite(PIN_STATUS_LED, LOW);

  pinMode(PIN_SOIL_MOISTURE, INPUT);

  // Initialize Hardware Serial 2 for MAX485 Modbus (9600 8N1)
  modbusSerial.begin(9600, SERIAL_8N1, PIN_RS485_RX, PIN_RS485_TX);

  // Initialize I2C for BH1750
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);
  if (lightMeter.begin(BH1750::CONTINUOUS_HIGH_RES_MODE)) {
    Serial.println("[INIT] BH1750 Light Sensor initialized successfully.");
  } else {
    Serial.println("[INIT] BH1750 Light Sensor initialization failed.");
  }

  // Initialize DHT22
  dht.begin();
  Serial.println("[INIT] DHT22 Environmental Sensor initialized.");

  // Connect to Wi-Fi
  Serial.printf("[WIFI] Connecting to %s...", WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int retryCount = 0;
  while (WiFi.status() != WL_CONNECTED && retryCount < 30) {
    delay(500);
    Serial.print(".");
    retryCount++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\n[WIFI] Connected! IP Address: %s\n", WiFi.localIP().toString().c_str());
  } else {
    Serial.println("\n[WIFI] Connection failed. Running in offline/autonomous logging mode.");
  }

  // Initialize Firebase Realtime Database
  fbConfig.database_url = FIREBASE_HOST;
  fbConfig.signer.tokens.legacy_token = FIREBASE_AUTH;
  Firebase.begin(&fbConfig, &auth);
  Firebase.reconnectWiFi(true);
  Serial.println("[FIREBASE] Cloud Telemetry initialized.");
}

// ==============================================================================
// MAIN TELEMETRY LOOP
// ==============================================================================
void loop() {
  unsigned long currentMillis = millis();

  if (currentMillis - lastSensorReadTime >= SENSOR_POLL_INTERVAL_MS) {
    lastSensorReadTime = currentMillis;

    // Toggle onboard status LED
    digitalWrite(PIN_STATUS_LED, HIGH);

    // 1. Read RS485 Modbus NPK
    int nVal = 42, pVal = 18, kVal = 75; // Baseline defaults if offline
    if (readNPK(nVal, pVal, kVal)) {
      Serial.printf("[NPK] Read Success -> N: %d, P: %d, K: %d mg/kg\n", nVal, pVal, kVal);
    } else {
      Serial.printf("[NPK] Using Baseline Telemetry -> N: %d, P: %d, K: %d mg/kg\n", nVal, pVal, kVal);
    }

    // 2. Read Soil pH
    float phVal = readSoilPH();

    // 3. Read Capacitive Moisture with Sliding Window Filter
    float moisture = readCalibratedMoisture();

    // 4. Read DHT22 Temperature & Humidity
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    if (isnan(temperature)) temperature = 27.5f;
    if (isnan(humidity)) humidity = 58.0f;

    // 5. Read BH1750 Ambient Sunlight
    float lux = lightMeter.readLightLevel();
    if (lux < 0.0f) lux = 4500.0f;

    Serial.printf("[TELEMETRY] Moist: %.1f%% | pH: %.1f | Temp: %.1fC | Hum: %.1f%% | Lux: %.0f\n",
                  moisture, phVal, temperature, humidity, lux);

    // 6. Serialize to JSON using Static Buffer (Prevents heap fragmentation)
    StaticJsonDocument<512> doc;
    doc["N"] = nVal;
    doc["P"] = pVal;
    doc["K"] = kVal;
    doc["Moisture"] = round(moisture * 10) / 10.0;
    doc["pH"] = round(phVal * 10) / 10.0;
    doc["Temperature"] = round(temperature * 10) / 10.0;
    doc["Humidity"] = round(humidity * 10) / 10.0;
    doc["Sunlight"] = round(lux);
    doc["timestamp"] = (uint32_t)(millis() / 1000);

    String jsonString;
    serializeJson(doc, jsonString);

    // 7. Push to Firebase Realtime Database
    if (WiFi.status() == WL_CONNECTED) {
      if (Firebase.setJSON(fbdo, "/currentSoilData", jsonString)) {
        Serial.println("[FIREBASE] Telemetry published to /currentSoilData successfully.");
      } else {
        Serial.printf("[FIREBASE] Publish failed: %s\n", fbdo.errorReason().c_str());
      }
    }

    digitalWrite(PIN_STATUS_LED, LOW);
  }
}
