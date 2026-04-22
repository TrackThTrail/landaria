/**
 * MapView — mapa do quadrante actual + lista de quadrantes.
 *
 * Estrutura de tabs:
 *   'map'    — minimap do quadrante actual, scrollável, mostra jogador
 *   'list'   — grade dos 5 quadrantes (vista anterior)
 *   'detail' — minimap de um quadrante específico (acessado via 'list')
 */

const QX_COUNT   = 5;
const GROUND_Y   = 7400;
const WORLD_H    = 20000;
const CELL_SIZE  = 40;
const QUAD_NAMES = [
  'Base  PX-7α',
  'Planície Leste',
  'Cratera Norte',
  'Zona Profunda',
  'Fronteira Perdida',
];

// Tamanho de cada célula do terreno no minimap (px)
const MAP_CELL    = 18;
const MAP_COLS    = 24;                                            // W / CELL_SIZE
const MAP_ROWS    = Math.ceil((WORLD_H - GROUND_Y) / CELL_SIZE);  // 315
const SKY_H       = 24;   // strip de céu no topo do mapa
const TOTAL_MAP_H = SKY_H + MAP_ROWS * MAP_CELL;                  // 5694 px

export class MapView {
  constructor(scene) {
    this.scene   = scene;
    this.visible = false;

    // Estado de navegação
    this._tab           = 'map';   // 'map' | 'list' | 'detail'
    this._detailQx      = 0;
    this._mapScrollY    = 0;
    this._detailScrollY = 0;

    // Geometria do painel
    const gW  = scene.game.config.width;   // 960
    const gH  = scene.game.config.height;  // 520
    const PW  = 520;
    const PH  = 440;
    const PX  = (gW - PW) / 2;   // 220
    const PY  = (gH - PH) / 2;   // 40
    const HH  = 48;               // altura do header
    const FH  = 24;               // altura do footer
    const PAD = Math.floor((PW - MAP_COLS * MAP_CELL) / 2);  // 44
    const MCX = PX + PAD;                  // 264 — X do conteúdo do mapa
    const MCW = MAP_COLS * MAP_CELL;       // 432
    const MVY = PY + HH;                   // 88  — Y do viewport do mapa
    const MVH = PH - HH - FH;             // 368 — altura visível

    this._PX = PX; this._PY = PY; this._PW = PW; this._PH = PH;
    this._HH = HH; this._FH = FH;
    this._MCX = MCX; this._MCW = MCW;
    this._MVY = MVY; this._MVH = MVH;

    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };
    const D  = 22;

    // ── Gráficos ─────────────────────────────────────────────────────────
    // Profundidade 20: fundo do painel + conteúdo da lista (sem máscara)
    this._g = scene.add.graphics().setDepth(20).setScrollFactor(0);

    // Profundidade 21: terrain minimap, mascarado ao viewport
    this._mapGfx = scene.add.graphics().setDepth(21).setScrollFactor(0);
    {
      const msk = scene.add.graphics().setScrollFactor(0);
      msk.fillRect(MCX, MVY, MCW, MVH);
      this._mapGfx.setMask(msk.createGeometryMask());
    }

    // ── Textos ────────────────────────────────────────────────────────────
    this._title = scene.add.text(PX + PW / 2, PY + 15, '',
                    { ...ts, fontSize: '15px', color: '#88ffcc' })
                    .setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    // Botão de troca de tab (lado esquerdo do header)
    this._tabBtn = scene.add.text(PX + 12, PY + 15, '',
                    { ...ts, fontSize: '12px', color: '#88ccff' })
                    .setOrigin(0, 0).setInteractive({ useHandCursor: true })
                    .setDepth(D).setScrollFactor(0);
    this._tabBtn.on('pointerover', () => this._tabBtn.setColor('#ffffff'));
    this._tabBtn.on('pointerout',  () => this._tabBtn.setColor('#88ccff'));
    this._tabBtn.on('pointerdown', () => this._onTabBtn());

