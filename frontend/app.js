/**
 * Diamond CX Live Client Application.
 * Coordinates WebSocket transport, audio stream, video stream, and live UI interactions.
 */

import { AudioManager } from "./audio/audio-manager.js";
import { CameraManager } from "./video/camera-manager.js";

// Session identities
const userId = "user-" + Math.random().toString(36).substring(2, 9);
const sessionId = "session-" + Math.random().toString(36).substring(2, 9);

// DOM Elements
const connectionBadge = document.getElementById("connectionBadge");
const statusText = document.getElementById("statusText");
const voiceSelect = document.getElementById("voiceSelect");
const modalitySelect = document.getElementById("modalitySelect");

const webcamVideo = document.getElementById("webcamVideo");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const cameraIndicator = document.getElementById("cameraIndicator");
const btnToggleCameraPrompt = document.getElementById("btnToggleCameraPrompt");
const btnSwitchCamera = document.getElementById("btnSwitchCamera");
const btnFlipCameraHud = document.getElementById("btnFlipCameraHud");

const visualizerCanvas = document.getElementById("visualizerCanvas");
const visualizerCtx = visualizerCanvas ? visualizerCanvas.getContext("2d") : null;
const volumeBarFill = document.getElementById("volumeBarFill");
const liveActivityPill = document.getElementById("liveActivityPill");

const btnConnect = document.getElementById("btnConnect");
const btnConnectText = document.getElementById("btnConnectText");
const btnConnectIcon = document.getElementById("btnConnectIcon");
const connectSpinner = document.getElementById("connectSpinner");
const btnToggleMic = document.getElementById("btnToggleMic");
const btnToggleCamera = document.getElementById("btnToggleCamera");
const btnInterrupt = document.getElementById("btnInterrupt");

const textInput = document.getElementById("textInput");
const btnSendText = document.getElementById("btnSendText");
const feedContent = document.getElementById("feedContent");
const btnClearFeed = document.getElementById("btnClearFeed");

// Mobile Tab Elements
const tabBtnFeed = document.getElementById("tabBtnFeed");
const tabBtnStudio = document.getElementById("tabBtnStudio");
const tabFeedBadge = document.getElementById("tabFeedBadge");
const studioActiveDot = document.getElementById("studioActiveDot");
const panelFeed = document.getElementById("panelFeed");
const panelStudio = document.getElementById("panelStudio");

// State
let ws = null;
let isConnected = false;
let isMicMuted = false;
let isCameraOn = false;
let currentAgentBubble = null;
let currentUserBubble = null;
let currentVolume = 0;
let activeTab = "feed";
let idleAnimationId = null;

// Initialize Managers
const audioManager = new AudioManager({
  onAudioChunk: (arrayBuffer) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(arrayBuffer);
    }
  },
  onMicVolume: (volume) => {
    currentVolume = volume;
    if (volumeBarFill) {
      volumeBarFill.style.width = `${Math.round(volume * 100)}%`;
    }
    if (liveActivityPill && isConnected) {
      if (volume > 0.08) {
        liveActivityPill.textContent = "Speaking";
        liveActivityPill.style.color = "#34d399";
        liveActivityPill.style.borderColor = "rgba(16, 185, 129, 0.4)";
        liveActivityPill.style.background = "rgba(16, 185, 129, 0.15)";
      } else {
        liveActivityPill.textContent = "Listening";
        liveActivityPill.style.color = "#00f0ff";
        liveActivityPill.style.borderColor = "rgba(0, 240, 255, 0.25)";
        liveActivityPill.style.background = "rgba(0, 240, 255, 0.1)";
      }
    }
  },
});

const cameraManager = new CameraManager({
  fps: 1,
  quality: 0.7,
  onFrame: (payload) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  },
});

