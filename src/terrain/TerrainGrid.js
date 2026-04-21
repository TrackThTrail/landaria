/**
 * Grade de blocos escaváveis.
 * Cada célula é 1 (sólida) ou 0 (vazia/escavada).
 */
export class TerrainGrid {
  /**
   * @param {number} groundY   - Y do mundo onde o subsolo começa
   * @param {number} worldH    - altura total do mundo
   * @param {number} worldW    - largura do mundo
   * @param {number} cellSize  - tamanho de cada célula em px
   */
  constructor(groundY, worldH, worldW, cellSize) {
    this.groundY  = groundY;
    this.cellSize = cellSize;
    this.cols     = Math.ceil(worldW  / cellSize);
    this.rows     = Math.ceil((worldH - groundY) / cellSize);
    // 0 = escavado, 1 = regolito, 2 = minério de cobre, 3 = rkanium
    this.cells = Array.from({ length: this.rows }, () => new Uint8Array(this.cols).fill(1));

    // Semeia veios de cobre a partir da 3ª fileira (razão 1/20)
    for (let row = 3; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const seed = (row * 31 + col * 17) & 0xffff;
        if (seed % 20 === 0) this.cells[row][col] = 2;
      }
    }

    // Semeia rkanium a partir da 8ª fileira (razão 1/35, mais raro)
    for (let row = 8; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const seed = (row * 53 + col * 29) & 0xffff;
        if (seed % 35 === 0) this.cells[row][col] = 3;
      }
    }
  }

  isSolid(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.cells[row][col] !== 0;
  }

  /** Escava a célula. Retorna o tipo do bloco removido (0 se já vazio). */
  dig(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return 0;
    const type = this.cells[row][col];
    if (type === 0) return 0;
    this.cells[row][col] = 0;
    return type;
  }

  /**
   * Verifica colisão vertical (queda).
   * Retorna o Y de encaixe se o ponto estiver dentro de um bloco sólido,
   * ou null se não houver colisão.
   */
  resolveY(wx, wy, vy) {
    if (vy < 0 || wy < this.groundY) return null;
    const col = Math.floor(wx / this.cellSize);
    const row = Math.floor((wy - this.groundY) / this.cellSize);
    if (this.isSolid(col, row)) {
      return this.groundY + row * this.cellSize;
    }
    return null;
  }

  /** Índices da célula sob os pés do personagem — para uso durante escavação. */
  cellUnder(wx, wy) {
    return {
      col: Math.floor(wx / this.cellSize),
      row: Math.floor((wy - this.groundY) / this.cellSize),
    };
  }

  /**
   * Desenha apenas as células visíveis na viewport.
   * @param {Phaser.GameObjects.Graphics} g
   * @param {number} camScrollY
   * @param {number} viewH
   */
  draw(g, camScrollY, viewH) {
    g.clear();
    const cs = this.cellSize;

    const startRow = Math.max(0, Math.floor((camScrollY - this.groundY) / cs) - 1);
    const endRow   = Math.min(this.rows - 1, Math.ceil((camScrollY + viewH - this.groundY) / cs) + 1);

    for (let row = startRow; row <= endRow; row++) {
      const wy     = this.groundY + row * cs;
      const depthT = row / Math.max(1, this.rows);

      for (let col = 0; col < this.cols; col++) {
        if (!this.isSolid(col, row)) continue;

        const wx = col * cs;
        const cellType = this.cells[row][col];

        if (cellType === 3) {
          // ── Rkanium: cristais violeta/roxo profundo ─────────────────────────
          const seed = (row * 53 + col * 29) & 0xffff;
          g.fillStyle(0x1a0828, 1);
          g.fillRect(wx, wy, cs - 1, cs - 1);
          // cristais brilhantes
          g.fillStyle(0x9933cc, 0.90);
          g.fillTriangle(wx + 8 + (seed % 8),  wy + cs - 6,  wx + 13 + (seed % 8), wy + 6,  wx + 18 + (seed % 8), wy + cs - 6);
          g.fillTriangle(wx + 20 + (seed % 6), wy + cs - 6,  wx + 26 + (seed % 6), wy + 4,  wx + 32 + (seed % 6), wy + cs - 6);
          g.fillStyle(0xcc66ff, 0.70);
          g.fillTriangle(wx + 12 + (seed % 10), wy + cs - 8, wx + 16 + (seed % 10), wy + 8, wx + 20 + (seed % 10), wy + cs - 8);
          // brilho interno
          g.fillStyle(0xeeccff, 0.35);
          g.fillCircle(wx + 18 + (seed % 8), wy + 14 + (seed % 6), 3);
        } else if (cellType === 2) {
          // ── Minério de cobre ──────────────────────────────────────────────
          const rv = Math.round(120 * (1 - depthT) + 60 * depthT);
          const gv = Math.round(60  * (1 - depthT) + 30 * depthT);
          const bv = Math.round(20  * (1 - depthT) + 10 * depthT);
          g.fillStyle((rv << 16) | (gv << 8) | bv, 1);
          g.fillRect(wx, wy, cs - 1, cs - 1);
          // veios de cobre brilhantes
          const seed = (row * 31 + col * 17) & 0xffff;
          g.fillStyle(0xb87333, 0.85);
          g.fillRect(wx + 4 + (seed % 10), wy + 6 + (seed % 8),  18, 3);
          g.fillRect(wx + 8 + (seed % 6),  wy + 16 + (seed % 6), 12, 4);
          g.fillStyle(0xe8a060, 0.60);
          g.fillRect(wx + 6 + (seed % 8),  wy + 10 + (seed % 5),  8, 2);
          g.fillCircle(wx + 14 + (seed % 10), wy + 22 + (seed % 8), 3);
        } else {
          // ── Regolito lunar: cinza claro (superfície) → cinza escuro/preto (fundo) ──
          const rv = Math.round(168 * (1 - depthT) + 30 * depthT);
          const gv = Math.round(164 * (1 - depthT) + 28 * depthT);
          const bv = Math.round(160 * (1 - depthT) + 26 * depthT);
          g.fillStyle((rv << 16) | (gv << 8) | bv, 1);
          g.fillRect(wx, wy, cs - 1, cs - 1);
        }

        // Pedriscos lunares (tons de cinza variados) — apenas regolito, não em cobre/rkanium
        const seed = (row * 31 + col * 17) & 0xffff;
        if (cellType === 2 || cellType === 3) continue;
        if (seed % 7 === 0) {
          g.fillStyle(0x9a9890, 0.60);
          g.fillCircle(wx + 8 + (seed % 18), wy + cs * 0.40 + (seed % 8), 3 + (seed % 3));
        }
        if (seed % 11 === 0) {
          g.fillStyle(0xb8b6b0, 0.45);
          g.fillRect(wx + 14 + (seed % 16), wy + cs * 0.25 + (seed % 10), 7, 4);
        }
        if (seed % 17 === 0) {
          // cratera pequena
          g.fillStyle(0x707070, 0.30);
          g.fillCircle(wx + 22 + (seed % 12), wy + cs * 0.50 + (seed % 10), 4);
          g.fillStyle(0xd0cec8, 0.20);
          g.fillCircle(wx + 21 + (seed % 12), wy + cs * 0.49 + (seed % 10), 2.5);
        }

        // Superfície lunar: linha cinza-clara no topo (apenas regolito)
        if (row === 0 && cellType !== 2) {
          g.fillStyle(0xd8d6d0, 1);
          g.fillRect(wx, wy, cs - 1, 5);
          g.fillStyle(0xf0eee8, 0.50);
          g.fillRect(wx, wy, cs - 1, 2);
        }
      }
    }
  }
}
