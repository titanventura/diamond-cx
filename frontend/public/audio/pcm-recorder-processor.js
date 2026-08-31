/**
 * AudioWorklet Processor for recording and downsampling microphone audio to 16kHz 16-bit PCM.
 */

class PCMRecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetSampleRate = 16000;
    this.buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) {
      return true;
    }

    const inputChannel = input[0]; // Mono input
    const inputSampleRate = sampleRate; // Global AudioWorklet sampleRate

    if (inputSampleRate === this.targetSampleRate) {
      // Direct conversion to 16-bit PCM
      const pcm16 = new Int16Array(inputChannel.length);
      for (let i = 0; i < inputChannel.length; i++) {
        const s = Math.max(-1, Math.min(1, inputChannel[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    } else {
      // Linear resampling down to 16kHz
      const ratio = inputSampleRate / this.targetSampleRate;
      const newLength = Math.floor(inputChannel.length / ratio);
      const pcm16 = new Int16Array(newLength);

      for (let i = 0; i < newLength; i++) {
        const srcIndex = i * ratio;
        const indexLow = Math.floor(srcIndex);
        const indexHigh = Math.min(indexLow + 1, inputChannel.length - 1);
        const fraction = srcIndex - indexLow;

        // Linear interpolation
        const sample =
          inputChannel[indexLow] * (1 - fraction) + inputChannel[indexHigh] * fraction;

        const s = Math.max(-1, Math.min(1, sample));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }

      this.port.postMessage(pcm16.buffer, [pcm16.buffer]);
    }

    return true;
  }
}

registerProcessor("pcm-recorder-processor", PCMRecorderProcessor);
