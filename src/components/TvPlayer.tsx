import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import type { Interruption, PlayerPayload, ProgramItem } from "../domain/tv";
import { isPlayableMedia, resolveMediaUrl } from "../services/media";
import {
  readPayload,
  readPlayback,
  savePayload,
  savePlayback,
} from "../services/playerCache";
import { selectNextInterruption } from "../services/playerQueue";
import { supabase } from "../services/supabase";
import type { TvPlaylistRecord } from "../hooks/useTvData";
import { useDeploymentRefresh } from "../hooks/useDeploymentRefresh";
import { normalizeTvVideo } from "../services/storage";
import {
  tvAudioService,
  type TvAudioDiagnostics,
} from "../services/tvAudioService";
import {
  defaultCallSpeechSettings,
  speechService,
  type CallSpeechSettings,
} from "../services/speechService";
import {
  TvPlayerRuntime,
  type TvPlayerDiagnostics,
} from "../services/tvPlayerRuntime";

const activationKey = (displayId: string) =>
  `famintoos-tv:activated:${displayId}`;
const processedCallsKey = (displayId: string) =>
  `famintoos-tv:processed-calls:${displayId}`;

function readProcessedCalls(displayId: string) {
  try {
    return new Set<string>(
      JSON.parse(
        window.localStorage.getItem(processedCallsKey(displayId)) ?? "[]",
      ) as string[],
    );
  } catch {
    return new Set<string>();
  }
}

