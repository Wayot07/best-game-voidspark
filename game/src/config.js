// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  speed: 340,
  hull: 3,
  fireInterval: 0.14,
  bulletSpeed: 740,
  bulletRadius: 5,
  invulnerable: 1.4,
  dashSpeed: 920,
  dashTime: 0.16,
  dashCooldown: 2.2,
  dashInvulnerable: 0.45,
};

/** Enemy kinds, each with its own shape, behaviour and score. */
export const ENEMY = {
  drifter: { radius: 19, hp: 1, speed: 96, score: 100, color: '#ff5d8f' },
  weaver: { radius: 18, hp: 2, speed: 72, score: 150, color: '#ffb84d' },
  splitter: { radius: 28, hp: 3, speed: 56, score: 200, color: '#b78cff' },
  mite: { radius: 11, hp: 1, speed: 178, score: 50, color: '#ff8f5d' },
  dasher: { radius: 18, hp: 2, speed: 84, score: 200, color: '#5dff8f' },
};

/** Enemy orbs (weaver shots): slow, dodgeable, one hull on hit. */
export const ORB = { radius: 7, speed: 205 };

/** Which kinds a wave may spawn, by wave number. */
export const WAVE_KINDS = {
  1: ['drifter'],
  2: ['drifter', 'weaver'],
  3: ['drifter', 'weaver', 'splitter'],
  4: ['drifter', 'weaver', 'splitter', 'dasher'],
};

/** Wave pacing: how many enemies, how fast they trickle in, and the breather between waves. */
export const WAVE = {
  baseCount: 6,
  perWave: 4,
  spawnInterval: 1.1,
  spawnScale: 0.94,
  minSpawnInterval: 0.42,
  clearBonus: 250,
  breather: 2.5,
};

/** Combo: kills inside the window chain; every 5 chained kills raise the multiplier, to x8. */
export const COMBO = { window: 2.5, perStep: 5, maxMultiplier: 8 };

/** Pickups: drop chance on a kill, how long they last, what they do. */
export const PICKUP = {
  dropChance: 0.12,
  miteDropChance: 0.05,
  lifetime: 9,
  magnetRadius: 110,
  rapidSeconds: 8,
  spreadSeconds: 8,
};

/** Pool sizes; the pools are allocated once at boot and never grow. */
export const POOL = { enemies: 96, bullets: 128, orbs: 64, particles: 420, pickups: 16, popups: 24 };

export const PALETTE = {
  backdrop: '#05060f',
  nebulaA: '#1b0f3a',
  nebulaB: '#0a2a3a',
  grid: '#182036',
  player: '#7df9ff',
  playerCore: '#ffffff',
  bullet: '#bff6ff',
  orb: '#ffb84d',
  shield: '#6fd8ff',
  text: '#eef4ff',
  muted: '#8b93b8',
  danger: '#ff5d6c',
  gold: '#ffd94d',
  panel: '#12172a',
  panelEdge: '#2c3a5e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'voidspark.best';
