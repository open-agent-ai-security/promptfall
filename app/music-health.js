export const MUSIC_HEALTH_POLL_MS = 1_500;
export const MUSIC_STALL_THRESHOLD_MS = 4_500;
const MUSIC_PROGRESS_EPSILON_SECONDS = 0.05;

export function createMusicHealthMonitor({
  tracks,
  getDesiredKey,
  isMuted,
  isVisible = () => true,
  enforceSingleTrack = () => {},
  onPlaybackError = () => {},
  now = () => performance.now(),
  setIntervalFn = (callback, delay) => window.setInterval(callback, delay),
  clearIntervalFn = (timer) => window.clearInterval(timer),
  pollMs = MUSIC_HEALTH_POLL_MS,
  stallThresholdMs = MUSIC_STALL_THRESHOLD_MS,
}) {
  let interval = null;
  let disposed = false;
  let blockedUntilGesture = false;
  const recoveryPromises = new Map();
  let observation = null;
  const listeners = [];

  const desired = () => {
    const key = getDesiredKey();
    const audio = key ? tracks[key] : null;
    return key && audio ? { key, audio } : null;
  };

  const resetObservation = (key, audio) => {
    observation = {
      key,
      currentTime: Number.isFinite(audio.currentTime) ? audio.currentTime : 0,
      progressedAt: now(),
      lastRecoveryAt: -Infinity,
      recoveriesWithoutProgress: 0,
    };
  };

  const noteProgress = (key, audio, allowSameTime = false) => {
    if (!observation || observation.key !== key) {
      resetObservation(key, audio);
      return;
    }
    const currentTime = Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : 0;
    if (
      allowSameTime ||
      currentTime >=
        observation.currentTime + MUSIC_PROGRESS_EPSILON_SECONDS ||
      currentTime < observation.currentTime
    ) {
      observation.currentTime = currentTime;
      observation.progressedAt = now();
      observation.recoveriesWithoutProgress = 0;
    }
  };

  const notePlaybackStarted = (key, audio) => {
    if (!observation || observation.key !== key) {
      resetObservation(key, audio);
      return;
    }
    observation.currentTime = Number.isFinite(audio.currentTime)
      ? audio.currentTime
      : 0;
    observation.progressedAt = now();
  };

  const isStalled = (key, audio) => {
    if (!observation || observation.key !== key) {
      resetObservation(key, audio);
      return false;
    }
    noteProgress(key, audio);
    return (
      !audio.paused &&
      !audio.ended &&
      !audio.error &&
      now() - observation.progressedAt >= stallThresholdMs
    );
  };

  const ensure = ({
    gesture = false,
    forceRecovery = false,
    reload = false,
    restart = false,
    enforce = true,
  } = {}) => {
    if (gesture) blockedUntilGesture = false;
    const target = desired();
    if (
      disposed ||
      !target ||
      isMuted() ||
      !isVisible() ||
      (blockedUntilGesture && !gesture)
    ) {
      return Promise.resolve(false);
    }

    const { key, audio } = target;
    const stalled = isStalled(key, audio);
    const unhealthy =
      forceRecovery ||
      stalled ||
      audio.paused ||
      audio.ended ||
      Boolean(audio.error);

    if (enforce && (gesture || unhealthy)) enforceSingleTrack(key);
    audio.muted = false;
    if (!unhealthy) return Promise.resolve(true);
    const existingRecovery = recoveryPromises.get(key);
    if (existingRecovery) return existingRecovery;

    if (!observation || observation.key !== key) {
      resetObservation(key, audio);
    }
    const repeatedStall =
      (stalled || forceRecovery) &&
      observation.recoveriesWithoutProgress > 0;
    const shouldReload = reload || Boolean(audio.error) || repeatedStall;

    observation.lastRecoveryAt = now();
    observation.recoveriesWithoutProgress += 1;

    if (audio.ended || restart) {
      audio.currentTime = 0;
    }
    if (shouldReload) {
      audio.pause();
      audio.load();
      audio.currentTime = 0;
    } else if (stalled || forceRecovery) {
      // A pause/play cycle recovers transient media stalls without throwing
      // away the listener's position. A repeated stall escalates to reload.
      audio.pause();
    }

    const recoveryPromise = Promise.resolve()
      .then(() => audio.play())
      .then(() => {
        blockedUntilGesture = false;
        // play() resolving proves that playback was accepted, not that media
        // time is advancing. Only a real time update clears stall attempts.
        notePlaybackStarted(key, audio);
        return true;
      })
      .catch((error) => {
        if (error?.name === "NotAllowedError") {
          blockedUntilGesture = true;
        }
        onPlaybackError(error, key);
        return false;
      })
      .finally(() => {
        if (recoveryPromises.get(key) === recoveryPromise) {
          recoveryPromises.delete(key);
        }
      });

    recoveryPromises.set(key, recoveryPromise);
    return recoveryPromise;
  };

  const poll = () => {
    const target = desired();
    if (
      disposed ||
      !target ||
      isMuted() ||
      !isVisible() ||
      blockedUntilGesture
    ) {
      return;
    }
    const { key, audio } = target;
    if (!observation || observation.key !== key) {
      resetObservation(key, audio);
    } else {
      noteProgress(key, audio);
    }

    const stalled = isStalled(key, audio);
    const recoveryDue =
      audio.paused ||
      audio.ended ||
      Boolean(audio.error) ||
      stalled;
    const cooledDown =
      now() - observation.lastRecoveryAt >= pollMs;
    if (recoveryDue && cooledDown) {
      void ensure({
        forceRecovery: stalled,
        reload: Boolean(audio.error),
        restart: audio.ended,
      });
    }
  };

  const listen = (key, audio, eventName, handler) => {
    const listener = () => {
      if (getDesiredKey() !== key || isMuted() || !isVisible()) return;
      handler();
    };
    audio.addEventListener(eventName, listener);
    listeners.push(() => audio.removeEventListener(eventName, listener));
  };

  const start = () => {
    if (disposed || interval !== null) return;
    Object.entries(tracks).forEach(([key, audio]) => {
      listen(key, audio, "playing", () => notePlaybackStarted(key, audio));
      listen(key, audio, "timeupdate", () => noteProgress(key, audio));
      listen(key, audio, "ended", () => {
        void ensure({ restart: true });
      });
      listen(key, audio, "error", () => {
        void ensure({ reload: true });
      });
      listen(key, audio, "stalled", () => {
        void ensure({ forceRecovery: true });
      });
    });
    interval = setIntervalFn(poll, pollMs);
  };

  const restore = () => {
    if (disposed || !isVisible()) return Promise.resolve(false);
    poll();
    return ensure();
  };

  const stop = () => {
    if (disposed) return;
    disposed = true;
    if (interval !== null) {
      clearIntervalFn(interval);
      interval = null;
    }
    listeners.splice(0).forEach((remove) => remove());
  };

  return {
    ensure,
    poll,
    restore,
    start,
    stop,
  };
}
