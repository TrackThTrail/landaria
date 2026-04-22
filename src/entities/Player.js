import { rot, fillRotatedRect, fillTopHalfEllipse } from '../utils/draw.js';

export class Player {
  constructor(x, y) {
    this.x        = x;
    this.y        = y;  // posição dos pés
    this.vx       = 0;
    this.vy       = 0;
    this.baseW    = 22;
    this.baseH    = 34;  // visual + hitbox cabem em 1 bloco (CELL_SIZE=40)
    this.maxSpeedX  = 3.6;
    this.accel     = 0.18;   // aceleração inicial
    this.accelMax  = 0.44;   // aceleração máxima após ramp-up
    this.ACCEL_RAMP= 280;    // ms até atingir accelMax
    this.friction  = 0.80;   // atrito normal (tecla pressionada)
    this.slideFric = 0.89;   // atrito de deslizamento (tecla solta)
    this._holdLeft  = 0;
    this._holdRight = 0;
    this._sideBlend = 0;  // 0 = frente, 1 = perfil (instantâneo)
    this.idleTime   = 0;  // ms acumulados parado no chão
    this.facing    = 1;
    this.walkTime  = 0;

    // Física 2D — gravidade assimétrica
    this.GRAVITY_UP     = 0.012;  // desacelera na subida → pico suave
    this.GRAVITY_DOWN   = 0.004;  // acelera devagar na descida → queda lenta/flutuante
    this.JUMP_VY        = -3.8;   // velocidade inicial do pulo
    this.MAX_FALL_SPEED = 6;      // cap de queda suave
    this.isOnGround     = true;

    // Paraquedas
    this.hasParachute      = true;  // consumível — some do HUD ao usar
    this.parachuteOpen     = false;
    this.parachuteAnim     = 0;   // 0..1 animação de abertura
    this.CHUTE_OPEN_SPEED  = 1 / 350;
    this.CHUTE_FALL_CAP    = 2.0;  // px/frame — descida suave com paraquedas

    // Ataque
    this.isAttacking = false;
    this.attackTimer = 0;
    this.ATTACK_DUR  = 280;
    this.ATTACK_PUSH = 1.8;

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
    this.oxygen    = 100;
    this.maxOxygen = 100;
    this.copper  = 10;
    this.iron    = 10;  // Ferro no inventário
    this.rkanium = 10;  // Rkanium no inventário
    this.stones  = 0;   // Pedras de Iluminação no inventário
    this.hasRadar = false;  // Radar de Sonar
    this.medkits = 1;   // Med-kits no inventário

    // Efeito do med-kit
    this.medkitActive    = false;
    this.medkitTimer     = 0;   // tempo restante do efeito (ms)
    this.medkitTickTimer = 0;   // temporizador entre ticks de cura
    this.medkitTick      = false; // true por 1 frame quando um tick de cura dispara

    // Jetpack
    this.jetpackOn       = false;
    this.JETPACK_THRUST  = -0.013;   // aceleração por ms (para cima)
    this.JETPACK_VY_CAP  = -3.0;     // velocidade máxima ascendente
    this.JETPACK_DRAIN   = 0.010;    // combustível gasto por ms (~10s de voo)

    // Luminosidade subterrânea
    this.lightRadius  = 90;   // raio de visão em px (cresce ao minerar)
    this.MAX_LIGHT_R  = 190;  // raio máximo atingível

    // Efeitos ativos
    this.effects = [];

    // Animação de levantamento inicial (1 = deitado, 0 = de pé)
    this.wakeAnim = 1.0;

    // Escavação
    this.isDrilling  = false;
    this.drillTime   = 0;   // acumula tempo para girar o bit
    this.hasDrill    = false; // escavadeira em mãos (toggle F)
    this.isDrillingH  = false; // está cavando (qualquer direção)
    this.drillDirX   = 1;     // direção da escavadeira (-1,0,1)
    this.drillDirY   = 0;
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

    // ── Med-kit ───────────────────────────────────────────────────────────
    this.medkitTick = false;
    if (this.medkitActive) {
      this.medkitTimer     -= delta;
      this.medkitTickTimer -= delta;
      if (this.medkitTickTimer <= 0) {
        this.medkitTickTimer += 1000;
        this.hp = Math.min(this.maxHp, this.hp + 5);
        this.medkitTick = true;
      }
      if (this.medkitTimer <= 0) {
        this.medkitActive = false;
      }
    }

    // ── Ataque ────────────────────────────────────────────────────────────
    if (this.isAttacking) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) { this.isAttacking = false; this.attackTimer = 0; }
    }

    // ── Gravidade assimétrica ─────────────────────────────────────────────
    // Subindo: grav leve → topo lento. Descendo: grav forte → queda rápida.
    const grav = this.vy < 0 ? this.GRAVITY_UP : this.GRAVITY_DOWN;
    this.vy += grav * delta;
    if (this.vy > this.MAX_FALL_SPEED) this.vy = this.MAX_FALL_SPEED;

    // ── Jetpack ───────────────────────────────────────────────────────────
    this.jetpackOn = false;
    if (input.jetpackActive && !this.isOnGround && this.fuel > 0) {
      this.jetpackOn = true;
      this.vy += this.JETPACK_THRUST * delta;
      if (this.vy < this.JETPACK_VY_CAP) this.vy = this.JETPACK_VY_CAP;
      this.fuel = Math.max(0, this.fuel - this.JETPACK_DRAIN * delta);
    }

    // ── Paraquedas ────────────────────────────────────────────────────────
    if (input.parachuteToggle && !this.isOnGround && this.hasParachute) {
      this.parachuteOpen = true;
      this.hasParachute  = false;   // consumido — ícone some do HUD
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

    // ── Movimento horizontal (aceleração progressiva + deslizamento) ─────────
    const movingL = input.left  && !this.isAttacking;
    const movingR = input.right && !this.isAttacking;
    const movingAtk = (input.left || input.right) && this.isAttacking;

    if (movingL) {
      this._holdLeft  = Math.min(this._holdLeft  + delta, this.ACCEL_RAMP);
      this._holdRight = 0;
    } else {
      this._holdLeft = 0;
    }
    if (movingR) {
      this._holdRight = Math.min(this._holdRight + delta, this.ACCEL_RAMP);
      this._holdLeft  = 0;
    } else {
      this._holdRight = 0;
    }

    const ramp      = Math.max(this._holdLeft, this._holdRight) / this.ACCEL_RAMP;
    const baseAccel = this.accel + (this.accelMax - this.accel) * ramp;
    const ea        = movingAtk ? baseAccel * 0.20 : baseAccel;
    if (movingL || movingAtk && input.left)  this.vx -= ea;
    if (movingR || movingAtk && input.right) this.vx += ea;

    // Ao não pressionar nada: atrito de deslizamento (varia proporcional à velocidade)
    const pressing = input.left || input.right;
    const fric = pressing ? this.friction : this.slideFric;
    this.vx *= fric;
    if (Math.abs(this.vx) > this.maxSpeedX) this.vx = Math.sign(this.vx) * this.maxSpeedX;
    if (!pressing && Math.abs(this.vx) < 0.08) this.vx = 0;

    if (this.vx >  0.25) this.facing =  1;
    if (this.vx < -0.25) this.facing = -1;

    // perfil instantâneo
    this._sideBlend = Math.abs(this.vx) > 0.25 ? 1 : 0;

    // idle: acumula quando parado no chão, zera quando move ou pula
    const idle = this.isOnGround && Math.abs(this.vx) < 0.25 && !this.isAttacking;
    if (idle) this.idleTime += delta;
    else      this.idleTime  = 0;

    const spd = Math.abs(this.vx);
    if (this.isOnGround && spd > 0.25) this.walkTime += delta * spd * 0.013;
    else                               this.walkTime  *= 0.90;

    // ── Movimento ─────────────────────────────────────────────────────────
    const prevY = this.y;
    this.x += this.vx;
    this.y += this.vy;
    this._landingVy = this.vy;  // guardado antes de colidir (para dano de queda)

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

    // Animação de levantamento: enquanto wakeAnim > 0 desenha pose de levantar
    if (this.wakeAnim > 0.01) {
      this._drawWaking(g);
      return;
    }

    const { x, y, facing, walkTime, vx, idleTime } = this;
    const moving    = Math.abs(vx) > 0.25;
    const inAir     = !this.isOnGround;
    const attacking = this.isAttacking;
    const isIdle    = !moving && !inAir && !attacking;

    // oscilações idle (respiração lenta)
    const idleBob  = isIdle ? Math.sin(idleTime * 0.0025) * 1.4 : 0;  // sobe/desce corpo
    const idleArm  = isIdle ? Math.sin(idleTime * 0.0018) * 0.10 : 0; // balanço leve dos braços

    // Escala fixa no modo 2D
    const w = this.baseW;
    const h = this.baseH;

    const atkT     = attacking ? 1 - (this.attackTimer / this.ATTACK_DUR) : 0;
    const atkAngle = attacking ? -Math.sin(atkT * Math.PI) * 1.2 : 0;
    const swing    = attacking ? 0 : (inAir ? 0.45 : (moving ? Math.sin(walkTime) * 0.34 : 0));
    const armSwing = attacking ? 0 : (inAir ? 0.40 : (moving ? Math.sin(walkTime + Math.PI) * 0.38 : idleArm));

    const side = this._sideBlend;  // 0 = frente, 1 = perfil
    const fx   = (dx) => x + dx * facing;

    const bodyW = side === 1 ? w * 0.35 : w * 0.72;  // tronco estreito de lado
    const leg   = { w: w * 0.28, h: h * 0.33 };
    const body  = { w: bodyW,    h: h * 0.42 };
    const arm   = { w: w * 0.22, h: h * 0.30 };
    const headR = w * 0.37;

    const legBaseY = y   - (leg.h + h * 0.02) + idleBob;
    const bodyTop  = legBaseY - body.h;
    const armY     = bodyTop  + body.h * 0.08;
    const headY    = bodyTop  - headR * 0.75;

    // ── Paraquedas (atrás do personagem) ──────────────────────────────────
    if (this.parachuteAnim > 0) this._drawParachute(g, x, headY, this.parachuteAnim);

    // ── Chamas do Jetpack ─────────────────────────────────────────────────
    if (this.jetpackOn) {
      const packX   = x - facing * (body.w / 2 + w * 0.06);
      const nozzleY = legBaseY - body.h * 0.12;
      const fl      = 1.0 + (Math.random() * 0.5 - 0.25);
      g.fillStyle(0xaaccff, 0.25);
      g.fillEllipse(packX, nozzleY + 12 * fl, w * 0.32 * fl, 20 * fl);
      g.fillStyle(0xff6600, 0.85);
      g.fillEllipse(packX, nozzleY + 8 * fl, w * 0.22 * fl, 14 * fl);
      g.fillStyle(0xffee44, 1.0);
      g.fillEllipse(packX, nozzleY + 3, w * 0.12, 7);
    }

    // ── Escavadeira na mão (sempre que hasDrill) ──────────────────────
    if (this.hasDrill) this._drawDrillHand(g, x, y, facing, armY, arm);

    // ── Sombra lunar ──────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x, y, w * 1.4, w * 0.28);

    // ── Pernas (calças brancas pressurizadas) ─────────────────────────────
    if (side === 0) {
      [
        { dx: -w * 0.16, angle:  swing * facing },
        { dx:  w * 0.16, angle: -swing * facing },
      ].forEach(({ dx, angle }) => {
        const pivX = fx(dx);
        // calça (branco-acinzentado)
        fillRotatedRect(g, pivX, legBaseY, leg.w, leg.h, angle, 0xdde0e8);
        // bota (cinza escuro)
        const bootH   = leg.h * 0.30;
        const bootOff = rot(0, leg.h - bootH, angle);
        fillRotatedRect(g, pivX + bootOff.x, legBaseY + bootOff.y, leg.w * 1.35, bootH, angle, 0x888a90);
      });
    } else {
      const fwd = Math.sin(walkTime) * w * 0.18;
      [
        { lx: x - fwd * facing, main: 0xbbbec8, boot: 0x707278 },
        { lx: x + fwd * facing, main: 0xdde0e8, boot: 0x888a90 },
      ].forEach(({ lx, main, boot }) => {
        const bootH = leg.h * 0.30;
        fillRotatedRect(g, lx, legBaseY,              leg.w,        leg.h,   0, main);
        fillRotatedRect(g, lx, legBaseY + leg.h - bootH, leg.w * 1.35, bootH, 0, boot);
      });
    }

    // ── Mochila de suporte de vida (atrás do tronco) ──────────────────────
    const packX = x - facing * (body.w / 2 + w * 0.06);
    g.fillStyle(0xb0b4bc, 1);
    g.fillRoundedRect(packX - w * 0.12, bodyTop + body.h * 0.06, w * 0.22, body.h * 0.82, 3);
    g.fillStyle(0x5588cc, 0.80);
    g.fillRoundedRect(packX - w * 0.09, bodyTop + body.h * 0.18, w * 0.16, body.h * 0.30, 2);

    // ── Tronco (fato branco pressurizado) ────────────────────────────────
    g.fillStyle(0xe8eaf0, 1);
    g.fillRoundedRect(x - body.w / 2, bodyTop, body.w, body.h, body.w * 0.22);
    // reflexo luminoso
    g.fillStyle(0xffffff, 0.35);
    g.fillRoundedRect(x - body.w * 0.22, bodyTop + body.h * 0.08, body.w * 0.28, body.h * 0.38, body.w * 0.12);
    // emblema NASA-like
    g.fillStyle(0x2244aa, 1);
    g.fillEllipse(x + body.w * 0.12, bodyTop + body.h * 0.52, body.w * 0.28, body.h * 0.24);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x + body.w * 0.04, bodyTop + body.h * 0.60, body.w * 0.24, body.h * 0.06, 1);
    // cinto de conexões
    g.fillStyle(0xaaaaaa, 1);
    g.fillRect(x - body.w / 2, bodyTop + body.h * 0.76, body.w, body.h * 0.10);
    g.fillStyle(0xffcc00, 1);
    g.fillRect(x - body.w * 0.06, bodyTop + body.h * 0.76, body.w * 0.12, body.h * 0.10);

    // ── Braços (manga branca + luva) ──────────────────────────────────────
    const frontArmAngle = attacking ? atkAngle * facing : -armSwing * facing;
    const backArmAngle  = attacking ? 0                 :  armSwing * facing;
    [
      { dx: -(body.w / 2 + arm.w * 0.25), angle: backArmAngle,  shade: 0xc8cad4 },
      { dx:  (body.w / 2 + arm.w * 0.25), angle: frontArmAngle, shade: 0xe8eaf0 },
    ].forEach(({ dx, angle, shade }) => {
      const pivX = fx(dx);
      fillRotatedRect(g, pivX, armY, arm.w, arm.h * 0.72, angle, shade);
      const gloveH   = arm.h * 0.32;
      const gloveOff = rot(0, arm.h * 0.72 - gloveH * 0.4, angle);
      fillRotatedRect(g, pivX + gloveOff.x, armY + gloveOff.y, arm.w * 1.1, gloveH, angle, 0x888a90);
    });

    // ── Capacete (esfera com visor dourado/âmbar) ─────────────────────────
    // pescoço
    g.fillStyle(0xccced6, 1);
    g.fillRect(x - w * 0.14, headY + headR * 0.60, w * 0.28, headR * 0.30);
    // casco branco
    g.fillStyle(0xe8eaf0, 1);
    g.fillCircle(x, headY, headR);
    // visor âmbar/dourado
    const visW = headR * (side === 0 ? 1.30 : 0.95);
    const visH = headR * 0.70;
    g.fillStyle(0xc88820, 0.88);
    g.fillEllipse(x + facing * headR * 0.08, headY + headR * 0.08, visW, visH);
    // reflexo no visor
    g.fillStyle(0xfffbe0, 0.30);
    g.fillEllipse(x + facing * headR * 0.04 - headR * 0.20, headY - headR * 0.10, visW * 0.42, visH * 0.38);
    // anel do capacete (base)
    g.lineStyle(2, 0x999aaa, 1);
    g.strokeCircle(x, headY, headR);
    // antena
    g.fillStyle(0xdddddd, 1);
    g.fillRect(x + facing * headR * 0.55, headY - headR * 0.90, 2, headR * 0.55);
    g.fillStyle(0xff4444, 1);
    g.fillCircle(x + facing * headR * 0.56, headY - headR * 0.94, 2);
  }

  /** Desenha o personagem deitado → levantando. wakeAnim: 1=deitado, 0=de pé. */
  _drawWaking(g) {
    const { x, y } = this;
    const angle = this.wakeAnim * Math.PI * 0.5;  // PI/2 = deitado, 0 = de pé
    const ca = Math.cos(angle), sa = Math.sin(angle);

    // Roda um ponto (px, py) em torno dos pés (x, y)
    const r = (px, py) => ({
      x: x + (px - x) * ca - (py - y) * sa,
      y: y + (px - x) * sa + (py - y) * ca,
    });

    const squat = this.wakeAnim;  // 1=deitado, 0=de pé
    const bw    = this.baseW * (0.72 + squat * 0.55);  // mais largo ao deitar
    const bh    = this.baseH * (1 - squat * 0.28);     // mais baixo/achatado ao deitar
    const headR = this.baseW * 0.37;
    const legW  = this.baseW * (0.28 + squat * 0.14);  // pernas também mais largas

    // Sombra no chão
    g.fillStyle(0x000000, 0.16);
    g.fillEllipse(x, y, this.baseW * 1.4, this.baseW * 0.28);

    // Perna esquerda
    const ll = [
      r(x - legW * 0.9, y - bh * 0.46),
      r(x - legW * 0.3, y - bh * 0.46),
      r(x - legW * 0.3, y),
      r(x - legW * 0.9, y),
    ];
    g.fillStyle(0xdde0e8, 1);
    g.fillPoints(ll, true);
    // bota
    const lb = [
      r(x - legW * 1.05, y - bh * 0.04),
      r(x - legW * 0.25, y - bh * 0.04),
      r(x - legW * 0.25, y),
      r(x - legW * 1.05, y),
    ];
    g.fillStyle(0x888a90, 1);
    g.fillPoints(lb, true);

    // Perna direita
    const rl = [
      r(x + legW * 0.3, y - bh * 0.46),
      r(x + legW * 0.9, y - bh * 0.46),
      r(x + legW * 0.9, y),
      r(x + legW * 0.3, y),
    ];
    g.fillStyle(0xbbbec8, 1);
    g.fillPoints(rl, true);
    const rb = [
      r(x + legW * 0.25, y - bh * 0.04),
      r(x + legW * 1.05, y - bh * 0.04),
      r(x + legW * 1.05, y),
      r(x + legW * 0.25, y),
    ];
    g.fillStyle(0x707278, 1);
    g.fillPoints(rb, true);

    // Corpo
    const bc = [
      r(x - bw / 2, y - bh),
      r(x + bw / 2, y - bh),
      r(x + bw / 2, y - bh * 0.40),
      r(x - bw / 2, y - bh * 0.40),
    ];
    g.fillStyle(0xe8eaf0, 1);
    g.fillPoints(bc, true);
    // Emblema azul no peito
    const em = [
      r(x - bw * 0.12, y - bh * 0.68),
      r(x + bw * 0.30, y - bh * 0.68),
      r(x + bw * 0.30, y - bh * 0.56),
      r(x - bw * 0.12, y - bh * 0.56),
    ];
    g.fillStyle(0x2244aa, 0.90);
    g.fillPoints(em, true);

    // Cabeça (capacete — círculo rotacionado em torno dos pés)
    const hc = r(x, y - bh - headR);
    g.fillStyle(0xe8eaf0, 1);
    g.fillCircle(hc.x, hc.y, headR);
    g.lineStyle(2, 0x999aaa, 1);
    g.strokeCircle(hc.x, hc.y, headR);
    // Visor âmbar
    const vc = r(x + headR * 0.1, y - bh - headR + headR * 0.08);
    g.fillStyle(0xc88820, 0.88);
    g.fillEllipse(vc.x, vc.y, headR * 1.30, headR * 0.70);
    g.fillStyle(0xfffbe0, 0.28);
    const vr = r(x - headR * 0.12, y - bh - headR - headR * 0.08);
    g.fillCircle(vr.x, vr.y, headR * 0.32);
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

  /**
   * Escavadeira compacta na mão — aponta em qualquer direção (drillDirX, drillDirY).
   * Usa transformação de coordenadas local para desenhar no ângulo correto.
   */
  _drawDrillHand(g, x, y, facing, armY, arm) {
    const t    = this.drillTime;
    const spin = t * 0.018;

    // posição do pivot na mão frontal
    const hx = x + facing * (arm.w * 0.5 + 8);
    const hy = armY + arm.h * 0.75;

    // ângulo da escavadeira (defau: aponta na direção do facing)
    const dx = this.drillDirX !== 0 ? this.drillDirX : (this.drillDirY !== 0 ? 0 : facing);
    const dy = this.drillDirY;
    const angle = Math.atan2(dy, dx);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    // helper: converte coords locais → mundo
    const lx = (lx, ly) => hx + lx * cos - ly * sin;
    const ly = (lx, ly) => hy + lx * sin + ly * cos;

    // cabo (trás)
    g.fillStyle(0x8B5E1A, 1);
    const chw = 5; const chl = 12;
    g.fillTriangle(
      lx(-chl, -chw), ly(-chl, -chw),
      lx(-chl,  chw), ly(-chl,  chw),
      lx(0,     0),   ly(0,     0)
    );
    g.fillTriangle(
      lx(-chl, -chw), ly(-chl, -chw),
      lx(-chl,  chw), ly(-chl,  chw),
      lx(-chl * 2, 0), ly(-chl * 2, 0)
    );

    // corpo metálico
    const bw = 7; const bl = 18;
    g.fillStyle(0xf0a020, 1);
    g.fillTriangle(
      lx(0,  -bw), ly(0,  -bw),
      lx(0,   bw), ly(0,   bw),
      lx(bl,  bw), ly(bl,  bw)
    );
    g.fillTriangle(
      lx(0,  -bw), ly(0,  -bw),
      lx(bl,  bw), ly(bl,  bw),
      lx(bl, -bw), ly(bl, -bw)
    );
    // detalhe escuro
    g.fillStyle(0xd08010, 1);
    g.fillTriangle(
      lx(2, -bw * 0.5), ly(2, -bw * 0.5),
      lx(2,  bw * 0.5), ly(2,  bw * 0.5),
      lx(bl - 2, bw * 0.5), ly(bl - 2, bw * 0.5)
    );

    // bit (estrela de 4 dentes no eixo da broca)
    const tipX = bl + 6;
    const bitR = 6;
    g.fillStyle(0xddeeee, 1);
    for (let i = 0; i < 4; i++) {
      const a = spin + (Math.PI / 2) * i;
      const ax = lx(tipX + Math.cos(a) * bitR, Math.sin(a) * bitR);
      const ay = ly(tipX + Math.cos(a) * bitR, Math.sin(a) * bitR);
      const bx2 = lx(tipX + Math.cos(a + 0.45) * bitR * 0.5, Math.sin(a + 0.45) * bitR * 0.5);
      const by2 = ly(tipX + Math.cos(a + 0.45) * bitR * 0.5, Math.sin(a + 0.45) * bitR * 0.5);
      const cx2 = lx(tipX + Math.cos(a - 0.45) * bitR * 0.5, Math.sin(a - 0.45) * bitR * 0.5);
      const cy2 = ly(tipX + Math.cos(a - 0.45) * bitR * 0.5, Math.sin(a - 0.45) * bitR * 0.5);
      g.fillTriangle(ax, ay, bx2, by2, cx2, cy2);
    }
    g.fillStyle(0x556666, 1);
    g.fillCircle(lx(tipX, 0), ly(tipX, 0), 3);

    // faíscas ao cavar
    if (this.isDrillingH) {
      g.fillStyle(0xffee44, 0.85);
      for (let i = 0; i < 4; i++) {
        const sa = spin * 2.3 + (Math.PI * 2 / 4) * i;
        const sr = bitR + 4 + Math.sin(spin * 3 + i) * 3;
        const fx2 = lx(tipX + Math.cos(sa) * sr, Math.sin(sa) * sr);
        const fy2 = ly(tipX + Math.cos(sa) * sr, Math.sin(sa) * sr);
        g.fillCircle(fx2, fy2, 1.5);
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

    const manaY  = headTop - 22;
    const hpY    = manaY - barH - 3;
    const oxyY   = hpY  - barH - 3;

    // Barra de oxigênio
    const oxyPct = this.oxygen / this.maxOxygen;
    const oxyColor = oxyPct > 0.5 ? 0x22aaff : oxyPct > 0.25 ? 0xff8800 : 0xff2222;
    g.fillStyle(0x0a1020, 0.75);
    g.fillRoundedRect(barX - 1, oxyY - 1, barW + 2, barH + 2, 2);
    g.fillStyle(oxyColor, 1);
    g.fillRoundedRect(barX, oxyY, barW * oxyPct, barH, 2);

    g.fillStyle(0x1a0a0a, 0.75);
    g.fillRoundedRect(barX - 1, hpY - 1, barW + 2, barH + 2, 2);
    g.fillStyle(0x22cc44, 1);
    g.fillRoundedRect(barX, hpY, barW * (this.hp / this.maxHp), barH, 2);

    g.fillStyle(0x0a0a1a, 0.75);
    g.fillRoundedRect(barX - 1, manaY - 1, barW + 2, barH + 2, 2);
    const fuelPct = this.fuel / this.maxFuel;
    const fuelColor = fuelPct > 0.5 ? 0xddcc00 : fuelPct > 0.25 ? 0xff8800 : 0xff2200;
    g.fillStyle(fuelColor, 1);
    g.fillRoundedRect(barX, manaY, barW * fuelPct, barH, 2);

    // Ícone de paraquedas — visível apenas enquanto disponível
    if (this.hasParachute) {
      const iconX = barX + barW + 8;
      const iconY = hpY + barH / 2;
      g.fillStyle(0xffffff, 0.85);
      g.fillTriangle(
        iconX,       iconY - 7,
        iconX - 6,   iconY + 2,
        iconX + 6,   iconY + 2
      );
      g.fillStyle(0xffffff, 0.65);
      g.fillRect(iconX - 0.5, iconY + 2, 1, 5);
    }

    // Ícone de med-kit — visível enquanto efeito activo
    if (this.medkitActive) {
      const ix = barX + barW + 8;
      const iy = manaY + barH / 2;
      g.fillStyle(0x330000, 0.75);
      g.fillRect(ix - 7, iy - 7, 14, 14);
      g.fillStyle(0xff3333, 1);
      g.fillRect(ix - 5, iy - 1.5, 10, 3);
      g.fillRect(ix - 1.5, iy - 5, 3, 10);
    }

    nameText.setPosition(x, headTop - 54).setText(this.name).setFontSize(10);
    levelText.setPosition(x, headTop - 66).setText(`Lv.${this.level}`).setFontSize(10);
  }
}
