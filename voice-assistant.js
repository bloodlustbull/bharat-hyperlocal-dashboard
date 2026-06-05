/*
  Shelly Voice Assistant

  Uses the browser Web Speech API for wake listening and commands.
  For AI responses, calls the RAG backend /api/assistant endpoint.
  Falls back to deterministic local responses if the backend is unavailable.
*/

(function () {
  const STATES = Object.freeze({
    DISABLED: "DISABLED",
    PERMISSION_NEEDED: "PERMISSION_NEEDED",
    PERMISSION_DENIED: "PERMISSION_DENIED",
    WAKE_LISTENING: "WAKE_LISTENING",
    WAKE_DETECTED: "WAKE_DETECTED",
    ACTIVE_LISTENING: "ACTIVE_LISTENING",
    THINKING: "THINKING",
    SPEAKING: "SPEAKING",
    STOPPING: "STOPPING",
    STOPPED: "STOPPED",
    ERROR: "ERROR",
  });

  const WAKE_PHRASES = ["hey shelly", "shelly", "yoo shelly"];
  const STOP_PHRASES = ["stop", "cancel", "shut up", "pause", "go silent", "stop listening", "enough", "never mind"];
  const STOP_PATTERNS = STOP_PHRASES.map(phrase => new RegExp(`(^|\\s)${phrase.replace(/\s+/g, "\\s+")}(\\s|$)`, "i"));

  class WakeWordEngine {
    constructor(phrases) {
      this.phrases = phrases;
    }

    detect(text) {
      return containsWakePhrase(text, this.phrases);
    }
  }

  class VoiceAssistant {
    getDefaultBackendUrl() {
      return (localStorage.getItem("bharatRagApiUrl") || "http://127.0.0.1:8787").replace(/\/+$/, "") + "/assistant";
    }

    constructor(options = {}) {
      this.options = {
        assistantName: "Shelly",
        backendUrl: this.getDefaultBackendUrl(),
        commandTimeoutMs: 9000,
        apiTimeoutMs: 7000,
        returnToWakeAfterStop: false,
        ...options,
      };
      this.state = STATES.DISABLED;
      this.recognition = null;
      this.recognitionMode = null;
      this.isRecognitionActive = false;
      this.isRecognitionCoolingDown = false;
      this.pendingRecognitionMode = null;
      this.startAttempts = 0;
      this.commandBuffer = "";
      this.lastCommand = "";
      this.abortController = null;
      this.timers = new Set();
      this.isMuted = false;
      this.voices = [];
      this.wakeWordEngine = new WakeWordEngine(WAKE_PHRASES);
      this.ui = {};
    }

    init() {
      this.bindUI();
      this.setState(STATES.DISABLED, { message: "Disabled. Click Enable Voice Assistant to start." });
      if (sessionStorage.getItem("shelly_voice_enabled") === "true") {
        this.setState(STATES.PERMISSION_NEEDED, { message: "Shelly is ready. Click Enable to reconnect the microphone for this page session." });
      }

      if ("speechSynthesis" in window) {
        this.voices = window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.voices = window.speechSynthesis.getVoices();
        };
      }
    }

    bindUI() {
      this.ui.root = document.getElementById("voiceAssistantRoot");
      this.ui.panel = document.getElementById("voiceAssistantPanel");
      this.ui.toggle = document.getElementById("voiceTogglePanel");
      this.ui.close = document.getElementById("voiceClosePanel");
      this.ui.enable = document.getElementById("voiceEnableBtn");
      this.ui.stop = document.getElementById("voiceStopBtn");
      this.ui.mute = document.getElementById("voiceMuteToggle");
      this.ui.stateLabel = document.getElementById("voiceStateLabel");
      this.ui.status = document.getElementById("voiceStatusText");
      this.ui.transcript = document.getElementById("voiceTranscript");
      this.ui.response = document.getElementById("voiceResponse");
      this.ui.waveform = document.getElementById("voiceWaveform");

      this.ui.toggle?.addEventListener("click", () => this.ui.panel?.classList.toggle("hidden"));
      this.ui.close?.addEventListener("click", () => this.ui.panel?.classList.add("hidden"));
      this.ui.enable?.addEventListener("click", () => this.requestMicPermission());
      this.ui.stop?.addEventListener("click", () => this.stopAssistantImmediately("user_clicked_stop"));
      this.ui.mute?.addEventListener("change", () => {
        this.isMuted = Boolean(this.ui.mute.checked);
        if (this.isMuted && "speechSynthesis" in window) window.speechSynthesis.cancel();
        this.updateUI();
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") this.stopAssistantImmediately("escape_key");
      });
    }

    async requestMicPermission() {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        this.setState(STATES.ERROR, { message: "SpeechRecognition is not supported in this browser. Try Chrome desktop." });
        return;
      }
      if (!("speechSynthesis" in window)) {
        this.setState(STATES.ERROR, { message: "speechSynthesis is not supported in this browser." });
        return;
      }

      this.setState(STATES.PERMISSION_NEEDED, { message: "Requesting microphone permission..." });

      try {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
        }
        sessionStorage.setItem("shelly_voice_enabled", "true");
        this.createRecognition();
        this.startWakeListening();
      } catch (error) {
        this.setState(STATES.PERMISSION_DENIED, { message: "Microphone permission denied or unavailable. Enable mic access and try again.", error });
      }
    }

    createRecognition() {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = "en-IN";

      this.recognition.onresult = (event) => {
        const result = event.results?.[event.results.length - 1];
        const text = normalizeTranscript(result?.[0]?.transcript || "");
        this.isRecognitionActive = false;
        this.isRecognitionCoolingDown = true;
        this.queue(() => { this.isRecognitionCoolingDown = false; }, 350);
        this.startAttempts = 0;
        if (containsStopPhrase(text)) {
          this.stopAssistantImmediately("user_stop_command");
          return;
        }
        if (this.recognitionMode === "wake") this.handleWakeTranscript(text);
        if (this.recognitionMode === "command") this.handleCommandTranscript(text);
      };

      this.recognition.onerror = (event) => {
        this.isRecognitionActive = false;
        this.isRecognitionCoolingDown = true;
        this.queue(() => { this.isRecognitionCoolingDown = false; }, 650);
        if (this.state === STATES.STOPPING || this.state === STATES.STOPPED || this.state === STATES.DISABLED) return;
        const message = event.error === "no-speech" ? "No speech detected. Returning to wake listening." : `Voice error: ${event.error || "unknown"}.`;
        if (this.recognitionMode === "wake") {
          this.setState(STATES.WAKE_LISTENING, { message });
          this.queue(() => this.startWakeListening(), 900);
        } else {
          this.setState(STATES.ERROR, { message });
          this.queue(() => this.startWakeListening(), 1200);
        }
      };

      this.recognition.onend = () => {
        this.isRecognitionActive = false;
        this.isRecognitionCoolingDown = true;
        this.queue(() => { this.isRecognitionCoolingDown = false; }, 350);
        if (this.state === STATES.WAKE_LISTENING && this.recognitionMode === "wake") {
          this.queue(() => this.startWakeListening(), 800);
        }
      };
    }

    startWakeListening() {
      if (!this.recognition) return;
      if ([STATES.DISABLED, STATES.PERMISSION_DENIED, STATES.STOPPING, STATES.SPEAKING, STATES.THINKING].includes(this.state)) return;
      this.setState(STATES.WAKE_LISTENING, { message: "Wake listening. Say Hey Shelly, Shelly, or Yoo Shelly." });
      this.safeStartRecognition("wake");
    }

    stopWakeListening() {
      if (this.recognitionMode === "wake") this.safeAbortRecognition();
    }

    handleWakeTranscript(text) {
      this.ui.transcript.textContent = text || "Empty transcript.";
      if (!text) {
        this.startWakeListening();
        return;
      }
      if (this.wakeWordEngine.detect(text)) {
        this.setState(STATES.WAKE_DETECTED, { message: "Wake phrase detected." });
        this.activateAssistant();
      } else {
        this.startWakeListening();
      }
    }

    activateAssistant() {
      if (this.state !== STATES.WAKE_DETECTED) return;
      this.speak("I am here. What should we do?", { next: "command" });
    }

    startCommandListening() {
      if (!this.recognition || this.state === STATES.STOPPING) return;
      this.commandBuffer = "";
      this.setState(STATES.ACTIVE_LISTENING, { message: "Listening for your command..." });
      this.safeStartRecognition("command");
      this.queue(() => {
        if (this.state === STATES.ACTIVE_LISTENING) {
          this.safeAbortRecognition();
          this.setState(STATES.WAKE_LISTENING, { message: "Command timed out. Returning to wake listening." });
          this.startWakeListening();
        }
      }, this.options.commandTimeoutMs);
    }

    async handleCommandTranscript(text) {
      this.ui.transcript.textContent = text || "Empty transcript.";
      if (!text) {
        this.setState(STATES.WAKE_LISTENING, { message: "I did not catch that. Returning to wake listening." });
        this.startWakeListening();
        return;
      }
      if (this.detectStopCommand(text)) return;
      this.lastCommand = text;
      this.setState(STATES.THINKING, { message: "Thinking..." });

      const routed = this.routeCommand(text);
      if (routed?.handled) {
        if (routed.response) this.ui.response.textContent = routed.response;
        this.speak(routed.response || "Done.");
        return;
      }

      const pageContext = this.getPageContext();
      this.abortController = new AbortController();
      const timeout = this.queue(() => this.abortController?.abort(), this.options.apiTimeoutMs);
      try {
        const response = await this.callAssistantBrain(text, pageContext, this.abortController.signal);
        this.clearTimer(timeout);
        this.speak(response);
      } catch {
        this.clearTimer(timeout);
        this.speak(this.mockAssistantBrain(text, pageContext));
      }
    }

    detectStopCommand(text) {
      if (!containsStopPhrase(text)) return false;
      this.stopAssistantImmediately("user_stop_command");
      return true;
    }

    routeCommand(text) {
      const command = normalizeTranscript(text);
      if (this.detectStopCommand(command)) return { handled: true, response: "" };

      const brandAction = getBrandActionFromCommand(command);
      const isNavigationIntent = /\b(open|show|take|go|switch|move|navigate)\b/.test(command);
      if (brandAction && (isNavigationIntent || command.includes("dashboard"))) {
        const tabName = getTabFromCommand(command) || "market";
        return { handled: true, response: this.runPageAction(brandAction, { tabName }) };
      }

      const tabIntent = getTabFromCommand(command);
      if (tabIntent && isNavigationIntent) {
        return { handled: true, response: openDashboardTab(tabIntent) };
      }

      const sectionMap = [
        ["open dashboard", "market"],
        ["show dashboard", "market"],
        ["go to dashboard", "market"],
        ["take me to dashboard", "market"],
        ["go to home", "market"],
        ["take me home", "market"],
        ["show campaign metrics", "campaign"],
        ["open campaign", "campaign"],
        ["go to campaign", "campaign"],
        ["take me to campaign", "campaign"],
        ["show video", "video"],
        ["open video", "video"],
        ["go to video", "video"],
        ["take me to video", "video"],
        ["open video campaigns", "video"],
        ["show video campaigns", "video"],
        ["take me to video campaigns", "video"],
        ["show geo", "geo"],
        ["open geo", "geo"],
        ["go to geo", "geo"],
        ["take me to geo", "geo"],
        ["open geo sales", "geo"],
        ["show geo sales", "geo"],
        ["show brand selector", "brand_selector"],
        ["open brand selector", "brand_selector"],
        ["show signals", "signals"],
        ["open signals", "signals"],
        ["take me to signals", "signals"],
        ["show report", "report"],
        ["open report", "report"],
        ["take me to report", "report"],
      ];

      const match = sectionMap.find(([phrase]) => command.includes(phrase));
      if (match) {
        if (match[1] === "brand_selector") {
          return { handled: true, response: this.runPageAction("show_brand_selector") };
        }
        return { handled: true, response: scrollToAssistantSection(match[1]) };
      }

      if (command.includes("switch to blinkit")) return { handled: true, response: this.runPageAction("switch_blinkit") };
      if (command.includes("switch to zepto")) return { handled: true, response: this.runPageAction("switch_zepto") };
      if (command.includes("switch to swiggy") || command.includes("switch to instamart")) return { handled: true, response: this.runPageAction("switch_instamart") };
      if (command.includes("read the summary")) return { handled: true, response: this.mockAssistantBrain("summary", this.getPageContext()) };
      if (command.includes("what does this metric mean") || command.includes("explain campaign metrics")) {
        return { handled: true, response: "CTR is clicks divided by reach or delivered messages. CAC is spend divided by customers. CVR is conversions divided by clicks. Repeat rate shows how many buyers came back." };
      }
      if (command.includes("help")) {
        return { handled: true, response: "I can open tabs, switch brands, explain campaign metrics, read a summary, or answer questions about the visible dashboard." };
      }

      return { handled: false };
    }

    getPageContext() {
      const activePanel = document.querySelector(".panel.active-panel");
      const activeTab = document.querySelector(".tab.active");
      const visibleMetrics = Array.from(document.querySelectorAll(".active-panel .kpi-card, .active-panel .planner-row, .active-panel .geo-area-row"))
        .slice(0, 10)
        .map(el => el.innerText.trim())
        .filter(Boolean);

      return {
        title: document.title,
        activeSection: activePanel?.dataset.assistantLabel || activeTab?.dataset.assistantLabel || activePanel?.id || "unknown",
        visibleMetrics,
        selectedBrand: document.getElementById("selectedPlatformName")?.innerText?.trim() || "",
        dashboardStatus: document.body.dataset.platform || "",
        lastCommand: this.lastCommand,
        assistantState: this.state,
      };
    }

    getAssistantUrl() {
      const saved = localStorage.getItem("bharatRagApiUrl");
      if (saved) return saved.replace(/\/+$/, "") + "/assistant";
      return this.options.backendUrl;
    }

    async callAssistantBrain(text, pageContext, signal) {
      const url = this.getAssistantUrl();
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, pageContext, assistantState: this.state }),
        signal,
      });
      if (!response.ok) throw new Error("assistant_backend_unavailable");
      const data = await response.json();
      return String(data.response || data.message || "").trim() || this.mockAssistantBrain(text, pageContext);
    }

    mockAssistantBrain(text, context) {
      const command = normalizeTranscript(text);
      if (command.includes("dashboard")) return `You are in ${context.activeSection}. This dashboard helps compare market signals, local campaign plans, geo sales, and video CTR ideas.`;
      if (command.includes("metric") || command.includes("ctr") || command.includes("cac") || command.includes("cvr")) {
        return "CTR tracks click interest, CAC tracks acquisition cost, CVR tracks click-to-order conversion, revenue tracks sales value, and repeat rate tracks retention.";
      }
      if (command.includes("brand")) return `Current brand is ${context.selectedBrand || "not selected"}. You can say switch to Blinkit, Zepto, or Swiggy.`;
      if (command.includes("summary")) {
        const metrics = context.visibleMetrics.length ? context.visibleMetrics.slice(0, 3).join(". ") : "No visible metrics found in this section.";
        return `${context.activeSection} summary: ${metrics}`;
      }
      return "I can help with this page, dashboard navigation, campaign metrics, or general questions.";
    }

    speak(text, options = {}) {
      if (this.state === STATES.DISABLED || this.state === STATES.STOPPING) return;
      this.safeAbortRecognition();
      if (this.isMuted || !("speechSynthesis" in window)) {
        this.ui.response.textContent = text;
        this.setState(STATES.WAKE_LISTENING, { message: "Muted. Returning to wake listening." });
        this.startWakeListening();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = this.pickVoice();
      if (voice) utterance.voice = voice;
      utterance.lang = voice?.lang || "en-IN";
      utterance.rate = 0.96;
      utterance.pitch = 1.04;
      utterance.onstart = () => this.setState(STATES.SPEAKING, { message: "Speaking...", response: text });
      utterance.onend = () => {
        if (this.state === STATES.STOPPING || this.state === STATES.STOPPED) return;
        if (options.next === "command") {
          this.startCommandListening();
        } else {
          this.setState(STATES.WAKE_LISTENING, { message: "Back to wake listening." });
          this.startWakeListening();
        }
      };
      utterance.onerror = () => {
        this.setState(STATES.ERROR, { message: "Speech output failed. Returning to wake listening." });
        this.startWakeListening();
      };
      window.speechSynthesis.speak(utterance);
    }

    stopAssistantImmediately(reason = "stop") {
      this.setState(STATES.STOPPING, { message: `Stopping: ${reason}` });
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      this.safeAbortRecognition();
      this.clearAllTimers();
      this.abortController?.abort();
      this.abortController = null;
      this.commandBuffer = "";
      this.lastCommand = "";
      this.ui.waveform?.classList.remove("active");
      const nextState = this.options.returnToWakeAfterStop ? STATES.WAKE_LISTENING : STATES.STOPPED;
      this.setState(nextState, { message: nextState === STATES.STOPPED ? "Stopped." : "Stopped. Returning to wake listening." });
      if (nextState === STATES.WAKE_LISTENING) this.startWakeListening();
    }

    setState(nextState, metadata = {}) {
      const allowed = {
        [STATES.DISABLED]: [STATES.PERMISSION_NEEDED, STATES.ERROR],
        [STATES.PERMISSION_NEEDED]: [STATES.WAKE_LISTENING, STATES.PERMISSION_DENIED, STATES.ERROR, STATES.STOPPING],
        [STATES.PERMISSION_DENIED]: [STATES.PERMISSION_NEEDED, STATES.STOPPING],
        [STATES.WAKE_LISTENING]: [STATES.WAKE_DETECTED, STATES.STOPPING, STATES.ERROR, STATES.WAKE_LISTENING],
        [STATES.WAKE_DETECTED]: [STATES.SPEAKING, STATES.ACTIVE_LISTENING, STATES.STOPPING],
        [STATES.ACTIVE_LISTENING]: [STATES.THINKING, STATES.STOPPING, STATES.WAKE_LISTENING, STATES.ERROR],
        [STATES.THINKING]: [STATES.SPEAKING, STATES.STOPPING, STATES.ERROR],
        [STATES.SPEAKING]: [STATES.WAKE_LISTENING, STATES.ACTIVE_LISTENING, STATES.STOPPING, STATES.ERROR],
        [STATES.STOPPING]: [STATES.STOPPED, STATES.WAKE_LISTENING],
        [STATES.STOPPED]: [STATES.PERMISSION_NEEDED, STATES.WAKE_LISTENING, STATES.STOPPING],
        [STATES.ERROR]: [STATES.PERMISSION_NEEDED, STATES.WAKE_LISTENING, STATES.STOPPING],
      };
      if (this.state && !allowed[this.state]?.includes(nextState)) {
        if (!(this.state === nextState)) return;
      }
      this.state = nextState;
      this.updateUI(metadata);
    }

    updateUI(metadata = {}) {
      const label = this.state.replace(/_/g, " ").toLowerCase();
      this.ui.root?.setAttribute("data-state", this.state);
      if (this.ui.stateLabel) this.ui.stateLabel.textContent = label;
      if (this.ui.status) this.ui.status.textContent = label;
      if (this.ui.response && metadata.response) this.ui.response.textContent = metadata.response;
      if (this.ui.response && metadata.message && !metadata.response) this.ui.response.textContent = metadata.message;
      this.ui.waveform?.classList.toggle("active", [STATES.WAKE_LISTENING, STATES.ACTIVE_LISTENING, STATES.SPEAKING].includes(this.state));
      if (this.ui.enable) this.ui.enable.textContent = this.state === STATES.DISABLED || this.state === STATES.STOPPED ? "Enable Voice Assistant" : "Voice Enabled";
    }

    safeStartRecognition(mode) {
      if (!this.recognition) return false;
      if (this.isRecognitionActive || this.isRecognitionCoolingDown) {
        this.pendingRecognitionMode = mode;
        this.queue(() => {
          const pending = this.pendingRecognitionMode;
          this.pendingRecognitionMode = null;
          if (pending && !this.isRecognitionActive) this.safeStartRecognition(pending);
        }, 450);
        return false;
      }
      this.recognitionMode = mode;
      try {
        this.recognition.start();
        this.isRecognitionActive = true;
        this.startAttempts = 0;
        return true;
      } catch (error) {
        this.isRecognitionActive = false;
        this.isRecognitionCoolingDown = true;
        this.startAttempts += 1;
        this.queue(() => { this.isRecognitionCoolingDown = false; }, 700);
        if (this.startAttempts <= 2 && this.state === STATES.WAKE_LISTENING) {
          this.queue(() => this.safeStartRecognition(mode), 900);
        } else {
          this.setState(STATES.ERROR, { message: "Voice recognition is busy. I will recover automatically; click Stop only if it keeps happening.", error });
          this.queue(() => {
            if (this.state === STATES.ERROR) {
              this.startAttempts = 0;
              this.setState(STATES.WAKE_LISTENING, { message: "Recovered. Back to wake listening." });
              this.safeStartRecognition("wake");
            }
          }, 1400);
        }
        return false;
      }
    }

    safeAbortRecognition() {
      if (!this.recognition) return;
      try {
        if (this.isRecognitionActive) this.recognition.abort();
      } catch {
        // Safe no-op: abort can throw if recognition has already ended.
      }
      this.isRecognitionActive = false;
      this.isRecognitionCoolingDown = true;
      this.queue(() => { this.isRecognitionCoolingDown = false; }, 500);
      this.recognitionMode = null;
    }

    pickVoice() {
      this.voices = this.voices.length ? this.voices : window.speechSynthesis.getVoices();
      return this.voices.find(v => /natural|neural|online|zira|heera|female/i.test(v.name) && v.lang?.startsWith("en"))
        || this.voices.find(v => v.lang === "en-IN")
        || this.voices.find(v => v.lang?.startsWith("en"))
        || null;
    }

    runPageAction(actionName, options = {}) {
      return runPageAction(actionName, options);
    }

    queue(fn, delay) {
      const id = window.setTimeout(() => {
        this.timers.delete(id);
        fn();
      }, delay);
      this.timers.add(id);
      return id;
    }

    clearTimer(id) {
      window.clearTimeout(id);
      this.timers.delete(id);
    }

    clearAllTimers() {
      this.timers.forEach(id => window.clearTimeout(id));
      this.timers.clear();
    }

    cleanup() {
      this.stopAssistantImmediately("cleanup");
      this.clearAllTimers();
    }
  }

  function normalizeTranscript(text) {
    return String(text || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function containsWakePhrase(text, phrases = WAKE_PHRASES) {
    const normalized = normalizeTranscript(text);
    return phrases.some(phrase => normalized.includes(phrase));
  }

  function containsStopPhrase(text) {
    const normalized = normalizeTranscript(text);
    return STOP_PATTERNS.some(pattern => pattern.test(normalized));
  }

  function getBrandActionFromCommand(command) {
    if (/\bblinkit\b/.test(command)) return "switch_blinkit";
    if (/\bzepto\b/.test(command)) return "switch_zepto";
    if (/\b(swiggy|instamart|swiggy instamart)\b/.test(command)) return "switch_instamart";
    if (/\b(bigbasket|big basket|bigbasket now|bb now)\b/.test(command)) return "switch_bigbasket_now";
    if (/\bdunzo\b/.test(command)) return "switch_dunzo";
    return "";
  }

  function scrollToAssistantSection(sectionName) {
    if (document.getElementById(sectionName)?.classList.contains("panel") || document.querySelector(`.tab[data-tab="${CSS.escape(sectionName)}"]`)) {
      return openDashboardTab(sectionName);
    }
    const tab = document.querySelector(`.tab[data-assistant-section="${CSS.escape(sectionName)}"], .tab[data-tab="${CSS.escape(sectionName)}"]`);
    if (tab) {
      tab.click();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return `Opened ${tab.dataset.assistantLabel || tab.textContent.trim()}.`;
    }
    const section = document.querySelector(`[data-assistant-section="${CSS.escape(sectionName)}"]`);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
      return `Showing ${section.dataset.assistantLabel || sectionName}.`;
    }
    return `I could not find the ${sectionName} section.`;
  }

  function getTabFromCommand(command) {
    const tabAliases = [
      ["market", /\b(market|dashboard|home|main|overview|pulse)\b/],
      ["scorer", /\b(opportunity|score|scorer|engine)\b/],
      ["video", /\b(video|videos|reel|reels|youtube|instagram|shorts)\b/],
      ["campaign", /\b(campaign|campaigns|whatsapp|message|messages)\b/],
      ["geo", /\b(geo|map|maps|sales|area|location|locations)\b/],
      ["planner", /\b(planner|plan|experiment|pilot)\b/],
      ["unit", /\b(unit|economics|cac|ltv)\b/],
      ["report", /\b(report|brief|summary)\b/],
      ["experiments", /\b(tracker|tracking|csv|experiment data|pilot data)\b/],
      ["sources", /\b(sources|source|audit)\b/],
      ["signals", /\b(signals|signal|news|market signals)\b/],
    ];
    return tabAliases.find(([, pattern]) => pattern.test(command))?.[0] || "";
  }

  function ensureDashboardVisible(preferredBrand = "") {
    const dashboard = document.getElementById("dashboardView");
    const currentBrand = document.body.dataset.platform || "blinkit";
    const brandId = preferredBrand || currentBrand || "blinkit";

    if (typeof window.enterDashboard === "function") {
      window.enterDashboard(brandId);
      return true;
    }

    document.getElementById("three-overlay")?.classList.add("hidden");
    document.getElementById("three-container")?.classList.add("hidden");
    ["landingView", "brandMapView"].forEach(id => document.getElementById(id)?.classList.remove("view-active"));
    if (dashboard) {
      dashboard.style.display = "";
      dashboard.classList.add("view-active");
      return true;
    }
    return false;
  }

  function openDashboardTab(tabName, preferredBrand = "") {
    ensureDashboardVisible(preferredBrand);
    if (typeof window.goToDashboardTab === "function") {
      window.goToDashboardTab(tabName);
    } else {
      document.querySelectorAll(".tab").forEach(button => button.classList.toggle("active", button.dataset.tab === tabName));
      document.querySelectorAll(".panel").forEach(panel => panel.classList.toggle("active-panel", panel.id === tabName));
    }

    const tab = document.querySelector(`.tab[data-tab="${CSS.escape(tabName)}"]`);
    const panel = document.getElementById(tabName);
    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
    return `Opened ${tab?.textContent?.trim() || tabName}.`;
  }

  function runPageAction(actionName, options = {}) {
    if (actionName === "show_brand_selector" && typeof window.showBrandMap === "function") {
      window.showBrandMap();
      return "Opening the brand selector.";
    }
    const brandMap = {
      switch_blinkit: { id: "blinkit", label: "Blinkit" },
      switch_zepto: { id: "zepto", label: "Zepto" },
      switch_instamart: { id: "instamart", label: "Swiggy Instamart" },
      switch_bigbasket_now: { id: "bigbasket_now", label: "BigBasket Now" },
      switch_dunzo: { id: "dunzo", label: "Dunzo" },
    };
    if (brandMap[actionName]) {
      ensureDashboardVisible(brandMap[actionName].id);
      if (options.tabName && options.tabName !== "market") {
        const tabResponse = openDashboardTab(options.tabName, brandMap[actionName].id);
        return `${brandMap[actionName].label}: ${tabResponse}`;
      }
      return `Opened ${brandMap[actionName].label} dashboard.`;
    }
    return "I could not run that page action.";
  }

  window.VoiceAssistant = VoiceAssistant;
  window.addEventListener("DOMContentLoaded", () => {
    const assistant = new VoiceAssistant();
    assistant.init();
    window.shellyAssistant = assistant;
  });
})();
