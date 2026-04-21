import { rot, fillRotatedRect, fillTopHalfEllipse } from '../utils/draw.js';

export class Player {
  constructor(x, y) {
    this.x        = x;
    this.y        = y;  // posição dos pés
    this.vx       = 0;
    this.vy       = 0;
    this.baseW    = 28;
    this.baseH    = 50;
    this.maxSpeedX = 4.8;
    this.accel    = 0.52;
    this.friction = 0.82;
    this.facing   = 1;
    this.walkTime = 0;

    // Física 2D
    this.GRAVITY        = 0.010;  // px/ms² acumulado
    this.JUMP_VY        = -3;     // px/frame (negativo = sobe)
    this.MAX_FALL_SPEED = 14;     // px/frame — terminal velocity
    this.isOnGround     = true;

    // Paraquedas
    this.parachuteOpen     = false;
    this.parachuteAnim     = 0;   // 0..1 animação de abertura
    this.CHUTE_OPEN_SPEED  = 1 / 350;
    this.CHUTE_FALL_CAP    = 2.0;  // px/frame — descida suave com paraquedas

    // Ataque
    this.isAttacking = false;
    this.attackTimer = 0;
    this.ATTACK_DUR  = 280;
    this.ATTACK_PUSH = 3.5;

    // Stats
    this.name    = 'Lander';
    this.level   = 1;
    this.hp      = 100;
    this.maxHp   = 100;
    this.mana    = 60;
    this.maxMana = 60;
    this.gold    = 50;
    this.fuel    = 100;
    this.maxFuel = 100;

    // Efeitos ativos
    this.effects = [];

    // Escavação
    this.isDrilling  = false;
    this.drillTime   = 0;   // acumula tempo para girar o bit
    this.hasDrill    = false; // escavadeira em mãos (toggle F)
    this.isDrillingH  = false; // está cavando horizontalmente
  }

  attack(dir) {
    if (this.isAttacking) return;
    this.isAttacking = true;
    this.attackTimer = this.ATTACK_DUR;
    this.facing      = dir;
    this.vx         += dir * this.ATTACK_PUSH;
  }

  addEffect(type) {
    if (type === 'health_potion') {
      this.effects.push({ type, tickInterval: 1000, tickTimer: 1000, remainingTicks: 10 });
    }
  }

  drainFuel(amount) {
    this.fuel = Math.max(0, this.fuel - amount);
  }

  setDrilling(on, delta) {
    this.isDrilling = on;
    if (on) this.drillTime += delta;
  }

  setDrillingH(on, delta) {
    this.isDrillingH = on;
    if (on) this.drillTime += delta;
  }

