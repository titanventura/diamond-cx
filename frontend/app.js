/**
 * Diamond CX Continuous Client Application.
 * Unifies E-Commerce Storefront, Orders Hub, Firebase Auth, Test Checkout,
 * and Gemini Live Multimodal Concierge with Dynamic Redressal.
 */

import { AudioManager } from "./audio/audio-manager.js";
import { CameraManager } from "./video/camera-manager.js";

// Determine API Base URL
function getApiBaseUrl() {
  if (window.location.port && window.location.port !== "8000") {
    return `${window.location.protocol}//${window.location.hostname}:8000/api/v1`;
  }
  return "/api/v1";
}

const API_BASE = getApiBaseUrl();

// -------------------------------------------------------------
// User Authentication State (Firebase Demo Profiles)
// -------------------------------------------------------------
const DEMO_USERS = {
  "user-demo-01": {
    id: "user-demo-01",
    name: "Aswath S",
    email: "aswath@diamondcx.com",
    initials: "AS",
  },
  "user-demo-02": {
    id: "user-demo-02",
    name: "Sarah Connor",
    email: "sarah@diamondcx.com",
    initials: "SC",
  },
  "user-demo-03": {
    id: "user-demo-03",
    name: "Bruce Wayne",
    email: "bruce@diamondcx.com",
    initials: "BW",
  },
};

let currentUser = JSON.parse(localStorage.getItem("diamond_cx_user")) || DEMO_USERS["user-demo-01"];
let currentSessionId = "session-" + Math.random().toString(36).substring(2, 9);
let activeOrderContext = null;
let currentOrders = [];

// -------------------------------------------------------------
// DOM Elements
// -------------------------------------------------------------
// Navigation & Views
const navBtnStore = document.getElementById("navBtnStore");
const navBtnOrders = document.getElementById("navBtnOrders");
const navBtnConcierge = document.getElementById("navBtnConcierge");
const navOrdersBadge = document.getElementById("navOrdersBadge");

const viewStore = document.getElementById("viewStore");
const viewOrders = document.getElementById("viewOrders");
const viewConcierge = document.getElementById("viewConcierge");

// User Auth Elements
const userAuthPill = document.getElementById("userAuthPill");
const userAvatar = document.getElementById("userAvatar");
const userName = document.getElementById("userName");
const userDropdownMenu = document.getElementById("userDropdownMenu");

// Storefront Elements
const galleryMainImg = document.getElementById("galleryMainImg");
const galleryThumbs = document.querySelectorAll(".thumb-btn");
const btnOpenCheckout = document.getElementById("btnOpenCheckout");
const btnAskConciergeAboutDesk = document.getElementById("btnAskConciergeAboutDesk");

// Orders View Elements
const btnRefreshOrders = document.getElementById("btnRefreshOrders");
const ordersGrid = document.getElementById("ordersGrid");
const ordersLoading = document.getElementById("ordersLoading");
const ordersEmptyState = document.getElementById("ordersEmptyState");
const btnEmptyGoToStore = document.getElementById("btnEmptyGoToStore");

// Checkout Modal Elements
const checkoutModal = document.getElementById("checkoutModal");
const btnCloseCheckout = document.getElementById("btnCloseCheckout");
const checkoutPaymentForm = document.getElementById("checkoutPaymentForm");
const checkoutFormStep = document.getElementById("checkoutFormStep");
const checkoutSuccessStep = document.getElementById("checkoutSuccessStep");
const btnSubmitPayment = document.getElementById("btnSubmitPayment");
const btnPayText = document.getElementById("btnPayText");
const paySpinner = document.getElementById("paySpinner");
const checkoutCustomerName = document.getElementById("checkoutCustomerName");
const checkoutCustomerEmail = document.getElementById("checkoutCustomerEmail");
const cardHolderDisplay = document.getElementById("cardHolderDisplay");
const successOrderId = document.getElementById("successOrderId");
const successSerial = document.getElementById("successSerial");
const successAmount = document.getElementById("successAmount");
const successPaymentId = document.getElementById("successPaymentId");
const btnSuccessViewOrders = document.getElementById("btnSuccessViewOrders");
const btnSuccessLaunchSupport = document.getElementById("btnSuccessLaunchSupport");

