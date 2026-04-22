import { W, H } from '../constants.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  create() {
    this._gfx = this.add.graphics();

    // ── Estrelas (fixas) ──────────────────────────────────────────────────
    this._stars = [];
    const rng = new Phaser.Math.RandomDataGenerator(['menu-stars']);
    for (let i = 0; i < 240; i++) {
      this._stars.push({
        x:      rng.between(0, W),
        y:      rng.between(0, H),
        r:      rng.realInRange(0.3, 1.8),
        bright: rng.realInRange(0.4, 1.0),
        color:  rng.pick([0xffffff, 0xaaccff, 0xffeedd]),
      });
    }

    // ── Terra (canto superior direito, decorativa) ────────────────────────
    this._drawEarth();

    // ── Nave: estado inicial ──────────────────────────────────────────────
    this._ship = {
      x:     -120,
      y:     H * 0.30,
      vx:    1.1,
      vy:    0.0,
      t:     0,       // tempo para oscilação suave
      flame: 0,       // phase da chama
    };

    // ── Título ────────────────────────────────────────────────────────────
    this.add.text(W / 2, H * 0.18, 'LANDARIA', {
      fontFamily: 'monospace',
      fontSize:   '52px',
      color:      '#e8eaf0',
      stroke:     '#2244aa',
      strokeThickness: 6,
      shadow:     { offsetX: 0, offsetY: 0, color: '#5588ff', blur: 22, fill: true },
    }).setOrigin(0.5).setDepth(10);

    this.add.text(W / 2, H * 0.28, 'lunar mining expedition', {
      fontFamily: 'monospace',
      fontSize:   '14px',
      color:      '#8899cc',
      letterSpacing: 4,
    }).setOrigin(0.5).setDepth(10);

    // ── Botão Jogar ───────────────────────────────────────────────────────
    const btnW = 200, btnH = 52;
    const btnX = W / 2 - btnW / 2;
    const btnY = H * 0.60;

    this._btnGfx = this.add.graphics().setDepth(10);
    this._drawBtn(false);

    this._btnZone = this.add.zone(W / 2, btnY + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);

    this._btnZone.on('pointerover',  () => { this._btnHover = true;  this._drawBtn(true);  });
    this._btnZone.on('pointerout',   () => { this._btnHover = false; this._drawBtn(false); });
    this._btnZone.on('pointerdown',  () => {
      this.cameras.main.fadeOut(400, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('GameScene');
      });
    });

    // ── Botão Como Jogar ──────────────────────────────────────────────────
    const btn2Y = btnY + btnH + 16;
    this._btn2Gfx = this.add.graphics().setDepth(10);
    this._drawBtn2(false);
    this._btn2Zone = this.add.zone(W / 2, btn2Y + btnH / 2, btnW, btnH)
      .setInteractive({ useHandCursor: true })
      .setDepth(11);
    this._btn2Zone.on('pointerover',  () => { this._btn2Hover = true;  this._drawBtn2(true);  });
    this._btn2Zone.on('pointerout',   () => { this._btn2Hover = false; this._drawBtn2(false); });
    this._btn2Zone.on('pointerdown',  () => this._openRules());

    // ── Modal de regras (inicialmente oculto) ─────────────────────────────
    this._buildRulesModal();

    // ── Tecla Enter / Espaço também inicia ────────────────────────────────
    this.input.keyboard.on('keydown-ENTER', () => { if (!this._rulesOpen) this._startGame(); });
    this.input.keyboard.on('keydown-SPACE', () => { if (!this._rulesOpen) this._startGame(); });
    this.input.keyboard.on('keydown-ESC',   () => { if (this._rulesOpen)  this._closeRules(); });

    this.cameras.main.fadeIn(600, 0, 0, 0);
    this._btnHover  = false;
    this._btn2Hover = false;
    this._btnTween  = 0;
    this._rulesOpen = false;
  }

  _startGame() {
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('GameScene'));
  }

  _drawEarth() {
    const g   = this.add.graphics().setDepth(1);
    const ex  = W - 70, ey = 72, er = 58;
    g.fillStyle(0x1133aa, 0.88);
    g.fillCircle(ex, ey, er);
    g.fillStyle(0x228833, 0.80);
    g.fillEllipse(ex - 18, ey - 12, 36, 26);
    g.fillEllipse(ex + 12, ey + 10, 28, 18);
    g.fillStyle(0xffffff, 0.22);
    g.fillEllipse(ex - 8,  ey - 28, 52, 14);
    g.fillEllipse(ex + 18, ey - 10, 30, 12);
    g.lineStyle(4, 0x6699ff, 0.18);
    g.strokeCircle(ex, ey, er + 5);
  }

  _drawBtn(hover) {
    const g    = this._btnGfx;
    const btnW = 200, btnH = 52;
    const bx   = W / 2 - btnW / 2;
    const by   = H * 0.60;
    g.clear();
    // sombra
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(bx + 4, by + 4, btnW, btnH, 10);
    // fundo
    g.fillStyle(hover ? 0x4466dd : 0x2244aa, 1);
    g.fillRoundedRect(bx, by, btnW, btnH, 10);
    // borda
    g.lineStyle(2, hover ? 0x88aaff : 0x5577cc, 1);
    g.strokeRoundedRect(bx, by, btnW, btnH, 10);
    // reflexo
    g.fillStyle(0xffffff, hover ? 0.18 : 0.10);
    g.fillRoundedRect(bx + 6, by + 5, btnW - 12, btnH * 0.38, 7);

    // texto do botão (recria toda vez para simplicidade)
    if (this._btnText) this._btnText.destroy();
    this._btnText = this.add.text(W / 2, by + btnH / 2, '▶  JOGAR', {
      fontFamily: 'monospace',
      fontSize:   '20px',
      color:      hover ? '#ffffff' : '#ccd8ff',
    }).setOrigin(0.5).setDepth(12);
  }
  _drawBtn2(hover) {
    const g    = this._btn2Gfx;
    const btnW = 200, btnH = 52;
    const bx   = W / 2 - btnW / 2;
    const by   = H * 0.60 + btnH + 16;
    g.clear();
    g.fillStyle(0x000000, 0.30);
    g.fillRoundedRect(bx + 4, by + 4, btnW, btnH, 10);
    g.fillStyle(hover ? 0x336655 : 0x1a4433, 1);
    g.fillRoundedRect(bx, by, btnW, btnH, 10);
    g.lineStyle(2, hover ? 0x66cc99 : 0x338866, 1);
    g.strokeRoundedRect(bx, by, btnW, btnH, 10);
    g.fillStyle(0xffffff, hover ? 0.14 : 0.07);
    g.fillRoundedRect(bx + 6, by + 5, btnW - 12, btnH * 0.38, 7);
    if (this._btn2Text) this._btn2Text.destroy();
    this._btn2Text = this.add.text(W / 2, by + btnH / 2, '?  COMO JOGAR', {
      fontFamily: 'monospace',
      fontSize:   '16px',
      color:      hover ? '#aaffcc' : '#77ccaa',
    }).setOrigin(0.5).setDepth(12);
  }

  _buildRulesModal() {
    const PW = 560, PH = 340;
    const PX = (W - PW) / 2, PY = (H - PH) / 2;

    this._rulesGroup = [
      this._rulesBg = this.add.graphics().setDepth(30),
      this._rulesText = this.add.text(PX + 24, PY + 20,
        'CONTROLES\n' +
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        'A / D        Mover para esquerda / direita\n' +
        'Espa\u00e7o       Pular\n' +
        'Espa\u00e7o (ar)  Soltar e pressionar de novo: jetpack\n' +
        '1            Abrir paraquedas\n' +
        'F            Equipar / guardar a escavadeira\n' +
        'L            Abrir mesa de ferramentas (perto dela)\n' +
        'E            Colocar pedra de ilumina\u00e7\u00e3o\n' +
        'Esc          Fechar menus\n\n' +
        'OBJETIVO\n' +
        '\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\n' +
        'Cava \u2192 encontra cobre \u2192 compra pedras na mesa\n' +
        'Usa o jetpack (bateria) para explorar.\n' +
        'Coloca pedras no ch\u00e3o para iluminar o subsolo.',
        {
          fontFamily: 'monospace', fontSize: '13px', color: '#ddeeff',
          stroke: '#000', strokeThickness: 2, lineSpacing: 4,
        }).setDepth(31),
      this._rulesClose = this.add.text(PX + PW - 14, PY + 12, '\u2715', {
        fontFamily: 'monospace', fontSize: '18px', color: '#ff6666',
        stroke: '#000', strokeThickness: 2,
      }).setOrigin(1, 0).setDepth(31)
        .setInteractive({ useHandCursor: true })
        .on('pointerover', () => this._rulesClose.setColor('#ffffff'))
        .on('pointerout',  () => this._rulesClose.setColor('#ff6666'))
        .on('pointerdown', () => this._closeRules()),
    ];

    this._rulesBg.fillStyle(0x020d1a, 0.96);
    this._rulesBg.fillRoundedRect(PX, PY, PW, PH, 12);
    this._rulesBg.lineStyle(2, 0x336699, 1);
    this._rulesBg.strokeRoundedRect(PX, PY, PW, PH, 12);

    this._rulesGroup.forEach(o => o.setVisible(false));
  }

  _openRules()  { this._rulesOpen = true;  this._rulesGroup.forEach(o => o.setVisible(true));  }
  _closeRules() { this._rulesOpen = false; this._rulesGroup.forEach(o => o.setVisible(false)); }
  _drawShip(g, sx, sy, flame) {
    // fuselagem principal (branca-acinzentada)
    g.fillStyle(0xe0e2ea, 1);
    // nariz apontando para direita (→)
    g.fillTriangle(sx + 60, sy, sx - 10, sy - 18, sx - 10, sy + 18);
    // corpo central
    g.fillStyle(0xc8cad4, 1);
    g.fillRect(sx - 30, sy - 14, 60, 28);
    // cúpula (visor)
    g.fillStyle(0xc88820, 0.90);
    g.fillEllipse(sx + 10, sy, 30, 22);
    g.fillStyle(0xfffbe0, 0.25);
    g.fillEllipse(sx + 5, sy - 4, 14, 10);
    // asa superior
    g.fillStyle(0xaab0be, 1);
    g.fillTriangle(sx - 5, sy - 14, sx + 20, sy - 14, sx + 5, sy - 34);
    // asa inferior
    g.fillTriangle(sx - 5, sy + 14, sx + 20, sy + 14, sx + 5, sy + 34);
    // motor (traseiro)
    g.fillStyle(0x888a96, 1);
    g.fillRect(sx - 40, sy - 10, 16, 20);
    // chama
    const fl = 0.6 + Math.sin(flame) * 0.4;
    g.fillStyle(0xff8800, 0.85 * fl);
    g.fillTriangle(sx - 40, sy - 7, sx - 40, sy + 7, sx - 40 - 28 * fl, sy);
    g.fillStyle(0xffee44, 0.70 * fl);
    g.fillTriangle(sx - 40, sy - 4, sx - 40, sy + 4, sx - 40 - 16 * fl, sy);
    // detalhe: linha de fuselagem
    g.lineStyle(1, 0x999aaa, 0.5);
    g.lineBetween(sx - 10, sy, sx + 55, sy);
  }

  update(time, delta) {
    const g   = this._gfx;
    const s   = this._ship;
    g.clear();

    // ── Fundo espacial ────────────────────────────────────────────────────
    g.fillStyle(0x000008, 1);
    g.fillRect(0, 0, W, H);
    for (const st of this._stars) {
      g.fillStyle(st.color, st.bright);
      g.fillCircle(st.x, st.y, st.r);
    }

    // ── Mover nave ────────────────────────────────────────────────────────
    s.t     += delta * 0.0008;
    s.flame += delta * 0.012;
    s.x     += s.vx;
    s.y      = H * 0.30 + Math.sin(s.t) * 28;

    // ── Rastro de fumaça ──────────────────────────────────────────────────
    if (!this._trail) this._trail = [];
    if (Math.floor(s.x) % 3 === 0) {
      this._trail.push({ x: s.x - 40, y: s.y, age: 0 });
    }
    this._trail = this._trail.filter(p => p.age < 60);
    for (const p of this._trail) {
      p.age++;
      const a = (1 - p.age / 60) * 0.18;
      g.fillStyle(0xaabbdd, a);
      g.fillCircle(p.x - p.age * 0.5, p.y + Math.sin(p.age * 0.15) * 4, 6 + p.age * 0.2);
    }

    // ── Desenha nave ──────────────────────────────────────────────────────
    this._drawShip(g, s.x, s.y, s.flame);

    // wrap: quando sai pela direita, volta pela esquerda
    if (s.x > W + 150) {
      s.x = -120;
      this._trail = [];
    }
  }
}
