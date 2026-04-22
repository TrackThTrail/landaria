export class Inventory {
  constructor(scene) {
    this.scene   = scene;
    this.visible = false;

    const W  = scene.game.config.width;
    const H  = scene.game.config.height;
    const PW = 400, PH = 360;
    const PX = (W - PW) / 2;
    const PY = (H - PH) / 2;
    this._bounds = { x: PX, y: PY, w: PW, h: PH };

    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };
    const D  = 22;

    this._g     = scene.add.graphics().setDepth(20).setScrollFactor(0);
    this._title = scene.add.text(PX + PW / 2, PY + 14, 'Inventário  [I]',
                    { ...ts, fontSize: '16px', color: '#aaddff' })
                    .setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    // Linhas de itens — geradas dinamicamente em update()
    const rows = [
      { key: 'copper',   icon: '🟠', label: 'Cobre',              color: '#e8a060' },
      { key: 'iron',     icon: '🔩', label: 'Ferro',              color: '#aaaaaa' },
      { key: 'rkanium',  icon: '🔮', label: 'Rkanium',            color: '#cc66ff' },
      { key: 'stones',   icon: '💡', label: 'Pedra de Iluminação', color: '#ffe066' },
      { key: 'medkits',  icon: '🩺', label: 'Med-kit  [Q]',        color: '#ff6666' },
      { key: 'hasRadar', icon: '📡', label: 'Radar de Sonar',      color: '#88ddff' },
    ];
    this._rows = rows;
    this._rowTexts = rows.map((r, i) =>
      scene.add.text(PX + 30, PY + 60 + i * 40, '',
        { ...ts, fontSize: '14px', color: r.color })
        .setDepth(D).setScrollFactor(0)
    );

    this._closeBtn = scene.add.text(PX + PW - 10, PY + 10, '✕',
                       { ...ts, fontSize: '16px', color: '#ff6666' })
                       .setOrigin(1, 0).setInteractive({ useHandCursor: true })
                       .setDepth(D).setScrollFactor(0);
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout',  () => this._closeBtn.setColor('#ff6666'));
    this._closeBtn.on('pointerdown', () => this.close());

    this._setVisible(false);
  }

  setPlayer(player) { this._player = player; }

  open()   { if (!this.visible) { this.visible = true;  this._setVisible(true);  } }
  close()  { if (this.visible)  { this.visible = false; this._setVisible(false); } }
  toggle() { this.visible ? this.close() : this.open(); }

  update() {
    if (!this.visible || !this._player) return;

    const p = this._player;
    const vals = {
      copper:   p.copper,
      iron:     p.iron,
      rkanium:  p.rkanium,
      stones:   p.stones,
      medkits:  p.medkits,
      hasRadar: p.hasRadar ? 1 : 0,
    };

    this._rows.forEach((r, i) => {
      const qty = vals[r.key];
      const suffix = r.key === 'hasRadar' ? (qty ? 'Obtido' : 'Não obtido') : `× ${qty}`;
      this._rowTexts[i].setText(`${r.icon}  ${r.label.padEnd(22)} ${suffix}`);
    });

    const { x, y, w, h } = this._bounds;
    this._g.clear();
    this._g.fillStyle(0x080d1a, 0.95);
    this._g.fillRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(2, 0x3366aa, 1);
    this._g.strokeRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(1, 0x224466, 0.8);
    this._g.lineBetween(x + 10, y + 44, x + w - 10, y + 44);
  }

  _setVisible(v) {
    [this._g, this._title, this._closeBtn, ...this._rowTexts]
      .forEach(o => o.setVisible(v));
  }
}
