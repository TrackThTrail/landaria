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
    // 1 = sólido, 0 = escavado
    this.cells = Array.from({ length: this.rows }, () => new Uint8Array(this.cols).fill(1));
  }

  isSolid(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    return this.cells[row][col] === 1;
  }

  /** Escava a célula. Retorna true se algo foi removido. */
  dig(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    if (this.cells[row][col] === 0) return false;
    this.cells[row][col] = 0;
    return true;
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

        // Cor do regolito lunar: cinza claro (superfície) → cinza escuro/preto (fundo)
        const rv = Math.round(168 * (1 - depthT) + 30 * depthT);
        const gv = Math.round(164 * (1 - depthT) + 28 * depthT);
        const bv = Math.round(160 * (1 - depthT) + 26 * depthT);
        g.fillStyle((rv << 16) | (gv << 8) | bv, 1);
        g.fillRect(wx, wy, cs - 1, cs - 1);

        // Pedriscos lunares (tons de cinza variados)
        const seed = (row * 31 + col * 17) & 0xffff;
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

        // Superfície lunar: linha cinza-clara no topo
        if (row === 0) {
          g.fillStyle(0xd8d6d0, 1);
          g.fillRect(wx, wy, cs - 1, 5);
          g.fillStyle(0xf0eee8, 0.50);
          g.fillRect(wx, wy, cs - 1, 2);
        }
      }
    }
  }
}