export function TvPlayer({
  companyId,
  displayId,
}: {
  companyId: string;
  displayId: string;
}) {
  const [activated, setActivated] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationError, setActivationError] = useState<string | null>(null);
  const [videoRecovery, setVideoRecovery] = useState<{
    mediaId: string;
    message: string;
    failed?: boolean;
  } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [callSettings, setCallSettings] = useState<CallSpeechSettings>(
    defaultCallSpeechSettings,
  );
  const [businessName, setBusinessName] = useState("");
  const [audioDiagnostics, setAudioDiagnostics] = useState<TvAudioDiagnostics>(
    () => tvAudioService.diagnostics(),
  );
  const [runtime] = useState(() => new TvPlayerRuntime(companyId, displayId));
  const [playerDiagnostics, setPlayerDiagnostics] =
    useState<TvPlayerDiagnostics>(() => runtime.snapshot());
  const [payload, setPayload] = useState<PlayerPayload | null>(() =>
    readPayload(companyId, displayId),
  );
  const [index, setIndex] = useState(
    () => readPlayback(companyId, displayId)?.itemIndex ?? 0,
  );
  const [interruptions, setInterruptions] = useState<Interruption[]>([]);
  const [activeInterruption, setActiveInterruption] =
    useState<Interruption | null>(null);
  const processedCalls = useRef(readProcessedCalls(displayId));
  const normalizingVideos = useRef(new Set<string>());
  const videoRef = useRef<HTMLVideoElement>(null);
  const loadingRef = useRef(false);
  const loadAgainRef = useRef(false);
  const loadRef = useRef<() => Promise<void>>(async () => undefined);
  const reconnectRef = useRef<() => void>(() => undefined);
  const disconnectRef = useRef<() => void>(() => undefined);
  const progressRef = useRef({
    itemId: "",
    value: 0,
    changedAt: 0,
    recoveries: 0,
  });
  const diagnosticMode = ["audio", "player"].includes(
    new URLSearchParams(window.location.search).get("diagnostic") ?? "",
  );

  useEffect(() => {
    const root = document.documentElement;
    const userAgent = navigator.userAgent.toLowerCase();
    const isFullyKiosk =
      userAgent.includes("fully") || "fully" in window;
    const updateViewport = () => {
      const viewport = window.visualViewport;
      root.style.setProperty(
        "--tv-viewport-width",
        `${Math.round(viewport?.width ?? window.innerWidth)}px`,
      );
      root.style.setProperty(
        "--tv-viewport-height",
        `${Math.round(viewport?.height ?? window.innerHeight)}px`,
      );
    };
    root.classList.toggle("fully-kiosk", isFullyKiosk);
    updateViewport();
    window.addEventListener("resize", updateViewport);
    window.addEventListener("orientationchange", updateViewport);
    window.visualViewport?.addEventListener("resize", updateViewport);
    return () => {
      root.classList.remove("fully-kiosk");
      root.style.removeProperty("--tv-viewport-width");
      root.style.removeProperty("--tv-viewport-height");
      window.removeEventListener("resize", updateViewport);
      window.removeEventListener("orientationchange", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
    };
  }, []);

  useEffect(() => {
    tvAudioService.initializeAudio();
    void speechService.initialize();
    const unsubscribe = tvAudioService.subscribe(setAudioDiagnostics);
    const unsubscribeRuntime = diagnosticMode
      ? runtime.subscribe(setPlayerDiagnostics)
      : () => undefined;
    return () => {
      unsubscribe();
      unsubscribeRuntime();
      tvAudioService.dispose();
      runtime.dispose();
    };
  }, [diagnosticMode, runtime]);

  const load = useCallback(async () => {
    if (!supabase || !companyId || !displayId) return;
    if (loadingRef.current) {
      loadAgainRef.current = true;
      return;
    }
    loadingRef.current = true;
    try {
      const [
        programResult,
        playlistResult,
        callsResult,
        displayResult,
        templateResult,
        businessResult,
      ] = await Promise.all([
        supabase.rpc("get_tv_player_payload", {
          p_company_id: companyId,
          p_display_id: displayId,
        }),
        supabase
          .from("tv_playlist_items")
          .select(
            "id,display_id,media_id,position,is_active,image_fit,caption_text,caption_animation,sound_media_id,sound_volume,sound_loop,mute_original_audio,media:tv_media!tv_playlist_items_media_id_fkey(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,storage_key,animation,starts_at,ends_at,weekdays,start_time,end_time),sound_media:tv_media!tv_playlist_items_sound_media_id_fkey(id,title,media_type,media_url,message_text,duration_seconds,public_url,storage_provider,animation)",
          )
          .eq("company_id", companyId)
          .eq("display_id", displayId)
          .eq("is_active", true)
          .order("position"),
        supabase
          .from("tv_calls")
          .select(
            "id,company_id,display_id,customer_name,order_id,call_text,call_payload,requested_at",
          )
          .eq("company_id", companyId)
          .eq("display_id", displayId)
          .eq("status", "pending")
          .order("requested_at"),
        supabase
          .from("tv_displays")
          .select("sound_enabled")
          .eq("company_id", companyId)
          .eq("id", displayId)
          .single(),
        supabase
          .from("tv_call_templates")
          .select("primary_text,volume,duration_seconds,repetitions,layout")
          .eq("company_id", companyId)
          .eq("active", true)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("business")
          .select("name")
          .eq("cnpj", companyId)
          .maybeSingle(),
      ]);
      if (programResult.error && playlistResult.error && callsResult.error) {
        runtime.error(
          programResult.error ?? playlistResult.error ?? callsResult.error,
        );
        return;
      }
      const programPayload = programResult.data as PlayerPayload | null;
      const nextSoundEnabled = displayResult.data?.sound_enabled ?? true;
      const nextCallSettings = templateResult.data
        ? {
            ...defaultCallSpeechSettings,
            ...(templateResult.data.layout as Partial<CallSpeechSettings>),
            template:
              templateResult.data.primary_text ||
              defaultCallSpeechSettings.template,
            volume: Number(templateResult.data.volume),
            durationSeconds: templateResult.data.duration_seconds,
            repetitions: templateResult.data.repetitions,
          }
        : defaultCallSpeechSettings;
      setCallSettings(nextCallSettings);
      setBusinessName(businessResult.data?.name ?? "");
      setSoundEnabled(nextSoundEnabled);
      tvAudioService.setEnabled(nextSoundEnabled);
      const legacyItems = (
        (playlistResult.data ?? []) as unknown as TvPlaylistRecord[]
      )
        .filter((item) => isScheduledNow(item.media))
        .map((item) => ({
          id: item.id,
          companyId,
          displayIds: [displayId],
          durationSeconds: item.media.duration_seconds ?? 10,
          volume: 1,
          muted: !nextSoundEnabled,
          fit: item.image_fit ?? "contain",
          overlayText: item.caption_text,
          overlayAnimation: item.caption_animation ?? "none",
          soundtrack: item.sound_media && (item.sound_media.public_url || item.sound_media.media_url) ? { id: item.sound_media.id, title: item.sound_media.title, url: item.sound_media.public_url ?? item.sound_media.media_url!, volume: item.sound_volume ?? .7, loop: item.sound_loop ?? true, muteOriginalAudio: item.mute_original_audio ?? false } : null,
          resumeBehavior: "resume" as const,
          active: item.is_active,
          media: {
            id: item.media.id,
            companyId,
            type: item.media.media_type,
            mediaUrl: item.media.media_url,
            publicUrl: item.media.public_url,
            storageProvider: item.media.storage_provider as
              "cloudflare_r2" | "supabase_storage" | "external_url" | null,
            storageKey: item.media.storage_key,
            animation: item.media.animation ?? "none",
            title:
              item.media.media_type === "message"
                ? item.media.message_text
                : item.media.title,
          },
        }));
      const known = new Set(legacyItems.map((item) => item.id));
      const programItems = (programPayload?.items ?? []).filter(
        (item) => !known.has(item.id),
      );
      const programInterruptions = (programPayload?.interruptions ?? []).filter(
        (interruption) => interruption.kind !== "call",
      );
      const pendingCalls: Interruption[] = (callsResult.data ?? [])
        .filter((call) => !processedCalls.current.has(call.id))
        .map((call) => ({
          id: call.id,
          companyId: call.company_id,
          displayId: call.display_id,
          kind: "call",
          priority: 1000,
          requestedAt: call.requested_at,
          durationSeconds: nextCallSettings.durationSeconds,
          title: call.call_text,
          subtitle: call.customer_name,
          callValues: {
            ...((call.call_payload ?? {}) as Interruption["callValues"]),
            customer_name: call.customer_name,
            order_number:
              ((call.call_payload ?? {}) as Interruption["callValues"])
                ?.order_number ?? call.order_id,
            call_text: call.call_text,
            business_name: businessResult.data?.name ?? "",
          },
        }));
      const next: PlayerPayload = {
        companyId,
        displayId,
        items: [...legacyItems, ...programItems],
        interruptions: [...programInterruptions, ...pendingCalls],
        syncedAt: new Date().toISOString(),
      };
      setPayload(next);
      setInterruptions(next.interruptions ?? []);
      savePayload(next);
      runtime.setCachedItems(next.items.length);
    } catch (error) {
      runtime.error(error);
    } finally {
      loadingRef.current = false;
      if (loadAgainRef.current) {
        loadAgainRef.current = false;
        window.queueMicrotask(() => void loadRef.current());
      }
    }
  }, [companyId, displayId, runtime]);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const timer = runtime.timeout(() => void load(), 0);
    return () => runtime.clear(timer);
  }, [load, runtime]);
  useEffect(() => {
    if (!supabase || !companyId || !displayId) return;
    const client = supabase;
    let channel: ReturnType<typeof client.channel> | null = null;
    let reconnectTimer: number | undefined;
    let disposed = false;
    let attempts = 0;
    const scheduleReconnect = () => {
      runtime.clear(reconnectTimer);
      const delay = Math.min(30_000, 1_500 * 2 ** attempts++);
      reconnectTimer = runtime.timeout(() => {
        if (!disposed) void connect();
      }, delay);
    };
    const disconnect = () => {
      const previous = channel;
      channel = null;
      runtime.setSubscriptions(0);
      if (previous) void client.removeChannel(previous);
    };
    const connect = async () => {
      if (disposed || document.hidden) return;
      const previous = channel;
      channel = null;
      runtime.setSubscriptions(0);
      if (previous) await client.removeChannel(previous);
      if (disposed || document.visibilityState === "hidden") return;
      const nextChannel = client
        .channel(`tv:${companyId}:${displayId}:stable`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tv_programs",
            filter: `company_id=eq.${companyId}`,
          },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tv_playlist_items",
            filter: `display_id=eq.${displayId}`,
          },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tv_playlist_items",
            filter: `display_id=eq.${displayId}`,
          },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            // Supabase does not support filters on DELETE events. The reload
            // itself remains scoped to this company and display.
            event: "DELETE",
            schema: "public",
            table: "tv_playlist_items",
          },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "tv_media",
            filter: `company_id=eq.${companyId}`,
          },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "tv_displays",
            filter: `id=eq.${displayId}`,
          },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tv_interruptions",
            filter: `display_id=eq.${displayId}`,
          },
          () => void load(),
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "tv_calls",
            filter: `display_id=eq.${displayId}`,
          },
          () => void load(),
        );
      channel = nextChannel;
      nextChannel.subscribe((status, error) => {
        if (disposed || channel !== nextChannel) return;
        if (status === "SUBSCRIBED") {
          attempts = 0;
          runtime.setSubscriptions(1);
          runtime.reconnected();
          void load();
          return;
        }
        if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          runtime.setSubscriptions(0);
          runtime.error(error ?? new Error(`Realtime: ${status}`));
          scheduleReconnect();
        }
      });
    };
    reconnectRef.current = () => {
      if (!channel) void connect();
      else void load();
    };
    disconnectRef.current = disconnect;
    void connect();
    return () => {
      disposed = true;
      runtime.clear(reconnectTimer);
      disconnect();
      reconnectRef.current = () => undefined;
      disconnectRef.current = () => undefined;
    };
  }, [companyId, displayId, load, runtime]);

  const items = (payload?.items ?? []).filter(
    (item) =>
      item.companyId === companyId &&
      item.displayIds.includes(displayId) &&
      item.active &&
      isPlayableMedia(item.media),
  );
  const current = items[index % Math.max(items.length, 1)];
  const next = items.length > 1 ? items[(index + 1) % items.length] : null;

  useDeploymentRefresh(() => {
    if (activeInterruption) return;
    savePlayback(companyId, displayId, {
      itemId: current?.id ?? "",
      itemIndex: index,
      elapsedSeconds: videoRef.current?.currentTime ?? 0,
      savedAt: new Date().toISOString(),
    });
    if (activated) window.sessionStorage.setItem(activationKey(displayId), "1");
    runtime.controlledReload("Nova versão do site detectada");
  }, runtime);

  useEffect(() => {
    const persist = () =>
      savePlayback(companyId, displayId, {
        itemId: current?.id ?? "",
        itemIndex: index,
        elapsedSeconds: videoRef.current?.currentTime ?? 0,
        savedAt: new Date().toISOString(),
      });
    const recover = () => {
      runtime.lifecycle("foreground");
      if (supabase)
        void supabase.auth
          .refreshSession()
          .catch((error) => runtime.error(error));
      reconnectRef.current();
      void load();
      void tvAudioService.resumeAudioContext();
      const video = videoRef.current;
      if (activated && video && current?.media.type === "video") {
        void (async () => {
          if (video.paused) {
            // Fully/Android WebView may revoke audible autoplay after the app
            // returns from the background. Resume the picture muted first.
            video.muted = true;
            try {
              await playVideo(video);
            } catch (error) {
              runtime.error(error);
              return;
            }
          }
          if (soundEnabled && !current.muted && !current.soundtrack?.muteOriginalAudio) {
            void tvAudioService.playMediaAudio(video, current.volume).catch(() => {
              // Keep the visual track running even if audible playback is denied.
              video.muted = true;
            });
          }
        })();
      }
    };
    const hide = () => {
      runtime.lifecycle("background");
      persist();
      tvAudioService.pauseAllAudio();
    };
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        hide();
        disconnectRef.current();
      } else recover();
    };
    const pageHide = () => {
      runtime.lifecycle("pagehide");
      hide();
      disconnectRef.current();
    };
    const blur = () => {
      runtime.lifecycle("blur");
      // Fully Kiosk may emit blur while requesting fullscreen. Persist state,
      // but keep the visual track running; the audio service mutes it.
      persist();
    };
    const offline = () => {
      runtime.lifecycle("offline");
      runtime.error("Conexão de rede indisponível.");
      disconnectRef.current();
    };
    window.addEventListener("pageshow", recover);
    window.addEventListener("pagehide", pageHide);
    window.addEventListener("focus", recover);
    window.addEventListener("blur", blur);
    window.addEventListener("online", recover);
    window.addEventListener("offline", offline);
    document.addEventListener("visibilitychange", visibility);
    const persistTimer = runtime.interval(persist, 5_000);
    const refreshTimer = runtime.interval(() => {
      if (!document.hidden) void load();
    }, 30_000);
    return () => {
      persist();
      runtime.clear(persistTimer);
      runtime.clear(refreshTimer);
      window.removeEventListener("pageshow", recover);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("focus", recover);
      window.removeEventListener("blur", blur);
      window.removeEventListener("online", recover);
      window.removeEventListener("offline", offline);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [
    activated,
    companyId,
    current?.id,
    current?.media.type,
    current?.muted,
    current?.soundtrack?.muteOriginalAudio,
    current?.volume,
    displayId,
    index,
    load,
    runtime,
    soundEnabled,
  ]);

  useEffect(() => {
    runtime.media(current?.media.title);
    progressRef.current = {
      itemId: current?.id ?? "",
      value: videoRef.current?.currentTime ?? index,
      changedAt: Date.now(),
      recoveries: 0,
    };
  }, [current?.id, current?.media.title, index, runtime]);

  useEffect(() => {
    const storageKey = current?.media.storageKey;
    if (!activated || current?.media.type !== "video" || !storageKey || storageKey.includes("/compatible/") || normalizingVideos.current.has(current.media.id)) return;
    normalizingVideos.current.add(current.media.id);
    setVideoRecovery({
      mediaId: current.media.id,
      message: "Preparando o vídeo para esta TV...",
    });
    runtime.lifecycle(`otimizando vídeo incompatível: ${current.media.title ?? current.media.id}`);
    const timer = runtime.timeout(() => {
      if (items.length > 1) setIndex(value => (value + 1) % items.length);
      void normalizeTvVideo(current.media.id)
        .then(() => {
          setVideoRecovery(null);
          runtime.lifecycle(`vídeo otimizado: ${current.media.title ?? current.media.id}`);
          return loadRef.current();
        })
        .catch(error => {
          normalizingVideos.current.delete(current.media.id);
          setVideoRecovery({
            mediaId: current.media.id,
            message: "Não foi possível preparar este vídeo. Verifique a conexão e tente novamente.",
            failed: true,
          });
          runtime.error(error);
        });
    }, 800);
    return () => runtime.clear(timer);
  }, [activated, current?.media.id, current?.media.storageKey, current?.media.title, current?.media.type, items.length, runtime]);

  useEffect(() => {
    if (!activated || activeInterruption || !soundEnabled || !current?.soundtrack) {
      tvAudioService.stopSoundtrack();
      return;
    }
    void tvAudioService.playSoundtrack(current.soundtrack.url, current.soundtrack.volume, current.soundtrack.loop).catch(error => runtime.error(error));
    return () => tvAudioService.stopSoundtrack();
  }, [activated, activeInterruption, current?.id, current?.soundtrack, runtime, soundEnabled]);

  useEffect(() => {
    if (!next) {
      runtime.setPreloadCount(0);
      return;
    }
    const url = resolveMediaUrl(next.media);
    if (!url) {
      runtime.setPreloadCount(0);
      return;
    }
    let media: HTMLImageElement | HTMLVideoElement;
    if (next.media.type === "video") {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = url;
      media = video;
    } else {
      const image = new Image();
      image.decoding = "async";
      image.src = url;
      media = image;
    }
    runtime.setPreloadCount(1);
    return () => {
      if (media instanceof HTMLVideoElement) {
        media.pause();
        media.removeAttribute("src");
        media.load();
      } else media.removeAttribute("src");
      runtime.setPreloadCount(0);
    };
  }, [next, runtime]);

  useEffect(() => {
    const watchdog = runtime.interval(() => {
      if (document.hidden || activeInterruption || !current) return;
      const video = videoRef.current;
      const value =
        video && current.media.type === "video" ? video.currentTime : index;
      const progress = progressRef.current;
      if (
        progress.itemId !== current.id ||
        Math.abs(value - progress.value) > 0.2
      ) {
        progressRef.current = {
          itemId: current.id,
          value,
          changedAt: Date.now(),
          recoveries: 0,
        };
        return;
      }
      const limit =
        current.media.type === "video"
          ? 45_000
          : (current.durationSeconds + 30) * 1000;
      if (Date.now() - progress.changedAt < limit) return;
      if (progress.recoveries < 2) {
        progress.recoveries += 1;
        progress.changedAt = Date.now();
        runtime.error(
          `Watchdog recuperando mídia travada: ${current.media.title ?? current.id}`,
        );
        void load();
        if (video) {
          video.load();
          void video.play().catch(() => undefined);
        } else setIndex((value) => (value + 1) % Math.max(items.length, 1));
        return;
      }
      savePlayback(companyId, displayId, {
        itemId: current.id,
        itemIndex: index,
        elapsedSeconds: video?.currentTime ?? 0,
        savedAt: new Date().toISOString(),
      });
      runtime.controlledReload(
        "Watchdog: player sem progresso após duas recuperações",
      );
    }, 15_000);
    return () => runtime.clear(watchdog);
  }, [
    activeInterruption,
    companyId,
    current,
    displayId,
    index,
    items.length,
    load,
    runtime,
  ]);

  useEffect(() => {
    if (!activated || activeInterruption) return;
    const next = selectNextInterruption(interruptions);
    if (!next) return;
    const startTimer = runtime.timeout(() => {
      savePlayback(companyId, displayId, {
        itemId: current?.id ?? "",
        itemIndex: index,
        elapsedSeconds: videoRef.current?.currentTime ?? 0,
        savedAt: new Date().toISOString(),
      });
      tvAudioService.pauseAllAudio();
      setActiveInterruption(next);
      if (next.kind === "call") {
        processedCalls.current.add(next.id);
        window.localStorage.setItem(
          processedCallsKey(displayId),
          JSON.stringify(Array.from(processedCalls.current).slice(-200)),
        );
        void updateCall(next.id, companyId, {
          status: "showing",
          displayed_at: new Date().toISOString(),
        });
      }
    }, 0);
    return () => runtime.clear(startTimer);
  }, [
    activated,
    activeInterruption,
    companyId,
    current?.id,
    displayId,
    index,
    interruptions,
    runtime,
  ]);

  useEffect(() => {
    if (!activeInterruption) return;
    const interruptionId = activeInterruption.id;
    const isCall = activeInterruption.kind === "call";
    const timer = runtime.timeout(() => {
      setInterruptions((queue) => queue.filter((i) => i.id !== interruptionId));
      setActiveInterruption(null);
      if (isCall)
        void updateCall(interruptionId, companyId, {
          status: "completed",
          completed_at: new Date().toISOString(),
        });
      if (videoRef.current)
        void tvAudioService
          .playMediaAudio(videoRef.current, current?.volume ?? 1)
          .catch(() => undefined);
    }, activeInterruption.durationSeconds * 1000);
    return () => runtime.clear(timer);
  }, [activeInterruption, companyId, current?.volume, runtime]);

  useEffect(() => {
    if (
      !activeInterruption ||
      activeInterruption.kind !== "call" ||
      !activated ||
      !soundEnabled
    )
      return;
    let spoken = false;
    let cancelled = false;
    let delayTimer: number | undefined;
    const speak = async () => {
      if (spoken) return;
      spoken = true;
      if (callSettings.bellEnabled) {
        try {
          await tvAudioService.playCallSound();
          await new Promise<void>((resolve) => {
            delayTimer = runtime.timeout(resolve, callSettings.bellDelayMs);
          });
        } catch {
          /* diagnostics expose playback errors */
        }
      }
      if (cancelled) return;
      await speechService.speakCall(
        activeInterruption.callValues ?? {
          customer_name: activeInterruption.subtitle,
          call_text: activeInterruption.title,
          business_name: businessName,
        },
        callSettings,
      );
    };
    void speak();
    return () => {
      cancelled = true;
      runtime.clear(delayTimer);
      speechService.cancel();
    };
  }, [
    activated,
    activeInterruption,
    businessName,
    callSettings,
    runtime,
    soundEnabled,
  ]);

  useEffect(() => {
    if (
      !activated ||
      !current ||
      current.media.type === "video" ||
      activeInterruption
    )
      return;
    const timer = runtime.timeout(
      () => setIndex((i) => (i + 1) % items.length),
      current.durationSeconds * 1000,
    );
    return () => runtime.clear(timer);
  }, [activated, activeInterruption, current, items.length, runtime]);

  const activate = async () => {
    setActivating(true);
    setActivationError(null);
    try {
      tvAudioService.initializeAudio();
      tvAudioService.setEnabled(soundEnabled);
      await tvAudioService.unlockAudio();
    } catch (error) {
      // Falhar ao liberar o som não pode impedir a imagem no Fully Kiosk.
      const message = error instanceof Error
        ? error.message
        : "Não foi possível ativar o áudio.";
      setActivationError(message);
      runtime.error(message);
    }
    const video = videoRef.current;
    if (video) {
      video.muted = true;
      try {
        await playVideo(video);
      } catch (error) {
        runtime.error(error);
      }
    }
    window.localStorage.setItem(
      activationKey(displayId),
      new Date().toISOString(),
    );
    setActivated(true);
    setActivating(false);
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* fullscreen is optional */
    }
  };
  if (!current)
    return (
      <main className="tv-screen" aria-label="TV sem programação">
        {!activated ? <AudioUnlock onClick={activate} activating={activating} error={activationError} /> : null}
        {activeInterruption ? (
          <CallOverlay interruption={activeInterruption} />
        ) : null}
        {diagnosticMode ? (
          <AudioDiagnostic
            diagnostics={audioDiagnostics}
            player={playerDiagnostics}
            soundEnabled={soundEnabled}
          />
        ) : null}
      </main>
    );

  return (
    <main className="tv-screen">
      <Media
        key={current.id}
        item={current}
        displayId={displayId}
        videoRef={videoRef}
        soundEnabled={soundEnabled}
        audioActivated={activated}
        playbackEnabled={activated}
        onVideoEvent={(event, video) => {
          if (diagnosticMode)
            runtime.lifecycle(`video:${event} ready=${video.readyState} network=${video.networkState} time=${video.currentTime.toFixed(1)} muted=${video.muted}`);
        }}
        onEnded={() => setIndex((i) => (i + 1) % items.length)}
        onError={(error) => {
          runtime.error(error);
          void load();
        }}
      />
      {videoRecovery?.mediaId === current.media.id ? (
        <div className={`video-recovery${videoRecovery.failed ? " failed" : ""}`} role="status">
          <strong>{videoRecovery.failed ? "Vídeo indisponível" : "Otimizando vídeo"}</strong>
          <span>{videoRecovery.message}</span>
        </div>
      ) : null}
      {activeInterruption ? (
        <CallOverlay interruption={activeInterruption} />
      ) : null}
      {!activated ? (
        <AudioUnlock onClick={activate} activating={activating} error={activationError} />
      ) : null}
      {diagnosticMode ? (
        <AudioDiagnostic
          diagnostics={audioDiagnostics}
          player={playerDiagnostics}
          soundEnabled={soundEnabled}
        />
      ) : null}
    </main>
  );
}

