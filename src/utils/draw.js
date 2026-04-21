/**
 * Rotaciona o ponto (dx, dy) em torno da origem pelo ângulo a (radianos).
 * @param {number} dx
 * @param {number} dy
 * @param {number} a
 * @returns {{ x: number, y: number }}
 */
export function rot(dx, dy, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/**
 * Desenha um retângulo rotacionado; o pivô é o topo-centro do rect.
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} pivX
 * @param {number} pivY
 * @param {number} rw
 * @param {number} rh
 * @param {number} angle
 * @param {number} colorHex
 * @param {number} [alpha=1]
 */
export function fillRotatedRect(g, pivX, pivY, rw, rh, angle, colorHex, alpha = 1) {
  const corners = [
    rot(-rw / 2, 0,  angle),
    rot( rw / 2, 0,  angle),
    rot( rw / 2, rh, angle),
    rot(-rw / 2, rh, angle),
  ].map(p => ({ x: pivX + p.x, y: pivY + p.y }));

  g.fillStyle(colorHex, alpha);
  g.fillPoints(corners, true);
}

/**
 * Preenche a metade superior de uma elipse (para o capacete).
 * @param {Phaser.GameObjects.Graphics} g
 * @param {number} cx
 * @param {number} cy
 * @param {number} rx
 * @param {number} ry
 * @param {number} colorHex
 */
export function fillTopHalfEllipse(g, cx, cy, rx, ry, colorHex) {
  const pts = [{ x: cx - rx, y: cy }];
  for (let i = 0; i <= 32; i++) {
    const a = Math.PI + Math.PI * (i / 32); // π → 2π (arco superior)
    pts.push({ x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry });
  }
  pts.push({ x: cx + rx, y: cy });
  g.fillStyle(colorHex, 1);
  g.fillPoints(pts, true);
}
