const MISSION_ENTRIES = [
  {
    date: 'Dia 0 — Entrada na órbita',
    text:
      'A nave "OXAGAM" completou a travessia de 14 meses sem incidentes ' +
      'até cruzar o campo gravitacional de PX-7, um planeta de superfície ' +
      'lunar até então sem catalogação. Uma tempestade de partículas de alta ' +
      'energia atingiu o casco durante a aproximação orbital.',
  },
  {
    date: 'Dia 0 — Impacto',
    text:
      'Os sistemas de propulsão falharam em cascata. A cápsula de emergência ' +
      'foi ejectada automaticamente com 8 tripulantes a bordo. O módulo ' +
      'principal desintegrou-se na estratosfera. Não há confirmação de outros ' +
      'sobreviventes. As balizas de socorro foram activadas mas a resposta ' +
      'pode demorar semanas — ou nunca chegar.',
  },
  {
    date: 'Dia 0 — Situação atual',
    text:
      'Você acordou sozinho junto aos destroços da cápsula numa planície ' +
      'de regolito cinzento. O ar exterior é irrespirável. As reservas de ' +
      'oxigénio da fato-escafandro são limitadas. Sob a superfície existem ' +
      'sinais de minerais desconhecidos. Sobreviva, escave e encontre um ' +
      'caminho de regresso.',
  },
];

export class MissionLog {
  constructor(scene) {
    this.scene   = scene;
    this.visible = false;

    const W  = scene.game.config.width;
    const H  = scene.game.config.height;
    const PW = 560, PH = 360;
    const PX = (W - PW) / 2;
    const PY = (H - PH) / 2;
    this._bounds = { x: PX, y: PY, w: PW, h: PH };

    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };
    const D  = 22;

    this._g     = scene.add.graphics().setDepth(20).setScrollFactor(0);
    this._title = scene.add.text(PX + PW / 2, PY + 14, 'Relatório da Missão  [J]',
                    { ...ts, fontSize: '16px', color: '#ffcc88' })
                    .setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    // Entradas do log
    this._entryNodes = MISSION_ENTRIES.map((e, i) => {
      const baseY = PY + 52 + i * 90;
      const dateT = scene.add.text(PX + 20, baseY,      e.date,
                      { ...ts, fontSize: '12px', color: '#ffcc44' })
                      .setDepth(D).setScrollFactor(0);
      const bodyT = scene.add.text(PX + 20, baseY + 16, e.text,
                      { ...ts, fontSize: '11px', color: '#cccccc', wordWrap: { width: PW - 40 } })
                      .setDepth(D).setScrollFactor(0);
      return [dateT, bodyT];
    });

    this._closeBtn = scene.add.text(PX + PW - 10, PY + 10, '✕',
                       { ...ts, fontSize: '16px', color: '#ff6666' })
                       .setOrigin(1, 0).setInteractive({ useHandCursor: true })
                       .setDepth(D).setScrollFactor(0);
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout',  () => this._closeBtn.setColor('#ff6666'));
    this._closeBtn.on('pointerdown', () => this.close());

    this._setVisible(false);
  }

  open()   { if (!this.visible) { this.visible = true;  this._setVisible(true);  this._draw(); } }
  close()  { if (this.visible)  { this.visible = false; this._setVisible(false); } }
  toggle() { this.visible ? this.close() : this.open(); }

  update() {}   // estático — nada a actualizar por frame

  _draw() {
    const { x, y, w, h } = this._bounds;
    this._g.clear();
    this._g.fillStyle(0x0a0804, 0.96);
    this._g.fillRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(2, 0x996633, 1);
    this._g.strokeRoundedRect(x, y, w, h, 10);
    this._g.lineStyle(1, 0x553311, 0.8);
    this._g.lineBetween(x + 10, y + 44, x + w - 10, y + 44);
  }

  _setVisible(v) {
    [this._g, this._title, this._closeBtn, ...this._entryNodes.flat()]
      .forEach(o => o.setVisible(v));
  }
}
