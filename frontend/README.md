# Diamond CX Live Frontend

A real-time, luxury client for Google ADK Gemini Live Multimodal interaction (Audio, Video, Text, and Tool Execution).

## Features

- **Bidirectional Live Audio Streaming**: Real-time 16kHz 16-bit PCM microphone capture and smooth 24kHz PCM audio playback powered by Web Audio API `AudioWorklet`.
- **Live Video Streaming**: Real-time camera capture streamed at 1 FPS JPEG frames to Gemini Live for instant visual object recognition and jewelry inspection.
- **Interactive Tool Execution**: Rich UI cards for order lookups (`lookup_order_or_serial`) and product specifications (`query_product_knowledge`).
- **Live Speech Transcription**: Real-time visual transcript for both customer speech and Gemini Live concierge voice.
- **Interruption Support**: Instant model speech cancellation when the customer speaks or presses the interrupt button.
- **Luxury Diamond Aesthetic**: Premium dark slate glassmorphism with glowing cyan diamond accents, real-time waveform visualizer, and responsive controls.

---

## Directory Structure

```
frontend/
├── index.html                     # Primary HTML5 application layout
├── style.css                      # Luxury glassmorphism & responsive stylesheet
├── app.js                         # Application coordinator & WebSocket manager
├── README.md                      # Documentation
├── audio/
│   ├── audio-manager.js           # Web Audio API and visualizer controller
│   ├── pcm-recorder-processor.js  # 16kHz 16-bit PCM downsampler AudioWorklet
│   └── pcm-player-processor.js    # Streaming PCM player AudioWorklet
└── video/
    └── camera-manager.js          # Canvas-based webcam snapshot streamer
```

---

## Running the Frontend

Ensure the backend server is running at `http://localhost:8000`.

Start a static HTTP server from the `frontend/` directory:

```bash
cd frontend
python3 -m http.server 3000
```

Open your browser at [http://localhost:3000](http://localhost:3000).

---

## Browser Requirements

- Supports modern Chrome, Edge, Safari, or Firefox with Web Audio API and `AudioWorklet` support.
- Microphone and Camera permissions must be granted when prompted.