function AudioUnlock({
  onClick,
  activating,
  error,
}: {
  onClick: () => Promise<void>;
  activating: boolean;
  error: string | null;
}) {
  return (
    <div className="audio-unlock-gate">
      <div>
        <span>Famintoos TV</span>
        <h1>Pronto para iniciar</h1>
        <p>Pressione o botão abaixo com o controle remoto para liberar imagem e som.</p>
        <button className="audio-unlock" onClick={() => void onClick()} disabled={activating} autoFocus>
          {activating ? "Iniciando exibição..." : "Iniciar exibição"}
        </button>
        {error ? <p className="activation-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}

function isScheduledNow(media: TvPlaylistRecord["media"]) {
  const now = new Date();
  const today = localDateKey(now);
  if (media.starts_at && today < media.starts_at.slice(0, 10)) return false;
  if (media.ends_at && today > media.ends_at.slice(0, 10)) return false;
  if (media.weekdays?.length && !media.weekdays.includes(now.getDay()))
    return false;
  const time = now.toTimeString().slice(0, 8);
  if (media.start_time && time < media.start_time) return false;
  if (media.end_time && time > media.end_time) return false;
  return true;
}

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function updateCall(
  id: string,
  companyId: string,
  values:
    | { status: "showing"; displayed_at: string }
    | { status: "completed"; completed_at: string },
) {
  if (!supabase) return;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase
      .from("tv_calls")
      .update(values)
      .eq("id", id)
      .eq("company_id", companyId)
      .select("id")
      .maybeSingle();
    if (!error && data) return;
  }
}

function CallOverlay({ interruption }: { interruption: Interruption }) {
  const isCall = interruption.kind === "call";
  return (
    <div className="call-overlay" role="status" aria-live="assertive">
      <div>
        {isCall ? <span className="call-kicker">Chamando</span> : null}
        <strong>
          {isCall
            ? (interruption.subtitle ??
              interruption.callValues?.order_number ??
              interruption.title)
            : interruption.title}
        </strong>
        <p>
          {isCall
            ? (interruption.callValues?.call_text ?? interruption.title)
            : interruption.subtitle}
        </p>
      </div>
    </div>
  );
}

function AudioDiagnostic({
  diagnostics,
  player,
  soundEnabled,
}: {
  diagnostics: TvAudioDiagnostics;
  player: TvPlayerDiagnostics;
  soundEnabled: boolean;
}) {
  const speech = speechService.diagnostics();
  return (
    <aside className="audio-diagnostic">
      <strong>Diagnóstico do player</strong>
      <span>áudio habilitado: {diagnostics.enabled ? "sim" : "não"}</span>
      <span>sound_enabled: {soundEnabled ? "true" : "false"}</span>
      <span>volume: {Math.round(diagnostics.volume * 100)}%</span>
      <span>AudioContext: {diagnostics.contextState}</span>
      <span>mídia carregada: {diagnostics.loadedMedia ?? "nenhuma"}</span>
      <span>última mídia: {player.lastMedia ?? "nenhuma"}</span>
      <span>recursos: {player.approximateResources}</span>
      <span>subscriptions: {player.subscriptionCount}</span>
      <span>timers gerenciados: {player.timerCount}</span>
      <span>
        cache/preload: {player.cachedItems}/{player.preloadCount}
      </span>
      <span>última reconexão: {player.lastReconnectAt ?? "nenhuma"}</span>
      <span>último evento: {player.lastLifecycleEvent ?? "nenhum"}</span>
      <span>último reload: {player.lastReloadReason ?? "nenhum"}</span>
      <span>
        voz:{" "}
        {speech.supported
          ? `${speech.voiceCount} disponível(is)`
          : "indisponível"}
      </span>
      <span>
        último erro:{" "}
        {player.lastError ??
          diagnostics.lastError ??
          speech.lastError ??
          "nenhum"}
      </span>
    </aside>
  );
}

function Media({
  item,
  displayId,
  videoRef,
  soundEnabled,
  audioActivated,
  playbackEnabled,
  onVideoEvent,
  onEnded,
  onError,
}: {
  item: ProgramItem;
  displayId: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  soundEnabled: boolean;
  audioActivated: boolean;
  playbackEnabled: boolean;
  onVideoEvent: (event: string, video: HTMLVideoElement) => void;
  onEnded: () => void;
  onError: (error: Error) => void;
}) {
  const url = resolveMediaUrl(item.media);
  const saved = readPlayback(item.companyId, displayId);
  const attachedVideo = useRef<HTMLVideoElement | null>(null);
  const playbackStarted = useRef(false);
  const attachVideo = useCallback(
    (video: HTMLVideoElement | null) => {
      const previous = attachedVideo.current;
      if (previous && previous !== video) tvAudioService.releaseMedia(previous);
      attachedVideo.current = video;
      videoRef.current = video;
    },
    [videoRef],
  );
  useEffect(
    () => () => {
      if (attachedVideo.current)
        tvAudioService.releaseMedia(attachedVideo.current);
      videoRef.current = null;
    },
    [videoRef],
  );
  const restoreAndPlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !playbackEnabled || playbackStarted.current) return;
    if (saved?.itemId === item.id && Number.isFinite(saved.elapsedSeconds)) {
      try {
        const lastPlayableSecond = Number.isFinite(video.duration)
          ? Math.max(0, video.duration - 0.25)
          : saved.elapsedSeconds;
        video.currentTime = Math.max(
          0,
          Math.min(saved.elapsedSeconds, lastPlayableSecond),
        );
      } catch {
        /* Some older browsers only accept currentTime after canplay. */
      }
    }
    video.volume = item.volume;
    // Always start the visual track muted. Amazon Silk can reject the whole
    // play() request when sound is enabled, even after a previous unlock.
    video.muted = true;
    try {
      await playVideo(video);
      playbackStarted.current = true;
    } catch {
      onError(mediaPlaybackError(video, item));
      return;
    }
    if (audioActivated && soundEnabled && !item.muted && !item.soundtrack?.muteOriginalAudio) {
      video.muted = false;
      try {
        await tvAudioService.playMediaAudio(video, item.volume);
      } catch {
        // Keep the picture running if audible playback is blocked.
        video.muted = true;
        if (video.paused) void playVideo(video).catch(() => undefined);
      }
    }
  }, [audioActivated, item, onError, playbackEnabled, saved, soundEnabled, videoRef]);

  useEffect(() => {
    if (playbackEnabled) void restoreAndPlay();
  }, [playbackEnabled, restoreAndPlay]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || item.media.type !== "video") return;
    const audible = audioActivated && soundEnabled && !item.muted && !item.soundtrack?.muteOriginalAudio;
    if (!audible) {
      video.muted = true;
      return;
    }
    video.muted = false;
    void tvAudioService.playMediaAudio(video, item.volume).catch(() => {
      video.muted = true;
      if (video.paused) void playVideo(video).catch(() => undefined);
    });
  }, [audioActivated, item, soundEnabled, videoRef]);
  return (
    <div
      className={`media-layer ${item.media.type === "video" ? "media-layer-video" : ""}`}
      style={{ "--media-fit": item.fit } as React.CSSProperties}
    >
      {item.media.type === "video" && url ? (
        <video
          className="tv-video"
          ref={attachVideo}
          src={url}
          preload="auto"
          muted
          controls={false}
          disablePictureInPicture
          onLoadedMetadata={(event) => { onVideoEvent("loadedmetadata", event.currentTarget); void restoreAndPlay(); }}
          onLoadedData={(event) => { onVideoEvent("loadeddata", event.currentTarget); void restoreAndPlay(); }}
          onCanPlay={(event) => { onVideoEvent("canplay", event.currentTarget); void restoreAndPlay(); }}
          onPlaying={(event) => onVideoEvent("playing", event.currentTarget)}
          onWaiting={(event) => onVideoEvent("waiting", event.currentTarget)}
          onStalled={(event) => onVideoEvent("stalled", event.currentTarget)}
          onEnded={onEnded}
          onError={(event) =>
            onError(mediaPlaybackError(event.currentTarget, item))
          }
          playsInline
        />
      ) : null}
      {item.media.type === "image" && url ? (
        <>
          {item.fit === "blur_background" ? (
            <img className="media-blurred-background" src={url} alt="" aria-hidden="true" />
          ) : null}
          <img
            className={`media-main-image ${item.fit === "blur_background" ? "media-main-image-centered" : ""} image-motion image-motion-${item.media.animation ?? "none"}`}
            style={{
              "--motion-duration": `${item.durationSeconds}s`,
            } as React.CSSProperties}
            src={url}
            alt={item.media.title ?? ""}
            onError={() =>
              onError(
                new Error(
                  `Falha ao carregar imagem: ${item.media.title ?? item.id}`,
                ),
              )
            }
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

async function playVideo(video: HTMLVideoElement) {
  const result = video.play();
  if (result && typeof result.then === "function") await result;
}

function mediaPlaybackError(video: HTMLVideoElement, item: ProgramItem) {
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
  return new Error(
    `Falha no vídeo ${item.media.title ?? item.id}: ${reason}.`,
  );
}
