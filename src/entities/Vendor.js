import { fillTopHalfEllipse } from '../utils/draw.js';

export class Vendor {
  constructor(x, y) {
    this.x             = x;
    this.y             = y;  // Y dos pés
    this.INTERACT_DIST = 90;
  }

  isNearPlayer(player) {
    return (
      Math.abs(player.x - this.x) < this.INTERACT_DIST &&
      Math.abs(player.y - this.y) < 80
    );
  }

  draw(g) {
    const { x, y } = this;
    const w = 22;
    const h = 44;

    // Sombra
    g.fillStyle(0x000000, 0.18);
    g.fillEllipse(x, y, w * 1.6, 7);

    // Robe
    const robeW = w * 0.90;
    const robeH = h * 0.60;
    const robeY = y - robeH;
    g.fillStyle(0x4a2070, 1);
    g.fillRoundedRect(x - robeW / 2, robeY, robeW, robeH, robeW * 0.18);

    // Detalhes do robe
    g.fillStyle(0x6a30a0, 1);
    g.fillRoundedRect(x - robeW * 0.25, robeY + robeH * 0.15, robeW * 0.5, robeH * 0.40, 3);

    // Braços (estáticos)
    g.fillStyle(0x4a2070, 1);
    g.fillRoundedRect(x - robeW / 2 - 5, robeY + 4, 9, robeH * 0.45, 4);
    g.fillRoundedRect(x + robeW / 2 - 4, robeY + 4, 9, robeH * 0.45, 4);

    // Mãos
    g.fillStyle(0xd4a060, 1);
    g.fillCircle(x - robeW / 2 - 1, robeY + robeH * 0.45 + 4, 5);
    g.fillCircle(x + robeW / 2 + 4,  robeY + robeH * 0.45 + 4, 5);

    // Cajado
    const staffX = x + robeW / 2 + 10;
    g.fillStyle(0x6b3a1e, 1);
    g.fillRect(staffX - 2, robeY - h * 0.35, 4, h * 0.95 + robeH * 0.45);
    // Orbe mágico
    g.fillStyle(0x9944ff, 0.9);
    g.fillCircle(staffX, robeY - h * 0.35, 8);
    g.fillStyle(0xcc88ff, 0.55);
    g.fillCircle(staffX - 3, robeY - h * 0.35 - 3, 4);

    // Cabeça
    const headR = w * 0.33;
    const headY = robeY - headR * 0.85;
    g.fillStyle(0xd4a060, 1);
    g.fillCircle(x, headY, headR);

    // Capuz
    g.fillStyle(0x3a1060, 1);
    fillTopHalfEllipse(g, x, headY - headR * 0.1, headR * 1.15, headR * 0.75, 0x3a1060);
    // Ponta do capuz
    g.fillStyle(0x3a1060, 1);
    g.fillTriangle(
      x - headR * 0.9, headY - headR * 0.55,
      x + headR * 0.1, headY - headR * 1.9,
      x + headR * 0.9, headY - headR * 0.55,
    );

    // Olhos brilhantes
    g.fillStyle(0xffd700, 1);
    g.fillCircle(x - headR * 0.28, headY + headR * 0.15, headR * 0.13);
    g.fillCircle(x + headR * 0.28, headY + headR * 0.15, headR * 0.13);
  }
}
