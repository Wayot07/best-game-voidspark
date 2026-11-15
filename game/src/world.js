// The game's rules and state, with no drawing and no browser in it: the player's ship,
// the waves of enemies, bullets, orbs, pickups, particles, combo and score. step() advances
// one fixed step and returns what happened as bit flags, so the caller can react (sound,
// announcements) without the world knowing about screens or sound. Nothing here allocates
// after createWorld returns: every entity lives in a pool made once at boot.

import { COMBO, ENEMY, FIELD, ORB, PICKUP, PLAYER, POOL, WAVE, WAVE_KINDS } from './config.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_WEAVER = 'weaver';
export const KIND_SPLITTER = 'splitter';
export const KIND_MITE = 'mite';
export const KIND_DASHER = 'dasher';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WAVE = 8;
export const EVENT_OVER = 16;
export const EVENT_CLEAR = 32;
export const EVENT_DASH = 64;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, vx: 0, vy: 0, angle: -Math.PI / 2,
    hull: PLAYER.hull, fireTimer: 0, invulnerable: 0,
    dashTimer: 0, dashCooldown: 0, dashX: 0, dashY: 0,
    shield: false, rapidTimer: 0, spreadTimer: 0,
  };
  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, vx: 0, vy: 0, hp: 1, radius: 16, speed: 0, score: 0, color: '#fff', fireTimer: 0, state: 'chase', stateTimer: 0, lockX: 0, lockY: 0, seed: 0 });
  }
  const bullets = [];
  for (let i = 0; i < POOL.bullets; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: PLAYER.bulletRadius });
  const orbs = [];
  for (let i = 0; i < POOL.orbs; i += 1) orbs.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: ORB.radius });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  const pickups = [];
  for (let i = 0; i < POOL.pickups; i += 1) pickups.push({ active: false, kind: 'shield', x: 0, y: 0, vx: 0, vy: 0, life: 0 });
  const popups = [];
  for (let i = 0; i < POOL.popups; i += 1) popups.push({ active: false, x: 0, y: 0, text: '', life: 0, maxLife: 1, color: '#fff' });

  const state = {
    player, enemies, bullets, orbs, particles, pickups, popups,
    score: 0, wave: 1, combo: 0, comboTimer: 0, multiplier: 1, kills: 0,
    elapsed: 0, shake: 0, flash: 0,
    banner: { text: '', sub: '', t: 0 },
    waveState: 'fighting', breatherTimer: 0, spawnTimer: 0, spawnQueue: [],
    ambientTimer: 0,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v; p.vy = Math.sin(angle) * v;
      p.maxLife = 0.35 + random() * 0.45;
      p.life = p.maxLife;
      p.size = 2 + random() * 3;
      p.color = color;
    }
  }

  function addPopup(x, y, text, color) {
    const p = free(popups);
    if (p === null) return;
    p.active = true;
    p.x = x; p.y = y;
    p.text = text;
    p.maxLife = 1.1;
    p.life = p.maxLife;
    p.color = color;
  }

  function setBanner(text, sub, seconds) {
    state.banner.text = text;
    state.banner.sub = sub;
    state.banner.t = seconds;
  }

  function buildWaveQueue(wave) {
    const kinds = WAVE_KINDS[Math.min(wave, 4)];
    const count = WAVE.baseCount + WAVE.perWave * (wave - 1);
    const queue = [];
    for (let i = 0; i < count; i += 1) {
      // The first three of a wave are always drifters, so the player is never rushed.
      queue.push(i < 3 ? KIND_DRIFTER : kinds[Math.floor(random() * kinds.length)]);
    }
    return queue;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = buildWaveQueue(wave);
    state.spawnTimer = 0.8;
    state.waveState = 'fighting';
    setBanner(`WAVE ${wave}`, wave === 1 ? 'clear the void' : 'they keep coming', 2);
  }

  function spawnInterval() {
    return Math.max(WAVE.minSpawnInterval, WAVE.spawnInterval * WAVE.spawnScale ** (state.wave - 1));
  }

  function spawnPoint() {
    // An edge point at least 240 away from the player, so nothing appears on top of them.
    for (let tries = 0; tries < 12; tries += 1) {
      const edge = Math.floor(random() * 4);
      let x = 0;
      let y = 0;
      if (edge === 0) { x = random() * FIELD.width; y = -30; }
      else if (edge === 1) { x = FIELD.width + 30; y = random() * FIELD.height; }
      else if (edge === 2) { x = random() * FIELD.width; y = FIELD.height + 30; }
      else { x = -30; y = random() * FIELD.height; }
      if (dist2(x, y, player.x, player.y) > 240 * 240) return { x, y };
    }
    return { x: FIELD.width / 2, y: -30 };
  }

  function spawnEnemy(kind) {
    const e = free(enemies);
    if (e === null) return;
    const def = ENEMY[kind];
    const at = spawnPoint();
    e.active = true;
    e.kind = kind;
    e.x = at.x; e.y = at.y;
    e.vx = 0; e.vy = 0;
    e.hp = def.hp + (kind === KIND_SPLITTER && state.wave >= 6 ? 1 : 0);
    e.radius = def.radius;
    e.speed = def.speed * (1 + Math.min(0.5, (state.wave - 1) * 0.04));
    e.score = def.score;
    e.color = def.color;
    e.fireTimer = 1.5 + random() * 1.5;
    e.state = 'chase';
    e.stateTimer = 0.6 + random() * 0.8;
    e.seed = random() * TAU;
  }

  function spawnMites(x, y) {
    for (let i = 0; i < 3; i += 1) {
      const e = free(enemies);
      if (e === null) return;
      const def = ENEMY.mite;
      e.active = true;
      e.kind = KIND_MITE;
      e.x = x + (random() - 0.5) * 30;
      e.y = y + (random() - 0.5) * 30;
      e.vx = (random() - 0.5) * 120;
      e.vy = (random() - 0.5) * 120;
      e.hp = def.hp;
      e.radius = def.radius;
      e.speed = def.speed;
      e.score = def.score;
      e.color = def.color;
      e.fireTimer = 0;
      e.state = 'chase';
      e.stateTimer = 0;
      e.seed = random() * TAU;
    }
  }

  function dropPickup(x, y, isMite) {
    const chance = isMite ? PICKUP.miteDropChance : PICKUP.dropChance;
    if (random() > chance) return;
    const p = free(pickups);
    if (p === null) return;
    const kinds = ['shield', 'rapid', 'spread', 'repair'];
    p.active = true;
    p.kind = kinds[Math.floor(random() * kinds.length)];
    p.x = x; p.y = y;
    p.vx = (random() - 0.5) * 40;
    p.vy = (random() - 0.5) * 40;
    p.life = PICKUP.lifetime;
  }

  function killEnemy(e) {
    e.active = false;
    state.kills += 1;
    state.combo += 1;
    state.comboTimer = COMBO.window;
    state.multiplier = 1 + Math.min(COMBO.maxMultiplier - 1, Math.floor(state.combo / COMBO.perStep));
    const gained = e.score * state.multiplier;
    state.score += gained;
    addPopup(e.x, e.y, `+${gained}`, state.multiplier > 1 ? '#ffd94d' : '#eef4ff');
    burst(e.x, e.y, e.color, e.kind === KIND_SPLITTER ? 26 : 14, 260);
    burst(e.x, e.y, '#ffffff', 5, 160);
    if (e.kind === KIND_SPLITTER) spawnMites(e.x, e.y);
    dropPickup(e.x, e.y, e.kind === KIND_MITE);
  }

  function hitPlayer() {
    if (player.invulnerable > 0 || player.dashTimer > 0) return 0;
    if (player.shield) {
      player.shield = false;
      player.invulnerable = 1.2;
      burst(player.x, player.y, '#6fd8ff', 18, 240);
      addPopup(player.x, player.y - 30, 'SHIELD DOWN', '#6fd8ff');
      return EVENT_HIT;
    }
    player.hull -= 1;
    player.invulnerable = PLAYER.invulnerable;
    state.shake = 16;
    state.flash = 0.35;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    burst(player.x, player.y, '#ff5d6c', 22, 300);
    if (player.hull <= 0) return EVENT_HIT | EVENT_OVER;
    return EVENT_HIT;
  }

  function fireBullet(angle) {
    const b = free(bullets);
    if (b === null) return;
    b.active = true;
    b.x = player.x + Math.cos(angle) * (PLAYER.radius + 8);
    b.y = player.y + Math.sin(angle) * (PLAYER.radius + 8);
    b.vx = Math.cos(angle) * PLAYER.bulletSpeed;
    b.vy = Math.sin(angle) * PLAYER.bulletSpeed;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.vx = 0; player.vy = 0;
    player.angle = -Math.PI / 2;
    player.hull = PLAYER.hull;
    player.fireTimer = 0;
    player.invulnerable = 0;
    player.dashTimer = 0;
    player.dashCooldown = 0;
    player.shield = false;
    player.rapidTimer = 0;
    player.spreadTimer = 0;
    for (const pool of [enemies, bullets, orbs, particles, pickups, popups]) {
      for (const item of pool) item.active = false;
    }
    state.score = 0;
    state.wave = 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.multiplier = 1;
    state.kills = 0;
    state.elapsed = 0;
    state.shake = 0;
    state.flash = 0;
    state.waveState = 'fighting';
    state.breatherTimer = 0;
    state.ambientTimer = 0;
    startWave(1);
  }

  function stepEnemy(e, dt) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (e.kind === KIND_DRIFTER) {
      const wobble = Math.sin(state.elapsed * 2 + e.seed) * 0.5;
      const nx = dx / d;
      const ny = dy / d;
      e.vx = (nx - ny * wobble) * e.speed;
      e.vy = (ny + nx * wobble) * e.speed;
    } else if (e.kind === KIND_MITE) {
      e.vx = (dx / d) * e.speed + Math.sin(state.elapsed * 5 + e.seed) * 40;
      e.vy = (dy / d) * e.speed + Math.cos(state.elapsed * 5 + e.seed) * 40;
    } else if (e.kind === KIND_SPLITTER) {
      e.vx = (dx / d) * e.speed;
      e.vy = (dy / d) * e.speed;
    } else if (e.kind === KIND_WEAVER) {
      // Hold about 260 away, circling, and shoot when in range.
      const radial = d > 300 ? 1 : d < 220 ? -1 : 0;
      const tx = -dy / d;
      const ty = dx / d;
      e.vx = (tx * 0.8 + (dx / d) * radial * 0.7) * e.speed;
      e.vy = (ty * 0.8 + (dy / d) * radial * 0.7) * e.speed;
      e.fireTimer -= dt;
      if (e.fireTimer <= 0 && d < 640) {
        e.fireTimer = 2.4;
        const o = free(orbs);
        if (o !== null) {
          o.active = true;
          o.x = e.x; o.y = e.y;
          o.vx = (dx / d) * ORB.speed;
          o.vy = (dy / d) * ORB.speed;
        }
      }
    } else if (e.kind === KIND_DASHER) {
      e.stateTimer -= dt;
      if (e.state === 'chase') {
        e.vx = (dx / d) * e.speed;
        e.vy = (dy / d) * e.speed;
        if (e.stateTimer <= 0 && d < 420) {
          e.state = 'telegraph';
          e.stateTimer = 0.6;
          e.vx = 0; e.vy = 0;
        }
      } else if (e.state === 'telegraph') {
        e.vx = 0; e.vy = 0;
        if (e.stateTimer <= 0) {
          e.state = 'dash';
          e.stateTimer = 0.45;
          e.lockX = dx / d;
          e.lockY = dy / d;
        }
      } else if (e.state === 'dash') {
        e.vx = e.lockX * 520;
        e.vy = e.lockY * 520;
        if (e.stateTimer <= 0) {
          e.state = 'recover';
          e.stateTimer = 0.8;
        }
      } else {
        e.vx = (dx / d) * e.speed * 0.4;
        e.vy = (dy / d) * e.speed * 0.4;
        if (e.stateTimer <= 0) {
          e.state = 'chase';
          e.stateTimer = 0.8 + random() * 0.8;
        }
      }
    }
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  }

  /**
   * One fixed step. `input` is {mx, my, ax, ay, firing, dashPressed} or null (the title
   * screen's backdrop, where the ship idles and drifters wander). With `harmless` set, nothing
   * can touch the player and nothing scores.
   */
  function step(dt, input, harmless) {
    let events = 0;
    state.elapsed += dt;
    if (state.banner.t > 0) state.banner.t -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 40);
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt);

    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (const p of popups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) p.active = false;
      else p.y -= 34 * dt;
    }

    if (harmless) {
      // Title backdrop: drifters wander in, bounce off the walls, never threaten anyone.
      state.ambientTimer -= dt;
      let drifters = 0;
      for (const e of enemies) if (e.active) drifters += 1;
      if (state.ambientTimer <= 0 && drifters < 6) {
        state.ambientTimer = 1.4;
        const e = free(enemies);
        if (e !== null) {
          const def = ENEMY.drifter;
          e.active = true;
          e.kind = KIND_DRIFTER;
          e.x = random() * FIELD.width;
          e.y = random() * FIELD.height;
          const angle = random() * TAU;
          e.vx = Math.cos(angle) * def.speed * 0.6;
          e.vy = Math.sin(angle) * def.speed * 0.6;
          e.hp = def.hp; e.radius = def.radius; e.speed = def.speed * 0.6;
          e.score = def.score; e.color = def.color;
          e.state = 'chase'; e.stateTimer = 0; e.seed = random() * TAU;
        }
      }
      for (const e of enemies) {
        if (!e.active) continue;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < 20 || e.x > FIELD.width - 20) e.vx *= -1;
        if (e.y < 20 || e.y > FIELD.height - 20) e.vy *= -1;
      }
      return events;
    }

    // --- player timers ---
    if (player.invulnerable > 0) player.invulnerable -= dt;
    if (player.dashCooldown > 0) player.dashCooldown -= dt;
    if (player.rapidTimer > 0) player.rapidTimer -= dt;
    if (player.spreadTimer > 0) player.spreadTimer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.combo = 0;
        state.multiplier = 1;
      }
    }

    // --- player movement ---
    const mx = input ? input.mx : 0;
    const my = input ? input.my : 0;
    const mag = Math.hypot(mx, my);
    const nx = mag > 0 ? mx / mag : 0;
    const ny = mag > 0 ? my / mag : 0;
    if (input && input.dashPressed && player.dashCooldown <= 0 && player.dashTimer <= 0) {
      const dx = mag > 0 ? nx : Math.cos(player.angle);
      const dy = mag > 0 ? ny : Math.sin(player.angle);
      player.dashX = dx;
      player.dashY = dy;
      player.dashTimer = PLAYER.dashTime;
      player.dashCooldown = PLAYER.dashCooldown;
      player.invulnerable = Math.max(player.invulnerable, PLAYER.dashInvulnerable);
      burst(player.x, player.y, '#7df9ff', 10, 200);
      events |= EVENT_DASH;
    }
    if (player.dashTimer > 0) {
      player.dashTimer -= dt;
      player.vx = player.dashX * PLAYER.dashSpeed;
      player.vy = player.dashY * PLAYER.dashSpeed;
    } else {
      player.vx = nx * PLAYER.speed;
      player.vy = ny * PLAYER.speed;
    }
    player.x = Math.min(FIELD.width - PLAYER.radius, Math.max(PLAYER.radius, player.x + player.vx * dt));
    player.y = Math.min(FIELD.height - PLAYER.radius, Math.max(PLAYER.radius, player.y + player.vy * dt));
    if (input && input.ax !== null && input.ay !== null) {
      player.angle = Math.atan2(input.ay - player.y, input.ax - player.x);
    }
    // Engine trail while moving.
    if (mag > 0 && random() < 0.5) {
      const p = free(particles);
      if (p !== null) {
        p.active = true;
        p.x = player.x - Math.cos(player.angle) * PLAYER.radius;
        p.y = player.y - Math.sin(player.angle) * PLAYER.radius;
        p.vx = -player.vx * 0.2 + (random() - 0.5) * 40;
        p.vy = -player.vy * 0.2 + (random() - 0.5) * 40;
        p.maxLife = 0.3;
        p.life = 0.3;
        p.size = 2 + random() * 2;
        p.color = '#3fc9de';
      }
    }

    // --- firing ---
    player.fireTimer -= dt;
    if (input && input.firing && player.fireTimer <= 0) {
      player.fireTimer = PLAYER.fireInterval * (player.rapidTimer > 0 ? 0.5 : 1);
      fireBullet(player.angle);
      if (player.spreadTimer > 0) {
        fireBullet(player.angle - 0.16);
        fireBullet(player.angle + 0.16);
      }
      const p = free(particles);
      if (p !== null) {
        p.active = true;
        p.x = player.x + Math.cos(player.angle) * (PLAYER.radius + 10);
        p.y = player.y + Math.sin(player.angle) * (PLAYER.radius + 10);
        p.vx = Math.cos(player.angle) * 120;
        p.vy = Math.sin(player.angle) * 120;
        p.maxLife = 0.12;
        p.life = 0.12;
        p.size = 3;
        p.color = '#bff6ff';
      }
    }

    // --- waves ---
    if (state.waveState === 'fighting') {
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = spawnInterval();
          spawnEnemy(state.spawnQueue.shift());
        }
      } else {
        let any = false;
        for (const e of enemies) if (e.active) { any = true; break; }
        if (!any) {
          const bonus = WAVE.clearBonus * state.wave;
          state.score += bonus;
          addPopup(FIELD.width / 2, FIELD.height / 2 - 60, `WAVE CLEAR +${bonus}`, '#ffd94d');
          setBanner(`WAVE ${state.wave} CLEAR`, `bonus +${bonus}`, 2);
          state.waveState = 'breather';
          state.breatherTimer = WAVE.breather;
          events |= EVENT_CLEAR;
        }
      }
    } else {
      state.breatherTimer -= dt;
      if (state.breatherTimer <= 0) {
        startWave(state.wave + 1);
        events |= EVENT_WAVE;
      }
    }

    // --- enemies, orbs, bullets ---
    for (const e of enemies) if (e.active) stepEnemy(e, dt);
    for (const o of orbs) {
      if (!o.active) continue;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      if (o.x < -20 || o.x > FIELD.width + 20 || o.y < -20 || o.y > FIELD.height + 20) o.active = false;
    }
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) b.active = false;
    }

    // --- bullets vs enemies ---
    for (const b of bullets) {
      if (!b.active) continue;
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          b.active = false;
          e.hp -= 1;
          burst(b.x, b.y, e.color, 4, 140);
          if (e.hp <= 0) {
            killEnemy(e);
            events |= EVENT_KILL;
          }
          break;
        }
      }
    }

    // --- enemies vs player ---
    if (player.invulnerable <= 0 && player.dashTimer <= 0) {
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + PLAYER.radius - 4;
        if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
          events |= hitPlayer();
          if (events & EVENT_OVER) return events;
          break;
        }
      }
    }
    if (player.invulnerable <= 0 && player.dashTimer <= 0 && !(events & EVENT_OVER)) {
      for (const o of orbs) {
        if (!o.active) continue;
        const rr = o.radius + PLAYER.radius - 4;
        if (dist2(o.x, o.y, player.x, player.y) < rr * rr) {
          o.active = false;
          events |= hitPlayer();
          if (events & EVENT_OVER) return events;
          break;
        }
      }
    }

    // --- pickups ---
    for (const p of pickups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const d2 = dist2(p.x, p.y, player.x, player.y);
      if (d2 < PICKUP.magnetRadius * PICKUP.magnetRadius) {
        const d = Math.sqrt(d2) || 1;
        p.vx += ((player.x - p.x) / d) * 500 * dt;
        p.vy += ((player.y - p.y) / d) * 500 * dt;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const rr = 26;
      if (d2 < rr * rr) {
        p.active = false;
        if (p.kind === 'shield') {
          player.shield = true;
          addPopup(player.x, player.y - 30, 'SHIELD UP', '#6fd8ff');
        } else if (p.kind === 'rapid') {
          player.rapidTimer = PICKUP.rapidSeconds;
          addPopup(player.x, player.y - 30, 'RAPID FIRE', '#ffd94d');
        } else if (p.kind === 'spread') {
          player.spreadTimer = PICKUP.spreadSeconds;
          addPopup(player.x, player.y - 30, 'SPREAD SHOT', '#ffd94d');
        } else if (p.kind === 'repair') {
          if (player.hull < PLAYER.hull) {
            player.hull += 1;
            addPopup(player.x, player.y - 30, '+1 HULL', '#5dff8f');
          } else {
            state.score += 250;
            addPopup(player.x, player.y - 30, '+250', '#ffd94d');
          }
        }
        burst(player.x, player.y, '#ffd94d', 10, 180);
        events |= EVENT_PICKUP;
      }
    }

    return events;
  }

  return { state, reset, step };
}
