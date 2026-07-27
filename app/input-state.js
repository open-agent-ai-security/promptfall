const LEFT_CODES = new Set(["ArrowLeft", "KeyA"]);
const RIGHT_CODES = new Set(["ArrowRight", "KeyD"]);
const JUMP_CODES = new Set(["ArrowUp", "KeyW", "Space"]);
const GAMEPLAY_CODES = new Set([
  ...LEFT_CODES,
  ...RIGHT_CODES,
  ...JUMP_CODES,
]);

/**
 * @typedef {"left" | "right"} TouchDirection
 * @typedef {{
 *   pressedKeys: Set<string>,
 *   touchDirections: Map<number, TouchDirection>,
 *   touchJump: boolean,
 * }} ControlState
 */

/** @returns {ControlState} */
export function createControlState() {
  return {
    pressedKeys: new Set(),
    touchDirections: new Map(),
    touchJump: false,
  };
}

export function isGameplayControlCode(code) {
  return GAMEPLAY_CODES.has(code);
}

/** @param {ControlState} state */
export function pressControlKey(state, code) {
  if (isGameplayControlCode(code)) state.pressedKeys.add(code);
}

/** @param {ControlState} state */
export function releaseControlKey(state, code) {
  state.pressedKeys.delete(code);
}

/**
 * @param {ControlState} state
 * @param {number} pointerId
 * @param {TouchDirection} direction
 */
export function setTouchDirection(state, pointerId, direction) {
  state.touchDirections.set(pointerId, direction);
}

/** @param {ControlState} state */
export function releaseTouchDirection(state, pointerId) {
  state.touchDirections.delete(pointerId);
}

/** @param {ControlState} state */
export function setTouchJump(state, active) {
  state.touchJump = active;
}

/** @param {ControlState} state */
export function clearControlState(state) {
  state.pressedKeys.clear();
  state.touchDirections.clear();
  state.touchJump = false;
}

/** @param {ControlState} state */
export function getControlInput(state) {
  const touchDirections = [...state.touchDirections.values()];
  return {
    left:
      [...LEFT_CODES].some((code) => state.pressedKeys.has(code)) ||
      touchDirections.includes("left"),
    right:
      [...RIGHT_CODES].some((code) => state.pressedKeys.has(code)) ||
      touchDirections.includes("right"),
    jump:
      state.touchJump ||
      [...JUMP_CODES].some((code) => state.pressedKeys.has(code)),
  };
}