  /**
   * @param {{ left, right, jumpJustDown, parachuteToggle }} input
   * @param {number} delta ms
   * @param {{ x, y, w }[]} platforms  — { x: centro, y: topo, w: largura }
   */
  update(input, delta, platforms) {
    // ── Efeitos ───────────────────────────────────────────────────────────
    this.effects = this.effects.filter(e => e.remainingTicks > 0);
    for (const e of this.effects) {
      e.tickTimer -= delta;
      if (e.tickTimer <= 0) {
        e.tickTimer += e.tickInterval;
        e.remainingTicks--;
        if (e.type === 'health_potion') this.hp = Math.min(this.maxHp, this.hp + 2);
      }
    }

    // ── Ataque ────────────────────────────────────────────────────────────
    if (this.isAttacking) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) { this.isAttacking = false; this.attackTimer = 0; }
    }

    // ── Gravidade ─────────────────────────────────────────────────────────
    this.vy += this.GRAVITY * delta;
    if (this.vy > this.MAX_FALL_SPEED) this.vy = this.MAX_FALL_SPEED;

    // ── Paraquedas ────────────────────────────────────────────────────────
    if (input.parachuteToggle && !this.isOnGround) {
      this.parachuteOpen = !this.parachuteOpen;
    }
    if (this.parachuteOpen && !this.isOnGround) {
      if (this.vy > this.CHUTE_FALL_CAP) this.vy = this.CHUTE_FALL_CAP;
      this.parachuteAnim = Math.min(1, this.parachuteAnim + this.CHUTE_OPEN_SPEED * delta);
    } else {
      this.parachuteAnim = Math.max(0, this.parachuteAnim - this.CHUTE_OPEN_SPEED * 2 * delta);
    }

    // ── Pulo ──────────────────────────────────────────────────────────────
    if (input.jumpJustDown && this.isOnGround) {
      this.vy = this.JUMP_VY;
      this.isOnGround = false;
    }

    // ── Movimento horizontal ──────────────────────────────────────────────
    const ea = this.isAttacking ? this.accel * 0.20 : this.accel;
    if (input.left)  this.vx -= ea;
    if (input.right) this.vx += ea;
    this.vx *= this.friction;
    if (Math.abs(this.vx) > this.maxSpeedX) this.vx = Math.sign(this.vx) * this.maxSpeedX;

    if (this.vx >  0.25) this.facing =  1;
    if (this.vx < -0.25) this.facing = -1;

    const spd = Math.abs(this.vx);
    if (this.isOnGround && spd > 0.25) this.walkTime += delta * spd * 0.013;
    else                               this.walkTime  *= 0.90;

    // ── Movimento ─────────────────────────────────────────────────────────
    const prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;

    // ── Colisão com plataformas ───────────────────────────────────────────
    this.isOnGround = false;
    for (const p of platforms) {
      if (
        this.vy >= 0 &&
        prevY  <= p.y &&
        this.y >= p.y &&
        this.x >= p.x - p.w / 2 &&
        this.x <= p.x + p.w / 2
      ) {
        this.y          = p.y;
        this.vy         = 0;
        this.isOnGround = true;
        if (this.parachuteOpen) { this.parachuteOpen = false; }
      }
    }

    this.x = Phaser.Math.Clamp(this.x, this.baseW / 2, 960 - this.baseW / 2);
  }

  draw(g) {
    g.clear();

    const { x, y, facing, walkTime, vx } = this;
    const moving    = Math.abs(vx) > 0.25;
    const inAir     = !this.isOnGround;
    const attacking = this.isAttacking;

    // Escala fixa no modo 2D
    const w = this.baseW;
    const h = this.baseH;

    const atkT     = attacking ? 1 - (this.attackTimer / this.ATTACK_DUR) : 0;
    const atkAngle = attacking ? -Math.sin(atkT * Math.PI) * 1.2 : 0;
    const swing    = attacking ? 0 : (inAir ? 0.45 : (moving ? Math.sin(walkTime) * 0.34 : 0));
    const armSwing = attacking ? 0 : (inAir ? 0.40 : (moving ? Math.sin(walkTime + Math.PI) * 0.38 : 0));

    const fx = (dx) => x + dx * facing;

    const leg   = { w: w * 0.28, h: h * 0.33 };
    const body  = { w: w * 0.72, h: h * 0.42 };
    const arm   = { w: w * 0.22, h: h * 0.30 };
    const headR = w * 0.37;

    const legBaseY = y   - (leg.h + h * 0.02);
    const bodyTop  = legBaseY - body.h;
    const armY     = bodyTop  + body.h * 0.08;
    const headY    = bodyTop  - headR * 0.75;

    // ── Paraquedas (atrás do personagem) ──────────────────────────────────
    if (this.parachuteAnim > 0) this._drawParachute(g, x, headY, this.parachuteAnim);

    // ── Escavadeira (abaixo dos pés quando cavando para baixo) ─────────
    if (this.isDrilling) this._drawDrill(g, x, y);

    // ── Escavadeira na mão (quando hasDrill e não cavando pra baixo) ─────
    if (this.hasDrill && !this.isDrilling) this._drawDrillHand(g, x, y, facing, armY, arm);

    // ── Sombra ────────────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.22);
    g.fillEllipse(x, y, w * 1.2, w * 0.32);

    // ── Pernas ────────────────────────────────────────────────────────────
    [
      { dx: -w * 0.16, angle:  swing * facing },
      { dx:  w * 0.16, angle: -swing * facing },
    ].forEach(({ dx, angle }) => {
      const pivX = fx(dx);
      fillRotatedRect(g, pivX, legBaseY, leg.w, leg.h, angle, 0x5030a0);
      const bootH   = leg.h * 0.28;
      const bootOff = rot(0, leg.h - bootH, angle);
      fillRotatedRect(g, pivX + bootOff.x, legBaseY + bootOff.y, leg.w * 1.3, bootH, angle, 0x3a2070);
    });

    // ── Corpo ─────────────────────────────────────────────────────────────
    g.fillStyle(0xc87818, 1);
    g.fillRoundedRect(x - body.w / 2, bodyTop, body.w, body.h, body.w * 0.16);
    g.fillStyle(0xa86010, 1);
    g.fillRoundedRect(x - body.w * 0.28, bodyTop + body.h * 0.15, body.w * 0.56, body.h * 0.42, body.w * 0.10);
    g.fillStyle(0x7a3c08, 1);
    g.fillRect(x - body.w / 2, bodyTop + body.h * 0.74, body.w, body.h * 0.14);
    g.fillStyle(0xe0c040, 1);
    g.fillRect(x - body.w * 0.08, bodyTop + body.h * 0.72, body.w * 0.16, body.h * 0.18);

    // ── Braços ────────────────────────────────────────────────────────────
    const frontArmAngle = attacking ? atkAngle * facing : -armSwing * facing;
    const backArmAngle  = attacking ? 0                 :  armSwing * facing;
    [
      { dx: -(body.w / 2 + arm.w * 0.25), angle: backArmAngle  },
      { dx:  (body.w / 2 + arm.w * 0.25), angle: frontArmAngle },
    ].forEach(({ dx, angle }) => {
      const pivX = fx(dx);
      fillRotatedRect(g, pivX, armY, arm.w, arm.h, angle, 0xc87818);
      const gloveH   = arm.h * 0.30;
      const gloveOff = rot(0, arm.h - gloveH, angle);
      fillRotatedRect(g, pivX + gloveOff.x, armY + gloveOff.y, arm.w * 1.1, gloveH, angle, 0x7a3c08);
    });

    // ── Cabeça ────────────────────────────────────────────────────────────
    g.fillStyle(0xf0c468, 1);
    g.fillCircle(x, headY, headR);
    fillTopHalfEllipse(g, x, headY - headR * 0.18, headR * 1.08, headR * 0.68, 0x904e10);
    g.fillStyle(0x7a3e0c, 1);
    g.fillRoundedRect(x - headR * 1.12, headY - headR * 0.22, headR * 2.24, headR * 0.20, headR * 0.07);
    g.fillStyle(0xffdc8c, 0.20);
    g.fillEllipse(x - headR * 0.25 * facing, headY - headR * 0.55, headR * 0.70, headR * 0.40);

    const eyeX  = headR * 0.32;
    const eyeY  = headY + headR * 0.08;
    const eyeRr = headR * 0.16;
    g.fillStyle(0x1a1a2e, 1);
    g.fillCircle(fx(-eyeX), eyeY, eyeRr);
    g.fillCircle(fx( eyeX), eyeY, eyeRr);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(fx(-eyeX) + eyeRr * 0.4 * facing, eyeY - eyeRr * 0.4, eyeRr * 0.38);
    g.fillCircle(fx( eyeX) + eyeRr * 0.4 * facing, eyeY - eyeRr * 0.4, eyeRr * 0.38);
  }

  _drawParachute(g, x, headY, openPct) {
    const RX = 54 * openPct;
    const RY = 34 * openPct;
    const cy = headY - 10 - RY;

    // Painéis alternados vermelho/branco
    const panels = 6;
    const colors = [0xff2222, 0xffffff];
    for (let i = 0; i < panels; i++) {
      const a0 = Math.PI + (i / panels) * Math.PI;
      const a1 = Math.PI + ((i + 1) / panels) * Math.PI;
      const pts = [{ x, y: cy }];
      for (let s = 0; s <= 8; s++) {
        const a = a0 + (s / 8) * (a1 - a0);
        pts.push({ x: x + Math.cos(a) * RX, y: cy + Math.sin(a) * RY });
      }
      g.fillStyle(colors[i % 2], 0.92);
      g.fillPoints(pts, true);
    }

    // Contorno
    g.lineStyle(1, 0x888888, 0.6);
    g.beginPath();
    for (let s = 0; s <= 32; s++) {
      const a  = Math.PI + (s / 32) * Math.PI;
      const px = x  + Math.cos(a) * RX;
      const py = cy + Math.sin(a) * RY;
      s === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
    }
    g.strokePath();

    // Cordas
    g.lineStyle(1, 0xdddddd, 0.8);
    g.lineBetween(x - RX * 0.75, cy + RY * 0.95, x - 6, headY + 6);
    g.lineBetween(x + RX * 0.75, cy + RY * 0.95, x + 6, headY + 6);
    g.lineBetween(x,             cy + RY,         x,     headY + 6);
  }

  /** Escavadeira compacta segurada na mão frontal do personagem. */
  _drawDrillHand(g, x, y, facing, armY, arm) {
    const t    = this.drillTime;
    const spin = t * 0.018;
    // posição da mão frontal (braço da frente, ponta)
    const hx = x + facing * (arm.w * 0.5 + 14);
    const hy = armY + arm.h * 0.85;

    // cabo
    g.fillStyle(0x8B5E1A, 1);
    g.fillRoundedRect(hx - facing * 14, hy - 4, 14, 8, 3);

    // corpo metálico
    g.fillStyle(0xf0a020, 1);
    g.fillRoundedRect(hx + facing * 0, hy - 6, facing * 18, 12, 3);
    g.fillStyle(0xd08010, 1);
    g.fillRect(hx + facing * 2, hy - 3, facing * 12, 6);

    // bit giratório lateral
    const bx  = hx + facing * 20;
    const bitR = 6;
    g.fillStyle(0xddeeee, 1);
    for (let i = 0; i < 4; i++) {
      const a  = spin + (Math.PI / 2) * i;
      const ax = bx + Math.cos(a) * bitR;
      const ay = hy + Math.sin(a) * bitR;
      const bx2 = bx + Math.cos(a + 0.45) * bitR * 0.5;
      const by2 = hy + Math.sin(a + 0.45) * bitR * 0.5;
      const cx2 = bx + Math.cos(a - 0.45) * bitR * 0.5;
      const cy2 = hy + Math.sin(a - 0.45) * bitR * 0.5;
      g.fillTriangle(ax, ay, bx2, by2, cx2, cy2);
    }
    g.fillStyle(0x556666, 1);
    g.fillCircle(bx, hy, 3);

    // faíscas
    if (this.isDrillingH) {
      g.fillStyle(0xffee44, 0.85);
      for (let i = 0; i < 4; i++) {
        const sa = spin * 2.3 + (Math.PI * 2 / 4) * i;
        const sr = bitR + 4 + Math.sin(spin * 3 + i) * 3;
        g.fillCircle(bx + Math.cos(sa) * sr, hy + Math.sin(sa) * sr, 1.5);
      }
    }
  }

  _drawDrill(g, x, y) {
    const t   = this.drillTime;
    const bob = Math.sin(t * 0.025) * 3;   // oscilação vertical suave
    const spin = t * 0.018;                 // rotação do bit

    const bdy = y + 6 + bob;   // base do corpo da broca

    // ── Corpo da escavadeira (retângulo metálico) ─────────────────────────
    g.fillStyle(0xf0a020, 1);
    g.fillRoundedRect(x - 18, bdy, 36, 20, 4);
    // Detalhes
    g.fillStyle(0xd08010, 1);
    g.fillRect(x - 14, bdy + 5, 28, 7);
    // Parafusos
    g.fillStyle(0xffe080, 1);
    g.fillCircle(x - 12, bdy + 4, 3);
    g.fillCircle(x + 12, bdy + 4, 3);

    // ── Mola / fole (conecta o corpo ao bit) ────────────────────────────────
    const springY = bdy + 20;
    g.lineStyle(2, 0x888888, 1);
    for (let i = 0; i < 5; i++) {
      const sy = springY + i * 4;
      const dir = (i % 2 === 0) ? 1 : -1;
      if (i < 4) g.lineBetween(x + dir * 7, sy, x - dir * 7, sy + 4);
    }

    // ── Bit giratório (estrela de 4 dentes) ──────────────────────────────
    const bitY = springY + 22;
    const bitR = 9;
    g.fillStyle(0xddeeee, 1);
    for (let i = 0; i < 4; i++) {
      const a  = spin + (Math.PI / 2) * i;
      const ax = x    + Math.cos(a) * bitR;
      const ay = bitY + Math.sin(a) * bitR;
      const bx = x    + Math.cos(a + 0.45) * bitR * 0.5;
      const by2 = bitY + Math.sin(a + 0.45) * bitR * 0.5;
      const cx2 = x    + Math.cos(a - 0.45) * bitR * 0.5;
      const cy2 = bitY + Math.sin(a - 0.45) * bitR * 0.5;
      g.fillTriangle(ax, ay, bx, by2, cx2, cy2);
    }
    // Centro do bit
    g.fillStyle(0x556666, 1);
    g.fillCircle(x, bitY, 4);

    // ── Faíscas / partículas ao redor do bit ─────────────────────────────
    g.fillStyle(0xffee44, 0.85);
    for (let i = 0; i < 5; i++) {
      const sa = spin * 2.3 + (Math.PI * 2 / 5) * i;
      const sr = bitR + 6 + Math.sin(spin * 3 + i) * 4;
      g.fillCircle(x + Math.cos(sa) * sr, bitY + Math.sin(sa) * sr * 0.55, 2);
    }
  }

  drawHud(g, nameText, levelText) {
    g.clear();

    const { x, y } = this;
    const w     = this.baseW;
    const h     = this.baseH;
    const headR = w * 0.37;

    const leg     = { h: h * 0.33 };
    const body    = { h: h * 0.42 };
    const headTop = y - (leg.h + h * 0.02) - body.h - headR * 0.75 - headR;

    const barW = 70;
    const barH = 6;
    const barX = x - barW / 2;

    const manaY = headTop - 22;
    const hpY   = manaY - barH - 3;

    g.fillStyle(0x1a0a0a, 0.75);
    g.fillRoundedRect(barX - 1, hpY - 1, barW + 2, barH + 2, 2);
    g.fillStyle(0x22cc44, 1);
    g.fillRoundedRect(barX, hpY, barW * (this.hp / this.maxHp), barH, 2);

    g.fillStyle(0x0a0a1a, 0.75);
    g.fillRoundedRect(barX - 1, manaY - 1, barW + 2, barH + 2, 2);
    g.fillStyle(0xddcc00, 1);
    g.fillRoundedRect(barX, manaY, barW * (this.mana / this.maxMana), barH, 2);

    nameText.setPosition(x, headTop - 36).setText(this.name).setFontSize(10);
    levelText.setPosition(x, headTop - 48).setText(`Lv.${this.level}`).setFontSize(10);
  }
}
