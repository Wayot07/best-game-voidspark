// Keyboard and pointer input. Held keys give a steering vector and the aim point; one-shot
// presses (start or restart, pause, dash, mute) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_MUTE = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const FIRE_KEY = new Set(['Space']);
const PAUSE = new Set(['KeyP', 'Escape']);
const DASH = new Set(['ShiftLeft', 'ShiftRight']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseSeen = false;

  window.addEventListener('keydown', (event) => {
    if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (DASH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_DASH;
    } else if (MUTE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (FIRE_KEY.has(event.code)) {
      // Space fires during play and also starts/restarts on the menus.
      keys.add(event.code);
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      keys.add(event.code);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  function trackMouse(event) {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseSeen = true;
  }
  canvas.addEventListener('pointermove', trackMouse);
  canvas.addEventListener('pointerdown', (event) => {
    trackMouse(event);
    mouseDown = true;
    actions |= ACTION_CONFIRM;
    event.preventDefault();
  });
  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function axis(negative, positive) {
    let value = 0;
    for (const code of negative) if (keys.has(code)) value -= 1;
    for (const code of positive) if (keys.has(code)) value += 1;
    return value;
  }

  return {
    /** Steering vector, each component -1, 0 or 1 (diagonals are normalised by the caller). */
    move() {
      return { x: axis(LEFT, RIGHT), y: axis(UP, DOWN) };
    },
    /** Aim point in canvas CSS pixels, or null before the mouse has moved. */
    aim() {
      return mouseSeen ? { x: mouseX, y: mouseY } : null;
    },
    /** True while the fire button (mouse) or Space is held. */
    firing() {
      return mouseDown || keys.has('Space');
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
