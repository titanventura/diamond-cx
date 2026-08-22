/**
 * Audio Manager for Gemini Live.
 * Handles microphone capture (16kHz 16-bit PCM) and streaming audio playback (24kHz PCM).
 */

export class AudioManager {
  constructor({ onAudioChunk, onMicVolume }) {
    this.onAudioChunk = onAudioChunk; // Callback receiving ArrayBuffer of 16kHz PCM
    this.onMicVolume = onMicVolume;   // Callback for visualizer volume meter

    this.recordContext = null;
    this.playContext = null;
    this.micStream = null;
    this.recorderNode = null;
    this.playerNode = null;
    this.analyser = null;
    this.isMuted = false;
    this.isRunning = false;
    this.animFrameId = null;
  }

  async initialize() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;

    // 1. Playback AudioContext (Gemini Live native audio output is 24,000 Hz PCM)
    if (!this.playContext || this.playContext.state === "closed") {
      try {
        this.playContext = new AudioContextClass({ sampleRate: 24000 });
      } catch (e) {
        console.warn("Falling back to default sampleRate for Playback AudioContext:", e);
        this.playContext = new AudioContextClass();
      }
      await this.playContext.audioWorklet.addModule("audio/pcm-player-processor.js?v=3");
      this.playerNode = new AudioWorkletNode(this.playContext, "pcm-player-processor");
      this.playerNode.connect(this.playContext.destination);
    }

    // 2. Recording AudioContext (default sample rate, downsampled to 16kHz in worklet)
    if (!this.recordContext || this.recordContext.state === "closed") {
      this.recordContext = new AudioContextClass();
      await this.recordContext.audioWorklet.addModule("audio/pcm-recorder-processor.js?v=3");
    }
  }

  async startMicrophone() {
    await this.initialize();

    if (this.playContext && this.playContext.state === "suspended") {
      await this.playContext.resume();
    }
    if (this.recordContext && this.recordContext.state === "suspended") {
      await this.recordContext.resume();
    }

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    const micSource = this.recordContext.createMediaStreamSource(this.micStream);

    // Visualizer Analyser
    this.analyser = this.recordContext.createAnalyser();
    this.analyser.fftSize = 256;
    micSource.connect(this.analyser);

    // Recorder Node
    this.recorderNode = new AudioWorkletNode(this.recordContext, "pcm-recorder-processor");
    this.recorderNode.port.onmessage = (event) => {
      if (!this.isMuted && this.isRunning && this.onAudioChunk) {
        this.onAudioChunk(event.data);
      }
    };

    micSource.connect(this.recorderNode);
    this.isRunning = true;
    this._startVolumeMeter();
  }

  _startVolumeMeter() {
    if (!this.analyser) return;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

    const checkVolume = () => {
      if (!this.isRunning) return;
      this.analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalized = Math.min(1, average / 128);
      if (this.onMicVolume) {
        this.onMicVolume(this.isMuted ? 0 : normalized);
      }
      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    checkVolume();
  }

  /**
   * Enqueue raw base64 PCM audio chunk from Gemini Live for smooth playback.
   */
  playAudioChunk(base64Data, mimeType = "audio/pcm;rate=24000") {
    if (!this.playerNode || !this.playContext) return;

    if (this.playContext.state === "suspended") {
      this.playContext.resume();
    }

    try {
      // Standardize base64 and decode to raw byte array
      let std = base64Data.replace(/-/g, "+").replace(/_/g, "/");
      while (std.length % 4) std += "=";
      const binaryString = window.atob(std);
      
      const len = binaryString.length;
      const sampleCount = Math.floor(len / 2);
      if (sampleCount === 0) return;

      const bytes = new Uint8Array(sampleCount * 2);
      for (let i = 0; i < sampleCount * 2; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Transfer raw Int16 ArrayBuffer to the processor ring buffer
      this.playerNode.port.postMessage(bytes.buffer, [bytes.buffer]);
    } catch (err) {
      console.error("Error decoding and playing audio chunk:", err);
    }
  }

  /**
   * Interrupt ongoing audio playback immediately (called when customer speaks or interrupt event occurs).
   */
  interruptPlayback() {
    if (this.playerNode) {
      this.playerNode.port.postMessage({ command: "interrupt" });
    }
  }

  setMute(muted) {
    this.isMuted = muted;
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  stop() {
    this.isRunning = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.recordContext && this.recordContext.state !== "closed") {
      this.recordContext.close();
      this.recordContext = null;
    }
    if (this.playContext && this.playContext.state !== "closed") {
      this.playContext.close();
      this.playContext = null;
    }
    this.recorderNode = null;
    this.playerNode = null;
  }
}