// Support Ticket Modal Elements
const ticketModal = document.getElementById("ticketModal");
const btnCloseTicket = document.getElementById("btnCloseTicket");
const supportTicketForm = document.getElementById("supportTicketForm");
const ticketOrderId = document.getElementById("ticketOrderId");
const ticketModalSubtitle = document.getElementById("ticketModalSubtitle");

// Concierge Context Banner
const orderContextBanner = document.getElementById("orderContextBanner");
const contextOrderTitle = document.getElementById("contextOrderTitle");
const contextOrderMeta = document.getElementById("contextOrderMeta");
const btnClearOrderContext = document.getElementById("btnClearOrderContext");

// Concierge Audio Controls & Studio
const conciergeAudioControls = document.getElementById("conciergeAudioControls");
const connectionBadge = document.getElementById("connectionBadge");
const statusText = document.getElementById("statusText");
const voiceSelect = document.getElementById("voiceSelect");
const modalitySelect = document.getElementById("modalitySelect");

const webcamVideo = document.getElementById("webcamVideo");
const videoPlaceholder = document.getElementById("videoPlaceholder");
const cameraIndicator = document.getElementById("cameraIndicator");
const btnToggleCameraPrompt = document.getElementById("btnToggleCameraPrompt");
const btnSwitchCamera = document.getElementById("btnSwitchCamera");

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
const quickChipsScroll = document.getElementById("quickChipsScroll");

// Mobile Tab Elements
const tabBtnFeed = document.getElementById("tabBtnFeed");
const tabBtnStudio = document.getElementById("tabBtnStudio");
const tabFeedBadge = document.getElementById("tabFeedBadge");
const studioActiveDot = document.getElementById("studioActiveDot");
const panelFeed = document.getElementById("panelFeed");
const panelStudio = document.getElementById("panelStudio");

// Live Session State
let ws = null;
let isConnected = false;
let isMicMuted = false;
let isCameraOn = false;
let currentAgentBubble = null;
let currentUserBubble = null;
let currentVolume = 0;
let activeMobileTab = "feed";
let idleAnimationId = null;

// -------------------------------------------------------------
// Audio & Camera Managers
// -------------------------------------------------------------
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

// -------------------------------------------------------------
// View Switching Logic
// -------------------------------------------------------------
function switchView(viewName) {
  // Update nav buttons
  navBtnStore.classList.toggle("active", viewName === "store");
  navBtnOrders.classList.toggle("active", viewName === "orders");
  navBtnConcierge.classList.toggle("active", viewName === "concierge");

  // Update view sections
  viewStore.classList.toggle("active", viewName === "store");
  viewOrders.classList.toggle("active", viewName === "orders");
  viewConcierge.classList.toggle("active", viewName === "concierge");

  // Concierge controls visibility in header
  if (conciergeAudioControls) {
    conciergeAudioControls.style.display = viewName === "concierge" ? "flex" : "none";
  }

  // View-specific initialization
  if (viewName === "orders") {
    fetchUserOrders();
  }
}

// -------------------------------------------------------------
// User Profile & Authentication Management
// -------------------------------------------------------------
function updateUserUi() {
  if (userAvatar) userAvatar.textContent = currentUser.initials;
  if (userName) userName.textContent = currentUser.name;
  if (checkoutCustomerName) checkoutCustomerName.value = currentUser.name;
  if (checkoutCustomerEmail) checkoutCustomerEmail.value = currentUser.email;
  if (cardHolderDisplay) cardHolderDisplay.textContent = currentUser.name.toUpperCase();

  // Highlight active in dropdown
  document.querySelectorAll(".dropdown-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.uid === currentUser.id);
  });
}

function switchUser(uid) {
  if (DEMO_USERS[uid]) {
    currentUser = DEMO_USERS[uid];
    localStorage.setItem("diamond_cx_user", JSON.stringify(currentUser));
    updateUserUi();
    userDropdownMenu.style.display = "none";
    fetchUserOrders();
  }
}

