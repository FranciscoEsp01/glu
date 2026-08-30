import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Volume2, FastForward } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl?: string;
  durationSec?: number;
  currentPlaybackTime: number;
  onSeek: (seconds: number) => void;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioUrl,
  durationSec = 60,
  currentPlaybackTime,
  onSeek,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Generar barras visuales estáticas para el waveform scrubber
  const waveformBars = useRef<number[]>(
    Array.from({ length: 48 }, () => Math.random() * 0.7 + 0.3)
  ).current;

  useEffect(() => {
    let timer: any = null;
    if (isPlaying) {
      timer = setInterval(() => {
        if (currentPlaybackTime >= durationSec) {
          setIsPlaying(false);
          onSeek(0);
        } else {
          onSeek(Math.min(durationSec, currentPlaybackTime + 1 * playbackRate));
        }
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isPlaying, currentPlaybackTime, durationSec, playbackRate, onSeek]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeekFromBar = (index: number) => {
    const targetSec = Math.round((index / waveformBars.length) * durationSec);
    onSeek(targetSec);
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length;
    setPlaybackRate(rates[nextIdx]);
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  };

  const progressPercent = (currentPlaybackTime / Math.max(1, durationSec)) * 100;

  return (
    <div className="w-full flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={togglePlay}
            className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 transition-transform active:scale-95"
            title={isPlaying ? 'Pausar audio' : 'Reproducir audio'}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current translate-x-0.5" />
            )}
          </button>

          {/* Reset button */}
          <button
            onClick={() => onSeek(0)}
            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-gray-500 dark:text-gray-400 text-xs transition-colors"
            title="Reiniciar al inicio"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {/* Timestamp readout */}
          <div className="font-mono text-xs font-semibold text-gray-700 dark:text-gray-200">
            <span>{formatTime(currentPlaybackTime)}</span>
            <span className="text-gray-400 dark:text-gray-500 mx-1">/</span>
            <span className="text-gray-400 dark:text-gray-500">{formatTime(durationSec)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Audio Source Badge */}
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-medium">
            <Volume2 className="w-3 h-3" />
            <span>Dual Audio Sync (16kHz)</span>
          </div>

          {/* Playback Rate button */}
          <button
            onClick={cyclePlaybackRate}
            className="px-2 py-0.5 rounded-md bg-black/5 dark:bg-white/10 text-gray-700 dark:text-gray-300 text-xs font-mono font-medium hover:bg-black/10 transition-colors flex items-center gap-1"
            title="Velocidad de reproducción"
          >
            <FastForward className="w-3 h-3" />
            <span>{playbackRate}x</span>
          </button>
        </div>
      </div>

      {/* Waveform Scrubber */}
      <div 
        className="h-9 w-full flex items-center justify-between gap-[2px] cursor-pointer group py-1"
        title="Haz clic en cualquier punto de la onda para saltar"
      >
        {waveformBars.map((heightFactor, idx) => {
          const barPercent = (idx / waveformBars.length) * 100;
          const isPassed = barPercent <= progressPercent;

          return (
            <div
              key={idx}
              onClick={() => handleSeekFromBar(idx)}
              className="flex-1 flex items-center justify-center h-full group/bar"
            >
              <div
                style={{ height: `${heightFactor * 100}%` }}
                className={`w-full rounded-full transition-all duration-150 group-hover/bar:scale-y-110 ${
                  isPassed
                    ? 'bg-indigo-600 dark:bg-indigo-400 shadow-sm'
                    : 'bg-gray-300/80 dark:bg-gray-700/80'
                }`}
              />
            </div>
          );
        })}
      </div>

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
};
