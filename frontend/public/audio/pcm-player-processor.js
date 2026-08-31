/**
 * AudioWorklet Processor for smoothly streaming and playing incoming 24kHz PCM audio
 * using a high-capacity circular ring buffer.
 */

class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 24kHz x 180 seconds capacity
    this.bufferSize = 24000 * 180;
    this.buffer = new Float32Array(this.bufferSize);
    this.writeIndex = 0;
    this.readIndex = 0;

    this.port.onmessage = (event) => {
      if (
        event.data &&
        (event.data.command === "interrupt" ||
          event.data.command === "clear" ||
          event.data.command === "endOfAudio")
      ) {
        // Fast forward read pointer to clear ongoing audio buffer
        this.readIndex = this.writeIndex;
        return;
      }

      if (!event.data) return;

      const int16Samples = new Int16Array(event.data);
      for (let i = 0; i < int16Samples.length; i++) {
        this.buffer[this.writeIndex] = int16Samples[i] / 32768.0;
        this.writeIndex = (this.writeIndex + 1) % this.bufferSize;
        if (this.writeIndex === this.readIndex) {
          this.readIndex = (this.readIndex + 1) % this.bufferSize;
        }
      }
    };
  }

  process(inputs, outputs) {
    const output = outputs[0];
    if (!output || !output[0]) {
      return true;
    }

    const framesPerBlock = output[0].length;
    for (let frame = 0; frame < framesPerBlock; frame++) {
      const sample = this.buffer[this.readIndex];
      output[0][frame] = sample;
      if (output.length > 1) {
        output[1][frame] = sample;
      }
      if (this.readIndex !== this.writeIndex) {
        this.readIndex = (this.readIndex + 1) % this.bufferSize;
      }
    }

    return true;
  }
}

registerProcessor("pcm-player-processor", PCMPlayerProcessor);
