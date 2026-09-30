import { desktop, invoke } from '../lib/platform';
import { storage } from './storage';
export class AudioRecordingService {
  private recorder?: MediaRecorder;
  private context?: AudioContext;
  private streams: MediaStream[] = [];
  private chunks: Blob[] = [];
  private frame = 0;
  private native = false;
  private id = '';
  private writeQueue: Promise<void> = Promise.resolve();
  private failure?: Error;
  async startRecording(
    id: string,
    source: 'microphone' | 'dual',
    onLevels: (levels: number[]) => void,
    onFailure: (message: string) => void,
  ) {
    this.id = id;
    this.failure = undefined;
    this.native = desktop();
    if (this.native) {
      await invoke('start_audio_capture', { id, dual: source === 'dual' });
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error('Este navegador no permite grabar. Usa Chrome o la app de escritorio.');
      if (source === 'dual') {
        const system = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
        this.streams.push(system);
        if (!system.getAudioTracks().length)
          throw new Error(
            'No se compartió audio. Selecciona una pestaña con «Compartir audio», o usa solo micrófono.',
          );
      }
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
      this.streams.push(mic);
      this.context = new AudioContext();
      await this.context.resume();
      const output = this.context.createMediaStreamDestination();
      const analyser = this.context.createAnalyser();
      analyser.fftSize = 64;
      for (const stream of this.streams) {
        const input = this.context.createMediaStreamSource(stream);
        const gain = this.context.createGain();
        gain.gain.value = 1 / this.streams.length;
        input.connect(gain);
        gain.connect(output);
        gain.connect(analyser);
        stream
          .getAudioTracks()
          .forEach(
            (track) =>
              (track.onended = () =>
                onFailure('La fuente de audio se desconectó. Finaliza para guardar lo capturado.')),
          );
      }
      const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find((t) =>
        MediaRecorder.isTypeSupported(t),
      );
      this.chunks = [];
      this.writeQueue = Promise.resolve();
      this.recorder = new MediaRecorder(output.stream, mime ? { mimeType: mime } : undefined);
      this.recorder.ondataavailable = (event) => {
        if (!event.data.size) return;
        this.chunks.push(event.data);
        const snapshot = new Blob(this.chunks, { type: this.recorder!.mimeType });
        this.writeQueue = this.writeQueue
          .then(() => storage.putAudio(this.id, snapshot))
          .catch((error) => {
            this.failure = new Error('No se pudo guardar el audio en el dispositivo.');
            onFailure(String(error));
          });
      };
      this.recorder.onerror = () => {
        this.failure = new Error(
          'El grabador encontró un error. Finaliza para recuperar el audio.',
        );
        onFailure(this.failure.message);
      };
      this.recorder.start(5000);
      const bins = new Uint8Array(analyser.frequencyBinCount);
      const draw = () => {
        analyser.getByteFrequencyData(bins);
        onLevels(
          Array.from({ length: 12 }, (_, i) =>
            this.recorder?.state === 'paused' ? 0 : bins[i * 2] / 255,
          ),
        );
        this.frame = requestAnimationFrame(draw);
      };
      draw();
    } catch (error) {
      this.cleanup();
      throw error;
    }
  }
  async pause(paused: boolean) {
    if (this.native) {
      await invoke('pause_audio_capture', { paused });
      return;
    }
    if (paused && this.recorder?.state === 'recording') this.recorder.pause();
    if (!paused && this.recorder?.state === 'paused') this.recorder.resume();
  }
  async stopRecording(): Promise<void> {
    if (this.native) {
      await invoke('stop_audio_capture');
      return;
    }
    try {
      if (this.recorder && this.recorder.state !== 'inactive')
        await new Promise<void>((resolve) => {
          this.recorder!.onstop = () => resolve();
          this.recorder!.stop();
        });
      await this.writeQueue;
      if (this.failure) throw this.failure;
      if (!this.chunks.length) throw new Error('No se capturó audio.');
    } finally {
      this.cleanup();
    }
  }
  private cleanup() {
    cancelAnimationFrame(this.frame);
    this.streams.forEach((s) =>
      s.getTracks().forEach((t) => {
        t.onended = null;
        t.stop();
      }),
    );
    this.streams = [];
    void this.context?.close();
    this.context = undefined;
  }
}
export const audioService = new AudioRecordingService();
