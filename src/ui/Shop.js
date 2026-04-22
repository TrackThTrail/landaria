export class Shop {
  constructor(scene) {
    this.scene   = scene;
    this.visible = false;
    this._feedbackTimer = 0;

    const W  = scene.game.config.width;
    const H  = scene.game.config.height;
    const PW = 380, PH = 420;
    const PX = (W - PW) / 2;
    const PY = (H - PH) / 2;
    this._bounds = { x: PX, y: PY, w: PW, h: PH };

    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };

    this._g          = scene.add.graphics().setDepth(20).setScrollFactor(0);
    this._title      = scene.add.text(PX + PW / 2, PY + 16, 'Mesa de Ferramentas',
                         { ...ts, fontSize: '16px', color: '#e8a060' }).setOrigin(0.5, 0).setDepth(21).setScrollFactor(0);
    this._copperText = scene.add.text(PX + 14, PY + 44, '',
                         { ...ts, fontSize: '13px', color: '#e8a060' }).setDepth(21).setScrollFactor(0);
    this._ironText   = scene.add.text(PX + 180, PY + 44, '',
                         { ...ts, fontSize: '13px', color: '#aaaaaa' }).setDepth(21).setScrollFactor(0);

    // ── Item 1: Pedra de Iluminação ────────────────────────────────────────
    this._itemName  = scene.add.text(PX + 20, PY + 88, '\u{1F4A1} Pedra de Iluminação',
                        { ...ts, fontSize: '14px', color: '#ffe066' }).setDepth(21).setScrollFactor(0);
    this._itemDesc  = scene.add.text(PX + 20, PY + 108, 'Arremesse e ilumine a área [E]',
                        { ...ts, fontSize: '11px', color: '#bbbbbb' }).setDepth(21).setScrollFactor(0);
    this._itemPrice = scene.add.text(PX + 20, PY + 124, '\u{1F7E0} 1 cobre  \u{1F52E} 1 rkanium',
                        { ...ts, fontSize: '12px', color: '#e8a060' }).setDepth(21).setScrollFactor(0);
    this._buyBtn    = scene.add.text(PX + PW - 20, PY + 106, '[ Fabricar ]',
                        { ...ts, fontSize: '13px', color: '#88ff88' })
                        .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(21).setScrollFactor(0);

    // ── Item 2: Radar de Sonar ─────────────────────────────────────────────
    this._item2Name  = scene.add.text(PX + 20, PY + 178, '📡 Radar de Sonar',
                         { ...ts, fontSize: '14px', color: '#88ddff' }).setDepth(21).setScrollFactor(0);
    this._item2Desc  = scene.add.text(PX + 20, PY + 198, 'Emite sonar que detecta minérios [R]',
                         { ...ts, fontSize: '11px', color: '#bbbbbb' }).setDepth(21).setScrollFactor(0);
    this._item2Price = scene.add.text(PX + 20, PY + 214, '🟠 1 cobre  🔩 1 ferro',
               { ...ts, fontSize: '12px', color: '#aaaaaa' }).setDepth(21).setScrollFactor(0);
    this._buyBtn2    = scene.add.text(PX + PW - 20, PY + 196, '[ Fabricar ]',
                         { ...ts, fontSize: '13px', color: '#88ff88' })
                         .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(21).setScrollFactor(0);

    // ── Item 3: Lanterna ───────────────────────────────────────────────────
    this._item3Name  = scene.add.text(PX + 20, PY + 258, '🔦 Lanterna',
               { ...ts, fontSize: '14px', color: '#ffdd88' }).setDepth(21).setScrollFactor(0);
    this._item3Desc  = scene.add.text(PX + 20, PY + 278, 'Ilumina em cone à frente [T]',
               { ...ts, fontSize: '11px', color: '#bbbbbb' }).setDepth(21).setScrollFactor(0);
    this._item3Price = scene.add.text(PX + 20, PY + 294, '🔩 2 ferros',
               { ...ts, fontSize: '12px', color: '#e8a060' }).setDepth(21).setScrollFactor(0);
    this._buyBtn3    = scene.add.text(PX + PW - 20, PY + 276, '[ Fabricar ]',
               { ...ts, fontSize: '13px', color: '#88ff88' })
               .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(21).setScrollFactor(0);

    // ── Item 4: Jetpack ───────────────────────────────────────────────────
    this._item4Name  = scene.add.text(PX + 20, PY + 338, '🚀 Jetpack',
               { ...ts, fontSize: '14px', color: '#ffbb44' }).setDepth(21).setScrollFactor(0);
    this._item4Desc  = scene.add.text(PX + 20, PY + 358, 'Permite voar [Espaço]',
               { ...ts, fontSize: '11px', color: '#bbbbbb' }).setDepth(21).setScrollFactor(0);
    this._item4Price = scene.add.text(PX + 20, PY + 374, '🔩 1 ferro  🔮 1 rkanium',
               { ...ts, fontSize: '12px', color: '#e8a060' }).setDepth(21).setScrollFactor(0);
    this._buyBtn4    = scene.add.text(PX + PW - 20, PY + 356, '[ Fabricar ]',
               { ...ts, fontSize: '13px', color: '#88ff88' })
               .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(21).setScrollFactor(0);
  this._buyBtn4.on('pointerover', () => this._buyBtn4.setColor('#ffffff'));
  this._buyBtn4.on('pointerout',  () => this._buyBtn4.setColor('#88ff88'));
  this._buyBtn4.on('pointerdown', () => this._onBuyJetpack());

    this._feedback  = scene.add.text(PX + PW / 2, PY + PH - 28, '',
                        { ...ts, fontSize: '12px', color: '#ffcc00' }).setOrigin(0.5).setDepth(21).setScrollFactor(0);

    this._closeBtn  = scene.add.text(PX + PW - 10, PY + 10, '✕',
                        { ...ts, fontSize: '16px', color: '#ff6666' })
                        .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(21).setScrollFactor(0);

    // Hover efeitos
    this._buyBtn.on('pointerover',  () => this._buyBtn.setColor('#ffffff'));
    this._buyBtn.on('pointerout',   () => this._buyBtn.setColor('#88ff88'));
    this._buyBtn2.on('pointerover', () => this._buyBtn2.setColor('#ffffff'));
    this._buyBtn2.on('pointerout',  () => this._buyBtn2.setColor('#88ff88'));
    this._buyBtn3.on('pointerover', () => this._buyBtn3.setColor('#ffffff'));
    this._buyBtn3.on('pointerout',  () => this._buyBtn3.setColor('#88ff88'));
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout',  () => this._closeBtn.setColor('#ff6666'));

    this._buyBtn.on('pointerdown',  () => this._onBuyStone());
    this._buyBtn2.on('pointerdown', () => this._onBuyRadar());
    this._buyBtn3.on('pointerdown', () => this._onBuyLantern());
    this._closeBtn.on('pointerdown', () => this.close());

    this._setVisible(false);
  }

  setPlayer(player) { this._player = player; }
    setSoundEngine(snd) { this._snd = snd; }
  setSoundEngine(snd) { this._snd = snd; }

  open()   { if (!this.visible) { this.visible = true;  this._setVisible(true);  } }
  close()  { if (this.visible)  { this.visible = false; this._setVisible(false); } }
  toggle() { this.visible ? this.close() : this.open(); }

  update(delta) {
    if (!this.visible) return;

    if (this._player) {
      this._copperText.setText(`\u{1F7E0} Cobre: ${this._player.copper}`);
      this._ironText.setText(`🔩 Ferro: ${this._player.iron}`);
      // Atualiza estado dos botões se já tiver
      const hasR = this._player.hasRadar;
      this._buyBtn2.setText(hasR ? '[ Obtido ]' : '[ Fabricar ]').setColor(hasR ? '#888888' : '#88ff88');
      const hasL = this._player.lanterns > 0;
      this._buyBtn3.setText(hasL ? '[ Obtido ]' : '[ Fabricar ]').setColor(hasL ? '#888888' : '#88ff88');
      const hasJ = this._player.hasJetpack;
      this._buyBtn4.setText(hasJ ? '[ Obtido ]' : '[ Fabricar ]').setColor(hasJ ? '#888888' : '#88ff88');
    }

    if (this._feedbackTimer > 0) {
      this._feedbackTimer -= delta;
      if (this._feedbackTimer <= 0) { this._feedback.setText(''); }
    }

    // Redesenha o painel a cada frame (dentro do if visible)
    const { x, y, w, h } = this._bounds;
    this._g.clear();
    this._g.fillStyle(0x14090a, 0.94);
    this._g.fillRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(2, 0xc06030, 1);
    this._g.strokeRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(1, 0x664433, 0.8);
    this._g.lineBetween(x + 10, y + 38,  x + w - 10, y + 38);
    this._g.lineBetween(x + 10, y + 76,  x + w - 10, y + 76);
    this._g.lineBetween(x + 10, y + 158, x + w - 10, y + 158);
    this._g.lineBetween(x + 10, y + 242, x + w - 10, y + 242);
    this._g.lineBetween(x + 10, y + 326, x + w - 10, y + 326);
  }

  _onBuyStone() {
    if (!this._player) return;
    if (this._player.copper >= 1 && this._player.rkanium >= 1) {
      this._player.copper  -= 1;
      this._player.rkanium -= 1;
      this._player.stones  += 1;
      if (this._snd) this._snd.sfxCraftStone();
      this._feedback.setText('Pedra obtida! [O] para usar').setColor('#ffe066');
    } else if (this._player.copper < 1) {
      this._feedback.setText('Cobre insuficiente!').setColor('#ff6666');
    } else {
      this._feedback.setText('Rkanium insuficiente!').setColor('#ff6666');
    }
    this._feedbackTimer = 2200;
  }

  _onBuyLantern() {
    if (!this._player) return;
    if (this._player.iron >= 2) {
      this._player.iron    -= 2;
      this._player.lanterns += 1;
      if (this._snd) this._snd.sfxCraftStone();
      this._feedback.setText('Lanterna obtida! [T] para usar').setColor('#ffdd88');
    } else {
      this._feedback.setText('Ferro insuficiente!').setColor('#ff6666');
    }
    this._feedbackTimer = 2200;
  }

  _onBuyRadar() {
    if (!this._player) return;
    if (this._player.hasRadar) {
      this._feedback.setText('Radar já obtido! [R] para usar').setColor('#88ddff');
    } else if (this._player.copper >= 1 && this._player.iron >= 1) {
      this._player.copper  -= 1;
      this._player.iron    -= 1;
      this._player.hasRadar = true;
      if (this._snd) this._snd.sfxCraftRadar();
      this._feedback.setText('Radar obtido! [R] para usar').setColor('#88ddff');
    } else if (this._player.copper < 1) {
      this._feedback.setText('Cobre insuficiente!').setColor('#ff6666');
    } else {
      this._feedback.setText('Ferro insuficiente!').setColor('#ff6666');
    }
    this._feedbackTimer = 2200;
  }

  _onBuyJetpack() {
    if (!this._player) return;
    if (this._player.hasJetpack) {
      this._feedback.setText('Jetpack já obtido! [Espaço] para usar').setColor('#ffbb44');
    } else if (this._player.iron >= 1 && this._player.rkanium >= 1) {
      this._player.iron     -= 1;
      this._player.rkanium  -= 1;
      this._player.hasJetpack = true;
      if (this._snd) this._snd.sfxCraftRadar();
      this._feedback.setText('Jetpack obtido! [Espaço] para usar').setColor('#ffbb44');
    } else if (this._player.iron < 1) {
      this._feedback.setText('Ferro insuficiente!').setColor('#ff6666');
    } else {
      this._feedback.setText('Rkanium insuficiente!').setColor('#ff6666');
    }
    this._feedbackTimer = 2200;
  }

  _setVisible(v) {
    [this._g, this._title, this._copperText, this._ironText,
     this._itemName, this._itemDesc, this._itemPrice, this._buyBtn,
     this._item2Name, this._item2Desc, this._item2Price, this._buyBtn2,
     this._item3Name, this._item3Desc, this._item3Price, this._buyBtn3,
     this._item4Name, this._item4Desc, this._item4Price, this._buyBtn4,
     this._feedback, this._closeBtn]
      .forEach(o => o.setVisible(v));
  }
}
