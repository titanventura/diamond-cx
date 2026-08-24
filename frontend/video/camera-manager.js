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
    this.facingMode = "user";     // 'user' (front) or 'environment' (back)
    this.currentDeviceId = null;
    this.availableDevices = [];
  }

  async getAvailableCameras() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter((d) => d.kind === "videoinput");
      return this.availableDevices;
    } catch (err) {
      console.warn("Could not enumerate camera devices:", err);
      return [];
    }
  }

  async start(videoElement, preferredDeviceId = null) {
    this.videoElement = videoElement;
    if (preferredDeviceId) {
      this.currentDeviceId = preferredDeviceId;
    }

    await this._startStream();

    // Setup offscreen snapshot canvas
    if (!this.canvas) {
      this.canvas = document.createElement("canvas");
      this.canvas.width = 640;
      this.canvas.height = 480;
      this.ctx = this.canvas.getContext("2d");
    }

    this.isActive = true;
    this._startCaptureLoop();
    await this.getAvailableCameras();
  }

  async _startStream() {
    // Stop existing tracks if any
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    let videoConstraints = {
      width: { ideal: 640 },
      height: { ideal: 480 },
    };

    if (this.currentDeviceId) {
      videoConstraints.deviceId = { exact: this.currentDeviceId };
    } else {
      videoConstraints.facingMode = this.facingMode;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
      });
    } catch (err) {
      console.warn("Primary constraint failed, falling back to standard video request:", err);
      // Fallback without exact deviceId
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
      });
    }

    // Identify the active device ID
    const activeTrack = this.stream.getVideoTracks()[0];
    if (activeTrack) {
      const settings = activeTrack.getSettings();
      if (settings.deviceId) {
        this.currentDeviceId = settings.deviceId;
      }
      if (settings.facingMode) {
        this.facingMode = settings.facingMode;
      }
    }

    this.videoElement.srcObject = this.stream;
    await this.videoElement.play();
  }

  async switchCamera() {
    if (!this.isActive) return false;

    await this.getAvailableCameras();

    if (this.availableDevices.length > 1) {
      // Multiple devices detected: cycle to the next camera
      const currentIndex = this.availableDevices.findIndex(
        (d) => d.deviceId === this.currentDeviceId
      );
      const nextIndex = (currentIndex + 1) % this.availableDevices.length;
      this.currentDeviceId = this.availableDevices[nextIndex].deviceId;
    } else {
      // Toggle facingMode between front ('user') and back ('environment')
      this.facingMode = this.facingMode === "user" ? "environment" : "user";
      this.currentDeviceId = null;
    }

    await this._startStream();
    return true;
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

