// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by an autopilot, so the frame is
// what a short game really looks like and the same seed always gives the same frame.
// The play pilot flies well (keeps its distance, leads its shots, dashes clear); the end
// pilot flies straight at the nearest enemy and never shoots, so it is caught out, as a
// hurried player is.

import { FIELD, PLAYER, STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 40;
/** The play scene is taken once the fight has closed in, not at a fixed second. */
const PLAY_MIN_ENEMIES = 5;
const PLAY_MIN_SECONDS = 12;
const PLAY_NEAR_RADIUS = 420;
const END_LIMIT_SECONDS = 600;

/** The nearest live enemy, or null when the arena is empty. */
function nearestEnemy(state) {
  let best = null;
  let bestD2 = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = e;
    }
  }
  return best === null ? null : { enemy: best, d2: bestD2 };
}

function nearestPickup(state) {
  let best = null;
  let bestD2 = Infinity;
  for (const p of state.pickups) {
    if (!p.active) continue;
    const dx = p.x - state.player.x;
    const dy = p.y - state.player.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = p;
    }
  }
  return best;
}

/**
 * The competent pilot: flee what is close, chase pickups, otherwise hold near the centre,
 * and always shoot the nearest enemy with a lead on its velocity.
 */
function pilotPlay(state) {
  const player = state.player;
  const found = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  let ax = player.x + Math.cos(player.angle) * 100;
  let ay = player.y + Math.sin(player.angle) * 100;
  let firing = false;
  let dashPressed = false;
  if (found !== null) {
    const { enemy, d2 } = found;
    const d = Math.sqrt(d2);
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    if (d < 130) {
      // Too close: back away, and dash if it is right on top of us.
      mx = -dx / d;
      my = -dy / d;
      if (d < 80 && player.dashCooldown <= 0) dashPressed = true;
    } else {
      const pickup = nearestPickup(state);
      if (pickup !== null && d2 > 200 * 200) {
        mx = (pickup.x - player.x) / Math.max(1, Math.hypot(pickup.x - player.x, pickup.y - player.y));
        my = (pickup.y - player.y) / Math.max(1, Math.hypot(pickup.x - player.x, pickup.y - player.y));
      } else {
        // Drift toward the centre so the arena stays open around us.
        const cx = FIELD.width / 2 - player.x;
        const cy = FIELD.height / 2 - player.y;
        const cd = Math.hypot(cx, cy);
        if (cd > 180) {
          mx = cx / cd;
          my = cy / cd;
        } else {
          mx = -dy / d;
          my = dx / d;
        }
      }
    }
    // Lead the target: where it will be when the bullet arrives.
    const flight = d / PLAYER.bulletSpeed;
    ax = enemy.x + enemy.vx * flight;
    ay = enemy.y + enemy.vy * flight;
    // Hold fire until the target is close: the arena stays busy and the fight reads.
    firing = d < 420;
  }
  return { mx, my, ax, ay, firing, dashPressed };
}

/** The doomed pilot: flies at the nearest enemy and fires with a wild, unleaded aim, so
 *  it scores a few kills before the waves catch it — a game over with a real score. */
function pilotEnd(state) {
  const player = state.player;
  const found = nearestEnemy(state);
  let mx = 0;
  let my = 0;
  let ax = player.x + Math.cos(player.angle) * 100;
  let ay = player.y + Math.sin(player.angle) * 100;
  let firing = false;
  if (found !== null) {
    const { enemy, d2 } = found;
    const d = Math.sqrt(d2) || 1;
    mx = (enemy.x - player.x) / d;
    my = (enemy.y - player.y) / d;
    // Aim wide of the target, by a wobble that shrinks as it closes: some shots land
    // at close range, most do not, so it scores before the waves catch it.
    const wobble = Math.sin(state.elapsed * 1.3) * 70 * (d / 500);
    ax = enemy.x - ((enemy.y - player.y) / d) * wobble;
    ay = enemy.y + ((enemy.x - player.x) / d) * wobble;
    firing = d < 500;
  }
  return { mx, my, ax, ay, firing, dashPressed: false };
}

/** How many enemies are close to the player (the fight, not the reinforcements). */
function enemiesNear(state, radius) {
  let count = 0;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = e.x - state.player.x;
    const dy = e.y - state.player.y;
    if (dx * dx + dy * dy < radius * radius) count += 1;
  }
  return count;
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, null, true);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'play') {
    // Play until the fight has closed in (several foes near the ship), or the cap.
    for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
      if (world.step(STEP, pilotPlay(world.state), false) & EVENT_OVER) break;
      if (world.state.elapsed >= PLAY_MIN_SECONDS && enemiesNear(world.state, PLAY_NEAR_RADIUS) >= PLAY_MIN_ENEMIES) break;
    }
    const over = world.state.player.hull <= 0;
    return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
    if (world.step(STEP, pilotEnd(world.state), false) & EVENT_OVER) break;
  }
  // Let the hit flash and shake settle, so the game-over panel reads cleanly.
  world.state.flash = 0;
  world.state.shake = 0;
  const over = world.state.player.hull <= 0;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}
