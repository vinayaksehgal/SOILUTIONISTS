/**
 * ==============================================================================
 * AgriBot Cognitive Engine - AI Agronomist & Context Vector Engine
 * ==============================================================================
 * SOILUTIONISTS (Team 12) - RV College of Engineering
 *
 * Implements Context Injection prompt engineering for Google Gemini models:
 *   Cv = {N, P, K, pH, Msoil, Tamb, Hamb, Llux}
 * Analyzes non-linear soil chemistry relationships (e.g. pH-induced nutrient lockout),
 * calculates prescriptive fertilizer dosages (Urea, DAP, MOP), and powers the
 * interactive AgriBot assistant.
 * ==============================================================================
 */

class AIAgronomist {
  constructor() {
    this.isGeneratingPlan = false;
    this.isChatWaiting = false;
  }

  /**
   * Generates a 3-step prescriptive daily action plan based on live telemetry
   */
  async generateDailyPlan(telemetry, isManual = false) {
    const reportContentEl = document.getElementById("ai-report-content");
    const loaderEl = document.getElementById("ai-loading");

    if (!telemetry || telemetry.Temperature === undefined) {
      if (reportContentEl) {
        reportContentEl.innerHTML = `
          <div class="text-sm text-amber-600 dark:text-amber-400 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            ⏳ Waiting for real-time sensor telemetry stream to initialize...
          </div>
        `;
      }
      return;
    }

    if (loaderEl) loaderEl.classList.remove("hidden");
    if (isManual && reportContentEl) {
      reportContentEl.innerHTML = `<p class="text-sm text-slate-400 italic">Synthesizing multi-parameter soil context vector with Gemini...</p>`;
    }

    const crop = window.appConfig.getCurrentCropProfile();

    // Construct the Context-Injected Agronomic Prompt
    const prompt = `
You are a senior agricultural consultant and agronomist for Team SOILUTIONISTS.
Target Crop: ${crop.name} (${crop.description})

Live Soil & Environmental Context Vector:
- Nitrogen (N): ${telemetry.N} mg/kg (Optimal range: ${crop.optimalN[0]} - ${crop.optimalN[1]} mg/kg)
- Phosphorus (P): ${telemetry.P} mg/kg (Optimal range: ${crop.optimalP[0]} - ${crop.optimalP[1]} mg/kg)
- Potassium (K): ${telemetry.K} mg/kg (Optimal range: ${crop.optimalK[0]} - ${crop.optimalK[1]} mg/kg)
- Soil Moisture: ${telemetry.Moisture}% (Optimal range: ${crop.optimalMoisture[0]} - ${crop.optimalMoisture[1]}%)
- Soil pH: ${telemetry.pH} (Optimal range: ${crop.optimalPH[0]} - ${crop.optimalPH[1]})
- Ambient Temperature: ${telemetry.Temperature} °C
- Relative Humidity: ${telemetry.Humidity}%
- Sunlight: ${telemetry.Sunlight} Lux

TASK: Provide a high-fidelity "Daily Agronomist Action Plan" with exactly 3 high-priority, actionable interventions:
1. Irrigation & Hydration Action (Address moisture deficit or waterlogging risk).
2. Nutrient Amendment (Specify exact chemical or organic remedies like Urea, DAP, MOP, or Compost in kg/hectare).
3. Soil Conditioning / Lockout Prevention (Address pH abnormalities; e.g., if pH < 6.0 recommend Agricultural Lime; if pH > 7.5 address Calcium Phosphate lockout).

FORMAT RULES:
- Output clean, valid HTML with <b>, <ul>, <li>, and status badges.
- Avoid vague generic advice; provide exact chemical names and dosages.
- Under 160 words total.
    `.trim();

    try {
      const responseText = await this.callGeminiAPI(prompt);
      if (reportContentEl) {
        reportContentEl.innerHTML = responseText;
      }
    } catch (error) {
      console.warn("[AI] Gemini API request failed, invoking heuristic fallback engine:", error);
      const fallbackPlan = this.generateHeuristicPlan(telemetry, crop);
      if (reportContentEl) {
        reportContentEl.innerHTML = fallbackPlan;
      }
    } finally {
      if (loaderEl) loaderEl.classList.add("hidden");
    }
  }

