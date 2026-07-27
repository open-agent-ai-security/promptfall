import assert from "node:assert/strict";
import test from "node:test";
import {
  MUSIC_STALL_THRESHOLD_MS,
  createMusicHealthMonitor,
} from "../app/music-health.js";

const flushPlayback = () =>
  new Promise((resolve) => setImmediate(resolve));

class MockAudio {
  constructor() {
    this.currentTime = 0;
    this.ended = false;
    this.error = null;
    this.muted = true;
    this.paused = true;
    this.loadCalls = 0;
    this.pauseCalls = 0;
    this.playCalls = 0;
    this.playError = null;
    this.listeners = new Map();
  }

  addEventListener(name, listener) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(listener);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name, listener) {
    this.listeners.get(name)?.delete(listener);
  }

  dispatch(name) {
    this.listeners.get(name)?.forEach((listener) => listener());
  }

  load() {
    this.loadCalls += 1;
    this.currentTime = 0;
    this.ended = false;
    this.error = null;
  }

  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }

  play() {
    this.playCalls += 1;
    if (this.playError) return Promise.reject(this.playError);
    this.paused = false;
    this.ended = false;
    return Promise.resolve();
  }
}

function setup() {
  const title = new MockAudio();
  const levelOne = new MockAudio();
  let desiredKey = "levelOne";
  let muted = false;
  let visible = true;
  let clock = 0;
  let intervalCallback = null;
  const enforced = [];
  const errors = [];

  const monitor = createMusicHealthMonitor({
    tracks: { title, levelOne },
    getDesiredKey: () => desiredKey,
    isMuted: () => muted,
    isVisible: () => visible,
    enforceSingleTrack: (key) => enforced.push(key),
    onPlaybackError: (error, key) => errors.push({ error, key }),
    now: () => clock,
    setIntervalFn: (callback) => {
      intervalCallback = callback;
      return 17;
    },
    clearIntervalFn: () => {
      intervalCallback = null;
    },
  });

  return {
    title,
    levelOne,
    monitor,
    enforced,
    errors,
    advance(milliseconds) {
      clock += milliseconds;
    },
    setDesired(key) {
      desiredKey = key;
    },
    setMuted(value) {
      muted = value;
    },
    setVisible(value) {
      visible = value;
    },
    tick() {
      intervalCallback?.();
    },
  };
}

test("starts only the desired music track", async () => {
  const state = setup();
  await state.monitor.ensure({ gesture: true });

  assert.equal(state.levelOne.playCalls, 1);
  assert.equal(state.title.playCalls, 0);
  assert.deepEqual(state.enforced, ["levelOne"]);
});

test("lets the mixer preserve an intentional transition crossfade", async () => {
  const state = setup();
  await state.monitor.ensure({ enforce: false });

  assert.equal(state.levelOne.playCalls, 1);
  assert.deepEqual(state.enforced, []);
});

test("recovers a track that reports playing but stops advancing", async () => {
  const state = setup();
  state.levelOne.paused = false;
  state.levelOne.currentTime = 14;
  state.monitor.start();
  state.monitor.poll();

  state.advance(MUSIC_STALL_THRESHOLD_MS + 1);
  state.monitor.poll();
  await flushPlayback();

  assert.equal(state.levelOne.pauseCalls, 1);
  assert.equal(state.levelOne.playCalls, 1);
  assert.deepEqual(state.enforced, ["levelOne"]);
  state.monitor.stop();
});

test("event recovery escalates a repeated stall to a reload", async () => {
  const state = setup();
  state.levelOne.paused = false;
  state.monitor.start();

  state.levelOne.dispatch("stalled");
  await flushPlayback();
  assert.equal(state.levelOne.playCalls, 1);
  assert.equal(state.levelOne.loadCalls, 0);

  state.advance(MUSIC_STALL_THRESHOLD_MS + 1);
  state.levelOne.dispatch("stalled");
  await flushPlayback();
  assert.equal(state.levelOne.playCalls, 2);
  assert.equal(state.levelOne.loadCalls, 1);
  state.monitor.stop();
});

test("retries autoplay rejection on the next user gesture", async () => {
  const state = setup();
  state.levelOne.playError = Object.assign(new Error("gesture required"), {
    name: "NotAllowedError",
  });

  assert.equal(await state.monitor.ensure(), false);
  state.levelOne.playError = null;
  state.monitor.poll();
  await Promise.resolve();
  assert.equal(state.levelOne.playCalls, 1);

  assert.equal(await state.monitor.ensure({ gesture: true }), true);
  assert.equal(state.levelOne.playCalls, 2);
  assert.equal(state.errors.length, 1);
});

test("restores desired music when the page becomes visible again", async () => {
  const state = setup();
  state.setVisible(false);
  assert.equal(await state.monitor.restore(), false);
  assert.equal(state.levelOne.playCalls, 0);

  state.setVisible(true);
  assert.equal(await state.monitor.restore(), true);
  assert.equal(state.levelOne.playCalls, 1);
});

test("restarts an unexpectedly ended looping track", async () => {
  const state = setup();
  state.levelOne.paused = false;
  state.levelOne.ended = true;
  state.levelOne.currentTime = 60;
  state.monitor.start();

  state.levelOne.dispatch("ended");
  await flushPlayback();

  assert.equal(state.levelOne.currentTime, 0);
  assert.equal(state.levelOne.playCalls, 1);
  state.monitor.stop();
});
