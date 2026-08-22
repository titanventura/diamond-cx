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

const visualizerCanvas = document.getElementById("visualizerCanvas");
const visualizerCtx = visualizerCanvas.getContext("2d");
const volumeBarFill = document.getElementById("volumeBarFill");

const btnConnect = document.getElementById("btnConnect");
const btnConnectText = document.getElementById("btnConnectText");
const btnToggleMic = document.getElementById("btnToggleMic");
const btnToggleCamera = document.getElementById("btnToggleCamera");
const btnInterrupt = document.getElementById("btnInterrupt");

const textInput = document.getElementById("textInput");
const btnSendText = document.getElementById("btnSendText");
const feedContent = document.getElementById("feedContent");
const btnClearFeed = document.getElementById("btnClearFeed");

// State
let ws = null;
let isConnected = false;
let isMicMuted = false;
let isCameraOn = false;
let currentAgentBubble = null;
let currentUserBubble = null;

// Initialize Managers
const audioManager = new AudioManager({
  onAudioChunk: (arrayBuffer) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(arrayBuffer);
    }
  },
  onMicVolume: (volume) => {
    volumeBarFill.style.width = `${Math.round(volume * 100)}%`;
    drawWaveform(volume);
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
  
  // If hosted on live backend, use relative origin; if local dev on port 3000, target port 8000
  let host = window.location.host;
  if (window.location.port === "3000" || window.location.port === "5173") {
    host = `${window.location.hostname}:8000`;
  }

  const voice = voiceSelect.value;
  const modality = modalitySelect.value;
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

  try {
    // 1. Initialize and start microphone
    await audioManager.startMicrophone();

    // 2. Open WebSocket
    const wsUrl = getWebSocketUrl();
    console.log("Connecting to Gemini Live WebSocket:", wsUrl);
    ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      isConnected = true;
      updateConnectionStatus("connected", "Live Concierge Active");
      btnConnectText.textContent = "End Live Session";
      btnConnect.classList.add("connected-btn");
      btnConnect.disabled = false;

      btnToggleMic.disabled = false;
      btnToggleCamera.disabled = false;
      btnInterrupt.disabled = false;
      textInput.disabled = false;
      btnSendText.disabled = false;

      addSystemMessage("Connected to Gemini Live session. You can speak now!");
    };

    ws.onmessage = (event) => {
      handleServerMessage(event.data);
    };

    ws.onerror = (err) => {
      console.error("Live WebSocket error:", err);
      addSystemMessage("Live WebSocket connection error. Please verify backend is running.", true);
    };

    ws.onclose = () => {
      disconnectLiveSession();
    };
  } catch (err) {
    console.error("Failed starting live session:", err);
    addSystemMessage(`Could not start live session: ${err.message}`, true);
    disconnectLiveSession();
  }
}

function disconnectLiveSession() {
  isConnected = false;
  updateConnectionStatus("disconnected", "Offline");
  btnConnectText.textContent = "Start Live Session";
  btnConnect.classList.remove("connected-btn");
  btnConnect.disabled = false;

  btnToggleMic.disabled = true;
  btnToggleCamera.disabled = true;
  btnInterrupt.disabled = true;
  textInput.disabled = true;
  btnSendText.disabled = true;

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
}

function updateConnectionStatus(state, label) {
  connectionBadge.className = `status-badge ${state}`;
  statusText.textContent = label;
}

