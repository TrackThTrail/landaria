import { W, H, WORLD_H, GROUND_Y, CLOUD_X, CLOUD_Y, CLOUD_W, CLOUD_H, VENDOR_X, CELL_SIZE } from '../constants.js';
import { Player } from '../entities/Player.js';
import { Vendor } from '../entities/Vendor.js';
import { Shop }   from '../ui/Shop.js';
import { TerrainGrid } from '../terrain/TerrainGrid.js';
import { SoundEngine } from '../audio/SoundEngine.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  create() {
    // ── Layers (ordem: bg → estáticos → dinâmicos → HUD) ─────────────────
    this._bg          = this.add.graphics().setDepth(0).setScrollFactor(0);
    this._parallaxGfx = this.add.graphics().setDepth(1).setScrollFactor(0.08);
    this._terrainGfx  = this.add.graphics().setDepth(1.5); // blocos escaváveis
    this._staticGfx  = this.add.graphics().setDepth(2);   // nuvem
    this._vendorGfx  = this.add.graphics().setDepth(3);
    this.gfx         = this.add.graphics().setDepth(4);   // personagem
    this.hudGfx      = this.add.graphics().setDepth(5);   // barras

    // ── Plataformas ────────────────────────────────────────────────────────
    // { x: centro, y: topo dos pés, w: largura }
    this._platforms = [
      { x: CLOUD_X, y: CLOUD_Y, w: CLOUD_W }, // nuvem (terra gerida pelo TerrainGrid)
    ];

    // ── Entidades ──────────────────────────────────────────────────────────
    this.player = new Player(CLOUD_X, CLOUD_Y);
    this.vendor = new Vendor(VENDOR_X, CLOUD_Y);  // vendedor na nuvem

    // ── Shop ──────────────────────────────────────────────────────────────
    this.shop = new Shop(this);
    this.shop.setPlayer(this.player);

    // ── Input ──────────────────────────────────────────────────────────────
    this._cursors  = this.input.keyboard.createCursorKeys();
    this._wasd     = this.input.keyboard.addKeys({
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });
    this._spaceKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this._gKey      = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this._vKey      = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.V);
    this._escKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._sKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this._fKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this._mineTimer    = 0;
    this._mineTimerH   = 0;  // timer para escavação horizontal
    this._drillingAudio  = false;
    this._drillingAudioH = false;

    // Clique esquerdo → ataque (se loja fechada)
    this.input.on('pointerdown', (pointer) => {
      if (pointer.leftButtonDown() && !this.shop.visible) {
        const dir = pointer.x >= this.player.x ? 1 : -1;
        this.player.attack(dir);
      }
    });

    // ── HUD textos flutuantes ─────────────────────────────────────────────
    const ts = { fontFamily: 'monospace', fontSize: '10px', color: '#ffe088',
                 stroke: '#000000', strokeThickness: 3 };
    this.nameText  = this.add.text(0, 0, '', ts).setOrigin(0.5).setDepth(5);
    this.levelText = this.add.text(0, 0, '', { ...ts, color: '#aaffcc' }).setOrigin(0.5).setDepth(5);

    // HUD canto superior esquerdo: ouro (fixo na tela)
    this._goldHud = this.add.text(12, 12, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffd700',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // HUD combustível — segunda linha, canto superior esquerdo
    this._fuelHud = this.add.text(12, 34, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#88ff88',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // HUD altitude — canto superior direito
    this._altHud = this.add.text(W - 12, 12, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#88ddff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(10).setScrollFactor(0);

    // Prompt de interação com vendedor
    this._vPrompt = this.add.text(0, 0, '[V] Abrir Loja', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffff44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setVisible(false).setDepth(5);

    // ── Terreno + Estáticos ────────────────────────────────────────────────
    this._terrain = new TerrainGrid(GROUND_Y, WORLD_H, W, CELL_SIZE);
    this._drawBackground();
    this._drawParallax();
    this._drawCloud();
    this.vendor.draw(this._vendorGfx);
    this._drawVendorSign();

    // ── Áudio ────────────────────────────────────────────────────────────
    this._snd = new SoundEngine();
    // Init no primeiro gesto do utilizador (req. browser)
    this.input.once('pointerdown', () => this._snd.init());
    this.input.keyboard.once('keydown', () => this._snd.init());
    this._wasOnGround = true;
    this._wasDrilling = false;

    // Botão engrenagem + modal de configurações de áudio
    const container = document.getElementById('game-container') || document.body;
    container.style.position = 'relative';
    this._buildAudioModal(container);
  }

  update(_time, delta) {
    const { _cursors: c, _wasd: w, player, shop } = this;
    const shopOpen = shop.visible;

    const spaceJustDown = !shopOpen && Phaser.Input.Keyboard.JustDown(this._spaceKey);
    const input = {
      left:             !shopOpen && (c.left.isDown  || w.left.isDown),
      right:            !shopOpen && (c.right.isDown || w.right.isDown),
      jumpJustDown:     spaceJustDown && player.isOnGround,
      parachuteToggle:  spaceJustDown && !player.isOnGround,
    };

    // ── SFX pulo / paraquedas ────────────────────────────────────────────
    if (input.jumpJustDown) this._snd.sfxJump();
    if (input.parachuteToggle && !player.parachuteOpen) this._snd.sfxParachute();

    player.update(input, delta, this._platforms);

    // SFX aterrisagem
    if (!this._wasOnGround && player.isOnGround) this._snd.sfxLand();
    this._wasOnGround = player.isOnGround;

    // ── Colisão AABB com terreno ─────────────────────────────────────────
    if (player.y >= GROUND_Y - CELL_SIZE) {
      const hw = player.baseW / 2 - 1;   // inset de 1px para suavidade
      const cs = CELL_SIZE;
      const playerTop = player.y - player.baseH;

      // ── Vertical (queda) ────────────────────────────────────────────────
      // Usa SÓ o centro (player.x) para detecção de chão — bordos laterais
      // nunca devem ser confundidos com piso.
      if (player.vy >= 0) {
        const row = Math.floor((player.y - GROUND_Y) / cs);
        if (row >= 0) {
          const col = Math.floor(player.x / cs);
          if (this._terrain.isSolid(col, row)) {
            player.y          = GROUND_Y + row * cs;
            player.vy         = 0;
            player.isOnGround = true;
            player.parachuteOpen = false;
          }
        }
      }

      // ── Horizontal (paredes) ────────────────────────────────────────────
      const rowEnd   = Math.floor((player.y      - GROUND_Y) / cs);
      const rowStart = Math.max(0, Math.floor((playerTop - GROUND_Y) / cs));
      if (rowEnd >= 0) {
        // Lado direito
        const rightCol = Math.floor((player.x + hw) / cs);
        outer_r: for (let r = rowStart; r <= rowEnd; r++) {
          if (!this._terrain.isSolid(rightCol, r)) continue;
          const rTop = GROUND_Y + r * cs;
          if (player.y > rTop && playerTop < rTop + cs) {
            player.x  = rightCol * cs - hw - 0.5;
            player.vx = Math.min(0, player.vx);
            break outer_r;
          }
        }
        // Lado esquerdo
        const leftCol  = Math.floor((player.x - hw) / cs);
        outer_l: for (let r = rowStart; r <= rowEnd; r++) {
          if (!this._terrain.isSolid(leftCol, r)) continue;
          const rTop = GROUND_Y + r * cs;
          if (player.y > rTop && playerTop < rTop + cs) {
            player.x  = (leftCol + 1) * cs + hw + 0.5;
            player.vx = Math.max(0, player.vx);
            break outer_l;
          }
        }
      }
    }

    // ── Toggle escavadeira (F) ───────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this._fKey)) {
      player.hasDrill = !player.hasDrill;
    }

    // ── Escavação para baixo (S) — só com escavadeira em mãos ─────────────
    const canDrill = player.hasDrill && this._sKey.isDown && player.isOnGround && player.y >= GROUND_Y && player.fuel > 0;
    if (canDrill) {
      player.setDrilling(true, delta);
      if (!this._drillingAudio) {
        this._drillingAudio = true;
        this._snd.init();
        this._snd.sfxDigStart();
      }
      this._mineTimer += delta;
      if (this._mineTimer >= 350) {
        this._mineTimer = 0;
        const { col: mc, row: mr } = this._terrain.cellUnder(player.x, player.y);
        if (this._terrain.dig(mc, mr)) {
          player.drainFuel(3);
          this._snd.sfxDigImpact();
        }
      }
    } else {
      if (this._drillingAudio && !this._drillingAudioH) {
        this._drillingAudio = false;
        this._snd.sfxDigStop();
      }
      player.setDrilling(false, delta);
      this._mineTimer = 0;
    }

    // ── Escavação lateral — encostar na parede com escavadeira em mãos ────
    const hw = player.baseW / 2 - 1;
    const cs = CELL_SIZE;
    const playerTop  = player.y - player.baseH;
    const rowEnd     = Math.floor((player.y   - GROUND_Y) / cs);
    const rowMid     = Math.max(0, Math.floor((player.y - player.baseH * 0.5 - GROUND_Y) / cs));
    const touchRight = player.hasDrill && rowEnd >= 0 && this._terrain.isSolid(Math.floor((player.x + hw + 1) / cs), rowMid);
    const touchLeft  = player.hasDrill && rowEnd >= 0 && this._terrain.isSolid(Math.floor((player.x - hw - 1) / cs), rowMid);
    const touchWall  = touchRight || touchLeft;

    if (touchWall && player.fuel > 0) {
      player.setDrillingH(true, delta);
      if (!this._drillingAudioH) {
        this._drillingAudioH = true;
        if (!this._drillingAudio) { this._snd.init(); this._snd.sfxDigStart(); }
      }
      this._mineTimerH += delta;
      if (this._mineTimerH >= 350) {
        this._mineTimerH = 0;
        const wallCol = touchRight
          ? Math.floor((player.x + hw + 1) / cs)
          : Math.floor((player.x - hw - 1) / cs);
        if (this._terrain.dig(wallCol, rowMid)) {
          player.drainFuel(3);
          this._snd.sfxDigImpact();
        }
      }
    } else {
      if (this._drillingAudioH && !this._drillingAudio) {
        this._snd.sfxDigStop();
      }
      this._drillingAudioH = false;
      player.setDrillingH(false, delta);
      this._mineTimerH = 0;
    }

    player.draw(this.gfx);
    player.drawHud(this.hudGfx, this.nameText, this.levelText);

    // SFX passos
    const isWalking = player.isOnGround && Math.abs(player.vx) > 0.4;
    if (isWalking) this._snd.tickWalk(delta);
    else           this._snd.resetWalk();

    // Terreno (redesenha blocos visíveis)
    this._terrain.draw(this._terrainGfx, this.cameras.main.scrollY, H);

    // ── Câmera segue o player verticalmente ────────────────────────────────
    const targetScrollY = Phaser.Math.Clamp(player.y - H * 0.5, 0, WORLD_H - H);
    this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetScrollY, 0.14);

    // Ouro + combustível
    this._goldHud.setText(`💰 ${player.gold}`);
    const fp = Math.ceil(player.fuel);
    this._fuelHud.setText(`⛽ ${fp}%`).setColor(fp > 30 ? '#88ff88' : '#ff6644');

    // Altitude
    const metersFromGround = Math.round((GROUND_Y - player.y) / 10);
    if (metersFromGround >= 0) {
      this._altHud.setText(`⬆ ${metersFromGround}m do chão`).setColor('#88ddff');
    } else {
      this._altHud.setText(`⬇ ${Math.abs(metersFromGround)}m subsolo`).setColor('#ff8844');
    }

    // Prompt do vendedor
    const nearVendor = this.vendor.isNearPlayer(player);
    this._vPrompt.setVisible(nearVendor && !shopOpen);
    if (nearVendor) {
      this._vPrompt.setPosition(this.vendor.x, this.vendor.y - 72);
    }

    // Abrir/fechar loja
    if (Phaser.Input.Keyboard.JustDown(this._vKey) && nearVendor) {
      const wasOpen = shop.visible;
      shop.toggle();
      if (!wasOpen) this._snd.sfxShopOpen();
      else          this._snd.sfxShopClose();
    }
    if (Phaser.Input.Keyboard.JustDown(this._escKey)) {
      if (shop.visible) this._snd.sfxShopClose();
      shop.close();
    }

    shop.update(delta);
  }

  // ── Fundo do céu (fixo na tela) ────────────────────────────────────────────
  _drawBackground() {
    const g = this._bg;
    // Gradiente que muda de céu noturno (topo) para tom mais escuro (fundo)
    g.fillGradientStyle(0x060b18, 0x060b18, 0x0a1428, 0x0a1428, 1);
    g.fillRect(0, 0, W, H);

    // Estrelas (em coordenadas de tela, bg fixo)
    const rng = new Phaser.Math.RandomDataGenerator(['landaria2d']);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 140; i++) {
      const sx = rng.between(0, W);
      const sy = rng.between(0, H - 20);
      const ss = rng.realInRange(0.4, 1.8);
      g.fillCircle(sx, sy, ss);
    }

    // Lua
    g.fillStyle(0xfffde0, 0.92);
    g.fillCircle(W - 80, 55, 28);
    g.fillStyle(0x0a1428, 1);
    g.fillCircle(W - 68, 50, 22);
  }

  // ── Névoa paralaxe (scrollFactor 0.08 — move-se mais devagar que o mundo) ──
  _drawParallax() {
    const g = this._parallaxGfx;
    const rng = new Phaser.Math.RandomDataGenerator(['fog77']);

    // Bandas horizontais de névoa espaçadas ao longo do mundo inteiro
    const bandSpacing = 420;
    const bands = Math.ceil(WORLD_H / bandSpacing) + 2;
    for (let i = 0; i < bands; i++) {
      const by = i * bandSpacing + rng.between(-80, 80);
      const alpha = rng.realInRange(0.04, 0.11);
      const bw    = rng.between(W * 0.6, W * 1.1);
      const bx    = rng.between(-60, W - bw + 60);
      const bh    = rng.between(40, 110);
      g.fillStyle(0x4466aa, alpha);
      g.fillEllipse(bx + bw / 2, by, bw, bh);
    }

    // Wisp de névoa menores (pontos brilhantes distantes)
    for (let i = 0; i < 180; i++) {
      const wx = rng.between(0, W);
      const wy = rng.between(0, WORLD_H);
      const wr = rng.realInRange(1.5, 5);
      g.fillStyle(0x8899dd, rng.realInRange(0.04, 0.13));
      g.fillCircle(wx, wy, wr);
    }
  }

  // Substituído pelo TerrainGrid
  _drawGround() {}

  // ── Nuvem (estática) ──────────────────────────────────────────────────────
  _drawCloud() {
    const g  = this._staticGfx;
    const cx = CLOUD_X;
    const cy = CLOUD_Y;
    const cw = CLOUD_W;
    const ch = CLOUD_H;

    // Base da nuvem
    g.fillStyle(0xe8eeff, 0.96);
    g.fillEllipse(cx, cy + ch * 0.35, cw * 0.88, ch * 0.55);

    // Puffs superiores
    g.fillStyle(0xffffff, 0.98);
    g.fillEllipse(cx - cw * 0.26, cy + ch * 0.04, cw * 0.40, ch * 0.68);
    g.fillEllipse(cx + cw * 0.14, cy - ch * 0.06, cw * 0.44, ch * 0.74);
    g.fillEllipse(cx - cw * 0.04, cy + ch * 0.08, cw * 0.38, ch * 0.56);

    // Plataforma sólida (piso branco)
    g.fillStyle(0xdde4ff, 0.88);
    g.fillRect(cx - cw / 2, cy + ch * 0.12, cw, ch * 0.42);

    // Borda superior da plataforma
    g.fillStyle(0xffffff, 0.65);
    g.fillRect(cx - cw / 2, cy + ch * 0.10, cw, 5);

    // Sombra inferior da nuvem
    g.fillStyle(0x8899cc, 0.18);
    g.fillEllipse(cx, cy + ch * 0.6, cw * 0.78, 10);
  }

  // ── Placa do vendedor (texto de cena, estático) ───────────────────────────
  _drawVendorSign() {
    this.add.text(VENDOR_X, CLOUD_Y - 78, '🪄 Loja', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffd700',
      stroke: '#000', strokeThickness: 2,
      backgroundColor: '#3a1060',
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(2);
  }

  _buildAudioModal(container) {
    const css = (el, styles) => Object.assign(el.style, styles);
    const BASE = 'rgba(8,4,22,0.96)';
    const BORDER = '#6633bb';
    const FONT = "14px 'monospace', monospace";

    // ── Botão engrenagem ──────────────────────────────────────────────────
    const gear = document.createElement('button');
    gear.textContent = '⚙';
    css(gear, {
      position: 'absolute', top: '8px', right: '8px',
      background: 'rgba(10,5,30,0.80)', border: `1px solid ${BORDER}`,
      color: '#ccaaff', fontSize: '20px', padding: '3px 10px',
      borderRadius: '6px', cursor: 'pointer', zIndex: '200',
      fontFamily: 'monospace', lineHeight: '1.4',
    });
    gear.addEventListener('mouseenter', () => css(gear, { background: 'rgba(60,20,120,0.90)' }));
    gear.addEventListener('mouseleave', () => css(gear, { background: 'rgba(10,5,30,0.80)' }));
    container.appendChild(gear);

    // ── Overlay escuro ────────────────────────────────────────────────────
    const overlay = document.createElement('div');
    css(overlay, {
      display: 'none', position: 'absolute', inset: '0',
      background: 'rgba(0,0,0,0.55)', zIndex: '300',
      justifyContent: 'center', alignItems: 'center',
    });
    container.appendChild(overlay);

    // ── Painel modal ──────────────────────────────────────────────────────
    const panel = document.createElement('div');
    css(panel, {
      background: BASE, border: `2px solid ${BORDER}`,
      borderRadius: '12px', padding: '24px 32px',
      minWidth: '280px', color: '#ddc8ff', font: FONT,
      boxShadow: '0 0 36px rgba(110,50,220,0.45)',
      userSelect: 'none',
    });

    // Título
    const title = document.createElement('div');
    title.textContent = '⚙  Configurações de Áudio';
    css(title, { fontSize: '15px', color: '#cc99ff', marginBottom: '20px',
                 fontWeight: 'bold', letterSpacing: '1px' });
    panel.appendChild(title);

    // Helper: criar linha label + slider + valor
    const makeSlider = (label, initial, onChange) => {
      const row = document.createElement('div');
      css(row, { display: 'flex', alignItems: 'center', marginBottom: '16px', gap: '10px' });

      const lbl = document.createElement('span');
      lbl.textContent = label;
      css(lbl, { width: '100px', color: '#bbaaee' });

      const slider = document.createElement('input');
      slider.type = 'range'; slider.min = '0'; slider.max = '100';
      slider.value = String(Math.round(initial * 100));
      css(slider, {
        flex: '1', accentColor: '#9955ee', cursor: 'pointer',
        height: '4px',
      });

      const val = document.createElement('span');
      val.textContent = slider.value + '%';
      css(val, { width: '38px', textAlign: 'right', color: '#ffdd88' });

      slider.addEventListener('input', () => {
        val.textContent = slider.value + '%';
        onChange(Number(slider.value) / 100);
      });

      row.append(lbl, slider, val);
      panel.appendChild(row);
      return slider;
    };

    const musicSlider = makeSlider('🎵 Música',  0.45, v => this._snd.setMusicVolume(v));
    const sfxSlider   = makeSlider('🔊 Efeitos', 0.55, v => this._snd.setSfxVolume(v));

    // Separador
    const sep = document.createElement('hr');
    css(sep, { border: 'none', borderTop: `1px solid ${BORDER}`, margin: '12px 0 18px' });
    panel.appendChild(sep);

    // Botão fechar
    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fechar';
    css(closeBtn, {
      display: 'block', margin: '0 auto', padding: '6px 28px',
      background: 'rgba(80,20,150,0.85)', border: `1px solid ${BORDER}`,
      color: '#ddbbff', borderRadius: '6px', cursor: 'pointer',
      font: FONT, letterSpacing: '0.5px',
    });
    closeBtn.addEventListener('mouseenter', () => css(closeBtn, { background: 'rgba(120,40,210,0.95)' }));
    closeBtn.addEventListener('mouseleave', () => css(closeBtn, { background: 'rgba(80,20,150,0.85)' }));
    panel.appendChild(closeBtn);
    overlay.appendChild(panel);

    // Abrir / fechar
    const open  = () => { overlay.style.display = 'flex'; this._snd.init(); };
    const close = () => { overlay.style.display = 'none'; };
    gear.addEventListener('click', () => overlay.style.display === 'none' ? open() : close());
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    // Sync volumes depois de init (sliders já têm os valores default)
    this._syncAudioSliders = () => {
      musicSlider.value = String(Math.round(this._snd.getMusicVolume() * 100));
      sfxSlider.value   = String(Math.round(this._snd.getSfxVolume()   * 100));
    };
  }
}

