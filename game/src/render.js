// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon glow, a parallax starfield, particles, floating score text and screen shake
// are all drawn here; nothing here changes the world. The shake uses sines of the elapsed
// time, never Math.random, so a staged screenshot is the same every run.

import { FIELD, FONT, PALETTE, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

/** Two font weights the HUD and panels share. */
const BOLD = '700';
const REGULAR = '400';

function mulberry32(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Three star layers, fixed once: the same sky every run. */
const STARS = (() => {
  const random = mulberry32(1337);
  const layers = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const stars = [];
    const count = 70 + layer * 50;
    for (let i = 0; i < count; i += 1) {
      stars.push({ x: random() * FIELD.width, y: random() * FIELD.height, r: 0.6 + layer * 0.5 + random() * 0.8, a: 0.25 + random() * 0.55 });
    }
    layers.push(stars);
  }
  return layers;
})();

function polygon(context, x, y, radius, sides, rotation) {
  context.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) context.moveTo(px, py);
    else context.lineTo(px, py);
  }
  context.closePath();
}

function formatScore(value) {
  return value.toLocaleString('en-US');
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  // The nebula is painted once to an offscreen canvas: three soft glows on the void.
  const nebula = document.createElement('canvas');
  nebula.width = FIELD.width;
  nebula.height = FIELD.height;
  const neb = nebula.getContext('2d');
  neb.fillStyle = PALETTE.backdrop;
  neb.fillRect(0, 0, FIELD.width, FIELD.height);
  const glows = [
    { x: 280, y: 180, r: 420, c: 'rgba(90, 40, 160, 0.20)' },
    { x: 1020, y: 540, r: 460, c: 'rgba(10, 110, 130, 0.20)' },
    { x: 980, y: 140, r: 320, c: 'rgba(160, 40, 110, 0.12)' },
  ];
  for (const glow of glows) {
    const grad = neb.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, glow.r);
    grad.addColorStop(0, glow.c);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    neb.fillStyle = grad;
    neb.fillRect(0, 0, FIELD.width, FIELD.height);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || REGULAR}:${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight || REGULAR} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  function drawBackground(elapsed) {
    context.drawImage(nebula, 0, 0);
    // Starfield drifts slowly, nearer layers faster.
    for (let layer = 0; layer < STARS.length; layer += 1) {
      const speed = (layer + 1) * 4;
      for (const star of STARS[layer]) {
        const x = (((star.x - elapsed * speed) % FIELD.width) + FIELD.width) % FIELD.width;
        const twinkle = 0.75 + 0.25 * Math.sin(elapsed * 2 + star.x * 0.05 + star.y * 0.03);
        context.globalAlpha = star.a * twinkle;
        context.fillStyle = '#cfe6ff';
        context.beginPath();
        context.arc(x, star.y, star.r, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    // Faint grid, so motion reads at a glance.
    context.strokeStyle = PALETTE.grid;
    context.lineWidth = 1;
    context.beginPath();
    for (let x = 64; x < FIELD.width; x += 64) {
      context.moveTo(x, 0);
      context.lineTo(x, FIELD.height);
    }
    for (let y = 64; y < FIELD.height; y += 64) {
      context.moveTo(0, y);
      context.lineTo(FIELD.width, y);
    }
    context.stroke();
    // Arena edge.
    context.strokeStyle = '#27335a';
    context.lineWidth = 2;
    context.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
  }

  function drawShip(x, y, angle, color, core) {
    context.save();
    context.translate(x, y);
    context.rotate(angle);
    context.shadowColor = color;
    context.shadowBlur = 16;
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(18, 0);
    context.lineTo(-12, -11);
    context.lineTo(-6, 0);
    context.lineTo(-12, 11);
    context.closePath();
    context.fill();
    context.shadowBlur = 0;
    context.fillStyle = core;
    context.beginPath();
    context.arc(2, 0, 4, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      const flash = e.kind === 'dasher' && e.state === 'telegraph' && Math.floor(state.elapsed * 10) % 2 === 0;
      const color = flash ? '#ffffff' : e.color;
      context.save();
      context.shadowColor = e.color;
      context.shadowBlur = 14;
      context.strokeStyle = color;
      context.fillStyle = color;
      context.lineWidth = 2;
      if (e.kind === 'drifter') {
        const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
        drawShip(e.x, e.y, angle, color, 'rgba(255,255,255,0.85)');
      } else if (e.kind === 'weaver') {
        context.translate(e.x, e.y);
        context.rotate(state.elapsed * 1.5 + e.seed);
        polygon(context, 0, 0, e.radius, 4, 0);
        context.fill();
        context.shadowBlur = 0;
        context.fillStyle = '#1a1206';
        context.beginPath();
        context.arc(0, 0, 4, 0, Math.PI * 2);
        context.fill();
      } else if (e.kind === 'splitter') {
        context.translate(e.x, e.y);
        context.rotate(state.elapsed * 0.6 + e.seed);
        polygon(context, 0, 0, e.radius, 6, 0);
        context.globalAlpha = 0.85;
        context.fill();
        context.globalAlpha = 1;
        context.shadowBlur = 0;
        context.fillStyle = '#241a3d';
        polygon(context, 0, 0, e.radius * 0.55, 6, 0.5);
        context.fill();
      } else if (e.kind === 'mite') {
        const angle = Math.atan2(state.player.y - e.y, state.player.x - e.x);
        drawShip(e.x, e.y, angle, color, 'rgba(255,255,255,0.7)');
      } else {
        // dasher: pentagon, with a warning ring while it telegraphs.
        context.translate(e.x, e.y);
        context.rotate(state.elapsed * 2 + e.seed);
        polygon(context, 0, 0, e.radius, 5, 0);
        context.fill();
        if (e.state === 'telegraph') {
          context.shadowBlur = 0;
          context.strokeStyle = '#ff5d6c';
          context.lineWidth = 2;
          context.beginPath();
          context.arc(0, 0, e.radius + 10, 0, Math.PI * 2);
          context.stroke();
        }
      }
      context.restore();
      // Hit points read at a glance: one pip per remaining hull.
      if (e.hp > 1) {
        context.fillStyle = '#ffffff';
        for (let i = 0; i < e.hp; i += 1) {
          context.fillRect(e.x - e.hp * 4 + i * 8, e.y - e.radius - 12, 5, 3);
        }
      }
    }
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (!p.active) continue;
      const color = p.kind === 'shield' ? '#6fd8ff' : p.kind === 'rapid' ? '#ffd94d' : p.kind === 'spread' ? '#ff9df5' : '#5dff8f';
      const pulse = 1 + 0.12 * Math.sin(state.elapsed * 6);
      context.save();
      context.translate(p.x, p.y);
      context.shadowColor = color;
      context.shadowBlur = 16;
      context.strokeStyle = color;
      context.fillStyle = 'rgba(5,6,15,0.85)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(0, 0, 14 * pulse, 0, Math.PI * 2);
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.fillStyle = color;
      context.font = `700 13px ${FONT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      const label = p.kind === 'shield' ? 'S' : p.kind === 'rapid' ? 'R' : p.kind === 'spread' ? 'W' : '+';
      context.fillText(label, 0, 1);
      context.restore();
    }
  }

  function drawBulletsOrbs(state) {
    context.save();
    context.shadowColor = PALETTE.bullet;
    context.shadowBlur = 10;
    context.fillStyle = PALETTE.bullet;
    for (const b of state.bullets) {
      if (!b.active) continue;
      context.beginPath();
      context.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.shadowColor = PALETTE.orb;
    context.fillStyle = PALETTE.orb;
    for (const o of state.orbs) {
      if (!o.active) continue;
      context.beginPath();
      context.arc(o.x, o.y, o.radius, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = 'rgba(255,184,77,0.5)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(o.x, o.y, o.radius + 4 + Math.sin(state.elapsed * 8) * 2, 0, Math.PI * 2);
      context.stroke();
    }
    context.restore();
  }

  function drawParticlesPopups(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const p of state.popups) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      text(p.text, p.x, p.y, 18, p.color, 'center', BOLD);
    }
    context.globalAlpha = 1;
  }

  function drawPlayer(state, screen) {
    const player = state.player;
    if (screen === SCREEN_TITLE) {
      // The title screen's ship idles at the centre, engines warm.
      drawShip(player.x, player.y + Math.sin(state.elapsed * 1.5) * 4, player.angle, PALETTE.player, PALETTE.playerCore);
      return;
    }
    if (player.invulnerable > 0 && Math.floor(state.elapsed * 12) % 2 === 0 && player.dashTimer <= 0) return;
    drawShip(player.x, player.y, player.angle, PALETTE.player, PALETTE.playerCore);
    if (player.shield) {
      context.save();
      context.strokeStyle = PALETTE.shield;
      context.globalAlpha = 0.7 + 0.3 * Math.sin(state.elapsed * 5);
      context.lineWidth = 2;
      context.shadowColor = PALETTE.shield;
      context.shadowBlur = 12;
      context.beginPath();
      context.arc(player.x, player.y, PLAYER.radius + 9, 0, Math.PI * 2);
      context.stroke();
      context.restore();
    }
  }

  function drawHud(state, best) {
    const player = state.player;
    // Score, top left.
    text(`SCORE ${formatScore(state.score)}`, 24, 44, 30, PALETTE.text, 'left', BOLD);
    text(`BEST ${formatScore(best)}`, 24, 70, 15, PALETTE.muted, 'left', REGULAR);
    // Wave, top centre.
    text(`WAVE ${state.wave}`, FIELD.width / 2, 44, 26, PALETTE.text, 'center', BOLD);
    let foes = 0;
    for (const e of state.enemies) if (e.active) foes += 1;
    const left = foes + state.spawnQueue.length;
    text(left > 0 ? `${left} HOSTILE${left === 1 ? '' : 'S'} LEFT` : 'WAVE CLEAR', FIELD.width / 2, 68, 14, PALETTE.muted, 'center', REGULAR);
    // Hull, top right: one ship per hull.
    for (let i = 0; i < PLAYER.hull; i += 1) {
      const x = FIELD.width - 24 - i * 30;
      if (i < player.hull) drawShip(x, 36, -Math.PI / 2, '#ff5d6c', '#ffffff');
      else {
        context.save();
        context.strokeStyle = '#3a4358';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 9, 26);
        context.lineTo(x - 6, 31);
        context.lineTo(x - 3, 36);
        context.lineTo(x - 6, 41);
        context.lineTo(x + 9, 46);
        context.closePath();
        context.stroke();
        context.restore();
      }
    }
    // Combo under the hull.
    if (state.multiplier > 1 || state.combo > 0) {
      text(`COMBO x${state.multiplier}`, FIELD.width - 24, 76, 18, '#ffd94d', 'right', BOLD);
      if (state.comboTimer > 0) {
        context.fillStyle = '#3a4358';
        context.fillRect(FIELD.width - 144, 84, 120, 5);
        context.fillStyle = '#ffd94d';
        context.fillRect(FIELD.width - 144, 84, 120 * (state.comboTimer / 2.5), 5);
      }
    }
    // Dash, bottom left.
    const dashReady = player.dashCooldown <= 0;
    text('DASH', 24, FIELD.height - 44, 14, dashReady ? '#7df9ff' : PALETTE.muted, 'left', BOLD);
    context.fillStyle = '#1c2438';
    context.fillRect(24, FIELD.height - 36, 130, 7);
    context.fillStyle = dashReady ? '#7df9ff' : '#3a6a78';
    context.fillRect(24, FIELD.height - 36, 130 * (dashReady ? 1 : 1 - player.dashCooldown / PLAYER.dashCooldown), 7);
    text(dashReady ? 'READY  [SHIFT]' : 'CHARGING', 162, FIELD.height - 28, 13, PALETTE.muted, 'left', REGULAR);
    // Power-ups, bottom right.
    let py = FIELD.height - 44;
    if (player.shield) {
      text('SHIELD', FIELD.width - 24, py, 15, '#6fd8ff', 'right', BOLD);
      py -= 22;
    }
    if (player.rapidTimer > 0) {
      text(`RAPID FIRE ${Math.ceil(player.rapidTimer)}s`, FIELD.width - 24, py, 15, '#ffd94d', 'right', BOLD);
      py -= 22;
    }
    if (player.spreadTimer > 0) {
      text(`SPREAD SHOT ${Math.ceil(player.spreadTimer)}s`, FIELD.width - 24, py, 15, '#ff9df5', 'right', BOLD);
      py -= 22;
    }
    // Wave banner, centre.
    if (state.banner.t > 0) {
      const alpha = Math.min(1, state.banner.t);
      context.globalAlpha = alpha;
      text(state.banner.text, FIELD.width / 2, FIELD.height / 2 - 40, 52, PALETTE.text, 'center', BOLD);
      if (state.banner.sub) text(state.banner.sub, FIELD.width / 2, FIELD.height / 2, 20, PALETTE.muted, 'center', REGULAR);
      context.globalAlpha = 1;
    }
  }

  function panel(width, top, lines) {
    const height = 70 + lines.length * 34;
    const x = (FIELD.width - width) / 2;
    context.fillStyle = 'rgba(10, 13, 26, 0.88)';
    context.fillRect(x, top, width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, top, width, height);
    return { x, top, height };
  }

  function drawTitle(state, best) {
    context.fillStyle = 'rgba(5, 6, 15, 0.45)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    const glow = 0.85 + 0.15 * Math.sin(state.elapsed * 2);
    context.save();
    context.shadowColor = '#7df9ff';
    context.shadowBlur = 34 * glow;
    text('VOIDSPARK', FIELD.width / 2, 218, 84, '#eafcff', 'center', BOLD);
    context.restore();
    text('N E O N   A R E N A', FIELD.width / 2, 262, 24, '#ffb84d', 'center', BOLD);
    text('Survive the void. Chain kills. Chase the combo.', FIELD.width / 2, 300, 18, PALETTE.muted, 'center', REGULAR);
    const box = panel(620, 330, ['WASD / ARROWS — fly', 'MOUSE — aim   ·   CLICK / SPACE — fire', 'SHIFT — dash through danger', 'P — pause   ·   M — mute']);
    const lines = ['WASD / ARROWS — fly', 'MOUSE — aim   ·   CLICK / SPACE — fire', 'SHIFT — dash through danger', 'P — pause   ·   M — mute'];
    lines.forEach((line, i) => text(line, FIELD.width / 2, box.top + 44 + i * 34, 18, PALETTE.text, 'center', REGULAR));
    if (best > 0) text(`BEST  ${formatScore(best)}`, FIELD.width / 2, box.top + box.height + 44, 20, '#ffd94d', 'center', BOLD);
    // The prompt never blinks: a staged screenshot must always show how to start.
    text('PRESS ENTER OR CLICK TO START', FIELD.width / 2, box.top + box.height + 84, 22, '#7df9ff', 'center', BOLD);
  }

  function drawPaused() {
    context.fillStyle = 'rgba(5, 6, 15, 0.6)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 340, 56, PALETTE.text, 'center', BOLD);
    text('Press P or click to resume', FIELD.width / 2, 388, 19, PALETTE.muted, 'center', REGULAR);
  }

  function drawOver(state, best, isNewBest) {
    context.fillStyle = 'rgba(5, 6, 15, 0.62)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    text('SHIP DESTROYED', FIELD.width / 2, 240, 60, '#ff5d6c', 'center', BOLD);
    if (isNewBest) text('★ NEW BEST ★', FIELD.width / 2, 282, 22, '#ffd94d', 'center', BOLD);
    const box = panel(520, 310, [`SCORE  ${formatScore(state.score)}`, `BEST  ${formatScore(best)}`, `WAVE  ${state.wave}`, `KILLS  ${state.kills}`]);
    const lines = [`SCORE  ${formatScore(state.score)}`, `BEST  ${formatScore(best)}`, `WAVE  ${state.wave}`, `KILLS  ${state.kills}`];
    lines.forEach((line, i) => text(line, FIELD.width / 2, box.top + 46 + i * 34, 21, PALETTE.text, 'center', i === 0 ? BOLD : REGULAR));
    // The prompt never blinks: a staged screenshot must always show how to restart.
    text('PRESS ENTER OR CLICK TO PLAY AGAIN', FIELD.width / 2, box.top + box.height + 52, 21, '#7df9ff', 'center', BOLD);
  }

  function draw(state, screen, best, isNewBest) {
    resize();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, width, height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Screen shake, deterministic in the elapsed time.
    if (state.shake > 0) {
      const sx = Math.sin(state.elapsed * 127.1) * state.shake * 0.5;
      const sy = Math.cos(state.elapsed * 149.7) * state.shake * 0.5;
      context.translate(sx, sy);
    }
    context.save();
    context.beginPath();
    context.rect(0, 0, FIELD.width, FIELD.height);
    context.clip();
    drawBackground(state.elapsed);
    drawPickups(state);
    drawEnemies(state);
    drawBulletsOrbs(state);
    drawPlayer(state, screen);
    drawParticlesPopups(state);
    context.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best, isNewBest);
    // Hit flash, drawn last.
    if (state.flash > 0) {
      context.fillStyle = `rgba(255, 60, 80, ${state.flash * 0.55})`;
      context.fillRect(0, 0, FIELD.width, FIELD.height);
    }
    context.setTransform(1, 0, 0, 1, 0, 0);
  }

  return {
    draw,
    /** Canvas-relative CSS pixels to field coordinates, for the mouse aim. */
    fieldFromClient(cssX, cssY) {
      return {
        x: (cssX * (window.devicePixelRatio || 1) - view.x) / view.scale,
        y: (cssY * (window.devicePixelRatio || 1) - view.y) / view.scale,
      };
    },
  };
}
