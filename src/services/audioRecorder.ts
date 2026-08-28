import { TranscriptSegment } from '../types/meeting';

export interface AudioVisualizerCallback {
  (levels: number[]): void;
}

export interface TranscriptChunkCallback {
  (segment: TranscriptSegment): void;
}

export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphoneStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private audioChunks: Blob[] = [];
  private transcriptIntervalId: any = null;
  private recordingStartTime: number = 0;
  private accumulatedSegments: TranscriptSegment[] = [];

  private visualizerCallback: AudioVisualizerCallback | null = null;
  private transcriptCallback: TranscriptChunkCallback | null = null;

  private sampleLivePhrases = [
    { speaker: 'Tú (Micrófono)', text: 'Estamos revisando el cronograma de entregas de la versión 1.0.' },
    { speaker: 'Participante (Audio Sistema)', text: 'De acuerdo, por nuestra parte los endpoints de la API ya están listos en staging.' },
    { speaker: 'Tú (Micrófono)', text: 'Perfecto, validemos la integración con la base de datos local y los tests de carga.' },
    { speaker: 'Participante (Audio Sistema)', text: 'Anotado. Dejaremos configurada la exportación automática para el equipo.' },
  ];

  async startRecording(
    onVisualizer: AudioVisualizerCallback,
    onTranscriptChunk?: TranscriptChunkCallback
  ): Promise<boolean> {
    try {
      this.visualizerCallback = onVisualizer;
      this.transcriptCallback = onTranscriptChunk || null;
      this.audioChunks = [];
      this.accumulatedSegments = [];
      this.recordingStartTime = Date.now();

      // Intentamos acceder al micrófono real
      let stream: MediaStream | null = null;
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.microphoneStream = stream;
        }
      } catch (e) {
        console.warn('Micrófono real no accesible, activando modo simulación de audio dual:', e);
      }

      if (stream) {
        // Configurar Web Audio API
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        // Configurar MediaRecorder
        this.mediaRecorder = new MediaRecorder(stream);
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };
        this.mediaRecorder.start(1000);
      }

      // Loop de animación de onda de audio
      this.startWaveformLoop();

      // Simulación de fragmentos de transcripción en tiempo real cada 7 segundos
      let phraseIndex = 0;
      this.transcriptIntervalId = setInterval(() => {
        const elapsedSec = (Date.now() - this.recordingStartTime) / 1000;
        const phrase = this.sampleLivePhrases[phraseIndex % this.sampleLivePhrases.length];
        const segment: TranscriptSegment = {
          id: `live-seg-${Date.now()}`,
          speaker: phrase.speaker,
          text: phrase.text,
          timestamp: Math.floor(elapsedSec),
          duration: 6,
        };
        this.accumulatedSegments.push(segment);
        if (this.transcriptCallback) {
          this.transcriptCallback(segment);
        }
        phraseIndex++;
      }, 7000);

      return true;
    } catch (error) {
      console.error('Error iniciando grabación:', error);
      return false;
    }
  }

  private startWaveformLoop() {
    const dataArray = new Uint8Array(32);

    const updateWaveform = () => {
      if (this.analyser) {
        this.analyser.getByteFrequencyData(dataArray);
        // Normalizar niveles de 0 a 1 para 12 barras
        const bars: number[] = [];
        const step = Math.floor(dataArray.length / 12);
        for (let i = 0; i < 12; i++) {
          const val = dataArray[i * step] / 255;
          bars.push(Math.max(0.15, val));
        }
        if (this.visualizerCallback) {
          this.visualizerCallback(bars);
        }
      } else {
        // Onda sintética suave si no hay micrófono físico
        const time = Date.now() / 200;
        const bars: number[] = [];
        for (let i = 0; i < 12; i++) {
          const v = Math.sin(time + i * 0.5) * 0.4 + 0.5;
          bars.push(Math.max(0.2, v));
        }
        if (this.visualizerCallback) {
          this.visualizerCallback(bars);
        }
      }

      this.animationFrameId = requestAnimationFrame(updateWaveform);
    };

    updateWaveform();
  }

  async stopRecording(): Promise<{ audioUrl?: string; transcript: TranscriptSegment[]; durationSec: number }> {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.transcriptIntervalId) {
      clearInterval(this.transcriptIntervalId);
      this.transcriptIntervalId = null;
    }

    const durationSec = Math.max(1, Math.round((Date.now() - this.recordingStartTime) / 1000));

    let audioUrl: string | undefined = undefined;

    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!this.mediaRecorder) return resolve();
        this.mediaRecorder.onstop = () => {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          audioUrl = URL.createObjectURL(audioBlob);
          resolve();
        };
        this.mediaRecorder.stop();
      });
    }

    if (this.microphoneStream) {
      this.microphoneStream.getTracks().forEach((track) => track.stop());
      this.microphoneStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    return {
      audioUrl,
      transcript: this.accumulatedSegments,
      durationSec,
    };
  }
}

export const audioService = new AudioRecordingService();