// -------------------------------------------------------------
// Orders Hub Data & Rendering
// -------------------------------------------------------------
async function fetchUserOrders() {
  if (!ordersGrid) return;

  if (ordersLoading) ordersLoading.style.display = "flex";
  if (ordersEmptyState) ordersEmptyState.style.display = "none";

  try {
    const res = await fetch(`${API_BASE}/store/orders?user_id=${currentUser.id}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const orders = await res.json();
    currentOrders = orders;

    // Update nav badge
    if (navOrdersBadge) {
      navOrdersBadge.textContent = orders.length;
      navOrdersBadge.style.display = orders.length > 0 ? "inline-block" : "none";
    }

    renderOrdersList(orders);
  } catch (err) {
    console.error("Failed fetching orders from Firestore:", err);
  } finally {
    if (ordersLoading) ordersLoading.style.display = "none";
  }
}

function renderOrdersList(orders) {
  ordersGrid.innerHTML = "";

  if (!orders || orders.length === 0) {
    if (ordersEmptyState) ordersEmptyState.style.display = "block";
    return;
  }

  orders.forEach((order) => {
    const card = document.createElement("div");
    card.className = "order-card";

    const isRefunded = Boolean(order.refund_status);
    const refundPill = isRefunded
      ? `<span class="status-badge-inline refund-badge">${order.refund_status} (${order.refund_amount || order.price})</span>`
      : "";

    card.innerHTML = `
      <div class="order-card-header">
        <div class="order-id-block">
          <strong>#${order.order_id}</strong>
          <span>${order.order_date}</span>
        </div>
        <div class="order-badges-wrap">
          ${refundPill}
          <span class="status-badge-inline delivered">${order.status || "Delivered"}</span>
        </div>
      </div>

      <div class="order-card-body">
        <div class="order-thumb">
          <img src="${order.image_url || '/static/sample_products/height_adjustable_desk/WhatsApp Image 2026-08-23 at 11.01.34.jpeg'}" alt="Product Photo">
        </div>
        <div class="order-info">
          <div class="order-product-name">${order.product_name}</div>
          <div class="order-meta-grid">
            <div class="order-meta-cell">
              <strong>Serial Number</strong>
              <span>${order.serial_number}</span>
            </div>
            <div class="order-meta-cell">
              <strong>Amount Paid</strong>
              <span>${order.price || ('$' + (order.amount_paid || 499.0).toFixed(2))}</span>
            </div>
            <div class="order-meta-cell">
              <strong>Payment Ref</strong>
              <span>${order.payment_id}</span>
            </div>
            <div class="order-meta-cell">
              <strong>Warranty</strong>
              <span style="color: var(--accent-success);">${order.warranty_status || "Active (2 Yrs)"}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="order-card-actions">
        <button class="btn btn-primary btn-sm btn-launch-support" data-order-id="${order.order_id}">
          <span>Live Concierge Support</span>
        </button>

        <button class="btn btn-secondary btn-sm btn-raise-ticket" data-order-id="${order.order_id}">
          <span>Raise Ticket</span>
        </button>
      </div>
    `;

    // Bind Launch Support CTA
    card.querySelector(".btn-launch-support").addEventListener("click", () => {
      startSupportForOrder(order);
    });

    // Bind Raise Ticket CTA
    card.querySelector(".btn-raise-ticket").addEventListener("click", () => {
      openTicketModal(order);
    });

    ordersGrid.appendChild(card);
  });
}

function startSupportForOrder(order) {
  activeOrderContext = order;

  // Display Context Banner in Live Concierge
  if (orderContextBanner) {
    contextOrderTitle.textContent = `Order #${order.order_id} • ${order.product_name}`;
    contextOrderMeta.textContent = `Serial: ${order.serial_number} • Payment: ${order.price} (${order.payment_status || 'Captured'}) • Warranty: ${order.warranty_status || 'Active'}`;
    orderContextBanner.style.display = "flex";
  }

  // Switch to concierge view
  switchView("concierge");

  // Greet and establish connection
  addSystemMessage(
    `Connected context for Order <strong>#${order.order_id}</strong> (${order.product_name}). ` +
    `Serial: <code>${order.serial_number}</code>. Gemini Live & Redressal Agent have pre-loaded this order record.`
  );

  // If not connected, prompt to start
  if (!isConnected) {
    connectLiveSession();
  }
}

// -------------------------------------------------------------
// Checkout & Test Payment Gateway Flow
// -------------------------------------------------------------
async function handleCheckoutSubmit(e) {
  e.preventDefault();

  btnSubmitPayment.disabled = true;
  btnPayText.textContent = "Authorizing Test Payment...";
  paySpinner.style.display = "inline-block";

  const payload = {
    product_id: "PROD-DESK-JHT8",
    quantity: 1,
    customer_name: checkoutCustomerName.value.trim(),
    customer_email: checkoutCustomerEmail.value.trim(),
    user_id: currentUser.id,
    shipping_address: document.getElementById("checkoutAddress").value.trim(),
    payment_method: "card_test_sandbox",
    test_card_number: "•••• 4242",
  };

  try {
    const res = await fetch(`${API_BASE}/store/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Checkout failed");
    }

    const orderData = await res.json();

    // Populate confirmation screen
    successOrderId.textContent = orderData.order_id;
    successSerial.textContent = orderData.serial_number;
    successAmount.textContent = `$${orderData.amount_paid.toFixed(2)} USD`;
    successPaymentId.textContent = orderData.payment_id;

    // Transition steps
    checkoutFormStep.style.display = "none";
    checkoutSuccessStep.style.display = "block";

    // Refresh orders and update badge
    fetchUserOrders();
  } catch (err) {
    alert(`Payment authorization error: ${err.message}`);
  } finally {
    btnSubmitPayment.disabled = false;
    btnPayText.textContent = "Authorize & Pay $499.00";
    paySpinner.style.display = "none";
  }
}

function openCheckoutModal() {
  updateUserUi();
  checkoutFormStep.style.display = "block";
  checkoutSuccessStep.style.display = "none";
  checkoutModal.style.display = "flex";
}

function closeCheckoutModal() {
  checkoutModal.style.display = "none";
}

// -------------------------------------------------------------
// Support Ticket Modal
// -------------------------------------------------------------
function openTicketModal(order) {
  ticketOrderId.value = order.order_id;
  ticketModalSubtitle.textContent = `Linked to Order #${order.order_id} (${order.product_name})`;
  ticketModal.style.display = "flex";
}

function closeTicketModal() {
  ticketModal.style.display = "none";
}

async function handleTicketSubmit(e) {
  e.preventDefault();

  const oid = ticketOrderId.value;
  const payload = {
    order_id: oid,
    user_id: currentUser.id,
    subject: document.getElementById("ticketSubject").value.trim(),
    description: document.getElementById("ticketDescription").value.trim(),
    priority: "high",
  };

  try {
    const res = await fetch(`${API_BASE}/store/orders/${oid}/ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error("Ticket submission failed");
    const ticket = await res.json();

    alert(`Ticket registered successfully! Ticket ID: ${ticket.ticket_id}. A hardware specialist has been notified.`);
    closeTicketModal();
    supportTicketForm.reset();
  } catch (err) {
    alert(`Error creating ticket: ${err.message}`);
  }
}

// -------------------------------------------------------------
// Live Concierge WebSocket Transport
// -------------------------------------------------------------
function getWebSocketUrl() {
  const isHttps = window.location.protocol === "https:";
  const wsProto = isHttps ? "wss:" : "ws:";
  
  let host = window.location.host;
  if (window.location.port && window.location.port !== "8000") {
    host = `${window.location.hostname}:8000`;
  }

  const voice = voiceSelect ? voiceSelect.value : "Puck";
  const modality = modalitySelect ? modalitySelect.value : "AUDIO";
  return `${wsProto}//${host}/ws/${currentUser.id}/${currentSessionId}?voice=${voice}&modality=${modality}`;
}

async function connectLiveSession() {
  if (isConnected) {
    disconnectLiveSession();
    return;
  }

  setConnectingState(true);

  try {
    await audioManager.init();

    const wsUrl = getWebSocketUrl();
    console.log("Connecting live WebSocket to:", wsUrl);
    ws = new WebSocket(wsUrl);

    ws.binaryType = "arraybuffer";

    ws.onopen = async () => {
      isConnected = true;
      setConnectedState(true);
      addSystemMessage("Connected to Gemini 3.1 Live. Bidirectional voice, vision, and dynamic redressal are active.");

      // If there is an active order context, inject it into the session immediately
      if (activeOrderContext) {
        const orderIntroText = (
          `[CUSTOMER CONTEXT] Customer Name: ${currentUser.name}. Active Order ID: ${activeOrderContext.order_id}. ` +
          `Product: ${activeOrderContext.product_name}. Serial Number: ${activeOrderContext.serial_number}. ` +
          `Amount Paid: ${activeOrderContext.price}. Warranty: ${activeOrderContext.warranty_status}. ` +
          `Please acknowledge this order and ask how you can help troubleshoot or diagnose their desk.`
        );
        sendTextMessage(orderIntroText);
      }

      await audioManager.startRecording();
      startVisualizerLoop();
    };

    ws.onmessage = (event) => {
      handleLiveMessage(event.data);
    };

    ws.onerror = (err) => {
      console.error("Live WebSocket error:", err);
      addSystemMessage("Connection error with Live session.", true);
    };

    ws.onclose = (event) => {
      console.log("Live WebSocket closed:", event.code, event.reason);
      disconnectLiveSession();
      addSystemMessage("Live session ended.");
    };
  } catch (err) {
    console.error("Connection failed:", err);
    disconnectLiveSession();
    addSystemMessage(`Connection failed: ${err.message}`, true);
  } finally {
    setConnectingState(false);
  }
}

function disconnectLiveSession() {
  isConnected = false;
  setConnectedState(false);
  stopVisualizerLoop();

  audioManager.stop();
  cameraManager.stop();
  isCameraOn = false;

  if (webcamVideo) webcamVideo.classList.remove("active");
  if (videoPlaceholder) videoPlaceholder.style.display = "flex";
  if (cameraIndicator) cameraIndicator.classList.remove("active");
  if (btnToggleCamera) btnToggleCamera.classList.remove("active");
  if (btnSwitchCamera) btnSwitchCamera.style.display = "none";
  if (studioActiveDot) studioActiveDot.style.display = "none";

  if (ws) {
    try {
      ws.close(1000, "User disconnected");
    } catch (_) {}
    ws = null;
  }
}

function sendTextMessage(text) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const payload = { type: "text", text: text };
  ws.send(JSON.stringify(payload));
  handleUserTranscription(text);
}

// -------------------------------------------------------------
// Live Message Dispatcher & Tool Call Handling
// -------------------------------------------------------------
function handleLiveMessage(data) {
  try {
    const event = JSON.parse(data);

    // 1. Audio data
    if (event.audio && event.audio.data) {
      audioManager.playAudioChunk(
        event.audio.data,
        event.audio.mimeType || event.audio.mime_type
      );
    }

    // 2. Transcripts
    if (event.userTranscription && event.userTranscription.text) {
      handleUserTranscription(event.userTranscription.text);
    }
    if (event.agentTranscription && event.agentTranscription.text) {
      handleAgentTranscription(event.agentTranscription.text);
    }

    // 3. ADK Content Parts
    const parts = extractContentParts(event);
    for (const part of parts) {
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData && inlineData.data) {
        audioManager.playAudioChunk(
          inlineData.data,
          inlineData.mimeType || inlineData.mime_type
        );
      }

      if (part.text) {
        handleAgentTranscription(part.text);
      }

      const fnCall = part.functionCall || part.function_call;
      if (fnCall) {
        renderToolCall(fnCall);
      }

      const fnResp = part.functionResponse || part.function_response;
      if (fnResp) {
        renderToolResponse(fnResp);
      }
    }

    // 4. Turn Complete
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
    console.error("Error parsing live event:", err, data);
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

// -------------------------------------------------------------
// Feed Rendering
// -------------------------------------------------------------
function handleUserTranscription(text) {
  if (!currentUserBubble) {
    currentUserBubble = createMessageBubble("user", currentUser.name);
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
  
  const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  bubble.innerHTML = `
    <div class="msg-header">
      <div class="msg-sender-wrap">
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
    bubble.style.borderColor = "var(--accent-alert-border)";
    bubble.style.color = "var(--accent-alert)";
  }
  bubble.innerHTML = `
    <div class="msg-header">
      <div class="msg-sender-wrap">
        <span class="msg-sender">SYSTEM</span>
      </div>
      <span class="msg-time">${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
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
        <span>Executing Action</span>
      </div>
      <span class="tool-name">${call.name}</span>
    </div>
    <div style="font-size: 0.76rem; color: var(--text-muted); font-family: var(--font-mono); word-break: break-all;">
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

  // 1. REFUND & REPLACEMENT ACTION (DECISIVE REDRESSAL)
  if (resp.name === "issue_order_refund_or_replacement" || respData.refund_id) {
    card.className = "tool-card refund-card-feed";
    contentHtml = `
      <div class="refund-card-header">
        <div class="refund-badge-pill">
          <span>Refund Authorized &amp; Settled</span>
        </div>
        <span class="refund-amt-highlight">${respData.refund_amount || "$499.00"}</span>
      </div>
      <div class="order-detail-grid">
        <div class="order-detail-item"><strong>Refund Ref ID</strong><span style="font-family: var(--font-mono);">${respData.refund_id}</span></div>
        <div class="order-detail-item"><strong>Order ID</strong><span>${respData.order_id}</span></div>
        <div class="order-detail-item"><strong>Product</strong><span>${respData.product_name || "Height Adjustable Desk"}</span></div>
        <div class="order-detail-item"><strong>Payment Ref</strong><span style="font-size: 0.74rem;">${respData.original_payment_id || "Captured Card"}</span></div>
        <div class="order-detail-item" style="grid-column: 1 / -1;">
          <strong>Resolution Notice</strong>
          <p style="margin-top: 4px; color: var(--text-primary); font-size: 0.8rem; line-height: 1.45;">${respData.message}</p>
        </div>
      </div>
    `;

    // Live update orders list in background
    fetchUserOrders();
  }
  // 2. ORDER LOOKUP
  else if (respData.results && Array.isArray(respData.results)) {
    const orders = respData.results;
    contentHtml = orders.map((o) => `
      <div class="order-detail-grid">
        <div class="order-detail-item"><strong>Order ID</strong><span>${o.order_id}</span></div>
        <div class="order-detail-item"><strong>Customer</strong><span>${o.customer_name}</span></div>
        <div class="order-detail-item"><strong>Product</strong><span>${o.product_name}</span></div>
        <div class="order-detail-item"><strong>Serial No</strong><span style="font-family: var(--font-mono);">${o.serial_number}</span></div>
        <div class="order-detail-item">
          <strong>Status</strong>
          <span class="status-badge-inline ${String(o.status || 'delivered').toLowerCase()}">${o.status || 'Active'}</span>
        </div>
        <div class="order-detail-item"><strong>Warranty</strong><span style="color: var(--accent-success);">${o.warranty_status || 'Active'}</span></div>
      </div>
    `).join("");
  }
  // 3. TECHNICIAN ESCALATION
  else if (resp.name === "escalate_to_human_technician" || respData.ticket_id) {
    contentHtml = `
      <div style="padding: 4px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <strong style="font-size: 0.85rem;">Technician Dispatch Scheduled</strong>
          <span style="font-family: var(--font-mono); font-size: 0.8rem;">${respData.ticket_id}</span>
        </div>
        <p style="font-size: 0.8rem; color: var(--text-secondary); line-height: 1.4;">${respData.message}</p>
      </div>
    `;
  }
  // 4. KNOWLEDGE SEARCH OR COMPONENT INSTRUCTIONS
  else if (respData.step_by_step_guide || respData.actionable_steps) {
    const steps = respData.step_by_step_guide || respData.actionable_steps || [];
    contentHtml = `
      <div style="font-size: 0.82rem; color: var(--text-primary);">
        <strong>${respData.component_name || 'Component'} Guide:</strong>
        <ol style="margin: 6px 0 0 16px; padding: 0; color: var(--text-secondary);">
          ${steps.map((s) => `<li style="margin-bottom: 3px;">${s}</li>`).join("")}
        </ol>
      </div>
    `;
  } else {
    contentHtml = `<pre style="font-size: 0.74rem; color: var(--text-secondary); overflow-x: auto; background: var(--bg-surface-subtle); padding: 8px; border: 1px solid var(--border-subtle);">${JSON.stringify(respData, null, 2)}</pre>`;
  }

  card.innerHTML = `
    <div class="tool-header">
      <div class="tool-badge-pill">
        <span>Tool Response</span>
      </div>
      <span class="tool-name">${resp.name || 'action'}</span>
    </div>
    ${contentHtml}
  `;
  feedContent.appendChild(card);
  notifyFeedActivity();
  scrollFeedToBottom();
}

function notifyFeedActivity() {
  if (activeMobileTab !== "feed" && tabFeedBadge) {
    tabFeedBadge.style.display = "inline-block";
  }
}

function scrollFeedToBottom() {
  if (feedContent) {
    feedContent.scrollTop = feedContent.scrollHeight;
  }
}

// -------------------------------------------------------------
// Visual Inspection / Camera
// -------------------------------------------------------------
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
      if (studioActiveDot) studioActiveDot.style.display = "inline-block";
      addSystemMessage("Camera enabled. Gemini Live is now inspecting visual desk frames.");
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
    if (studioActiveDot) studioActiveDot.style.display = "none";
    addSystemMessage("Camera disabled.");
  }
}

// -------------------------------------------------------------
// UI State Helpers
// -------------------------------------------------------------
function setConnectingState(isConnecting) {
  if (btnConnect) btnConnect.disabled = isConnecting;
  if (connectSpinner) connectSpinner.style.display = isConnecting ? "inline-block" : "none";
  if (btnConnectIcon) btnConnectIcon.style.display = isConnecting ? "none" : "block";
  if (btnConnectText) btnConnectText.textContent = isConnecting ? "Connecting..." : isConnected ? "End Live Session" : "Start Live Session";
}

function setConnectedState(connected) {
  if (connectionBadge) {
    connectionBadge.className = `status-badge ${connected ? "connected" : "disconnected"}`;
  }
  if (statusText) {
    statusText.textContent = connected ? "Live Active" : "Offline";
  }
  if (btnConnect) {
    btnConnect.className = `btn btn-large ${connected ? "btn-danger" : "btn-primary"}`;
  }
  if (btnConnectText) {
    btnConnectText.textContent = connected ? "End Live Session" : "Start Live Session";
  }
  if (btnConnectIcon) {
    btnConnectIcon.innerHTML = connected
      ? '<rect x="6" y="6" width="12" height="12" rx="2"></rect>'
      : '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  }
  if (btnToggleMic) btnToggleMic.disabled = !connected;
  if (btnToggleCamera) btnToggleCamera.disabled = !connected;
  if (btnInterrupt) btnInterrupt.disabled = !connected;
  if (textInput) textInput.disabled = !connected;
  if (btnSendText) btnSendText.disabled = !connected;

  if (liveActivityPill) {
    liveActivityPill.textContent = connected ? "Listening" : "Ready";
  }
}

// -------------------------------------------------------------
// Waveform Visualizer
// -------------------------------------------------------------
function startVisualizerLoop() {
  if (!visualizerCanvas || !visualizerCtx) return;

  function render() {
    visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    const width = visualizerCanvas.width;
    const height = visualizerCanvas.height;

    const bars = 32;
    const barWidth = width / bars;

    for (let i = 0; i < bars; i++) {
      const freq = Math.sin(Date.now() * 0.005 + i * 0.3) * 0.5 + 0.5;
      const barHeight = Math.max(4, freq * height * Math.max(0.2, currentVolume * 2));

      const grad = visualizerCtx.createLinearGradient(0, height - barHeight, 0, height);
      grad.addColorStop(0, "#00f0ff");
      grad.addColorStop(1, "#0284c7");

      visualizerCtx.fillStyle = grad;
      visualizerCtx.fillRect(i * barWidth + 2, height - barHeight, barWidth - 3, barHeight);
    }

    idleAnimationId = requestAnimationFrame(render);
  }

  render();
}

function stopVisualizerLoop() {
  if (idleAnimationId) {
    cancelAnimationFrame(idleAnimationId);
    idleAnimationId = null;
  }
  if (visualizerCtx && visualizerCanvas) {
    visualizerCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
  }
  if (volumeBarFill) volumeBarFill.style.width = "0%";
}

// -------------------------------------------------------------
// Event Listeners & Initialization
// -------------------------------------------------------------
document.addEventListener("DOMContentLoaded", () => {
  updateUserUi();
  fetchUserOrders();

  // Navigation Tabs
  navBtnStore.addEventListener("click", () => switchView("store"));
  navBtnOrders.addEventListener("click", () => switchView("orders"));
  navBtnConcierge.addEventListener("click", () => switchView("concierge"));

  // User Auth Dropdown Toggle
  userAuthPill.addEventListener("click", (e) => {
    e.stopPropagation();
    userDropdownMenu.style.display = userDropdownMenu.style.display === "none" ? "block" : "none";
  });

  document.addEventListener("click", () => {
    if (userDropdownMenu) userDropdownMenu.style.display = "none";
  });

  document.querySelectorAll(".dropdown-item").forEach((btn) => {
    btn.addEventListener("click", () => switchUser(btn.dataset.uid));
  });

  // Storefront Gallery
  galleryThumbs.forEach((btn) => {
    btn.addEventListener("click", () => {
      galleryThumbs.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (galleryMainImg && btn.dataset.src) {
        galleryMainImg.src = btn.dataset.src;
      }
    });
  });

  // Checkout Actions
  btnOpenCheckout.addEventListener("click", openCheckoutModal);
  btnCloseCheckout.addEventListener("click", closeCheckoutModal);
  checkoutPaymentForm.addEventListener("submit", handleCheckoutSubmit);

  btnSuccessViewOrders.addEventListener("click", () => {
    closeCheckoutModal();
    switchView("orders");
  });

  btnSuccessLaunchSupport.addEventListener("click", () => {
    closeCheckoutModal();
    if (currentOrders.length > 0) {
      startSupportForOrder(currentOrders[0]);
    } else {
      switchView("concierge");
    }
  });

  // Ask Concierge about Desk from storefront
  btnAskConciergeAboutDesk.addEventListener("click", () => {
    switchView("concierge");
    if (!isConnected) connectLiveSession();
    setTimeout(() => {
      sendTextMessage("Tell me about the JIN OFFICE Electric Sit-Stand Desk, its dual motor specs, and how the anti-collision system works.");
    }, 1000);
  });

  // Orders View
  btnRefreshOrders.addEventListener("click", fetchUserOrders);
  if (btnEmptyGoToStore) {
    btnEmptyGoToStore.addEventListener("click", () => switchView("store"));
  }

  // Clear Order Context Banner
  if (btnClearOrderContext) {
    btnClearOrderContext.addEventListener("click", () => {
      activeOrderContext = null;
      if (orderContextBanner) orderContextBanner.style.display = "none";
      addSystemMessage("Order context disconnected from Live session.");
    });
  }

  // Ticket Modal
  btnCloseTicket.addEventListener("click", closeTicketModal);
  supportTicketForm.addEventListener("submit", handleTicketSubmit);

  // Live Concierge Controls
  btnConnect.addEventListener("click", connectLiveSession);
  btnToggleCameraPrompt.addEventListener("click", () => toggleCamera(true));
  btnToggleCamera.addEventListener("click", () => toggleCamera());

  btnToggleMic.addEventListener("click", () => {
    isMicMuted = !isMicMuted;
    audioManager.setMute(isMicMuted);
    btnToggleMic.classList.toggle("active", isMicMuted);
    addSystemMessage(isMicMuted ? "Microphone muted." : "Microphone unmuted.");
  });

  btnInterrupt.addEventListener("click", () => {
    audioManager.interruptPlayback();
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "activity_start" }));
    }
    addSystemMessage("Interrupted concierge speech.");
  });

  btnSendText.addEventListener("click", () => {
    const val = textInput.value.trim();
    if (val) {
      sendTextMessage(val);
      textInput.value = "";
    }
  });

  textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const val = textInput.value.trim();
      if (val) {
        sendTextMessage(val);
        textInput.value = "";
      }
    }
  });

  btnClearFeed.addEventListener("click", () => {
    feedContent.innerHTML = "";
    addSystemMessage("Feed cleared.");
  });

  // Mobile Tabs
  if (tabBtnFeed && tabBtnStudio) {
    tabBtnFeed.addEventListener("click", () => {
      tabBtnFeed.classList.add("active");
      tabBtnStudio.classList.remove("active");
      panelFeed.classList.add("active");
      panelStudio.classList.remove("active");
      activeMobileTab = "feed";
      if (tabFeedBadge) tabFeedBadge.style.display = "none";
    });

    tabBtnStudio.addEventListener("click", () => {
      tabBtnStudio.classList.add("active");
      tabBtnFeed.classList.remove("active");
      panelStudio.classList.add("active");
      panelFeed.classList.remove("active");
      activeMobileTab = "studio";
    });
  }

  // Quick Inquiries Chips
  if (quickChipsScroll) {
    quickChipsScroll.addEventListener("click", (e) => {
      const chip = e.target.closest(".chip");
      if (chip && chip.dataset.prompt) {
        const prompt = chip.dataset.prompt;
        if (!isConnected) {
          connectLiveSession().then(() => {
            setTimeout(() => sendTextMessage(prompt), 800);
          });
        } else {
          sendTextMessage(prompt);
        }
      }
    });
  }
});
