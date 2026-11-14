/* Auryx Nexavória — supressão de ruído com IA (RNNoise) num AudioWorklet.
   Roda numa thread de áudio separada: não trava a interface.
   RNNoise processa quadros de 480 amostras (10 ms a 48 kHz) e também
   devolve a chance de ter voz no quadro, que usamos como "portão" inteligente. */
import createRNNWasmModule from "./vendor/rnnoise/rnnoise.js";

const FRAME = 480;

class NexoraNoise extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    this.gate = o.gate !== false;
    this.ready = false;
    this.inBuf = new Float32Array(FRAME);
    this.inLen = 0;
    this.out = new Float32Array(FRAME * 8);
    // começa com 1 quadro de silêncio de folga: evita "estalos" (atraso total ~20 ms)
    this.outRead = 0;
    this.outWrite = FRAME;
    this.outCount = FRAME;
    this.gain = 1;
    this.hold = 0;
    this.port.onmessage = e => { if (e.data && "gate" in e.data) this.gate = !!e.data.gate; };
    createRNNWasmModule({ wasmBinary: o.wasm }).then(m => {
      this.m = m;
      this.state = m._rnnoise_create();
      this.pIn = m._malloc(FRAME * 4);
      this.pOut = m._malloc(FRAME * 4);
      this.ready = true;
      this.port.postMessage({ ready: true });
    }).catch(err => this.port.postMessage({ error: String(err) }));
  }
  frame() {
    const m = this.m, heap = m.HEAPF32, i0 = this.pIn >> 2, o0 = this.pOut >> 2;
    for (let i = 0; i < FRAME; i++) heap[i0 + i] = this.inBuf[i] * 32768;
    const vad = m._rnnoise_process_frame(this.state, this.pOut, this.pIn);
    // portão: só fecha quando a IA tem certeza de que não é voz (com segurinha de 250 ms)
    if (vad > 0.6) this.hold = 25;
    else if (this.hold > 0) this.hold--;
    const target = !this.gate || this.hold > 0 ? 1 : vad > 0.25 ? 0.6 : 0.03;
    for (let i = 0; i < FRAME; i++) {
      this.gain += (target - this.gain) * (target > this.gain ? 0.02 : 0.0025);
      this.out[this.outWrite] = (heap[o0 + i] / 32768) * this.gain;
      this.outWrite = (this.outWrite + 1) % this.out.length;
    }
    this.outCount += FRAME;
  }
  process(inputs, outputs) {
    const input = inputs[0] && inputs[0][0], output = outputs[0] && outputs[0][0];
    if (!output) return true;
    if (!input) { output.fill(0); return true; }
    if (!this.ready) { output.set(input); return true; }
    for (let i = 0; i < input.length; i++) {
      this.inBuf[this.inLen++] = input[i];
      if (this.inLen === FRAME) { this.frame(); this.inLen = 0; }
    }
    for (let i = 0; i < output.length; i++) {
      if (this.outCount > 0) {
        output[i] = this.out[this.outRead];
        this.outRead = (this.outRead + 1) % this.out.length;
        this.outCount--;
      } else output[i] = 0;
    }
    for (let c = 1; c < outputs[0].length; c++) outputs[0][c].set(output);
    return true;
  }
}
registerProcessor("nexora-noise", NexoraNoise);
