export class Shop {
  constructor(scene) {
    this.scene   = scene;
    this.visible = false;
    this._feedbackTimer = 0;

    const W  = scene.game.config.width;
    const H  = scene.game.config.height;
    const PW = 380, PH = 240;
    const PX = (W - PW) / 2;
    const PY = (H - PH) / 2;
    this._bounds = { x: PX, y: PY, w: PW, h: PH };

    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };

    this._g         = scene.add.graphics().setDepth(20);
    this._title     = scene.add.text(PX + PW / 2, PY + 16, 'Loja do Vendedor',
                        { ...ts, fontSize: '16px', color: '#ffd700' }).setOrigin(0.5, 0).setDepth(21);
    this._goldText  = scene.add.text(PX + 14, PY + 44, '',
                        { ...ts, fontSize: '13px', color: '#ffe088' }).setDepth(21);

    // ── Item: Poção de Vida ───────────────────────────────────────────────
    this._itemName  = scene.add.text(PX + 20, PY + 86, '❤  Poção de Vida',
                        { ...ts, fontSize: '14px', color: '#ff8888' }).setDepth(21);
    this._itemDesc  = scene.add.text(PX + 20, PY + 108, '+2 HP/s durante 10s',
                        { ...ts, fontSize: '11px', color: '#bbbbbb' }).setDepth(21);
    this._itemPrice = scene.add.text(PX + 20, PY + 126, '💰 10 ouro',
                        { ...ts, fontSize: '12px', color: '#ffd700' }).setDepth(21);

    this._buyBtn    = scene.add.text(PX + PW - 20, PY + 106, '[ Comprar ]',
                        { ...ts, fontSize: '13px', color: '#88ff88' })
                        .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(21);

    this._feedback  = scene.add.text(PX + PW / 2, PY + PH - 28, '',
                        { ...ts, fontSize: '12px', color: '#ffcc00' }).setOrigin(0.5).setDepth(21);

    this._closeBtn  = scene.add.text(PX + PW - 10, PY + 10, '✕',
                        { ...ts, fontSize: '16px', color: '#ff6666' })
                        .setOrigin(1, 0).setInteractive({ useHandCursor: true }).setDepth(21);

    // Hover efeitos
    this._buyBtn.on('pointerover', () => this._buyBtn.setColor('#ffffff'));
    this._buyBtn.on('pointerout',  () => this._buyBtn.setColor('#88ff88'));
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout',  () => this._closeBtn.setColor('#ff6666'));

    this._buyBtn.on('pointerdown',   () => this._onBuy());
    this._closeBtn.on('pointerdown', () => this.close());

    this._setVisible(false);
  }

  setPlayer(player) { this._player = player; }

  open()   { if (!this.visible) { this.visible = true;  this._setVisible(true);  } }
  close()  { if (this.visible)  { this.visible = false; this._setVisible(false); } }
  toggle() { this.visible ? this.close() : this.open(); }

  update(delta) {
    if (!this.visible) return;

    if (this._player) {
      this._goldText.setText(`💰 Ouro: ${this._player.gold}`);
    }

    if (this._feedbackTimer > 0) {
      this._feedbackTimer -= delta;
      if (this._feedbackTimer <= 0) { this._feedback.setText(''); }
    }

    // Redesenha o painel a cada frame (dentro do if visible)
    const { x, y, w, h } = this._bounds;
    this._g.clear();
    this._g.fillStyle(0x080514, 0.94);
    this._g.fillRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(2, 0x7733cc, 1);
    this._g.strokeRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(1, 0x443366, 0.8);
    this._g.lineBetween(x + 10, y + 38, x + w - 10, y + 38);
    this._g.lineBetween(x + 10, y + 76, x + w - 10, y + 76);
  }

  _onBuy() {
    if (!this._player) return;
    if (this._player.gold >= 10) {
      this._player.gold -= 10;
      this._player.addEffect('health_potion');
      this._feedback.setText('Poção adicionada!').setColor('#88ff88');
    } else {
      this._feedback.setText('Ouro insuficiente!').setColor('#ff6666');
    }
    this._feedbackTimer = 2200;
  }

  _setVisible(v) {
    [this._g, this._title, this._goldText, this._itemName, this._itemDesc,
     this._itemPrice, this._buyBtn, this._feedback, this._closeBtn]
      .forEach(o => o.setVisible(v));
  }
}
