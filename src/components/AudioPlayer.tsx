import { useEffect, useRef, useState } from 'react';
interface Props {
  audioUrl?: string;
  durationSec?: number;
  currentPlaybackTime: number;
  onSeek: (s: number) => void;
}
export function AudioPlayer({ audioUrl, currentPlaybackTime }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (audio.current && Number.isFinite(currentPlaybackTime))
      audio.current.currentTime = currentPlaybackTime;
  }, [currentPlaybackTime]);
  useEffect(() => setError(false), [audioUrl]);
  if (!audioUrl) return <p className="muted">No hay audio conservado para esta reunión.</p>;
  return (
    <div>
      {error ? (
        <p className="notice">
          No se pudo reproducir este archivo. Puedes descargarlo para abrirlo con otro reproductor.
        </p>
      ) : (
        <audio
          ref={audio}
          controls
          preload="metadata"
          src={audioUrl}
          onError={() => setError(true)}
          className="w-full"
        />
      )}
      <a className="text-link" href={audioUrl} download="reunion-audio">
        Descargar audio
      </a>
    </div>
  );
}