// Determine WebSocket Server URL
function getWebSocketUrl() {
  const isHttps = window.location.protocol === "https:";
  const wsProto = isHttps ? "wss:" : "ws:";
  
  // If running on a separate frontend dev server (port != 8000), target backend on port 8000
  let host = window.location.host;
  if (window.location.port && window.location.port !== "8000") {
    host = `${window.location.hostname}:8000`;
  }

  const voice = voiceSelect ? voiceSelect.value : "Puck";
  const modality = modalitySelect ? modalitySelect.value : "AUDIO";
  return `${wsProto}//${host}/ws/${userId}/${sessionId}?voice=${voice}&modality=${modality}`;
}

// Connect / Disconnect Handlers
async function connectLiveSession() {
  if (isConnected) {
    disconnectLiveSession();
    return;
  }

  updateConnectionStatus("connecting", "Connecting...");
  btnConnect.disabled = true;
  if (connectSpinner) connectSpinner.style.display = "inline-block";
  if (btnConnectIcon) btnConnectIcon.style.display = "none";
  if (btnConnectText) btnConnectText.textContent = "Connecting...";

  try {
    // 1. Initialize and start microphone
    try {
      await audioManager.startMicrophone();
    } catch (micErr) {
      console.warn("Microphone start warning:", micErr);
      const isHttpNonLocal = window.location.protocol === "http:" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";
      if (isHttpNonLocal) {
        addSystemMessage("⚠️ Mobile browser blocked Microphone/Camera access over unencrypted HTTP (http://" + window.location.hostname + "). Mobile browsers require HTTPS for camera/mic permissions.", true);
      } else {
        addSystemMessage(`Microphone access issue: ${micErr.message}`, true);
      }
    }

    // 2. Open WebSocket
    const wsUrl = getWebSocketUrl();
    console.log("Connecting to Gemini Live WebSocket:", wsUrl);
    ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      isConnected = true;
      updateConnectionStatus("connected", "Live Concierge");
      if (connectSpinner) connectSpinner.style.display = "none";
      if (btnConnectIcon) btnConnectIcon.style.display = "inline-block";
      btnConnectText.textContent = "End Live Session";
      btnConnect.classList.add("connected-btn");
      btnConnect.disabled = false;

      btnToggleMic.disabled = false;
      btnToggleCamera.disabled = false;
      btnInterrupt.disabled = false;
      textInput.disabled = false;
      btnSendText.disabled = false;

      if (liveActivityPill) {
        liveActivityPill.textContent = "Listening";
      }

      addSystemMessage("Connected to Gemini Live session. You can speak now!");
    };

    ws.onmessage = (event) => {
      handleServerMessage(event.data);
    };

    ws.onerror = (err) => {
      console.error("Live WebSocket error:", err);
      addSystemMessage(`WebSocket connection error (${wsUrl}). Verify backend is running on 0.0.0.0:8000.`, true);
      disconnectLiveSession();
    };

    ws.onclose = (event) => {
      console.log("Live WebSocket closed:", event);
      if (isConnected) {
        addSystemMessage("Live session disconnected.", false);
      }
      disconnectLiveSession();
    };
  } catch (err) {
    console.error("Failed starting session:", err);
    addSystemMessage(`Connection failed: ${err.message}`, true);
    disconnectLiveSession();
  }
}

function disconnectLiveSession() {
  isConnected = false;
  updateConnectionStatus("disconnected", "Offline");
  if (connectSpinner) connectSpinner.style.display = "none";
  if (btnConnectIcon) btnConnectIcon.style.display = "inline-block";
  btnConnectText.textContent = "Start Live Session";
  btnConnect.classList.remove("connected-btn");
  btnConnect.disabled = false;

  btnToggleMic.disabled = true;
  btnToggleCamera.disabled = true;
  btnInterrupt.disabled = true;
  textInput.disabled = true;
  btnSendText.disabled = true;

  if (liveActivityPill) {
    liveActivityPill.textContent = "Ready";
    liveActivityPill.style.color = "";
    liveActivityPill.style.borderColor = "";
    liveActivityPill.style.background = "";
  }

  audioManager.stop();
  if (isCameraOn) {
    toggleCamera(false);
  }

  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  currentAgentBubble = null;
  currentUserBubble = null;
  currentVolume = 0;
  if (volumeBarFill) volumeBarFill.style.width = "0%";
}

