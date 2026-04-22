const SLOT_SIZE = 80;
const SLOT_GAP  = 8;
const COLS      = 4;
const ROWS      = 3;

const DEFS = {
  copper:   { icon: '🟠', label: 'Cobre',        color: '#e8a060' },
  iron:     { icon: '🔩', label: 'Ferro',        color: '#aaaaaa' },
  rkanium:  { icon: '🔮', label: 'Rkanium',      color: '#cc66ff' },
  stones:   { icon: '💡', label: 'Pedra [E]',    color: '#ffe066' },
  medkits:  { icon: '🩺', label: 'Med-kit [Q]',  color: '#ff6666' },
  hasRadar:   { icon: '📡', label: 'Radar [R]',    color: '#88ddff', equip: true },
  lanterns:   { icon: '🔦', label: 'Lanterna [T]', color: '#ffdd88', equip: true },
  hasJetpack: { icon: '🚀', label: 'Jetpack [Espaço]', color: '#ffbb44', equip: true },
};

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

    // Grid top-left (centered horizontally inside panel)
    this._gx = PX + Math.round((PW - (COLS * (SLOT_SIZE + SLOT_GAP) - SLOT_GAP)) / 2);
    this._gy = PY + 52;

    // Slot order — item key per slot position, null = empty
    this._slotOrder = [
      'copper', 'iron', 'rkanium', 'stones',
      'medkits', 'hasRadar', 'lanterns', 'hasJetpack',
      null, null, null, null,
    ];

    // Drag state
    this._dragSlot  = -1;
    this._mouseDown = false;
    this._dragging  = false;
    this._dragX     = 0;
    this._dragY     = 0;

    const D  = 22;
    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };

    this._g        = scene.add.graphics().setDepth(20).setScrollFactor(0);
    this._ghostGfx = scene.add.graphics().setDepth(D + 2).setScrollFactor(0);

    this._title = scene.add.text(PX + PW / 2, PY + 14, 'Inventário  [I]',
                    { ...ts, fontSize: '16px', color: '#aaddff' })
                    .setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    // One text object per slot (icon + label + qty, centered)
    this._slotTexts = Array.from({ length: COLS * ROWS }, () =>
      scene.add.text(0, 0, '', { ...ts, fontSize: '11px', color: '#fff', align: 'center' })
        .setOrigin(0.5, 0.5).setDepth(D + 1).setScrollFactor(0)
    );

    this._ghostText = scene.add.text(0, 0, '',
      { ...ts, fontSize: '11px', color: '#fff', align: 'center' })
      .setOrigin(0.5, 0.5).setDepth(D + 3).setScrollFactor(0);

    this._closeBtn = scene.add.text(PX + PW - 10, PY + 10, '✕',
                       { ...ts, fontSize: '16px', color: '#ff6666' })
                       .setOrigin(1, 0).setInteractive({ useHandCursor: true })
                       .setDepth(D).setScrollFactor(0);
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout',  () => this._closeBtn.setColor('#ff6666'));
    this._closeBtn.on('pointerdown', () => this.close());

    scene.input.on('pointerdown', (p) => this._onDown(p));
    scene.input.on('pointermove', (p) => this._onMove(p));
    scene.input.on('pointerup',   (p) => this._onUp(p));

    this._setVisible(false);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  _rect(i) {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      x: this._gx + col * (SLOT_SIZE + SLOT_GAP),
      y: this._gy + row * (SLOT_SIZE + SLOT_GAP),
      w: SLOT_SIZE, h: SLOT_SIZE,
    };
  }

  _hitSlot(px, py) {
    if (!this.visible) return -1;
    for (let i = 0; i < COLS * ROWS; i++) {
      const { x, y, w, h } = this._rect(i);
      if (px >= x && px <= x + w && py >= y && py <= y + h) return i;
    }
    return -1;
  }

  _getQty(key) {
    const p = this._player;
    if (!p) return 0;
    if (key === 'hasRadar') return p.hasRadar ? 1 : 0;
    return p[key] ?? 0;
  }

  // ── Drag handlers ────────────────────────────────────────────────────────

  _onDown(pointer) {
    if (!this.visible) return;
    const s = this._hitSlot(pointer.x, pointer.y);
    if (s >= 0 && this._slotOrder[s] !== null) {
      const _dk = this._slotOrder[s];
      if (DEFS[_dk]?.equip && this._getQty(_dk) === 0) return; // não possui
      this._dragSlot  = s;
      this._mouseDown = true;
      this._dragX     = pointer.x;
      this._dragY     = pointer.y;
    }
  }

  _onMove(pointer) {
    if (!this.visible || !this._mouseDown || this._dragSlot < 0) return;
    const dx = pointer.x - this._dragX;
    const dy = pointer.y - this._dragY;
    if (!this._dragging && dx * dx + dy * dy > 36) this._dragging = true;
    if (this._dragging) {
      this._dragX = pointer.x;
      this._dragY = pointer.y;
      this._drawGhost(pointer.x, pointer.y);
    }
  }

  _onUp(pointer) {
    if (!this.visible) return;
    if (this._dragging && this._dragSlot >= 0) {
      const t = this._hitSlot(pointer.x, pointer.y);
      if (t >= 0 && t !== this._dragSlot) {
        [this._slotOrder[t], this._slotOrder[this._dragSlot]] =
          [this._slotOrder[this._dragSlot], this._slotOrder[t]];
      }
    }
    this._cancelDrag();
  }

  _cancelDrag() {
    this._dragSlot  = -1;
    this._mouseDown = false;
    this._dragging  = false;
    this._ghostGfx.clear();
    this._ghostText.setText('');
  }

  _drawGhost(px, py) {
    const key = this._slotOrder[this._dragSlot];
    if (!key) return;
    const def = DEFS[key];
    const S   = SLOT_SIZE;
    this._ghostGfx.clear();
    this._ghostGfx.fillStyle(0x1a2a3a, 0.88);
    this._ghostGfx.fillRoundedRect(px - S / 2, py - S / 2, S, S, 7);
    this._ghostGfx.lineStyle(2, 0x88aaff, 0.9);
    this._ghostGfx.strokeRoundedRect(px - S / 2, py - S / 2, S, S, 7);
    const qty     = this._getQty(key);
    const isEquip = def.equip ?? false;
    const qtyLine = isEquip ? '' : `\n×${qty}`;
    this._ghostText.setPosition(px, py)
      .setText(`${def.icon}\n${def.label}${qtyLine}`)
      .setColor(def.color);
  }

  // ── Public API ───────────────────────────────────────────────────────────

  setPlayer(player) { this._player = player; }

  open()   { if (!this.visible) { this.visible = true;  this._setVisible(true);  } }
  close()  { if (this.visible)  { this.visible = false; this._setVisible(false); this._cancelDrag(); } }
  toggle() { this.visible ? this.close() : this.open(); }

  update() {
    if (!this.visible || !this._player) return;

    const { x, y, w, h } = this._bounds;
    this._g.clear();
    this._g.fillStyle(0x080d1a, 0.95);
    this._g.fillRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(2, 0x3366aa, 1);
    this._g.strokeRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(1, 0x224466, 0.8);
    this._g.lineBetween(x + 10, y + 44, x + w - 10, y + 44);

    for (let i = 0; i < COLS * ROWS; i++) {
      const { x: sx, y: sy } = this._rect(i);
      const key       = this._slotOrder[i];
      const isDragSrc = this._dragging && i === this._dragSlot;

      // slot metadata
      const def     = key ? DEFS[key] : null;
      const qty     = key ? this._getQty(key) : 0;
      const isEquip = def?.equip ?? false;
      const owned   = qty > 0;
      // equipment not yet owned → render as empty slot
      const showContent = key && !isDragSrc && (!isEquip || owned);

      // Slot BG
      const borderCol   = isDragSrc ? 0x334466 : (isEquip && owned ? 0xddaa44 : 0x2244aa);
      const borderAlpha = isDragSrc ? 0.5      : (isEquip && owned ? 1.0      : 0.7);
      const fillCol     = isDragSrc ? 0x111122 : (isEquip && owned ? 0x1a1200 : 0x0a1020);
      const fillAlpha   = isDragSrc ? 0.35     : 0.85;
      this._g.fillStyle(fillCol, fillAlpha);
      this._g.fillRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 7);
      this._g.lineStyle(isEquip && owned ? 2 : 1, borderCol, borderAlpha);
      this._g.strokeRoundedRect(sx, sy, SLOT_SIZE, SLOT_SIZE, 7);

      // Slot content text
      const t = this._slotTexts[i];
      if (showContent) {
        const label = isEquip
          ? `${def.icon}\n${def.label}`
          : `${def.icon}\n${def.label}\n×${qty}`;
        t.setPosition(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2)
         .setText(label)
         .setColor(def.color)
         .setVisible(true);
      } else {
        t.setVisible(false);
      }
    }
  }

  _setVisible(v) {
    this._g.setVisible(v);
    this._ghostGfx.setVisible(v);
    this._ghostText.setVisible(v);
    this._title.setVisible(v);
    this._closeBtn.setVisible(v);
    this._slotTexts.forEach(t => t.setVisible(v));
    if (!v) {
      this._ghostGfx.clear();
      this._ghostText.setText('');
    }
  }
}
