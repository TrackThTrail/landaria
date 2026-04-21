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

        // Cor da terra: castanho (superfície) → quase preto (fundo)
        const rv = Math.round(58  * (1 - depthT) + 18 * depthT);
        const gv = Math.round(26  * (1 - depthT) + 10 * depthT);
        const bv = Math.round(10  * (1 - depthT) +  4 * depthT);
        g.fillStyle((rv << 16) | (gv << 8) | bv, 1);
        g.fillRect(wx, wy, cs - 1, cs - 1);

        // Pedriscos decorativos
        const seed = (row * 31 + col * 17) & 0xffff;
        if (seed % 9 === 0) {
          g.fillStyle(0x5a3015, 0.55);
          g.fillCircle(wx + 10, wy + cs * 0.42, 5);
        }
        if (seed % 13 === 0) {
          g.fillStyle(0x7a4020, 0.45);
          g.fillRect(wx + 20, wy + cs * 0.22, 10, 6);
        }

        // Faixa de grama só na primeira linha
        if (row === 0) {
          g.fillStyle(0x3a8822, 1);
          g.fillRect(wx, wy, cs - 1, 8);
          g.fillStyle(0x66ee44, 0.45);
          g.fillRect(wx, wy, cs - 1, 3);
        }
      }
    }
  }
}
