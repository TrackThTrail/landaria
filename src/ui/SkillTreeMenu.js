export class SkillTreeMenu {
  constructor(scene) {
    this.scene   = scene;
    this.visible = false;
    this._player = null;

    const W = scene.game.config.width;
    const H = scene.game.config.height;
    this._bounds = { x: 0, y: 0, w: W, h: H };

    const D = 40;
    const ts = { fontFamily: 'monospace', stroke: '#000000', strokeThickness: 2 };

    this._g = scene.add.graphics().setDepth(D - 2).setScrollFactor(0);

    this._title = scene.add.text(W / 2, 18, 'Habilidades  [Y]', {
      ...ts, fontSize: '20px', color: '#cce6ff',
    }).setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    this._pointsText = scene.add.text(W / 2, 50, '', {
      ...ts, fontSize: '13px', color: '#ffee88',
    }).setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    this._colExpl = scene.add.text(W * 0.17, 98, 'Exploracao', {
      ...ts, fontSize: '18px', color: '#88ccff',
    }).setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    this._colSurv = scene.add.text(W * 0.50, 98, 'Sobrevivencia', {
      ...ts, fontSize: '18px', color: '#99ffbb',
    }).setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    this._colCombat = scene.add.text(W * 0.83, 98, 'Combate', {
      ...ts, fontSize: '18px', color: '#ffb2b2',
    }).setOrigin(0.5, 0).setDepth(D).setScrollFactor(0);

    // Exploração: skills disponíveis
    this._explSkills = [
      {
        key: 'suitResistance',
        label: 'Resistencia do traje',
        desc: '+5 resistencia por nivel',
        color: '#ffd166',
        y: 170,
      },
      {
        key: 'oxygenTank',
        label: 'Tanque de O2',
        desc: '+20 O2 maximo por nivel',
        color: '#66d9ff',
        y: 255,
      },
      {
        key: 'battery',
        label: 'Bateria',
        desc: '+50 combustivel maximo por nivel',
        color: '#8affc1',
        y: 340,
      },
    ];

    this._skillNodes = this._explSkills.map((s) => {
      const title = scene.add.text(42, s.y, s.label, {
        ...ts, fontSize: '15px', color: s.color,
      }).setDepth(D).setScrollFactor(0);

      const rank = scene.add.text(42, s.y + 22, '', {
        ...ts, fontSize: '12px', color: '#d8e0ea',
      }).setDepth(D).setScrollFactor(0);

      const desc = scene.add.text(42, s.y + 42, s.desc, {
        ...ts, fontSize: '11px', color: '#8ea1b5',
      }).setDepth(D).setScrollFactor(0);

      const btn = scene.add.text(280, s.y + 12, '+', {
        ...ts, fontSize: '18px', color: '#0f1a2a',
      })
        .setOrigin(0.5)
        .setDepth(D)
        .setScrollFactor(0)
        .setInteractive({ useHandCursor: true });

      btn.on('pointerdown', () => this._upgradeSkill(s.key));

      return { key: s.key, title, rank, desc, btn };
    });

    this._comingSoon1 = scene.add.text(W * 0.50, H * 0.52, 'Em breve', {
      ...ts, fontSize: '14px', color: '#6e7f8f',
    }).setOrigin(0.5).setDepth(D).setScrollFactor(0);

    this._comingSoon2 = scene.add.text(W * 0.83, H * 0.52, 'Em breve', {
      ...ts, fontSize: '14px', color: '#6e7f8f',
    }).setOrigin(0.5).setDepth(D).setScrollFactor(0);

    this._closeBtn = scene.add.text(W - 14, 12, 'X', {
      ...ts, fontSize: '20px', color: '#ff6666',
    })
      .setOrigin(1, 0)
      .setDepth(D)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true });
    this._closeBtn.on('pointerover', () => this._closeBtn.setColor('#ffffff'));
    this._closeBtn.on('pointerout', () => this._closeBtn.setColor('#ff6666'));
    this._closeBtn.on('pointerdown', () => this.close());

    this._allNodes = [
      this._g,
      this._title,
      this._pointsText,
      this._colExpl,
      this._colSurv,
      this._colCombat,
      this._comingSoon1,
      this._comingSoon2,
      this._closeBtn,
      ...this._skillNodes.flatMap(n => [n.title, n.rank, n.desc, n.btn]),
    ];

    this._setVisible(false);
  }

  setPlayer(player) { this._player = player; }

  open() {
    if (!this.visible) {
      this.visible = true;
      this._setVisible(true);
    }
  }

  close() {
    if (this.visible) {
      this.visible = false;
      this._setVisible(false);
    }
  }

  toggle() { this.visible ? this.close() : this.open(); }

  update() {
    if (!this.visible || !this._player) return;

    const p = this._player;
    const { w: W, h: H } = this._bounds;
    const g = this._g;

    g.clear();

    // Overlay escuro de tela inteira
    g.fillStyle(0x03070f, 0.96);
    g.fillRect(0, 0, W, H);

    // Colunas
    const padX = 16;
    const topY = 88;
    const botY = H - 20;

    g.lineStyle(2, 0x20364f, 1);
    g.strokeRect(padX, topY, W - padX * 2, botY - topY);

    g.lineStyle(1, 0x1a2b3d, 1);
    g.lineBetween(W / 3, topY, W / 3, botY);
    g.lineBetween((W / 3) * 2, topY, (W / 3) * 2, botY);

    // Cartões da coluna esquerda
    for (const s of this._explSkills) {
      g.fillStyle(0x0c1624, 0.9);
      g.fillRoundedRect(24, s.y - 8, W / 3 - 48, 72, 8);
      g.lineStyle(1, 0x29405a, 0.8);
      g.strokeRoundedRect(24, s.y - 8, W / 3 - 48, 72, 8);

      // Botão
      g.fillStyle(0x88ccff, 0.95);
      g.fillRoundedRect(264, s.y + 2, 32, 28, 6);
      g.lineStyle(1, 0x99d5ff, 1);
      g.strokeRoundedRect(264, s.y + 2, 32, 28, 6);
    }

    const pts = p.getAvailableSkillPoints();
    this._pointsText.setText(`Pontos disponiveis: ${pts}`);

    for (const n of this._skillNodes) {
      const rank = p.skillUpgrades[n.key] || 0;
      const canUpgrade = pts > 0 && rank < 3;

      n.rank.setText(`Nivel ${rank}/3`);

      n.btn.setColor(canUpgrade ? '#0f1a2a' : '#5b6270').setAlpha(canUpgrade ? 1 : 0.6);
      if (canUpgrade) {
        if (!n.btn.input || !n.btn.input.enabled) n.btn.setInteractive({ useHandCursor: true });
      } else if (n.btn.input && n.btn.input.enabled) {
        n.btn.disableInteractive();
      }
    }
  }

  _upgradeSkill(key) {
    if (!this._player) return;
    this._player.applySkillUpgrade(key);
  }

  _setVisible(v) {
    this._allNodes.forEach(o => o.setVisible(v));
  }
}