// Parse and Handle Incoming ADK Live Events
function handleServerMessage(data) {
  if (typeof data !== "string") {
    // Binary frame if server sends raw bytes
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

    // 3. User Speech Transcription (if returned by live audio transcription)
    const userText =
      (event.inputTranscription && event.inputTranscription.text) ||
      (event.input_transcription && event.input_transcription.text) ||
      (event.inputAudioTranscription && event.inputAudioTranscription.text);

    if (userText) {
      handleUserTranscription(userText);
    }

    // 4. Output Audio Transcription (model speech transcription)
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
  scrollFeedToBottom();
}

function handleAgentTranscription(textChunk) {
  if (!currentAgentBubble) {
    currentAgentBubble = createMessageBubble("agent", "Diamond Concierge");
    feedContent.appendChild(currentAgentBubble);
  }
  const body = currentAgentBubble.querySelector(".msg-body");
  body.textContent += textChunk;
  scrollFeedToBottom();
}

function createMessageBubble(role, senderName) {
  const bubble = document.createElement("div");
  bubble.className = `message-bubble ${role}-message`;
  
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  bubble.innerHTML = `
    <div class="msg-header">
      <span class="msg-sender">${senderName}</span>
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
    bubble.style.borderColor = "rgba(244, 63, 94, 0.4)";
    bubble.style.color = "#fb7185";
  }
  bubble.innerHTML = `
    <div class="msg-header">
      <span class="msg-sender">SYSTEM NOTICE</span>
      <span class="msg-time">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
    <div class="msg-body">${text}</div>
  `;
  feedContent.appendChild(bubble);
  scrollFeedToBottom();
}

function renderToolCall(call) {
  const card = document.createElement("div");
  card.className = "tool-card";
  card.innerHTML = `
    <div class="tool-header">
      <span>Executing Tool</span>
      <span class="tool-name">${call.name}</span>
    </div>
    <div style="font-size: 0.8rem; color: var(--text-muted);">
      Query: <code>${JSON.stringify(call.args || {})}</code>
    </div>
  `;
  feedContent.appendChild(card);
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
        <div class="order-detail-item"><strong>Serial</strong><span>${o.serial_number}</span></div>
        <div class="order-detail-item"><strong>Status</strong><span style="color: #34d399;">${o.status}</span></div>
        <div class="order-detail-item"><strong>Warranty</strong><span>${o.warranty_status}</span></div>
      </div>
    `).join("");
  } else if (respData.information) {
    // Rich rendering for product FAQ
    contentHtml = `
      <div style="font-size: 0.85rem; line-height: 1.4; color: var(--text-primary);">
        <strong>${respData.product || 'Product'} (${respData.topic || 'Details'}):</strong>
        <p style="margin-top: 4px;">${respData.information}</p>
      </div>
    `;
  } else {
    contentHtml = `<pre style="font-size: 0.75rem; color: var(--text-secondary);">${JSON.stringify(respData, null, 2)}</pre>`;
  }

  card.innerHTML = `
    <div class="tool-header">
      <span>Tool Completed</span>
      <span class="tool-name">${resp.name || 'query'}</span>
    </div>
    ${contentHtml}
  `;
  feedContent.appendChild(card);
  scrollFeedToBottom();
}

function scrollFeedToBottom() {
  feedContent.scrollTop = feedContent.scrollHeight;
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
      addSystemMessage("Camera enabled. Gemini Live is now inspecting visual video frames.");
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

// Visualizer Waveform Drawer
function drawWaveform(volume) {
  const width = visualizerCanvas.width;
  const height = visualizerCanvas.height;
  visualizerCtx.clearRect(0, 0, width, height);

  const bars = 32;
  const barWidth = width / bars - 2;
  const centerY = height / 2;

  for (let i = 0; i < bars; i++) {
    const sinOffset = Math.sin((i / bars) * Math.PI * 2 + Date.now() / 200);
    const barHeight = Math.max(4, (volume * height * 0.8 * (0.5 + 0.5 * sinOffset)));

    const x = i * (barWidth + 2);
    const y = centerY - barHeight / 2;

    const grad = visualizerCtx.createLinearGradient(0, y, 0, y + barHeight);
    grad.addColorStop(0, "#00d2ff");
    grad.addColorStop(1, "#0284c7");

    visualizerCtx.fillStyle = grad;
    visualizerCtx.fillRect(x, y, barWidth, barHeight);
  }
}

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
  addSystemMessage("Log cleared.");
});

// Quick Prompt Chips
document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const prompt = chip.getAttribute("data-prompt");
    textInput.value = prompt;
    if (isConnected) {
      sendTextMessage();
    }
  });
});
