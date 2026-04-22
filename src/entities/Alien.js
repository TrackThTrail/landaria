/**
 * Criatura alienígena hostil que patrulha cavernas.
 *
 * Estados:
 *  patrol    — caminha de um lado para o outro dentro do leash
 *  alert     — detectou jogador; mostra ! por ALERT_DUR ms antes de atacar
 *  charging  — sprint em direção ao jogador
 *  confused  — errou o ataque; fica parado 2s e volta ao patrol
 *  stunned   — recuo após golpear o jogador
 *  dead      — anima morte e desaparece
 */
export class Alien {
  constructor(x, y) {
    this.x = x;
    this.y = y;

    this.hp    = 60;
    this.maxHp = 60;

    this.vx = 0;
    this.vy = 0;
    this.facing     = 1;
    this.isOnGround = false;

    // ── Estado ────────────────────────────────────────────────────────────
    this.state        = 'patrol';
    this.alertTimer   = 0;
    this.stunnedTimer  = 0;
    this.confusedTimer = 0;
    this.deadTimer     = 0;
    this.chargeDir     = 0;  // direção fixada ao iniciar a carga
    this.chargeStartX  = 0;  // X de início da carga (para medir distância)

    // ── Patrulha ──────────────────────────────────────────────────────────
    this.patrolDir   = 1;
    this.patrolTimer = 0;
    this.homeX       = x;

    // ── Constantes ────────────────────────────────────────────────────────
    this.ALERT_DUR    = 1500;   // ms de aviso antes de avançar
    this.STUNNED_DUR  = 900;    // ms de recuo após golpear
    this.CONFUSED_DUR = 2000;   // ms parado após errar o ataque
    this.DEAD_DUR     = 700;    // ms da animação de morte
    this.PATROL_DUR   = 2200;   // ms em cada direção
    this.LEASH        = 160;    // px máx da posição inicial
    this.DETECT_RANGE = 210;    // px de deteção horizontal
    this.DETECT_VERT  = 80;     // px vertical máx para deteção (2 blocos)
    this.ATTACK_DIST  = 36;     // px para activar o golpe
    this.DAMAGE       = 45;     // HP removido do jogador
    this.PATROL_SPD   = 0.5;    // px/frame na patrulha
    this.CHARGE_SPD   = 2.4;    // px/frame na carga (abaixo do maxSpeedX=3.6 do jogador)

    this.baseW = 30;
    this.baseH = 22;

    this.hitPlayer = false;  // true no frame em que golpeia o jogador
  }

  /** true quando a animação de morte terminou — pode ser removido da lista */
  get isDead() {
    return this.state === 'dead' && this.deadTimer <= 0;
  }

