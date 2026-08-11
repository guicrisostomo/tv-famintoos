import { useCallback, useEffect, useRef, useState } from "react";
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
  const transitionType = item.transition?.type ?? "none";
  const transitionDurationMs = item.transition?.durationMs ?? 700;
  const attachedVideo = useRef<HTMLVideoElement | null>(null);
  const sourceUrl = useRef("");
  const activeSession = useRef("");
  const positionedSession = useRef("");
  const playingSession = useRef("");
  const stageRef = useRef<HTMLDivElement | null>(null);
  const transitionCurtainRef = useRef<HTMLDivElement | null>(null);
  const sourceWatermarkLogo = item.watermark?.logoUrl?.trim() ?? "";
  const [resolvedWatermarkLogo, setResolvedWatermarkLogo] = useState(() => ({
    source: sourceWatermarkLogo,
    url: sourceWatermarkLogo,
  }));
  const watermarkLogoUrl =
    resolvedWatermarkLogo.source === sourceWatermarkLogo
      ? resolvedWatermarkLogo.url
      : sourceWatermarkLogo;

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    if (!sourceWatermarkLogo) return;
    void fetch(sourceWatermarkLogo, {
      cache: "force-cache",
      mode: "cors",
      referrerPolicy: "no-referrer",
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.blob();
      })
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setResolvedWatermarkLogo({ source: sourceWatermarkLogo, url: objectUrl });
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourceWatermarkLogo]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !playbackEnabled || transitionType === "none") return;
    const target = isVideo ? transitionCurtainRef.current : stage;
    if (!target || typeof target.animate !== "function") return;
    const animation = target.animate(
      isVideo ? videoTransitionFrames(transitionType) : transitionFrames(transitionType),
      {
        duration: Math.max(200, Math.min(2500, transitionDurationMs)),
        easing: "cubic-bezier(.22, 1, .36, 1)",
        fill: "both",
      },
    );
    return () => animation.cancel();
  }, [isVideo, playbackEnabled, sessionKey, transitionDurationMs, transitionType]);

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
      ref={stageRef}
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
      {item.watermark?.enabled ? (
        <div className="tv-watermark tv-watermark-top">
          {watermarkLogoUrl ? (
            <img
              src={watermarkLogoUrl}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : null}
          <div>
            {item.watermark.name ? <strong>{item.watermark.name}</strong> : null}
            {item.watermark.extraText ? <span>{item.watermark.extraText}</span> : null}
          </div>
          {item.watermark.phone ? <b>{item.watermark.phone}</b> : null}
        </div>
      ) : null}
      {item.qrCodeUrl ? (
        <div className="qr-overlay">
          <QRCodeSVG value={item.qrCodeUrl} size={128} />
          <small>Aponte a câmera</small>
        </div>
      ) : null}
      <div ref={transitionCurtainRef} className="transition-curtain" aria-hidden="true" />
    </div>
  );
}

function videoTransitionFrames(type: NonNullable<ProgramItem["transition"]>["type"]): Keyframe[] {
  switch (type) {
    case "slide_left":
      return [{ opacity: 1, transform: "translate3d(0,0,0)" }, { opacity: 1, transform: "translate3d(-102%,0,0)" }];
    case "slide_up":
      return [{ opacity: 1, transform: "translate3d(0,0,0)" }, { opacity: 1, transform: "translate3d(0,-102%,0)" }];
    case "zoom":
      return [{ opacity: 1, transform: "scale(1)" }, { opacity: 0, transform: "scale(1.18)" }];
    case "wipe":
      return [{ opacity: 1, clipPath: "inset(0 0 0 0)" }, { opacity: 1, clipPath: "inset(0 0 0 100%)" }];
    default:
      return [{ opacity: 1 }, { opacity: 0 }];
  }
}

function transitionFrames(type: NonNullable<ProgramItem["transition"]>["type"]): Keyframe[] {
  switch (type) {
    case "slide_left":
      return [
        { opacity: 0.15, transform: "translate3d(7%, 0, 0) scale(1.015)", filter: "blur(5px)" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", filter: "blur(0)" },
      ];
    case "slide_up":
      return [
        { opacity: 0.15, transform: "translate3d(0, 7%, 0) scale(1.02)", filter: "blur(4px)" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)", filter: "blur(0)" },
      ];
    case "zoom":
      return [
        { opacity: 0.1, transform: "scale(1.09)", filter: "blur(7px) brightness(.72)" },
        { opacity: 1, transform: "scale(1)", filter: "blur(0) brightness(1)" },
      ];
    case "wipe":
      return [
        { opacity: 0.55, clipPath: "inset(0 100% 0 0)", filter: "brightness(1.35)" },
        { opacity: 1, clipPath: "inset(0 0 0 0)", filter: "brightness(1)" },
      ];
    case "fade":
      return [
        { opacity: 0, filter: "blur(5px) brightness(.68)" },
        { opacity: 1, filter: "blur(0) brightness(1)" },
      ];
    default:
      return [{ opacity: 1 }, { opacity: 1 }];
  }
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