    this._closeBtn = scene.add.text(PX + PW - 10, PY + 11, '✕',
                       { ...ts, fontSize: '16px', color: '#ff6666' })
                       .setOrigin(1, 0).setInteractive({ useHandCursor: true })
                       .setDepth(D).setScrollFactor(0);
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout',  () => this._closeBtn.setColor('#ff6666'));
    this._closeBtn.on('pointerdown', () => this.close());

    this._posLabel = scene.add.text(PX + PW / 2, PY + PH - 6, '',
                       { ...ts, fontSize: '11px', color: '#ffff88' })
                       .setOrigin(0.5, 1).setDepth(D).setScrollFactor(0);

    // ── Lista de quadrantes (tab 'list') ──────────────────────────────────
    const CW = 80, CGAP = 10;
    const gridW = QX_COUNT * CW + (QX_COUNT - 1) * CGAP;
    const gridX = PX + (PW - gridW) / 2;
    const gridY = PY + HH + 55;

    this._cells = Array.from({ length: QX_COUNT }, (_, i) => ({
      x: gridX + i * (CW + CGAP), y: gridY, w: CW, h: CW,
    }));

    this._cellNames = Array.from({ length: QX_COUNT }, () =>
      scene.add.text(0, 0, '', { ...ts, fontSize: '10px', color: '#778899',
        align: 'center', wordWrap: { width: CW - 4 } })
        .setOrigin(0.5, 0).setDepth(D).setScrollFactor(0)
    );