  /**
   * Interactive Chatbot Query Handler
   */
  async askAssistant(userMessage, currentTelemetry) {
    const chatWindow = document.getElementById("chat-window");
    if (!chatWindow) return;

    // Append User Message to UI
    this.appendChatMessage("user", userMessage);

    // Append loading placeholder
    const loadingId = "chat-loading-" + Date.now();
    const loadingHtml = `
      <div id="${loadingId}" class="flex items-center gap-2 p-3 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg max-w-[85%] text-xs">
        <span class="spinner"></span> AgriBot is analyzing soil vector...
      </div>
    `;
    chatWindow.insertAdjacentHTML("beforeend", loadingHtml);
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const crop = window.appConfig.getCurrentCropProfile();

    const contextualPrompt = `
You are AgriBot, the AI agronomist assistant for the SOILUTIONISTS project.
Current Crop: ${crop.name}
Current Live Telemetry:
- Nitrogen: ${currentTelemetry.N || '--'} mg/kg, Phosphorus: ${currentTelemetry.P || '--'} mg/kg, Potassium: ${currentTelemetry.K || '--'} mg/kg
- Moisture: ${currentTelemetry.Moisture || '--'}%, pH: ${currentTelemetry.pH || '--'}
- Temperature: ${currentTelemetry.Temperature || '--'} °C, Humidity: ${currentTelemetry.Humidity || '--'}%, Sunlight: ${currentTelemetry.Sunlight || '--'} Lux

Farmer asks: "${userMessage}"

Give a concise, practical agricultural answer (under 80 words). Reference the live sensor readings directly.
    `.trim();

    try {
      const reply = await this.callGeminiAPI(contextualPrompt);
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();
      this.appendChatMessage("bot", reply);
    } catch (e) {
      const loader = document.getElementById(loadingId);
      if (loader) loader.remove();
      const localReply = this.generateHeuristicChatReply(userMessage, currentTelemetry, crop);
      this.appendChatMessage("bot", localReply);
    }
  }