  // ────────────────────────────────────────────────────────────────────────
  update(delta, playerX, playerY) {
    this.hitPlayer = false;

    if (this.state === 'dead') {
      this.deadTimer -= delta;
      this.vx *= 0.88;
      if (!this.isOnGround) this.vy = Math.min(this.vy + 0.28, 8);
      this.x += this.vx;
      this.y += this.vy;
      return;
    }

    const ddx  = playerX - this.x;
    const dist = Math.hypot(ddx, playerY - this.y);

    // Gravidade
    if (!this.isOnGround) this.vy = Math.min(this.vy + 0.28, 8);
    else                  this.vy = 0;

    switch (this.state) {
      case 'patrol': {
        this.patrolTimer += delta;
        if (this.patrolTimer >= this.PATROL_DUR) {
          this.patrolDir  *= -1;
          this.patrolTimer = 0;
        }
        // Leash — vira quando afasta demasiado
        if (this.x - this.homeX >  this.LEASH) { this.patrolDir = -1; this.patrolTimer = 0; }
        if (this.homeX - this.x >  this.LEASH) { this.patrolDir =  1; this.patrolTimer = 0; }

        this.vx     = this.patrolDir * this.PATROL_SPD;
        this.facing = this.patrolDir;

        if (dist < this.DETECT_RANGE && Math.abs(playerY - this.y) <= this.DETECT_VERT) {
          this.state      = 'alert';
          this.alertTimer = this.ALERT_DUR;
          this.vx         = 0;
        }
        break;
      }

      case 'alert': {
        this.vx    *= 0.85;
        this.facing = Math.sign(ddx) || this.facing;
        this.alertTimer -= delta;
        if (this.alertTimer <= 0) {
          this.state       = 'charging';
          this.chargeDir   = Math.sign(ddx) || this.facing;  // fixa direção agora
          this.chargeStartX = this.x;
        }
        if (dist > this.DETECT_RANGE * 1.8 || Math.abs(playerY - this.y) > this.DETECT_VERT * 1.5)
                                                    { this.state = 'patrol'; }
        break;
      }

      case 'charging': {
        // Direção fixada no início — não muda durante o ataque
        this.facing = this.chargeDir;
        this.vx     = this.chargeDir * this.CHARGE_SPD;
        if (dist < this.ATTACK_DIST) {
          this.hitPlayer    = true;
          this.vx           = -this.chargeDir * 2.5;  // recuo
          this.vy           = -3.5;
          this.isOnGround   = false;
          this.state        = 'stunned';
          this.stunnedTimer = this.STUNNED_DUR;
        }
        // Para após 5 blocos (200px) sem acertar — fica confuso
        const chargeTravelled = Math.abs(this.x - this.chargeStartX);
        if (chargeTravelled > 200) {
          this.state         = 'confused';
          this.confusedTimer = this.CONFUSED_DUR;
          this.vx            = 0;
        }
        break;
      }

      case 'confused': {
        this.vx             *= 0.80;
        this.confusedTimer  -= delta;
        if (this.confusedTimer <= 0) {
          this.state       = 'patrol';
          this.patrolTimer = 0;
          this.vx          = 0;
        }
        break;
      }

      case 'stunned': {
        this.vx          *= 0.82;
        this.stunnedTimer -= delta;
        if (this.stunnedTimer <= 0) {
          this.state = dist < this.DETECT_RANGE ? 'alert' : 'patrol';
          if (this.state === 'alert') this.alertTimer = this.ALERT_DUR;
        }
        break;
      }
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  // ────────────────────────────────────────────────────────────────────────
  resolveCollision(terrain, groundY, cs) {
    this.isOnGround = false;
    if (this.y < groundY) return;

    const hw = this.baseW / 2 - 1;
    const pt = this.y - this.baseH;

    // Piso
    if (this.vy >= 0) {
      const row = Math.floor((this.y - groundY) / cs);
      if (row >= 0) {
        const col = Math.floor(this.x / cs);
        if (terrain.isSolid(col, row)) {
          this.y          = groundY + row * cs;
          this.vy         = 0;
          this.isOnGround = true;
        }
      }
    }

    // Paredes laterais
    const rowBot = Math.floor((this.y - groundY) / cs);
    const rowTop = Math.max(0, Math.floor((pt - groundY) / cs));
    if (rowBot >= 0) {
      for (let r = rowTop; r <= rowBot; r++) {
        const rTop  = groundY + r * cs;
        if (!(this.y > rTop && pt < rTop + cs)) continue;
        const rC = Math.floor((this.x + hw) / cs);
        const lC = Math.floor((this.x - hw) / cs);
        if (terrain.isSolid(rC, r)) {
          this.x = rC * cs - hw - 0.5;
          this.vx = Math.min(0, this.vx);
          if (this.state === 'patrol')   { this.patrolDir = -1; this.patrolTimer = 0; }
          if (this.state === 'charging') { this.state = 'confused'; this.confusedTimer = this.CONFUSED_DUR; this.vx = 0; }
        }
        if (terrain.isSolid(lC, r)) {
          this.x = (lC + 1) * cs + hw + 0.5;
          this.vx = Math.max(0, this.vx);
          if (this.state === 'patrol')   { this.patrolDir =  1; this.patrolTimer = 0; }
          if (this.state === 'charging') { this.state = 'confused'; this.confusedTimer = this.CONFUSED_DUR; this.vx = 0; }
        }
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  takeDamage(amount) {
    if (this.state === 'dead') return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp <= 0) {
      this.state     = 'dead';
      this.deadTimer = this.DEAD_DUR;
      this.vy        = -4;
      this.vx        = this.facing * -2;
    } else if (this.state === 'charging') {
      // Interrompe a carga ao ser atingido
      this.state      = 'alert';
      this.alertTimer = 700;
      this.vx         = 0;
    }
    return true;
  }

  // ────────────────────────────────────────────────────────────────────────
  /** Desenha em coordenadas de mundo (gfx world-space). camY usado só para culling. */
  draw(g, camY) {
    if (this.isDead) return;
    // Culling: fora da janela visível
    if (this.y < camY - 80 || this.y > camY + 620) return;

    const x  = this.x;
    const y  = this.y;
    const f  = this.facing;
    const fr = this.state === 'dead'
      ? Math.max(0, this.deadTimer / this.DEAD_DUR)
      : 1;
    if (fr <= 0) return;

    const isCharging = this.state === 'charging';
    const isAlert    = this.state === 'alert';
    const isStunned  = this.state === 'stunned';

    // Animação das pernas
    const legOsc = isCharging
      ? Math.sin(Date.now() * 0.022) * 5
      : Math.sin(Date.now() * 0.006) * 3;

    // ── Sombra ────────────────────────────────────────────────────────────
    g.fillStyle(0x000000, 0.20 * fr);
    g.fillEllipse(x, y + 1, 36, 6);

    // ── Pernas (4) ────────────────────────────────────────────────────────
    g.lineStyle(2, isCharging ? 0x880e00 : 0x1e3a0e, fr);
    g.lineBetween(x - 7,  y - 8, x - 20, y -  2 + legOsc);
    g.lineBetween(x - 9,  y - 5, x - 15, y +  3 - legOsc);
    g.lineBetween(x + 7,  y - 8, x + 20, y -  2 - legOsc);
    g.lineBetween(x + 9,  y - 5, x + 15, y +  3 + legOsc);

    // ── Corpo (carapaça) ──────────────────────────────────────────────────
    g.fillStyle(isCharging ? 0x3e0600 : (isStunned ? 0x24100a : 0x102208), fr);
    g.fillEllipse(x, y - 10, 30, 20);
    // Brilho dorsal
    g.fillStyle(isCharging ? 0x7a1800 : 0x264618, 0.75 * fr);
    g.fillEllipse(x - 1, y - 13, 22, 11);
    // Marcas bioluminescentes
    g.fillStyle(0x44ff66, 0.18 * fr);
    g.fillCircle(x - 4, y - 12, 2);
    g.fillCircle(x + 3, y - 10, 1.5);

    // ── Garras frontais ───────────────────────────────────────────────────
    const clawC = isCharging ? 0xff4400 : 0x2a420e;
    g.lineStyle(isCharging ? 3 : 2, clawC, fr);
    g.lineBetween(x + f * 11, y - 9,  x + f * 24, y - 16);
    g.lineBetween(x + f * 11, y - 6,  x + f * 22, y -  1);
    g.lineStyle(1, clawC, 0.9 * fr);
    g.lineBetween(x + f * 24, y - 16, x + f * 28, y - 11);
    g.lineBetween(x + f * 22, y -  1, x + f * 26, y -  6);

    // ── Olhos ─────────────────────────────────────────────────────────────
    const eyeC = isAlert || isCharging ? 0xff2200 : 0x22ee22;
    g.fillStyle(eyeC, 0.30 * fr);
    g.fillCircle(x + f * 8, y - 15, 8);    // glow
    g.fillStyle(eyeC, fr);
    g.fillCircle(x + f * 8,  y - 15, 4);
    g.fillCircle(x + f * 12, y - 12, 2.5);
    g.fillStyle(0x000000, 0.85 * fr);
    g.fillCircle(x + f * 9,  y - 15, 1.8); // pupila

    // ── Barra de HP ───────────────────────────────────────────────────────
    if (this.hp < this.maxHp && this.state !== 'dead') {
      const bw = 28, bh = 3, bx = x - 14, by = y - 34;
      g.fillStyle(0x330000, 0.85);
      g.fillRect(bx, by, bw, bh);
      g.fillStyle(0xdd2222, 0.92);
      g.fillRect(bx, by, Math.max(0, bw * (this.hp / this.maxHp)), bh);
    }

    // ── Exclamação de alerta ──────────────────────────────────────────────
    if (this.state === 'alert') {
      const blinkSpeed = 130 + (this.alertTimer / this.ALERT_DUR) * 220;
      const blink      = Math.floor(Date.now() / blinkSpeed) % 2 === 0;
      if (blink) {
        g.fillStyle(0xffee00, 0.95);
        g.fillRoundedRect(x - 8, y - 58, 16, 22, 4);
        g.fillTriangle(x - 4, y - 36, x + 4, y - 36, x, y - 30);
        g.fillStyle(0x000000, 0.9);
        g.fillRect(x - 2, y - 56, 4, 13);
        g.fillCircle(x, y - 39, 2.5);
      }
    }

    // ── Vórtice de confusão ──────────────────────────────────────────────
    if (this.state === 'confused') {
      const t       = Date.now() * 0.004;
      const bx2     = x - 8;
      const by2     = y - 60;
      // fundo do balão
      g.fillStyle(0x334455, 0.88);
      g.fillRoundedRect(bx2, by2, 16, 16, 4);
      g.fillTriangle(x - 3, by2 + 16, x + 3, by2 + 16, x, by2 + 22);
      // espiral simples: 3 arcos rotacionando
      const cx2 = x, cy2 = by2 + 8;
      for (let i = 0; i < 3; i++) {
        const a   = t + (i / 3) * Math.PI * 2;
        const ox  = Math.cos(a) * 3.5;
        const oy  = Math.sin(a) * 2.5;
        const alp = 0.5 + 0.5 * Math.sin(a);
        g.fillStyle(0x88ddff, alp);
        g.fillCircle(cx2 + ox, cy2 + oy, 1.8);
      }
    }
  }
}