function updateConnectionStatus(state, label) {
  if (!connectionBadge || !statusText) return;
  connectionBadge.className = `status-badge ${state}`;
  statusText.textContent = label;
}

// Parse and Handle Incoming ADK Live Events
function handleServerMessage(data) {
  if (typeof data !== "string") {
    return;
  }

  try {
    const event = JSON.parse(data);

    // 1. Check for simulated/system notifications
    if (event.type === "system") {
      addSystemMessage(event.message);
      return;
    }

    // 2. Interruption event (Customer spoke while model was talking)
    if (
      event.interrupted ||
      (event.serverContent && event.serverContent.interrupted) ||
      (event.server_content && event.server_content.interrupted)
    ) {
      audioManager.interruptPlayback();
      if (currentAgentBubble) {
        const header = currentAgentBubble.querySelector(".msg-header");
        if (header && !header.querySelector(".interrupted-tag")) {
          const interruptedTag = document.createElement("span");
          interruptedTag.className = "msg-time interrupted-tag";
          interruptedTag.textContent = " (interrupted)";
          header.appendChild(interruptedTag);
        }
      }
      return;
    }

    // 3. User Speech Transcription
    const userText =
      (event.inputTranscription && event.inputTranscription.text) ||
      (event.input_transcription && event.input_transcription.text) ||
      (event.inputAudioTranscription && event.inputAudioTranscription.text);

    if (userText) {
      handleUserTranscription(userText);
    }

    // 4. Output Audio Transcription
    const agentText =
      (event.outputTranscription && event.outputTranscription.text) ||
      (event.output_transcription && event.output_transcription.text) ||
      (event.outputAudioTranscription && event.outputAudioTranscription.text);

    if (agentText) {
      handleAgentTranscription(agentText);
    }

    // 5. Model Turns & Content Parts
    const parts = extractContentParts(event);
    for (const part of parts) {
      // Inline PCM audio output
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData && inlineData.data) {
        audioManager.playAudioChunk(
          inlineData.data,
          inlineData.mimeType || inlineData.mime_type
        );
      }

      // Text tokens
      if (part.text) {
        handleAgentTranscription(part.text);
      }

      // Function/Tool Call
      const fnCall = part.functionCall || part.function_call;
      if (fnCall) {
        renderToolCall(fnCall);
      }

      // Function/Tool Response
      const fnResp = part.functionResponse || part.function_response;
      if (fnResp) {
        renderToolResponse(fnResp);
      }
    }

    // 6. Turn Complete
    if (
      event.turnComplete ||
      event.turn_complete ||
      (event.serverContent && event.serverContent.turnComplete) ||
      (event.server_content && event.server_content.turn_complete)
    ) {
      currentAgentBubble = null;
      currentUserBubble = null;
    }
  } catch (err) {
    console.error("Error parsing live server event:", err, data);
  }
}

function extractContentParts(event) {
  const parts = [];
  if (event.content && event.content.parts) {
    parts.push(...event.content.parts);
  }
  if (event.serverContent && event.serverContent.modelTurn && event.serverContent.modelTurn.parts) {
    parts.push(...event.serverContent.modelTurn.parts);
  }
  if (event.server_content && event.server_content.model_turn && event.server_content.model_turn.parts) {
    parts.push(...event.server_content.model_turn.parts);
  }
  return parts;
}

// Conversation Feed Rendering
function handleUserTranscription(text) {
  if (!currentUserBubble) {
    currentUserBubble = createMessageBubble("user", "You");
    feedContent.appendChild(currentUserBubble);
  }
  const body = currentUserBubble.querySelector(".msg-body");
  body.textContent = text;
  notifyFeedActivity();
  scrollFeedToBottom();
}

function handleAgentTranscription(textChunk) {
  if (!currentAgentBubble) {
    currentAgentBubble = createMessageBubble("agent", "Diamond Concierge");
    feedContent.appendChild(currentAgentBubble);
  }
  const body = currentAgentBubble.querySelector(".msg-body");
  body.textContent += textChunk;
  notifyFeedActivity();
  scrollFeedToBottom();
}

