import { useCallback, useEffect, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { ProgramItem } from "../domain/tv";
import { playVideoElement, resolveMediaUrl } from "../services/media";
import { tvAudioService } from "../services/tvAudioService";

interface TvMediaStageProps {
  item: ProgramItem;
  playbackRun: number;
  resumeSeconds: number;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  soundEnabled: boolean;
  audioActivated: boolean;
  playbackEnabled: boolean;
  onVideoEvent: (event: string, video: HTMLVideoElement) => void;
  onEnded: () => void;
  onError: (error: Error) => void;
}

export function TvMediaStage({
  item,
  playbackRun,
  resumeSeconds,
  videoRef,
  soundEnabled,
  audioActivated,
  playbackEnabled,
  onVideoEvent,
  onEnded,
  onError,
}: TvMediaStageProps) {
  const url = resolveMediaUrl(item.media);
  const isVideo = item.media.type === "video" && Boolean(url);
  const mediaFit = isVideo && item.fit === "blur_background" ? "contain" : item.fit;
  const sessionKey = `${item.id}:${playbackRun}`;
  const attachedVideo = useRef<HTMLVideoElement | null>(null);
  const sourceUrl = useRef("");
  const activeSession = useRef("");
  const positionedSession = useRef("");
  const playingSession = useRef("");

  const attachVideo = useCallback(
    (video: HTMLVideoElement | null) => {
      attachedVideo.current = video;
      videoRef.current = video;
    },
    [videoRef],
  );

  useEffect(
    () => () => {
      const video = attachedVideo.current;
      if (video) tvAudioService.releaseMedia(video);
      attachedVideo.current = null;
      videoRef.current = null;
    },
    [videoRef],
  );

  const startVideo = useCallback(
    async (video: HTMLVideoElement) => {
      if (
        !isVideo ||
        !playbackEnabled ||
        activeSession.current !== sessionKey ||
        video.readyState < 1
      )
        return;

      if (positionedSession.current !== sessionKey) {
        const duration = Number.isFinite(video.duration) ? video.duration : 0;
        const requested = Math.max(0, resumeSeconds);
        const target = duration > 0 && duration - requested > 1 ? requested : 0;
        try {
          video.currentTime = Math.min(target, Math.max(0, duration - 0.25));
        } catch {
          video.currentTime = 0;
        }
        positionedSession.current = sessionKey;
      }

      if (video.readyState < 2) return;
      const audible =
        audioActivated &&
        soundEnabled &&
        !item.muted &&
        !item.soundtrack?.muteOriginalAudio;

      if (playingSession.current !== sessionKey || video.paused || video.ended) {
        if (video.ended) video.currentTime = 0;
        video.volume = Math.max(0, Math.min(1, item.volume));
        video.muted = true;
        try {
          await playVideoElement(video);
          if (activeSession.current !== sessionKey || !playbackEnabled) {
            video.pause();
            return;
          }
          playingSession.current = sessionKey;
        } catch {
          onError(videoPlaybackError(video, item));
          return;
        }
      }

      if (!audible) {
        video.muted = true;
        return;
      }
      video.muted = false;
      try {
        await tvAudioService.playMediaAudio(video, item.volume);
      } catch {
        // O áudio não pode derrubar a superfície de vídeo no Android WebView.
        video.muted = true;
        if (video.paused) void playVideoElement(video).catch(onError);
      }
    },
    [
      audioActivated,
      isVideo,
      item,
      onError,
      playbackEnabled,
      resumeSeconds,
      sessionKey,
      soundEnabled,
    ],
  );

  useEffect(() => {
    const video = attachedVideo.current;
    activeSession.current = sessionKey;
    positionedSession.current = "";
    playingSession.current = "";
    if (!video) return;
    if (!isVideo || !url) {
      video.pause();
      video.muted = true;
      try {
        video.currentTime = 0;
      } catch {
        /* A fonte anterior pode ainda não ter metadados. */
      }
      return;
    }

    video.pause();
    video.muted = true;
    if (sourceUrl.current !== url) {
      sourceUrl.current = url;
      video.src = url;
      video.load();
    } else {
      try {
        video.currentTime = 0;
      } catch {
        video.load();
      }
    }
  }, [isVideo, sessionKey, url]);

  useEffect(() => {
    const video = attachedVideo.current;
    if (!video || !isVideo) return;
    if (!playbackEnabled) {
      video.pause();
      return;
    }
    void startVideo(video);
  }, [isVideo, playbackEnabled, startVideo]);

  const videoEvent = (name: string, video: HTMLVideoElement) => {
    onVideoEvent(name, video);
    if (name === "loadedmetadata" || name === "loadeddata" || name === "canplay")
      void startVideo(video);
  };

  return (
    <div
      className={`media-layer${isVideo ? " media-layer-video" : ""}`}
      style={{ "--media-fit": mediaFit } as React.CSSProperties}
    >
      <video
        className={`tv-video${isVideo ? " active" : ""}`}
        ref={attachVideo}
        preload="auto"
        muted
        controls={false}
        disablePictureInPicture
        aria-hidden={!isVideo}
        onLoadedMetadata={(event) => videoEvent("loadedmetadata", event.currentTarget)}
        onLoadedData={(event) => videoEvent("loadeddata", event.currentTarget)}
        onCanPlay={(event) => videoEvent("canplay", event.currentTarget)}
        onPlaying={(event) => videoEvent("playing", event.currentTarget)}
        onPause={(event) => videoEvent("pause", event.currentTarget)}
        onWaiting={(event) => videoEvent("waiting", event.currentTarget)}
        onStalled={(event) => videoEvent("stalled", event.currentTarget)}
        onEnded={(event) => {
          videoEvent("ended", event.currentTarget);
          if (activeSession.current === sessionKey && isVideo) onEnded();
        }}
        onError={(event) => {
          if (isVideo && sourceUrl.current === url)
            onError(videoPlaybackError(event.currentTarget, item));
        }}
        playsInline
      />
      {item.media.type === "image" && url ? (
        <>
          {item.fit === "blur_background" ? (
            <img className="media-blurred-background" src={url} alt="" aria-hidden="true" />
          ) : null}
          <img
            className={`media-main-image ${item.fit === "blur_background" ? "media-main-image-centered" : ""} image-motion image-motion-${item.media.animation ?? "none"}`}
            style={{ "--motion-duration": `${item.durationSeconds}s` } as React.CSSProperties}
            src={url}
            alt={item.media.title ?? ""}
            onError={() => onError(new Error(`Falha ao carregar imagem: ${item.media.title ?? item.id}`))}
          />
        </>
      ) : null}
      {item.media.type === "message" ? (
        <div className="message-content">{item.media.title}</div>
      ) : null}
      {item.overlayText ? (
        <div className={`media-caption caption-${item.overlayAnimation ?? "none"}`}>{item.overlayText}</div>
      ) : null}
      {item.qrCodeUrl ? (
        <div className="qr-overlay">
          <QRCodeSVG value={item.qrCodeUrl} size={128} />
          <small>Aponte a câmera</small>
        </div>
      ) : null}
    </div>
  );
}

function videoPlaybackError(video: HTMLVideoElement, item: ProgramItem) {
  const code = video.error?.code;
  const reason =
    code === 4
      ? "formato incompatível (use MP4 com vídeo H.264 e áudio AAC)"
      : code === 3
        ? "o navegador não conseguiu decodificar o arquivo"
        : code === 2
          ? "falha de rede ao baixar o arquivo"
          : code === 1
            ? "reprodução interrompida"
            : "reprodução bloqueada pelo navegador";
  return new Error(`Falha no vídeo ${item.media.title ?? item.id}: ${reason}.`);
}
