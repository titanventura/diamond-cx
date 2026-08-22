/**
 * Camera and Video Stream Manager for Gemini Live Multimodal interaction.
 * Captures real-time camera frames at 1-2 FPS and converts to JPEG payloads for the WebSocket.
 */

export class CameraManager {
  constructor({ onFrame, fps = 1, quality = 0.7 }) {
    this.onFrame = onFrame;       // Callback receiving { type: 'image', data: base64, mimeType: 'image/jpeg' }
    this.fps = fps;               // Frames per second (recommended 1-2 FPS for Live API)
    this.quality = quality;       // JPEG quality (0.6 - 0.8)
    this.videoElement = null;
    this.stream = null;
    this.canvas = null;
    this.ctx = null;
    this.intervalId = null;
    this.isActive = false;
  }

  async start(videoElement) {
    this.videoElement = videoElement;

    // Request camera stream (640x480 resolution is ideal for fast real-time multimodal inference)
    this.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: "user",
      },
    });

    this.videoElement.srcObject = this.stream;
    await this.videoElement.play();

    // Setup offscreen snapshot canvas
    this.canvas = document.createElement("canvas");
    this.canvas.width = 640;
    this.canvas.height = 480;
    this.ctx = this.canvas.getContext("2d");

    this.isActive = true;
    this._startCaptureLoop();
  }

  _startCaptureLoop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const intervalMs = Math.max(500, Math.floor(1000 / this.fps));

    this.intervalId = setInterval(() => {
      if (!this.isActive || !this.videoElement || !this.ctx) return;
      if (this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return;

      // Draw current video frame to canvas
      const width = this.canvas.width;
      const height = this.canvas.height;
      this.ctx.drawImage(this.videoElement, 0, 0, width, height);

      // Convert to JPEG data URL
      const dataUrl = this.canvas.toDataURL("image/jpeg", this.quality);

      if (this.onFrame) {
        this.onFrame({
          type: "image",
          data: dataUrl,
          mimeType: "image/jpeg",
        });
      }
    }, intervalMs);
  }

  setFps(fps) {
    this.fps = fps;
    if (this.isActive) {
      this._startCaptureLoop();
    }
  }

  stop() {
    this.isActive = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
    }
    this.canvas = null;
    this.ctx = null;
  }
}