  appendChatMessage(role, text) {
    const chatWindow = document.getElementById("chat-window");
    if (!chatWindow) return;

    const isUser = role === "user";
    const bubbleClass = isUser
      ? "bg-emerald-600 text-white ml-auto rounded-tl-xl rounded-tr-none"
      : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 mr-auto rounded-tr-xl rounded-tl-none";

    const msgHtml = `
      <div class="p-3 rounded-2xl shadow-sm text-sm max-w-[85%] mb-2.5 ${bubbleClass} leading-relaxed">
        ${text}
      </div>
    `;
    chatWindow.insertAdjacentHTML("beforeend", msgHtml);
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  /**
   * Executes HTTP POST call to Google Gemini endpoint
   */
  async callGeminiAPI(promptText) {
    const apiUrl = window.appConfig.getGeminiUrl();
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: promptText }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 350
        }
      })
    });

    if (!response.ok) {
      throw new Error(`API HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.candidates || !data.candidates[0].content.parts[0].text) {
      throw new Error("Invalid API response format");
    }

    let text = data.candidates[0].content.parts[0].text;
    // Format newlines into HTML if raw markdown
    text = text.replace(/```html/g, "").replace(/```/g, "");
    if (!text.includes("<p>") && !text.includes("<ul>")) {
      text = text.replace(/\n\n/g, "<br><br>").replace(/\n/g, "<br>");
    }
    return text;
  }

  /**
   * Offline Heuristic Plan (Evaluates agronomic rules locally if offline)
   */
  generateHeuristicPlan(t, crop) {
    const actions = [];

    // 1. Moisture evaluation
    if (t.Moisture < crop.optimalMoisture[0]) {
      actions.push(`<li><b>💧 Irrigation Required:</b> Moisture is low at <b>${t.Moisture}%</b> (Target: ${crop.optimalMoisture[0]}-${crop.optimalMoisture[1]}%). Schedule drip irrigation for 45 minutes during evening hours.</li>`);
    } else if (t.Moisture > crop.optimalMoisture[1]) {
      actions.push(`<li><b>⚠️ Drainage Advisory:</b> Soil moisture is high at <b>${t.Moisture}%</b>. Suspend automated irrigation to prevent root hypoxia.</li>`);
    } else {
      actions.push(`<li><b>💧 Hydration Stable:</b> Moisture is optimal at <b>${t.Moisture}%</b>. Maintain current schedule.</li>`);
    }

    // 2. NPK Nutrient evaluation
    if (t.N < crop.optimalN[0]) {
      actions.push(`<li><b>🌱 Nitrogen Boost:</b> Nitrogen is deficient at <b>${t.N} mg/kg</b>. Top-dress with <b>25 kg/hectare Urea</b> to promote vegetative tillering.</li>`);
    } else if (t.P < crop.optimalP[0]) {
      actions.push(`<li><b>🌿 Phosphorus Supplement:</b> P is low at <b>${t.P} mg/kg</b>. Band-apply <b>30 kg/ha DAP (Diammonium Phosphate)</b> near root zones.</li>`);
    } else {
      actions.push(`<li><b>🌿 Balanced Nutrition:</b> NPK values (${t.N}-${t.P}-${t.K} mg/kg) satisfy crop baseline. No immediate bulk fertilizer required.</li>`);
    }

    // 3. pH & Lockout evaluation
    if (t.pH < 6.0) {
      actions.push(`<li><b>🧪 Acidic Lockout Prevention:</b> Low pH of <b>${t.pH}</b> locks phosphorus and causes aluminum toxicity. Apply <b>500 kg/ha Agricultural Lime (CaCO3)</b> to elevate pH.</li>`);
    } else if (t.pH > 7.8) {
      actions.push(`<li><b>🧪 Alkaline Remediation:</b> High alkalinity of <b>${t.pH}</b> leads to calcium phosphate lockout. Apply agricultural gypsum (calcium sulfate) or elemental sulfur.</li>`);
    } else {
      actions.push(`<li><b>✅ Soil Chemistry Optimal:</b> pH <b>${t.pH}</b> provides ideal cation exchange capacity. Micro-nutrients remain bioavailable.</li>`);
    }

    return `
      <div class="space-y-2 text-slate-700 dark:text-slate-300">
        <p class="font-semibold text-emerald-700 dark:text-emerald-400 text-sm">Automated Agronomic Advisory for ${crop.name}:</p>
        <ul class="list-disc pl-5 space-y-2 text-sm">
          ${actions.join("")}
        </ul>
      </div>
    `;
  }

  generateHeuristicChatReply(msg, t, crop) {
    const lower = msg.toLowerCase();
    if (lower.includes("nitrogen") || lower.includes(" n ")) {
      return `Current Nitrogen is ${t.N || 0} mg/kg. For ${crop.name}, optimal range is ${crop.optimalN[0]}-${crop.optimalN[1]} mg/kg. ${t.N < crop.optimalN[0] ? 'Deficit detected: apply Urea.' : 'Nitrogen levels are healthy.'}`;
    }
    if (lower.includes("ph") || lower.includes("acid") || lower.includes("lockout")) {
      return `Current pH is ${t.pH || 0}. Values below 6.0 cause Phosphorus lockout; values above 7.8 immobilize micronutrients. Current status: ${t.pH < 6.0 ? 'Acidic lockout risk.' : t.pH > 7.8 ? 'Alkaline lockout risk.' : 'Optimal bioavailability.'}`;
    }
    if (lower.includes("moisture") || lower.includes("water") || lower.includes("irrigation")) {
      return `Current soil moisture is ${t.Moisture || 0}%. Target range for ${crop.name} is ${crop.optimalMoisture[0]}-${crop.optimalMoisture[1]}%.`;
    }
    return `Based on live soil vector (N:${t.N}, P:${t.P}, K:${t.K}, pH:${t.pH}, Moist:${t.Moisture}%), your field conditions are currently being monitored continuously. Ask specifically about irrigation, NPK, or pH adjustments!`;
  }
}

window.AIAgronomist = AIAgronomist;