function createMessageBubble(role, senderName) {
  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${role}-message`;
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.innerHTML = `
    <div class="msg-header">
      <div class="msg-sender-wrap">
        <span class="system-badge-icon">${role === 'user' ? '👤' : '✦'}</span>
        <span class="msg-sender">${senderName}</span>
      </div>
      <span class="msg-time">${time}</span>
    </div>
    <div class="msg-body"></div>
  `;
  return bubble;
}

function addSystemMessage(text, isError = false) {
  const bubble = document.createElement("div");
  bubble.className = "message-bubble system-message";
  if (isError) {
    bubble.style.borderColor = "rgba(244, 63, 94, 0.45)";
    bubble.style.color = "#fb7185";
  }
  bubble.innerHTML = `
    <div class="msg-header">
      <div class="msg-sender-wrap">
        <span class="system-badge-icon">ℹ</span>
        <span class="msg-sender">SYSTEM NOTICE</span>
      </div>
      <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="msg-body">${text}</div>
  `;
  feedContent.appendChild(bubble);
  notifyFeedActivity();
  scrollFeedToBottom();
}

function renderToolCall(call) {
  const card = document.createElement("div");
  card.className = "tool-card";
  card.innerHTML = `
    <div class="tool-header">
      <div class="tool-badge-pill">
        <span>⚡ Executing Tool</span>
      </div>
      <span class="tool-name">${call.name}</span>
    </div>
    <div style="font-size: 0.78rem; color: var(--text-muted); font-family: var(--font-mono); word-break: break-all;">
      ${JSON.stringify(call.args || {})}
    </div>
  `;
  feedContent.appendChild(card);
  notifyFeedActivity();
  scrollFeedToBottom();
}

function renderToolResponse(resp) {
  const card = document.createElement("div");
  card.className = "tool-card";
  
  let contentHtml = "";
  const respData = resp.response || resp;

  // Rich rendering for order lookups
  if (respData.results && Array.isArray(respData.results)) {
    const orders = respData.results;
    contentHtml = orders.map(o => `
      <div class="order-detail-grid">
        <div class="order-detail-item"><strong>Order ID</strong><span>${o.order_id}</span></div>
        <div class="order-detail-item"><strong>Customer</strong><span>${o.customer_name}</span></div>
        <div class="order-detail-item"><strong>Product</strong><span>${o.product_name}</span></div>
        <div class="order-detail-item"><strong>Serial No</strong><span style="font-family: var(--font-mono); color: var(--diamond-cyan);">${o.serial_number}</span></div>
        <div class="order-detail-item">
          <strong>Status</strong>
          <span class="status-badge-inline ${String(o.status).toLowerCase()}">${o.status}</span>
        </div>
        <div class="order-detail-item"><strong>Warranty</strong><span style="color: #34d399;">${o.warranty_status || 'Active'}</span></div>
      </div>
    `).join("");
  } else if (respData.information) {
    // Rich rendering for product FAQ
    contentHtml = `
      <div style="font-size: 0.84rem; line-height: 1.45; color: var(--text-primary);">
        <strong style="color: var(--diamond-cyan);">${respData.product || 'Product'} (${respData.topic || 'Details'}):</strong>
        <p style="margin-top: 4px; color: var(--text-secondary);">${respData.information}</p>
      </div>
    `;
  } else {
    contentHtml = `<pre style="font-size: 0.74rem; color: var(--text-secondary); overflow-x: auto; background: rgba(0,0,0,0.3); padding: 8px; border-radius: 6px;">${JSON.stringify(respData, null, 2)}</pre>`;
  }

  card.innerHTML = `
    <div class="tool-header">
      <div class="tool-badge-pill">
        <span>✓ Tool Completed</span>
      </div>
      <span class="tool-name">${resp.name || 'query'}</span>
    </div>
    ${contentHtml}
  `;
  feedContent.appendChild(card);
  notifyFeedActivity();
  scrollFeedToBottom();
}

function notifyFeedActivity() {
  if (activeTab !== "feed" && tabFeedBadge) {
    tabFeedBadge.style.display = "inline-block";
  }
}

function scrollFeedToBottom() {
  if (feedContent) {
    feedContent.scrollTop = feedContent.scrollHeight;
  }
}

// Camera Toggle
async function toggleCamera(forceState) {
  const nextState = forceState !== undefined ? forceState : !isCameraOn;
  if (nextState === isCameraOn) return;

  if (nextState) {
    try {
      await cameraManager.start(webcamVideo);
      isCameraOn = true;
      webcamVideo.classList.add("active");
      videoPlaceholder.style.display = "none";
      cameraIndicator.classList.add("active");
      btnToggleCamera.classList.add("active");
      if (btnSwitchCamera) btnSwitchCamera.style.display = "inline-flex";
      if (btnFlipCameraHud) btnFlipCameraHud.style.display = "inline-flex";
      if (studioActiveDot) studioActiveDot.style.display = "inline-block";
      addSystemMessage("Camera enabled. Gemini Live is now inspecting visual frames.");
    } catch (err) {
      console.error("Camera access failed:", err);
      addSystemMessage(`Camera access denied: ${err.message}`, true);
    }
  } else {
    cameraManager.stop();
    isCameraOn = false;
    webcamVideo.classList.remove("active");
    videoPlaceholder.style.display = "flex";
    cameraIndicator.classList.remove("active");
    btnToggleCamera.classList.remove("active");
    if (btnSwitchCamera) btnSwitchCamera.style.display = "none";
    if (btnFlipCameraHud) btnFlipCameraHud.style.display = "none";
    if (studioActiveDot) studioActiveDot.style.display = "none";
  }
}

// Switch / Flip Camera Source
async function switchCameraSource() {
  if (!isCameraOn) return;
  try {
    const success = await cameraManager.switchCamera();
    if (success) {
      const mode = cameraManager.facingMode === "environment" ? "Back (Environment)" : "Front (User)";
      addSystemMessage(`Switched camera source: ${mode}`);
    }
  } catch (err) {
    console.error("Failed to switch camera:", err);
    addSystemMessage(`Camera switch error: ${err.message}`, true);
  }
}

// Microphone Mute Toggle
function toggleMute() {
  isMicMuted = !isMicMuted;
  audioManager.setMute(isMicMuted);
  if (isMicMuted) {
    btnToggleMic.classList.add("muted");
  } else {
    btnToggleMic.classList.remove("muted");
  }
}

// Mobile Tab Switcher Logic
function switchTab(tabName) {
  activeTab = tabName;
  if (tabName === "feed") {
    tabBtnFeed.classList.add("active");
    tabBtnStudio.classList.remove("active");
    panelFeed.classList.add("active");
    panelStudio.classList.remove("active");
    if (tabFeedBadge) tabFeedBadge.style.display = "none";
  } else {
    tabBtnStudio.classList.add("active");
    tabBtnFeed.classList.remove("active");
    panelStudio.classList.add("active");
    panelFeed.classList.remove("active");
    resizeVisualizer();
  }
}

if (tabBtnFeed && tabBtnStudio) {
  tabBtnFeed.addEventListener("click", () => switchTab("feed"));
  tabBtnStudio.addEventListener("click", () => switchTab("studio"));
}

// High-DPI Responsive Canvas Resizer
function resizeVisualizer() {
  if (!visualizerCanvas || !visualizerCanvas.parentElement) return;
  const rect = visualizerCanvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.floor(rect.width) || 360;
  const height = 56;

  visualizerCanvas.width = width * dpr;
  visualizerCanvas.height = height * dpr;
  visualizerCanvas.style.width = `${width}px`;
  visualizerCanvas.style.height = `${height}px`;

  if (visualizerCtx) {
    visualizerCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

// Continuous Visualizer & Ambient Wave Loop
function renderVisualizerLoop() {
  if (!visualizerCanvas || !visualizerCtx) return;
  
  const width = parseFloat(visualizerCanvas.style.width) || 360;
  const height = parseFloat(visualizerCanvas.style.height) || 56;
  visualizerCtx.clearRect(0, 0, width, height);

  const time = Date.now() * 0.003;

  if (currentVolume > 0.02) {
    // Dynamic Equalizer Frequency Bars
    const bars = Math.min(48, Math.max(24, Math.floor(width / 10)));
    const barWidth = Math.max(2.5, (width / bars) - 3);
    const centerY = height / 2;

    for (let i = 0; i < bars; i++) {
      const freqFactor = Math.sin((i / bars) * Math.PI * 3 + time * 2);
      const barHeight = Math.max(4, currentVolume * height * 0.9 * (0.4 + 0.6 * Math.abs(freqFactor)));

      const x = i * (barWidth + 3);
      const y = centerY - barHeight / 2;

      const grad = visualizerCtx.createLinearGradient(0, y, 0, y + barHeight);
      grad.addColorStop(0, "#00f0ff");
      grad.addColorStop(0.5, "#0284c7");
      grad.addColorStop(1, "#10b981");

      visualizerCtx.fillStyle = grad;
      visualizerCtx.beginPath();
      visualizerCtx.roundRect(x, y, barWidth, barHeight, 2);
      visualizerCtx.fill();
    }
  } else {
    // Luxury Ambient Sine Wave
    visualizerCtx.lineWidth = 2;
    const grad = visualizerCtx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, "rgba(0, 240, 255, 0.1)");
    grad.addColorStop(0.5, isConnected ? "rgba(0, 240, 255, 0.7)" : "rgba(56, 189, 248, 0.35)");
    grad.addColorStop(1, "rgba(0, 240, 255, 0.1)");
    
    visualizerCtx.strokeStyle = grad;
    visualizerCtx.beginPath();

    const centerY = height / 2;
    const amplitude = isConnected ? 7 : 3;

    for (let x = 0; x < width; x += 4) {
      const y = centerY + Math.sin(x * 0.035 + time) * Math.cos(x * 0.01 + time * 0.5) * amplitude;
      if (x === 0) {
        visualizerCtx.moveTo(x, y);
      } else {
        visualizerCtx.lineTo(x, y);
      }
    }
    visualizerCtx.stroke();
  }

  idleAnimationId = requestAnimationFrame(renderVisualizerLoop);
}

// Window and Resize Observers
window.addEventListener("resize", () => {
  resizeVisualizer();
});

const resizeObserver = new ResizeObserver(() => {
  resizeVisualizer();
});
if (visualizerCanvas && visualizerCanvas.parentElement) {
  resizeObserver.observe(visualizerCanvas.parentElement);
}

// Start Visualizer Loop
resizeVisualizer();
renderVisualizerLoop();

// Text Message Sender
function sendTextMessage() {
  const text = textInput.value.trim();
  if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;

  // Add user bubble
  handleUserTranscription(text);
  currentUserBubble = null;

  // Send JSON text frame
  ws.send(JSON.stringify({
    type: "text",
    text: text,
  }));

  textInput.value = "";
}

// Event Listeners
btnConnect.addEventListener("click", connectLiveSession);
btnToggleMic.addEventListener("click", toggleMute);
btnToggleCamera.addEventListener("click", () => toggleCamera());
btnToggleCameraPrompt.addEventListener("click", () => toggleCamera(true));
if (btnSwitchCamera) {
  btnSwitchCamera.addEventListener("click", switchCameraSource);
}
if (btnFlipCameraHud) {
  btnFlipCameraHud.addEventListener("click", switchCameraSource);
}
btnInterrupt.addEventListener("click", () => {
  audioManager.interruptPlayback();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ type: "activity_start" }));
  }
});

btnSendText.addEventListener("click", sendTextMessage);
textInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    sendTextMessage();
  }
});

btnClearFeed.addEventListener("click", () => {
  feedContent.innerHTML = "";
  addSystemMessage("Conversation log cleared.");
});

// Quick Prompt Chips
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.getAttribute("data-prompt");
    if (!prompt) return;
    textInput.value = prompt;
    // On mobile, automatically switch to feed to view inquiry and response
    if (window.innerWidth <= 1024) {
      switchTab("feed");
    }
    if (isConnected) {
      sendTextMessage();
    }
  });
});
