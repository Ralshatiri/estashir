import type { DemoState } from './types';
import { aiMessage, patientMessage } from './helpers';
import { createVoiceSession } from './agentClient';

export type VoiceStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'error' | 'ended';
interface Options {
  getState: () => DemoState;
  update: (patch: Partial<DemoState>) => void;
  onStatus: (status: VoiceStatus, message?: string) => void;
  onTranscript: (patient: string, assistant: string) => void;
}

/** Audio transport only. Gemini Live performs speech understanding and generation. */
export class LiveVoiceAgent {
  private socket: WebSocket | null = null;
  private stream: MediaStream | null = null;
  private inputContext: AudioContext | null = null;
  private outputContext: AudioContext | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private worklet: AudioWorkletNode | null = null;
  private workletUrl: string | null = null;
  private playback = new Set<AudioBufferSourceNode>();
  private nextPlaybackTime = 0;
  private stopped = false;
  private ready = false;
  private failed = false;
  private patientTranscript = '';
  private assistantTranscript = '';
  private pendingPatch: Partial<DemoState> | null = null;
  private finishTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly options: Options) {}

  async start(): Promise<void> {
    this.options.onStatus('connecting');
    // Created from the user's start-call click, before any network awaits.
    this.outputContext = new AudioContext({ sampleRate: 24000 });
    await this.outputContext.resume();
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (this.stopped) { this.release(); return; }
    this.inputContext = new AudioContext({ sampleRate: 16000 });
    await this.inputContext.resume();
    if (this.inputContext.sampleRate !== 16000) throw new Error('المتصفح لا يدعم معدل تسجيل الصوت المطلوب.');
    const sessionId = await createVoiceSession();
    if (this.stopped) return;
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/api/live`);
    this.socket = socket;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('انتهت مهلة الاتصال الصوتي بالخادم.')), 15000);
      socket.onopen = () => { clearTimeout(timeout); socket.send(JSON.stringify({ session_id: sessionId })); resolve(); };
      socket.onerror = () => { clearTimeout(timeout); reject(new Error('تعذّر فتح الاتصال الصوتي بالخادم.')); };
      socket.onclose = () => { clearTimeout(timeout); reject(new Error('أُغلق الاتصال قبل بدء المكالمة.')); };
      socket.onmessage = (event) => this.handleMessage(event.data);
    });
    if (this.stopped) return;
    socket.onerror = () => this.fail('تعذّر الاتصال الصوتي. تحقق من تشغيل الخلفية.');
    socket.onclose = () => {
      if (this.stopped) return;
      this.flushTranscripts();
      this.stopped = true;
      this.release();
      if (!this.failed) this.options.onStatus('ended', 'انتهى الاتصال. يمكنك بدء مكالمة جديدة.');
    };
    await this.startMicrophone();
  }

  private async startMicrophone(): Promise<void> {
    if (!this.inputContext || !this.stream) return;
    const processor = `class PcmMicrophone extends AudioWorkletProcessor {
      constructor() { super(); this.samples = new Float32Array(640); this.offset = 0; }
      process(inputs, outputs) {
        const input = inputs[0]?.[0];
        if (input) for (const sample of input) {
          this.samples[this.offset++] = sample;
          if (this.offset === 640) {
            const buffer = new ArrayBuffer(1280);
            const view = new DataView(buffer);
            for (let i = 0; i < 640; i++) {
              const v = Math.max(-1, Math.min(1, this.samples[i]));
              view.setInt16(i * 2, v < 0 ? v * 32768 : v * 32767, true);
            }
            this.port.postMessage(buffer, [buffer]); this.offset = 0;
          }
        }
        for (const output of outputs) for (const channel of output) channel.fill(0);
        return true;
      }
    }
    registerProcessor('pcm-microphone', PcmMicrophone);`;
    this.workletUrl = URL.createObjectURL(new Blob([processor], { type: 'application/javascript' }));
    await this.inputContext.audioWorklet.addModule(this.workletUrl);
    if (this.stopped) return;
    this.source = this.inputContext.createMediaStreamSource(this.stream);
    this.worklet = new AudioWorkletNode(this.inputContext, 'pcm-microphone');
    this.worklet.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
      if (!this.ready || this.socket?.readyState !== WebSocket.OPEN) return;
      if (this.socket.bufferedAmount > 256000) { this.fail('الاتصال بطيء. أعد بدء المكالمة.'); return; }
      this.socket.send(event.data);
    };
    this.source.connect(this.worklet);
    this.worklet.connect(this.inputContext.destination);
  }

  private handleMessage(raw: string): void {
    if (this.stopped) return;
    try {
      const message = JSON.parse(raw);
      if (message.type === 'ready') { this.ready = true; this.options.onStatus('listening'); }
      if (message.type === 'error') { this.fail(message.message); return; }
      if (message.type === 'audio') {
        this.clearFinishTimer();
        this.playAudio(message.data, message.mime_type);
        this.options.onStatus('speaking');
      }
      if (message.type === 'input_transcript') this.patientTranscript += message.text;
      if (message.type === 'output_transcript') this.assistantTranscript += message.text;
      if (message.type.endsWith('_transcript')) {
        this.options.onTranscript(this.patientTranscript, this.assistantTranscript);
      }
      if (message.type === 'interrupted') {
        this.clearPlayback();
        this.pendingPatch = null;
        this.flushTranscripts();
        this.options.onStatus('listening');
      }
      if (message.type === 'state') this.pendingPatch = message.patch;
      if (message.type === 'turn_complete') {
        this.flushTranscripts();
        if (message.idle) {
          this.clearFinishTimer();
          const delay = Math.max(0, this.nextPlaybackTime - (this.outputContext?.currentTime || 0)) * 1000;
          this.finishTimer = setTimeout(() => {
            if (this.stopped) return;
            this.options.onStatus('listening');
            if (this.pendingPatch) { this.options.update(this.pendingPatch); this.pendingPatch = null; }
          }, delay + 80);
        }
      }
    } catch { this.fail('وصلت استجابة صوتية غير صالحة.'); }
  }

  private playAudio(base64: string, mimeType: string): void {
    if (!this.outputContext) return;
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const view = new DataView(bytes.buffer);
    const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000);
    const buffer = this.outputContext.createBuffer(1, Math.floor(bytes.length / 2), rate);
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < channel.length; i++) channel[i] = view.getInt16(i * 2, true) / 32768;
    const source = this.outputContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.outputContext.destination);
    const start = Math.max(this.nextPlaybackTime, this.outputContext.currentTime);
    source.start(start);
    this.nextPlaybackTime = start + buffer.duration;
    this.playback.add(source);
    source.onended = () => this.playback.delete(source);
  }

  private flushTranscripts(): void {
    const messages = [];
    if (this.patientTranscript.trim()) messages.push(patientMessage(this.patientTranscript.trim()));
    if (this.assistantTranscript.trim()) messages.push(aiMessage(this.assistantTranscript.trim()));
    if (messages.length) this.options.update({ chat: [...this.options.getState().chat, ...messages] });
    this.patientTranscript = ''; this.assistantTranscript = '';
    this.options.onTranscript('', '');
  }

  private clearFinishTimer(): void {
    if (this.finishTimer) clearTimeout(this.finishTimer);
    this.finishTimer = null;
  }

  private clearPlayback(): void {
    this.clearFinishTimer();
    this.playback.forEach((source) => { try { source.stop(); } catch { /* already ended */ } });
    this.playback.clear();
    this.nextPlaybackTime = this.outputContext?.currentTime || 0;
  }

  private release(): void {
    this.ready = false;
    this.socket?.close(); this.socket = null;
    this.worklet?.disconnect(); this.worklet = null;
    this.source?.disconnect(); this.source = null;
    this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null;
    this.clearPlayback();
    if (this.workletUrl) URL.revokeObjectURL(this.workletUrl);
    this.workletUrl = null;
    void this.inputContext?.close(); this.inputContext = null;
    void this.outputContext?.close(); this.outputContext = null;
  }

  private fail(message: string): void {
    if (this.stopped) return;
    this.failed = true; this.stopped = true;
    this.release();
    this.options.onStatus('error', message);
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.release();
    this.options.onStatus('ended');
  }
}
