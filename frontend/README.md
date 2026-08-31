# Diamond CX Frontend (shadcn/ui + React + Vite)

A modern, luxury, and highly responsive real-time client for Google ADK Gemini Live 3.1 Multimodal Interaction (Audio, Video, Text, and Tool Execution) built with **React, Vite, Tailwind CSS, Lucide Icons, and shadcn/ui**.

## Features

- **shadcn/ui Design System**: Dark/Light mode theme toggle, standard HSL design tokens, Radix UI accessible primitives, and rich micro-interactions.
- **High Responsiveness**: Adaptive layouts optimized for mobile (bottom navigation bar, compact headers, touch controls), tablet, and desktop (multi-column dashboard).
- **Bidirectional Live Audio Streaming**: Real-time 16kHz 16-bit PCM microphone capture and smooth 24kHz PCM audio playback powered by Web Audio API `AudioWorklet`.
- **Live Video Streaming**: Real-time camera snapshot streamer (1 FPS JPEG) with device switching (front/back cameras).
- **Decisive Redressal & Tool Execution**: Rich UI cards for refund authorization receipts (`issue_order_refund_or_replacement`), order lookups (`lookup_order_or_serial`), technician dispatches (`escalate_to_human_technician`), and component step guides.
- **Storefront & Test Checkout**: Interactive desk showcase with multi-angle gallery, specifications table, and sandbox checkout dialog with Firestore order registration.
- **Orders Hub & Warranty Management**: Complete order history with 1-click **Live Concierge Support** context injection and support ticket raising.

---

## Directory Structure

```
frontend/
├── dist/                              # Production build output
├── public/
│   └── audio/
│       ├── pcm-player-processor.js    # 24kHz PCM circular buffer AudioWorklet
│       └── pcm-recorder-processor.js  # 16kHz PCM downsampler AudioWorklet
├── src/
│   ├── components/
│   │   ├── concierge/                 # Live studio, camera, visualizer, chat feed
│   │   ├── layout/                    # Responsive Navbar & MobileNav bottom bar
│   │   ├── modals/                    # CheckoutModal & TicketModal dialogs
│   │   ├── orders/                    # Order cards & warranty grid
│   │   ├── store/                     # Storefront & interactive desk showcase
│   │   └── ui/                        # Reusable shadcn/ui components
│   ├── context/                       # AppContext (user, orders, active view, theme)
│   ├── lib/                           # Audio/Camera managers, API client, utils
│   ├── types/                         # TypeScript interfaces
│   ├── App.tsx                        # Root application layout
│   ├── index.css                      # Tailwind & shadcn theme tokens
│   └── main.tsx                       # Entrypoint
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Running the Frontend

### Development Mode (Vite)
```bash
cd frontend
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build
```bash
cd frontend
npm run build
```
FastAPI automatically serves the built static files at [http://localhost:8000/app/](http://localhost:8000/app/).
