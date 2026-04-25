export class CharacterMenu {
  constructor(scene) {
    this.scene   = scene;
    this.visible = false;
    this._player = null;

    const W  = scene.game.config.width;
    const H  = scene.game.config.height;
    const PW = 400, PH = 340;
    const PX = (W - PW) / 2;
    const PY = (H - PH) / 2;
    this._bounds = { x: PX, y: PY, w: PW, h: PH };

    const D  = 22;
    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };

    this._g = scene.add.graphics().setDepth(D - 2).setScrollFactor(0);

    this._title = scene.add.text(PX + PW / 2, PY + 14,
      'Personagem  [P]',
      { ...ts, fontSize: '16px', color: '#aaccff' })
      .setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    // ── Linha: nome + nível ──────────────────────────────────────────────
    this._nameText = scene.add.text(PX + 20, PY + 50, '',
      { ...ts, fontSize: '14px', color: '#ffffff' })
      .setDepth(D).setScrollFactor(0);

    this._levelText = scene.add.text(PX + PW - 20, PY + 50, '',
      { ...ts, fontSize: '14px', color: '#aaffcc' })
      .setOrigin(1, 0).setDepth(D).setScrollFactor(0);

    // ── Seção: Experiência ───────────────────────────────────────────────
    this._xpLabel = scene.add.text(PX + 20, PY + 80, 'Experiência',
      { ...ts, fontSize: '11px', color: '#888899' })
      .setDepth(D).setScrollFactor(0);
    this._xpVal = scene.add.text(PX + PW - 20, PY + 80, '',
      { ...ts, fontSize: '11px', color: '#ccccff' })
      .setOrigin(1, 0).setDepth(D).setScrollFactor(0);

    // ── Seção: Traje ─────────────────────────────────────────────────────
    this._sectionLabel = scene.add.text(PX + 20, PY + 118,
      '— Traje Espacial ─────────────────────────',
      { ...ts, fontSize: '11px', color: '#446688' })
      .setDepth(D).setScrollFactor(0);

    // Bateria (combustível do jetpack)
    this._batLabel = scene.add.text(PX + 20, PY + 148, 'Bateria (Jetpack)',
      { ...ts, fontSize: '12px', color: '#88ffcc' })
      .setDepth(D).setScrollFactor(0);
    this._batVal = scene.add.text(PX + PW - 20, PY + 148, '',
      { ...ts, fontSize: '12px', color: '#88ffcc' })
      .setOrigin(1, 0).setDepth(D).setScrollFactor(0);

    // Tanque de O₂
    this._oxyLabel = scene.add.text(PX + 20, PY + 198, 'Tanque de O₂',
      { ...ts, fontSize: '12px', color: '#22aaff' })
      .setDepth(D).setScrollFactor(0);
    this._oxyVal = scene.add.text(PX + PW - 20, PY + 198, '',
      { ...ts, fontSize: '12px', color: '#22aaff' })
      .setOrigin(1, 0).setDepth(D).setScrollFactor(0);

    // Resistência do Traje
    this._resLabel = scene.add.text(PX + 20, PY + 248, 'Resistência do Traje',
      { ...ts, fontSize: '12px', color: '#ffcc44' })
      .setDepth(D).setScrollFactor(0);
    this._resVal = scene.add.text(PX + PW - 20, PY + 248, '',
      { ...ts, fontSize: '12px', color: '#ffcc44' })
      .setOrigin(1, 0).setDepth(D).setScrollFactor(0);

    // Botão fechar
    this._closeBtn = scene.add.text(PX + PW - 10, PY + 10, '✕',
      { ...ts, fontSize: '16px', color: '#ff6666' })
      .setOrigin(1, 0).setInteractive({ useHandCursor: true })
      .setDepth(D).setScrollFactor(0);
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout',  () => this._closeBtn.setColor('#ff6666'));
    this._closeBtn.on('pointerdown', () => this.close());

    this._allNodes = [
      this._g, this._title, this._nameText, this._levelText,
      this._xpLabel, this._xpVal, this._sectionLabel,
      this._batLabel, this._batVal,
      this._oxyLabel, this._oxyVal,
      this._resLabel, this._resVal,
      this._closeBtn,
    ];

    this._setVisible(false);
  }

  setPlayer(player) { this._player = player; }

  open()   { if (!this.visible) { this.visible = true;  this._setVisible(true); } }
  close()  { if (this.visible)  { this.visible = false; this._setVisible(false); } }
  toggle() { this.visible ? this.close() : this.open(); }

  update() {
    if (!this.visible || !this._player) return;
    const p = this._player;
    const { x: PX, y: PY, w: PW, h: PH } = this._bounds;
    const g = this._g;

    // Redesenha fundo e barras
    g.clear();
    // Painel fundo
    g.fillStyle(0x060c18, 0.97);
    g.fillRoundedRect(PX, PY, PW, PH, 10);
    g.lineStyle(2, 0x2244aa, 1);
    g.strokeRoundedRect(PX, PY, PW, PH, 10);
    g.lineStyle(1, 0x112244, 0.8);
    g.lineBetween(PX + 10, PY + 44, PX + PW - 10, PY + 44);
    g.lineBetween(PX + 10, PY + 110, PX + PW - 10, PY + 110);

    // ── Barra de XP ──────────────────────────────────────────────────────
    const xpPct  = Math.min(1, p.xp / p.xpToNext);
    const bX = PX + 20, bW = PW - 40, bH = 8;
    const xpBarY = PY + 94;
    g.fillStyle(0x0a0a1a, 0.85);
    g.fillRoundedRect(bX - 1, xpBarY - 1, bW + 2, bH + 2, 3);
    g.fillStyle(0x4455ff, 0.9);
    g.fillRoundedRect(bX, xpBarY, bW * xpPct, bH, 3);
    g.lineStyle(1, 0x3344aa, 0.6);
    g.strokeRoundedRect(bX - 1, xpBarY - 1, bW + 2, bH + 2, 3);

    // ── Barra bateria ─────────────────────────────────────────────────────
    const batPct = p.fuel / p.maxFuel;
    const batBarY = PY + 164;
    const batColor = batPct > 0.5 ? 0x44ffaa : batPct > 0.25 ? 0xffcc22 : 0xff4422;
    this._drawBar(g, bX, batBarY, bW, 8, batPct, batColor);

    // ── Barra oxigênio ────────────────────────────────────────────────────
    const oxyPct   = p.oxygen / p.maxOxygen;
    const oxyBarY  = PY + 214;
    const oxyColor = oxyPct > 0.5 ? 0x22aaff : oxyPct > 0.25 ? 0xff8800 : 0xff2222;
    this._drawBar(g, bX, oxyBarY, bW, 8, oxyPct, oxyColor);

    // ── Barra resistência ─────────────────────────────────────────────────
    const resPct  = Math.min(1, p.suitResistance / 100);
    const resBarY = PY + 262;
    this._drawBar(g, bX, resBarY, bW, 8, resPct, 0xffcc44);

    // Textos dinâmicos
    this._nameText.setText(p.name);
    this._levelText.setText(`Nível ${p.level}`);
    this._xpVal.setText(`${p.xp} / ${p.xpToNext} XP`);
    this._batVal.setText(`${Math.ceil(p.fuel)} / ${p.maxFuel}`);
    this._oxyVal.setText(`${Math.ceil(p.oxygen)} / ${p.maxOxygen}`);
    this._resVal.setText(`${p.suitResistance}`);
  }

  _drawBar(g, x, y, w, h, pct, color) {
    g.fillStyle(0x0a0a1a, 0.85);
    g.fillRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);
    if (pct > 0) {
      g.fillStyle(color, 0.9);
      g.fillRoundedRect(x, y, w * pct, h, 3);
    }
    g.lineStyle(1, color, 0.30);
    g.strokeRoundedRect(x - 1, y - 1, w + 2, h + 2, 3);
  }

  _setVisible(v) {
    this._allNodes.forEach(o => o.setVisible(v));
  }
}