    this._cellCenter = Array.from({ length: QX_COUNT }, () =>
      scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '22px',
        color: '#2a4a30', stroke: '#000', strokeThickness: 2 })
        .setOrigin(0.5, 0.5).setDepth(D).setScrollFactor(0)
    );

    // ── Roda do rato — scroll vertical ───────────────────────────────────
    scene.input.on('wheel', (_p, _o, _dx, dy) => {
      if (!this.visible) return;
      const max = Math.max(0, TOTAL_MAP_H - this._MVH);
      if (this._tab === 'map') {
        this._mapScrollY = Phaser.Math.Clamp(this._mapScrollY + dy * 0.4, 0, max);
      } else if (this._tab === 'detail') {
        this._detailScrollY = Phaser.Math.Clamp(this._detailScrollY + dy * 0.4, 0, max);
      }
    });

    // ── Clique nas células da lista ───────────────────────────────────────
    scene.input.on('pointerdown', (ptr) => {
      if (!this.visible || this._tab !== 'list') return;
      const vtd = this.scene._visitedQuadrants || new Set(['0']);
      for (let i = 0; i < this._cells.length; i++) {
        const c = this._cells[i];
        if (ptr.x >= c.x && ptr.x <= c.x + c.w &&
            ptr.y >= c.y && ptr.y <= c.y + c.h) {
          if (vtd.has(String(i))) {
            this._tab           = 'detail';
            this._detailQx      = i;
            this._detailScrollY = 0;
          }
          break;
        }
      }
    });

    this._setVisible(false);
  }

  // ── API pública ───────────────────────────────────────────────────────────
  open() {
    if (!this.visible) {
      this.visible = true;
      this._tab    = 'map';
      // Centra verticalmente na posição do jogador ao abrir
      const p = this.scene.player;
      if (p && p.y >= GROUND_Y) {
        const pRow = (p.y - GROUND_Y) / CELL_SIZE;
        const max  = Math.max(0, TOTAL_MAP_H - this._MVH);
        this._mapScrollY = Phaser.Math.Clamp(
          SKY_H + pRow * MAP_CELL - this._MVH / 2, 0, max);
      } else {
        this._mapScrollY = 0;
      }
      this._setVisible(true);
      this._draw();
    }
  }

  close()  { if (this.visible) { this.visible = false; this._setVisible(false); } }
  toggle() { this.visible ? this.close() : this.open(); }
  update() { if (this.visible) this._draw(); }

  // ── Navegação entre tabs ─────────────────────────────────────────────────
  _onTabBtn() {
    if      (this._tab === 'map')  this._tab = 'list';
    else if (this._tab === 'list') this._tab = 'map';
    else /* 'detail' */            this._tab = 'list';
  }

  // ── Desenho principal ────────────────────────────────────────────────────
  _draw() {
    const { _PX:PX, _PY:PY, _PW:PW, _PH:PH, _HH:HH, _FH:FH } = this;
    const qx      = this.scene._qx || 0;
    const visited = this.scene._visitedQuadrants || new Set(['0']);

    const g = this._g;
    g.clear();
    g.fillStyle(0x020d06, 0.97);
    g.fillRoundedRect(PX, PY, PW, PH, 10);
    g.lineStyle(2, 0x228844, 1);
    g.strokeRoundedRect(PX, PY, PW, PH, 10);
    g.lineStyle(1, 0x114422, 0.8);
    g.lineBetween(PX + 10, PY + HH,      PX + PW - 10, PY + HH);
    g.lineBetween(PX + 10, PY + PH - FH, PX + PW - 10, PY + PH - FH);

    this._mapGfx.clear();

    const onList = this._tab === 'list';
    this._cellNames.forEach(t  => t.setVisible(onList));
    this._cellCenter.forEach(t => t.setVisible(onList));

    if (this._tab === 'map') {
      this._title.setText(`Mapa — ${QUAD_NAMES[qx]}`).setColor('#88ffcc');
      this._tabBtn.setText('Quadrantes  ›');
      this._posLabel.setText(`Quadrante ${qx + 1} / ${QX_COUNT}`);
      this._drawTerrainMinimap(qx, false);

    } else if (this._tab === 'list') {
      this._title.setText('Quadrantes').setColor('#aaddff');
      this._tabBtn.setText('‹  Mapa');
      this._posLabel.setText(`Actual: ${QUAD_NAMES[qx]}`);
      this._drawListTab(qx, visited);

    } else {  // 'detail'
      const dq = this._detailQx;
      this._title.setText(QUAD_NAMES[dq]).setColor('#88ffcc');
      this._tabBtn.setText('‹  Quadrantes');
      this._posLabel.setText(
        `Quadrante ${dq + 1}${dq === qx ? '  ← actual' : ''}`);
      this._drawTerrainMinimap(dq, true);
    }
  }

  // ── Minimap do terreno ───────────────────────────────────────────────────
  _drawTerrainMinimap(qx, isDetail) {
    const { _MCX:mcX, _MCW:mcW, _MVY:mvY, _MVH:mvH } = this;
    const mg    = this._mapGfx;
    const scene = this.scene;
    const curQx = scene._qx || 0;

    // Scroll state
    const scrKey = isDetail ? '_detailScrollY' : '_mapScrollY';
    const maxScr = Math.max(0, TOTAL_MAP_H - mvH);
    this[scrKey] = Phaser.Math.Clamp(this[scrKey], 0, maxScr);
    const scrollY = this[scrKey];

    // Terreno do quadrante solicitado
    const terrain = (qx === curQx)
      ? (scene._terrain || null)
      : ((scene._terrainCache && scene._terrainCache.get(qx)) || null);

    // ── Strip de céu ──────────────────────────────────────────────────────
    const skyBot = mvY + SKY_H - scrollY;
    const sdTop  = Math.max(skyBot - SKY_H, mvY);
    const sdBot  = Math.min(skyBot, mvY + mvH);
    if (sdBot > sdTop) {
      mg.fillStyle(0x060818, 1);
      mg.fillRect(mcX, sdTop, mcW, sdBot - sdTop);
    }

    // Linha de superfície
    if (skyBot >= mvY && skyBot <= mvY + mvH) {
      mg.lineStyle(1, 0x44cc44, 0.8);
      mg.lineBetween(mcX, skyBot, mcX + mcW, skyBot);
    }

    // ── Células do terreno ────────────────────────────────────────────────
    if (!terrain) {
      const fillTop = Math.max(mvY, skyBot);
      if (fillTop < mvY + mvH) {
        mg.fillStyle(0x060e08, 1);
        mg.fillRect(mcX, fillTop, mcW, mvY + mvH - fillTop);
      }
    } else {
      const rowFrom = Math.max(0, Math.floor((scrollY - SKY_H) / MAP_CELL));
      const rowTo   = Math.min(MAP_ROWS - 1, rowFrom + Math.ceil(mvH / MAP_CELL) + 2);

      for (let row = rowFrom; row <= rowTo; row++) {
        const cy = mvY + SKY_H + row * MAP_CELL - scrollY;
        if (cy + MAP_CELL < mvY || cy > mvY + mvH) continue;

        for (let col = 0; col < MAP_COLS; col++) {
          const cx = mcX + col * MAP_CELL;

          // Não revelado — nevoeiro de guerra
          if (!terrain.explored[row * terrain.cols + col]) {
            mg.fillStyle(0x080e0a, 1);
            mg.fillRect(cx, cy, MAP_CELL - 1, MAP_CELL - 1);
            continue;
          }

          const v  = terrain.cells[row][col];

          // Espaço vazio (escavado): cinza sem bordas, como plano de fundo
          if (v === 0) {
            mg.fillStyle(0x4a4a4a, 1);
            mg.fillRect(cx, cy, MAP_CELL, MAP_CELL);
            continue;
          }

          let color;
          switch (v) {
            case 2: color = 0xbb6622; break;  // cobre
            case 3: color = 0xaa44dd; break;  // rkanium
            case 4: color = 0x888888; break;  // ferro
            default: color = 0x353535;        // regolito
          }
          mg.fillStyle(color, 1);
          mg.fillRect(cx, cy, MAP_CELL - 1, MAP_CELL - 1);
        }
      }
    }

    // ── Marcador do jogador ───────────────────────────────────────────────
    if (qx === curQx && scene.player) {
      const pl  = scene.player;
      const pmx = mcX + (pl.x / CELL_SIZE) * MAP_CELL;
      const pmy = (pl.y >= GROUND_Y)
        ? mvY + SKY_H + ((pl.y - GROUND_Y) / CELL_SIZE) * MAP_CELL - scrollY
        : mvY + (pl.y / GROUND_Y) * SKY_H - scrollY;
      mg.fillStyle(0x44ff88, 1);
      mg.fillCircle(pmx, pmy, 4);
      mg.lineStyle(1.5, 0xffffff, 0.85);
      mg.strokeCircle(pmx, pmy, 6);
    }

    // ── Barra de scroll ───────────────────────────────────────────────────
    if (maxScr > 0) {
      const bx     = mcX + mcW + 8;
      const trackH = mvH - 12;
      const thumb  = Math.max(20, trackH * mvH / TOTAL_MAP_H);
      const thumbY = mvY + 6 + (trackH - thumb) * (scrollY / maxScr);
      mg.fillStyle(0x224422, 0.45);
      mg.fillRoundedRect(bx, mvY + 6, 4, trackH, 2);
      mg.fillStyle(0x66cc66, 0.9);
      mg.fillRoundedRect(bx, thumbY, 4, thumb, 2);
    }
  }

  // ── Lista de quadrantes ──────────────────────────────────────────────────
  _drawListTab(currentQx, visited) {
    const g = this._g;

    // Conectores
    for (let i = 0; i < this._cells.length - 1; i++) {
      const c1  = this._cells[i];
      const c2  = this._cells[i + 1];
      const midY = c1.y + c1.h / 2;
      const vis = visited.has(String(i)) || visited.has(String(i + 1));
      g.lineStyle(1, 0x336644, vis ? 0.6 : 0.15);
      g.lineBetween(c1.x + c1.w, midY, c2.x, midY);
      const ax = c2.x - 1;
      g.fillStyle(0x336644, vis ? 0.6 : 0.15);
      g.fillTriangle(ax - 5, midY - 3, ax - 5, midY + 3, ax, midY);
    }

    // Células
    for (let i = 0; i < this._cells.length; i++) {
      const c         = this._cells[i];
      const isVisited = visited.has(String(i));
      const isCurrent = i === currentQx;
      const midX      = c.x + c.w / 2;
      const midY      = c.y + c.h / 2;

      if (isVisited) {
        g.fillStyle(0x0d2b1a, 1);
        g.fillRoundedRect(c.x, c.y, c.w, c.h, 6);

        for (let dr = 0; dr < 5; dr++) {
          for (let dc = 0; dc < 7; dc++) {
            const s = (i * 97 + dr * 31 + dc * 17) & 0xfff;
            const dx = c.x + 6 + dc * (c.w - 12) / 6;
            const dy = c.y + 8 + dr * (c.h - 16) / 4;
            if      (s % 35 === 5) { g.fillStyle(0xaa44dd, 0.9); g.fillRect(dx, dy, 2, 2); }
            else if (s % 20 === 2) { g.fillStyle(0x888888, 0.8); g.fillRect(dx, dy, 2, 2); }
            else if (s % 12 === 0) { g.fillStyle(0xbb6622, 0.9); g.fillRect(dx, dy, 2, 2); }
            else                   { g.fillStyle(0x344433, 0.5); g.fillRect(dx, dy, 1, 1); }
          }
        }

        if (i === 0) {
          g.fillStyle(0xffee44, 0.9);
          g.fillCircle(c.x + 12, c.y + 12, 4);
          g.lineStyle(1, 0xffcc00, 0.7);
          g.strokeCircle(c.x + 12, c.y + 12, 7);
        }

        if (isCurrent) {
          g.fillStyle(0x44ff88, 1);
          const ax = midX, ay = c.y + c.h - 6;
          g.fillTriangle(ax - 5, ay - 7, ax + 5, ay - 7, ax, ay - 1);
        } else {
          // Indica que é clicável
          g.lineStyle(1, 0x225533, 0.45);
          g.strokeRoundedRect(c.x + 2, c.y + 2, c.w - 4, c.h - 4, 4);
        }

        g.lineStyle(isCurrent ? 2 : 1, isCurrent ? 0x44ff88 : 0x336644, isCurrent ? 1 : 0.7);
        g.strokeRoundedRect(c.x, c.y, c.w, c.h, 6);

        this._cellCenter[i].setText('').setPosition(midX, midY);
        this._cellNames[i]
          .setText(QUAD_NAMES[i])
          .setColor(isCurrent ? '#aaffcc' : '#99bbaa')
          .setPosition(midX, c.y + c.h + 4);

      } else {
        g.fillStyle(0x060d08, 1);
        g.fillRoundedRect(c.x, c.y, c.w, c.h, 6);
        g.lineStyle(1, 0x192b1f, 1);
        g.strokeRoundedRect(c.x, c.y, c.w, c.h, 6);
        this._cellCenter[i].setText('?').setColor('#2a4a30').setPosition(midX, midY);
        this._cellNames[i].setText('').setPosition(midX, c.y + c.h + 4);
      }
    }
  }

  _setVisible(v) {
    [this._g, this._mapGfx, this._title, this._tabBtn,
     this._closeBtn, this._posLabel].forEach(o => o.setVisible(v));
    const showCells = v && this._tab === 'list';
    this._cellNames.forEach(t  => t.setVisible(showCells));
    this._cellCenter.forEach(t => t.setVisible(showCells));
  }
}
