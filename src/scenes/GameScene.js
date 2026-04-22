import { W, H, WORLD_H, GROUND_Y, CLOUD_X, CLOUD_Y, CLOUD_W, CLOUD_H, WORKBENCH_X, CELL_SIZE } from '../constants.js';
import { Player } from '../entities/Player.js';
import { Alien }  from '../entities/Alien.js';
import { Shop }        from '../ui/Shop.js';
import { Inventory }   from '../ui/Inventory.js';
import { MissionLog }  from '../ui/MissionLog.js';
import { MapView }     from '../ui/MapView.js';
import { TerrainGrid } from '../terrain/TerrainGrid.js';

const QX_COUNT = 5;  // número de quadrantes horizontais
import { SoundEngine } from '../audio/SoundEngine.js';

export class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    // ── Layers (ordem: bg → estáticos → dinâmicos → HUD) ─────────────────
    this._bg          = this.add.graphics().setDepth(0).setScrollFactor(0);
    this._parallaxGfx = this.add.graphics().setDepth(1).setScrollFactor(0.08);
    this._terrainGfx  = this.add.graphics().setDepth(1.5); // blocos escaváveis
    this._staticGfx  = this.add.graphics().setDepth(2);   // nuvem + workbench
    this._workbenchGfx = this.add.graphics().setDepth(3);
    this.gfx         = this.add.graphics().setDepth(4);   // personagem
    this.hudGfx      = this.add.graphics().setDepth(5);   // barras

    // ── Plataformas ────────────────────────────────────────────────────────
    // { x: centro, y: topo dos pés, w: largura }
    this._platforms = [
      { x: CLOUD_X, y: CLOUD_Y, w: CLOUD_W }, // nuvem (terra gerida pelo TerrainGrid)
    ];

    // ── Entidades ──────────────────────────────────────────────────────────
    // O personagem começa deitado na superfície, ao lado da cápsula
    this.player = new Player(WORKBENCH_X + 65, GROUND_Y);
    this.player.isOnGround = true;
    // Animação de despertar: 0–2.8s de intro
    this._wakeupTimer = 0;
    this._wakeupDur   = 1600;
    this._wakeupDone  = false;
    // ── workbench (mesa de ferramentas na superfície, lado esquerdo) ──────
    this._workbench = { x: WORKBENCH_X, y: GROUND_Y, interactDist: 110,
                        battery: 1000, maxBattery: 1000,
                        oxygen: 1000,  maxOxygen: 1000 };

    // ── Pedras de Iluminação colocadas no mundo ───────────────────────────
    this._placedStones  = [];   // [{ x, y }] em coords de mundo
    this._stoneGfx      = this.add.graphics().setDepth(3);
    this._cableGfx      = this.add.graphics().setDepth(3.5);
    this._cableConnected = false;
    this._CABLE_MAX_DIST = 110;  // px — igual ao interactDist da loja
    this._CHARGE_RATE    = 100 / (20 * 1000); // 100% em 20s (por ms)
    this._OXY_DRAIN      = 100 / (90 * 1000); // esgota em 90s no subsolo (por ms)
    this._OXY_REGEN      = 100 / (15 * 1000); // recarrega em 15s (por ms)

    // ── Shop ──────────────────────────────────────────────────────────────
    this.shop = new Shop(this);
    this.shop.setPlayer(this.player);

    // ── Inventário ────────────────────────────────────────────────────────
    this.inventory = new Inventory(this);
    this.inventory.setPlayer(this.player);

    // ── Relatório da Missão ───────────────────────────────────────────────
    this.missionLog = new MissionLog(this);

    // ── Input ──────────────────────────────────────────────────────────────
    this._cursors  = this.input.keyboard.createCursorKeys();
    this._wasd     = this.input.keyboard.addKeys({
      left:  Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
      up:    Phaser.Input.Keyboard.KeyCodes.W,
      down:  Phaser.Input.Keyboard.KeyCodes.S,
    });
    this._spaceKey  = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this._gKey      = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.G);
    this._lKey      = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.L);
    this._eKey      = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this._key1      = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
    this._escKey    = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this._sKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this._fKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.F);
    this._hKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.H);
    this._rKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this._iKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    this._jKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.J);
    this._mKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.M);
    this._qKey         = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this._tJustDown    = false;
    this.input.keyboard.on('keydown-T', () => { this._tJustDown = true; });
    this._mineTimerH   = 0;  // timer de escavação direcional
    this._drillTarget  = null; // bloco alvo para flash
    this._drillingAudio  = false;
    this._drillingAudioH = false;

    // ── Sonar ─────────────────────────────────────────────────────────────
    this._sonarWave  = null;   // { sx, sy, r, maxR } — onda ativa
    this._sonarPings = [];     // [{ wx, wy, phase }] — locais de minério detectados
    this._sonarGfx   = this.add.graphics().setDepth(9.5).setScrollFactor(0);
    this._throwGfx   = this.add.graphics().setDepth(9.2);  // trajetória e barra de carga (coords mundo)
    this._stoneCharge   = 0;     // 0–1: nível de carga atual
    this._stoneCharging = false; // true enquanto E está pressionado

    // ── Game over (sem oxigênio) ──────────────────────────────────────────
    this._gameOverActive  = false;
    this._gameOverTimer   = 0;
    this._gameOverGfx     = this.add.graphics().setDepth(30).setScrollFactor(0).setVisible(false);
    this._gameOverText    = this.add.text(W / 2, H / 2 - 20, 'SEM OXIGÊNIO', {
      fontFamily: 'monospace', fontSize: '36px', color: '#ff2222',
      stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0).setVisible(false);
    this._gameOverSub     = this.add.text(W / 2, H / 2 + 28, 'Reiniciando…', {
      fontFamily: 'monospace', fontSize: '16px', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(31).setScrollFactor(0).setVisible(false);

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

    // HUD oxigênio — canto superior esquerdo (primeira linha)
    this._oxyHudMain = this.add.text(12, 12, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#22aaff',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // HUD combustível — segunda linha, canto superior esquerdo
    this._fuelHud = this.add.text(12, 34, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#88ff88',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // HUD cobre — terceira linha, canto superior esquerdo
    this._copperHud = this.add.text(12, 56, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#e8a060',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // HUD ferro — quarta linha
    this._ironHud = this.add.text(12, 78, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#aaaaaa',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // HUD rkanium — quinta linha
    this._rkaniumHud = this.add.text(12, 100, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#cc66ff',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // HUD pedras de iluminação — sexta linha, canto superior esquerdo
    this._stoneHud = this.add.text(12, 122, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffe066',
      stroke: '#000', strokeThickness: 3,
    }).setDepth(10).setScrollFactor(0);

    // Tempo de jogo — acumulado em ms
    this._worldTime = 0;

    // HUD temporizador — reposicionado dinamicamente à esquerda do altitude
    this._timeHud = this.add.text(0, 12, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#ffeeaa',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(10).setScrollFactor(0);

    // HUD altitude — canto superior direito
    this._altHud = this.add.text(W - 12, 12, '', {
      fontFamily: 'monospace', fontSize: '13px', color: '#88ddff',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(1, 0).setDepth(10).setScrollFactor(0);

    // Prompt de interação com a cápsula de emergência
    this._vPrompt = this.add.text(0, 0, '🚨 Mesa  [L]', {
      fontFamily: 'monospace', fontSize: '12px', color: '#ffff44',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setVisible(false).setDepth(5);

    // Prompt do cabo carregador
    this._cablePrompt = this.add.text(0, 0, '🔋 Cabo [H]', {
      fontFamily: 'monospace', fontSize: '12px', color: '#88ffcc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setVisible(false).setDepth(5);

    // ── Slot de equipamento ativo (rodapé) ──────────────────────────────────────
    this._equipGfx  = this.add.graphics().setDepth(10).setScrollFactor(0);
    this._equipText = this.add.text(W / 2, H - 28, '', {
      fontFamily: 'monospace', fontSize: '14px', color: '#ffffff',
      stroke: '#000', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0.5).setDepth(11).setScrollFactor(0);

    // ── Terreno + Estáticos ────────────────────────────────────────────────
    this._terrain = new TerrainGrid(GROUND_Y, WORLD_H, W, CELL_SIZE);

    // ── Sistema de Quadrantes ─────────────────────────────────────────────
    this._qx               = 0;
    this._visitedQuadrants = new Set(['0']);
    this._transitioning    = false;  // impede nova transição enquanto activo
    this._transitionOut    = false;  // congela update durante o fade de saída
    this._terrainCache     = new Map();  // qx → TerrainGrid (persiste escavações)
    this._alienCache       = new Map();  // qx → Alien[] (persiste aliens)

    // ── Mapa ──────────────────────────────────────────────────────────────
    this.mapView = new MapView(this);

    this._drawBackground();
    // Pré-gera dados das estrelas para parallax
    {
      const rng = new Phaser.Math.RandomDataGenerator(['landaria2d']);
      this._starData = Array.from({ length: 140 }, () => ({
        x:    rng.between(0, W),
        y:    rng.between(0, H - 20),
        r:    rng.realInRange(0.4, 1.8),
        twinkle: rng.realInRange(0, Math.PI * 2),  // fase inicial do brilho
      }));
    }
    this._drawParallax();
    this._drawCloud();
    this._drawWorkbench();

    // ── Sistema de Luminosidade ──────────────────────────────────────────
    // Canvas 2D: destination-out garante coords de ecrã exatas sem câmera Phaser
    this._lightCanvas = this.textures.createCanvas('_lightCanvas', W, H);
    this._lightImage  = this.add.image(0, 0, '_lightCanvas')
      .setOrigin(0, 0).setDepth(9).setScrollFactor(0);

    // ── Aliens ────────────────────────────────────────────────────
    this._aliensGfx = this.add.graphics().setDepth(3.8);
    this._aliens    = this._spawnAliens(this._terrain);
    this._wasAttacking = false;

    // ── Áudio ────────────────────────────────────────────────────────────
    this._snd = new SoundEngine();
    this.shop.setSoundEngine(this._snd);
    // Init no primeiro gesto do utilizador (req. browser)
    this.input.once('pointerdown', () => this._snd.init());
    this.input.keyboard.once('keydown', () => this._snd.init());
    this._wasOnGround = true;
    this._wasDrilling = false;
    this._jetpackArmed = false;   // true só após soltar espaço no ar

    // ── Texto flutuante de drop (+1) ─────────────────────────────────────
    this._floatTexts = [];  // [{ text: Phaser.Text, vy, life, maxLife }]

    // Botão engrenagem + modal de configurações de áudio
    const container = document.getElementById('game-container') || document.body;
    container.style.position = 'relative';
    this._buildAudioModal(container);
  }

  update(time, delta) {
    const { _cursors: c, _wasd: w, player, shop } = this;

    // ── Fundo dinâmico (camY necessário para dividir céu↔caverna) ─────────
    this._drawBackground(this.cameras.main.scrollY, time);

    // ── Animação de despertar ──────────────────────────────────────────────
    if (!this._wakeupDone) {
      this._wakeupTimer += delta;
      const t = Math.min(1, this._wakeupTimer / this._wakeupDur);
      if (t < 0.08) {
        player.wakeAnim = 1.0;   // deitado immóvel
      } else {
        const p    = (t - 0.08) / 0.92;
        const ease = p * p * p * (p * (p * 6 - 15) + 10);  // smootherstep (mais agressivo)
        player.wakeAnim = Math.max(0, 1 - ease);
      }
      if (t >= 1) {
        this._wakeupDone  = true;
        player.wakeAnim   = 0;
        this._snd.sfxLand(); // pequeno impacto ao ficar de pé
        this._wasOnGround = true;
      }
    }

    const shopOpen = shop.visible || this.inventory.visible || this.missionLog.visible || this.mapView.visible;
    // Movimento bloqueado apenas por painéis que precisam de foco total (não o mapa)
    const blockMove = shop.visible || this.inventory.visible || this.missionLog.visible;

    const spaceJustDown = !blockMove && Phaser.Input.Keyboard.JustDown(this._spaceKey);
    const spaceIsDown   = !blockMove && this._spaceKey.isDown;
    const wJustDown     = !blockMove && !player.hasDrill && Phaser.Input.Keyboard.JustDown(w.up);
    const wIsDown       = !blockMove && !player.hasDrill && w.up.isDown;
    const jumpJustDown  = (spaceJustDown || wJustDown) && player.isOnGround;

    // Jetpack "armado": só ativa depois de soltar espaço após o pulo
    if (player.isOnGround) {
      this._jetpackArmed = false;   // reset ao tocar o chão
    } else if (!(spaceIsDown || wIsDown)) {
      this._jetpackArmed = true;    // espaço foi solto no ar — agora pode armar
    }
    const jetpackActive = this._jetpackArmed && (spaceIsDown || wIsDown) && !player.isOnGround && player.fuel > 0;
    const key1JustDown  = !blockMove && Phaser.Input.Keyboard.JustDown(this._key1);

    const input = {
      left:             !blockMove && (c.left.isDown  || w.left.isDown),
      right:            !blockMove && (c.right.isDown || w.right.isDown),
      jumpJustDown,
      jetpackActive,
      parachuteToggle:  key1JustDown && !player.isOnGround,
    };

    // Bloqueia controlos durante animação inicial
    if (!this._wakeupDone) {
      input.left = false; input.right = false;
      input.jumpJustDown = false; input.jetpackActive = false;
      input.parachuteToggle = false;
    }

    // ── SFX pulo / paraquedas ────────────────────────────────────────────
    if (input.jumpJustDown) this._snd.sfxJump();
    if (input.parachuteToggle && !player.parachuteOpen && player.hasParachute) this._snd.sfxParachute();

    player.update(input, delta, this._platforms);

    // Float text de cura do med-kit
    if (player.medkitTick) {
      this._spawnFloatText(player.x, player.y - player.baseH, '+5', '#44ff88');
    }

    // Marca células exploradas ao redor do jogador (para o minimap)
    this._terrain.markExplored(player.x, player.y, player.lightRadius);

    if (player.jetpackOn && !this._jetpackWasOn) this._snd.sfxJetpackStart();
    if (!player.jetpackOn && this._jetpackWasOn) this._snd.sfxJetpackStop();
    this._jetpackWasOn = player.jetpackOn;

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
            const wasAir = !player.isOnGround;
            player.y          = GROUND_Y + row * cs;
            if (wasAir && player.vy > 0) {
              player._landingVy = player.vy;
            }
            player.vy         = 0;
            player.isOnGround = true;
            player.parachuteOpen = false;
          }
        }
      }

      // ── Vertical (teto) ─────────────────────────────────────────────────
      // Só pelo centro para não ser confundido com paredes laterais.
      if (player.vy < 0) {
        const ceilRow = Math.floor((playerTop - GROUND_Y) / cs);
        if (ceilRow >= 0) {
          const col = Math.floor(player.x / cs);
          if (this._terrain.isSolid(col, ceilRow)) {
            // empurra os pés para baixo do bloco de teto
            player.y  = GROUND_Y + (ceilRow + 1) * cs + player.baseH;
            player.vy = 0;
          }
        }
      }

      // ── Horizontal (paredes) ────────────────────────────────────────────
      // Recalcula playerTop com player.y já corrigido pelas resoluções verticais
      const playerTopH = player.y - player.baseH;
      const rowEnd   = Math.floor((player.y       - GROUND_Y) / cs);
      const rowStart = Math.max(0, Math.floor((playerTopH - GROUND_Y) / cs));
      if (rowEnd >= 0) {
        // Lado direito
        const rightCol = Math.floor((player.x + hw) / cs);
        outer_r: for (let r = rowStart; r <= rowEnd; r++) {
          if (!this._terrain.isSolid(rightCol, r)) continue;
          const rTop = GROUND_Y + r * cs;
          if (player.y > rTop && playerTopH < rTop + cs) {
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
          if (player.y > rTop && playerTopH < rTop + cs) {
            player.x  = (leftCol + 1) * cs + hw + 0.5;
            player.vx = Math.max(0, player.vx);
            break outer_l;
          }
        }
      }
    }

    // SFX aterrisagem + dano de queda (após AABB para terreno ser detectado)
    const justLanded = !this._wasOnGround && player.isOnGround;
    if (justLanded) {
      this._snd.sfxLand();
      // paraquedas limita vy ≤ 2, por isso naturalmente abaixo do threshold
      const fallVy = player._landingVy || 0;
      if (fallVy > 4.5) {
        const dmg = Math.round((fallVy - 4.5) * 18);
        player.hp = Math.max(0, player.hp - dmg);
        this._spawnFloatText(player.x, player.y - player.baseH, `-${dmg} HP`, '#ff4444');
        this._snd.sfxFallDamage();
      }
    }
    this._wasOnGround = player.isOnGround;

    // ── Transições de quadrante ──────────────────────────────────────────
    // Player.js já faz Clamp(x, hw, W-hw). A AABB do terreno bloqueia cols
    // sólidas no subsolo. Aqui basta detetar quando o jogador toca a borda.
    {
      const hw    = player.baseW / 2;
      const wallR = W - hw;   // 949 — borda direita da tela
      const wallL = hw;       //  11 — borda esquerda da tela

      if (!this._transitioning && !shopOpen && this._wakeupDone) {
        if (input.right && player.x >= wallR && this._qx < QX_COUNT - 1) {
          this._startTransition(this._qx + 1, 'right');
        } else if (input.left && player.x <= wallL && this._qx > 0) {
          this._startTransition(this._qx - 1, 'left');
        }
      }
    }

    // Congela tudo durante o fade de saída
    if (this._transitionOut) return;

    // ── Toggle escavadeira (F) ───────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this._fKey)) {
      player.hasDrill = !player.hasDrill;
      if (player.hasDrill) player.lanternOn = false;  // desliga lanterna
      if (!player.hasDrill) {
        // guarda a escavadeira — para tudo
        player.isDrillingH = false;
        player.drillDirX = 1; player.drillDirY = 0;
        this._drillTarget = null;
        this._mineTimerH  = 0;
        if (this._drillingAudioH) { this._snd.sfxDigStop(); this._drillingAudioH = false; }
      }
    }

    // ── Escavação direcional (WASD / arrows) com escavadeira em mãos ──────
    if (player.hasDrill && player.fuel > 0) {
      // Direção pedida pelo jogador
      const digLeft  = this._wasd.left.isDown  || this._cursors.left.isDown;
      const digRight = this._wasd.right.isDown || this._cursors.right.isDown;
      const digUp    = this._wasd.up.isDown    || this._cursors.up.isDown;
      const digDown  = this._wasd.down.isDown  || this._cursors.down.isDown;

      const dx = (digRight ? 1 : 0) - (digLeft ? 1 : 0);
      const dy = (digDown  ? 1 : 0) - (digUp   ? 1 : 0);
      const digging = dx !== 0 || dy !== 0;

      if (digging) {
        // Atualiza direção e animação da escavadeira
        player.drillDirX = dx;
        player.drillDirY = dy;
        player.isDrillingH = true;
        player.drillTime  += delta;

        // Calcula célula-alvo (a partir do centro do personagem, 1 célula na direção)
        const cs       = CELL_SIZE;
        const centerX  = player.x;
        const centerY  = player.y - player.baseH * 0.5;
        const targetWX = centerX + dx * cs;
        const targetWY = centerY + dy * cs;
        const tCol     = Math.floor(targetWX / cs);
        const tRow     = Math.floor((targetWY - GROUND_Y) / cs);

        const targetIsValid = tRow >= 0 && this._terrain.isSolid(tCol, tRow);

        if (targetIsValid) {
          // Salva alvo para o flash
          this._drillTarget = { col: tCol, row: tRow };
          this._mineTimerH += delta;

          if (!this._drillingAudioH) {
            this._drillingAudioH = true;
            this._snd.init();
            this._snd.sfxDigStart();
          }

          // Cobre demora o dobro (700ms), rkanium 1000ms, ferro 500ms, regolito 350ms
          const blockType    = this._terrain.cells[tRow][tCol];
          const mineRequired = blockType === 3 ? 1000 : blockType === 2 ? 700 : blockType === 4 ? 500 : 350;
          if (this._mineTimerH >= mineRequired) {
            this._mineTimerH = 0;
            const dug = this._terrain.dig(tCol, tRow);
            // Remove pedras coladas neste bloco
            this._placedStones = this._placedStones.filter(
              st => !st.wallAnchor || st.wallAnchor.col !== tCol || st.wallAnchor.row !== tRow);
            if (dug > 0) {
              player.drainFuel(3);
              const bx = tCol * CELL_SIZE + CELL_SIZE / 2;
              const by = GROUND_Y + tRow * CELL_SIZE;
              // Dano de escavadeira em alien adjacente
              for (const al of this._aliens) {
                if (al.state === 'dead') continue;
                if (Math.abs(al.x - bx) < CELL_SIZE * 1.4 && Math.abs(al.y - (by + CELL_SIZE / 2)) < CELL_SIZE) {
                  if (al.takeDamage(35))
                    this._spawnFloatText(al.x, al.y - al.baseH, '-35', '#ffaa00');
                }
              }
              if (dug === 3) {
                this._snd.sfxDigImpactCopper();
                player.rkanium++;
                this._spawnFloatText(bx, by, '+1 Rkanium', '#cc66ff');
                player.lightRadius = Math.min(player.MAX_LIGHT_R, player.lightRadius + 2);
              } else if (dug === 4) {
                this._snd.sfxDigImpactCopper();
                player.iron++;
                this._spawnFloatText(bx, by, '+1 Ferro', '#aaaaaa');
                player.lightRadius = Math.min(player.MAX_LIGHT_R, player.lightRadius + 1);
                // Remove sonar ping se existir nesta célula
                const pingWX = bx;
                const pingWY = GROUND_Y + tRow * CELL_SIZE + CELL_SIZE / 2;
                this._sonarPings = this._sonarPings.filter(
                  p => Math.abs(p.wx - pingWX) > 5 || Math.abs(p.wy - pingWY) > 5);
              } else if (dug === 2) {
                this._snd.sfxDigImpactCopper();
                player.copper++;
                this._spawnFloatText(bx, by, '+1 Cobre', '#e8a060');
                player.lightRadius = Math.min(player.MAX_LIGHT_R, player.lightRadius + 6);
                // Remove sonar ping se existir nesta célula
                const pingWX = bx;
                const pingWY = GROUND_Y + tRow * CELL_SIZE + CELL_SIZE / 2;
                this._sonarPings = this._sonarPings.filter(
                  p => Math.abs(p.wx - pingWX) > 5 || Math.abs(p.wy - pingWY) > 5);
              } else {
                this._snd.sfxDigImpact();
                player.lightRadius = Math.min(player.MAX_LIGHT_R, player.lightRadius + 0.3);
              }
            }
          }
        } else {
          // Aponta para a direção mas não está em contato com bloco
          this._drillTarget = null;
          this._mineTimerH  = 0;
          if (this._drillingAudioH) { this._snd.sfxDigStop(); this._drillingAudioH = false; }
        }
      } else {
        // Sem tecla — escavadeira parada, aponta para o facing
        player.drillDirX   = player.facing;
        player.drillDirY   = 0;
        player.isDrillingH = false;
        this._drillTarget  = null;
        this._mineTimerH   = 0;
        if (this._drillingAudioH) { this._snd.sfxDigStop(); this._drillingAudioH = false; }
      }
    } else {
      player.isDrillingH = false;
      this._drillTarget  = null;
      this._mineTimerH   = 0;
      if (this._drillingAudioH) { this._snd.sfxDigStop(); this._drillingAudioH = false; }
    }

    player.draw(this.gfx);

    // ── Aliens ────────────────────────────────────────────────────
    {
      const camYAl = this.cameras.main.scrollY;
      this._aliensGfx.clear();
      for (const al of this._aliens) {
        al.update(delta, player.x, player.y);
        al.resolveCollision(this._terrain, GROUND_Y, CELL_SIZE);
        if (al.hitPlayer && !this._gameOverActive) {
          player.hp = Math.max(0, player.hp - al.DAMAGE);
          this._spawnFloatText(player.x, player.y - player.baseH, `-${al.DAMAGE} HP`, '#ff2222');
          this._snd.sfxFallDamage();
          // Knocback no jogador
          player.vx = Math.sign(player.x - al.x) * 5;
          player.vy = -4;
          player.isOnGround = false;
        }
        al.draw(this._aliensGfx, camYAl);
      }
      // Remove aliens com animação de morte concluída
      this._aliens = this._aliens.filter(al => !al.isDead);

      // Ataque corpo-a-corpo do jogador (clique esquerdo)
      const justAttacked = player.isAttacking && !this._wasAttacking;
      this._wasAttacking  = player.isAttacking;
      if (justAttacked) {
        const atkRange = 65;
        for (const al of this._aliens) {
          if (al.state === 'dead') continue;
          const adx = al.x - player.x;
          if (Math.abs(adx) < atkRange && Math.sign(adx) === player.facing) {
            if (al.takeDamage(25))
              this._spawnFloatText(al.x, al.y - al.baseH, '-25', '#ffaa00');
          }
        }
      }
    }

    // ── Física das pedras: gravidade + colisão horizontal e vertical ────────
    {
      const STONE_GRAV = 0.35;
      this._stoneGfx.clear();
      for (const st of this._placedStones) {
        // ── Horizontal ──────────────────────────────────────────────────
        if (st.vx && !st.wallAnchor) {
          const prevX = st.x;
          st.x  += st.vx * (delta / 16);
          st.vx *= 0.998;
          if (Math.abs(st.vx) < 0.05) st.vx = 0;
          if (st.x < 0)       { st.x = 0;     st.vx = 0; }
          if (st.x > W - 1)   { st.x = W - 1; st.vx = 0; }
          const hRow = Math.floor((st.y - GROUND_Y) / CELL_SIZE);
          if (hRow >= 0) {
            const newC = Math.floor(st.x / CELL_SIZE);
            if (this._terrain.isSolid(newC, hRow)) {
              st.x = prevX; st.vx = 0; st.vy = 0;
              // Cola na parede
              st.wallAnchor = { col: newC, row: hRow };
            }
          }
        }
        // ── Vertical ────────────────────────────────────────────────────
        if (!st.wallAnchor) {
          const col     = Math.floor(st.x / CELL_SIZE);
          const row     = Math.floor((st.y - GROUND_Y) / CELL_SIZE);
          const onSolid = row >= 0 && this._terrain.isSolid(col, row);
          if (onSolid) {
            st.vy = 0; st.vx = 0;
            st.y  = GROUND_Y + row * CELL_SIZE;
          } else {
            st.vy = Math.min(st.vy + STONE_GRAV * (delta / 16), 12);
            st.y += st.vy * (delta / 16);
          }
        }
        // Glow visual
        this._stoneGfx.fillStyle(0xffffff, 0.18);
        this._stoneGfx.fillCircle(st.x, st.y - 4, 14);
        this._stoneGfx.fillStyle(0xffe066, 0.9);
        this._stoneGfx.fillCircle(st.x, st.y - 4, 5);
        this._stoneGfx.fillStyle(0xffffff, 1);
        this._stoneGfx.fillCircle(st.x - 1, st.y - 5, 1.5);
      }
    }

    // ── Luminosidade subterrânea (overlay de escuridão com buraco de luz) ─────────
    {
      const depthPx        = player.y - GROUND_Y;   // negativo: acima; positivo: abaixo
      const camY           = this.cameras.main.scrollY;
      const surfaceScreenY = GROUND_Y - camY;        // Y da superfície em coords de ecrã
      const ctx = this._lightCanvas.context;
      ctx.clearRect(0, 0, W, H);

      if (surfaceScreenY < H) {
        const FADE_DEPTH = CELL_SIZE * 4;  // 4 blocos visíveis a partir da superfície
        const fadeEnd    = surfaceScreenY + FADE_DEPTH;  // em coords de ecrã (pode sair do ecrã)

        // ── 1. Gradiente: surface → surface+4blocos (sempre presente) ──────
        const gradTop = Math.max(0, surfaceScreenY);
        const gradBot = Math.min(H, fadeEnd);
        if (gradBot > gradTop) {
          // calcula alpha no topo e fundo do segmento visível
          const alphaAt = sy => Math.min(1, Math.max(0, (sy - surfaceScreenY) / FADE_DEPTH));
          const grad = ctx.createLinearGradient(0, gradTop, 0, gradBot);
          grad.addColorStop(0, `rgba(0,0,0,${alphaAt(gradTop).toFixed(3)})`);
          grad.addColorStop(1, `rgba(0,0,0,${alphaAt(gradBot).toFixed(3)})`);
          ctx.fillStyle = grad;
          ctx.fillRect(0, gradTop, W, gradBot - gradTop);
        }

        // ── 2. Tudo abaixo dos 4 blocos: preto total ───────────────────────
        if (fadeEnd < H) {
          ctx.fillStyle = 'rgba(0,0,0,1)';
          ctx.fillRect(0, Math.max(0, fadeEnd), W, H - Math.max(0, fadeEnd));
        }

        // ── 3. Acima da superfície: escurece gradualmente ao descer ─────────
        if (depthPx > 0 && surfaceScreenY > 0) {
          const topAlpha = Math.min(1, (depthPx / 200));
          ctx.fillStyle = `rgba(0,0,0,${topAlpha.toFixed(3)})`;
          ctx.fillRect(0, 0, W, surfaceScreenY);
        }

        // ── 4. Underground: buraco de luz à volta do jogador ────────────────
        if (depthPx > 0) {
          const sx = player.x;
          const sy = (player.y - player.baseH * 0.5) - camY;
          const miningBoost = (player.isDrilling || player.isDrillingH) ? 35 : 0;
          const R  = player.lightRadius + miningBoost;
          const edge = Math.min(18, R * 0.12);  // fade só nas últimas 18px da borda
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          // Área plana: totalmente transparente até (R - edge)
          ctx.fillStyle = 'rgba(0,0,0,1)';
          ctx.beginPath();
          ctx.arc(sx, sy, R - edge, 0, Math.PI * 2);
          ctx.fill();
          // Borda suave: gradiente apenas na faixa [R-edge, R]
          const grd = ctx.createRadialGradient(sx, sy, R - edge, sx, sy, R);
          grd.addColorStop(0, 'rgba(0,0,0,1)');
          grd.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = grd;
          ctx.beginPath();
          ctx.arc(sx, sy, R, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();

          // ── 6. Cone da lanterna (dentro do bloco underground) ─────────────
          if (player.lanternOn && player.lanterns > 0) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            const coneLen   = 240;
            const halfAng   = Math.PI / 6;  // ±30°
            const centerAng = player.facing === 1 ? 0 : Math.PI;
            const grdC = ctx.createRadialGradient(sx, sy, 0, sx, sy, coneLen);
            grdC.addColorStop(0,    'rgba(0,0,0,1)');
            grdC.addColorStop(0.65, 'rgba(0,0,0,0.92)');
            grdC.addColorStop(0.88, 'rgba(0,0,0,0.50)');
            grdC.addColorStop(1.0,  'rgba(0,0,0,0)');
            ctx.fillStyle = grdC;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.arc(sx, sy, coneLen, centerAng - halfAng, centerAng + halfAng);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        }

        // ── 5. Pedras colocadas: cada uma abre um círculo de luz em gradiente ─────
        if (this._placedStones.length > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          const STONE_R = 180;
          for (const st of this._placedStones) {
            const stSY = (st.y - 4) - camY;
            // Gradiente radial: centro totalmente iluminado → borda quase escuro
            const grd2 = ctx.createRadialGradient(st.x, stSY, 0, st.x, stSY, STONE_R);
            grd2.addColorStop(0.00, 'rgba(0,0,0,1)');    // centro: max visibilidade
            grd2.addColorStop(0.55, 'rgba(0,0,0,0.95)'); // ainda muito brilhante
            grd2.addColorStop(0.82, 'rgba(0,0,0,0.50)'); // dimming suave
            grd2.addColorStop(1.00, 'rgba(0,0,0,0.04)'); // borda: quase escuro
            ctx.fillStyle = grd2;
            ctx.beginPath();
            ctx.arc(st.x, stSY, STONE_R, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
      }
      this._lightCanvas.refresh();
    }

    // ── Flash do bloco-alvo ──────────────────────────────────────────────
    if (this._drillTarget) {
      const { col, row } = this._drillTarget;
      const cs = CELL_SIZE;
      const bx = col * cs;
      const by = GROUND_Y + row * cs;
      // pisca a ~8 Hz usando sin (alpha varia 0.25–0.85)
      const flashAlpha = 0.55 + 0.35 * Math.sin(Date.now() * 0.05);
      this.gfx.fillStyle(0xffffff, flashAlpha);
      this.gfx.fillRect(bx, by, cs, cs);
    }

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

    // HUD oxigênio (primeira linha) + combustível + minerais
    {
      const oxyPct = player.oxygen / player.maxOxygen;
      const secsLeft = Math.ceil((player.oxygen / 100) * 90);
      const m = Math.floor(secsLeft / 60);
      const s = secsLeft % 60;
      const oxyLabel = m > 0 ? `O2 ${m}m ${s < 10 ? '0' : ''}${s}s` : `O2 ${s}s`;
      const oxyColor = oxyPct > 0.5 ? '#22aaff' : oxyPct > 0.25 ? '#ff8800' : '#ff2222';
      this._oxyHudMain.setText(oxyLabel).setColor(oxyColor);
    }
    const fp = Math.ceil(player.fuel);
    this._fuelHud.setText(`⛽ ${fp}%`).setColor(fp > 30 ? '#88ff88' : '#ff6644');
    this._copperHud.setText(`🟠 ${player.copper} Cu`);
    this._ironHud.setText(`🔩 ${player.iron} Fe`);
    this._rkaniumHud.setText(`🔮 ${player.rkanium} Rk`);
    this._stoneHud.setText(player.stones > 0 ? `💡 ${player.stones}x [E]` : '');

    // ── Float texts (animação +1) ─────────────────────────────────────────
    for (let i = this._floatTexts.length - 1; i >= 0; i--) {
      const ft = this._floatTexts[i];
      ft.life -= delta;
      ft.text.y -= ft.vy * (delta / 16);
      ft.text.setAlpha(Math.max(0, ft.life / ft.maxLife));
      if (ft.life <= 0) { ft.text.destroy(); this._floatTexts.splice(i, 1); }
    }

    // ── Pedra de iluminação: segura [E] para carregar, solta para lançar ────
    {
      const STONE_GRAV  = 0.35;
      const CHARGE_DUR  = 1100; // ms para carga máxima
      this._throwGfx.clear();
      const throwCamY = this.cameras.main.scrollY;
      const mx = this.input.activePointer.x;
      const my = this.input.activePointer.y + throwCamY; // coords mundo
      const originX = player.x;
      const originY = player.y - player.baseH * 0.5;

      if (this._eKey.isDown && player.stones > 0 && !shopOpen) {
        this._stoneCharging = true;
        this._stoneCharge   = Math.min(1, this._stoneCharge + delta / CHARGE_DUR);

        // Direção e velocidade de lançamento
        const dx   = mx - originX;
        const dy   = my - originY;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const spd  = 2 + this._stoneCharge * 13;
        const lvx  = (dx / dist) * spd;
        const lvy  = (dy / dist) * spd;

        // Trajetória prevista
        let tx = originX, ty = originY;
        let tvx = lvx,    tvy = lvy;
        for (let i = 0; i < 65; i++) {
          tx += tvx; ty += tvy;
          tvy = Math.min(tvy + STONE_GRAV, 12);
          tvx *= 0.998;
          const tCol = Math.floor(tx / CELL_SIZE);
          const tRow = Math.floor((ty - GROUND_Y) / CELL_SIZE);
          if (tRow >= 0 && this._terrain.isSolid(tCol, tRow)) break;
          const alpha   = (1 - i / 65) * 0.9;
          const dotR    = 1 + (1 - i / 65) * 2.5;
          this._throwGfx.fillStyle(0xffe066, alpha);
          this._throwGfx.fillCircle(tx, ty, dotR);
        }

        // Barra de carga acima da cabeça
        const barW = 42;
        const barH = 5;
        const barX = originX - barW / 2;
        const barY = player.y - player.baseH - 22;
        this._throwGfx.fillStyle(0x111111, 0.75);
        this._throwGfx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
        const barColor = this._stoneCharge > 0.7 ? 0xff6600 : 0xffe066;
        this._throwGfx.fillStyle(barColor, 0.95);
        this._throwGfx.fillRect(barX, barY, barW * this._stoneCharge, barH);

      } else if (this._stoneCharging) {
        // E foi solto → lança
        this._stoneCharging = false;
        if (player.stones > 0 && this._stoneCharge > 0.04) {
          player.stones -= 1;
          const dx   = mx - originX;
          const dy   = my - originY;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const spd  = 2 + this._stoneCharge * 13;
          this._placedStones.push({
            x: originX, y: originY,
            vx: (dx / dist) * spd,
            vy: (dy / dist) * spd,
          });
        }
        this._stoneCharge = 0;
      } else {
        this._stoneCharge = 0;
      }
    }

    // ── Ativar Radar de Sonar [R] ─────────────────────────────────────────
    if (Phaser.Input.Keyboard.JustDown(this._rKey) && !shop.visible
        && player.hasRadar && !this._sonarWave && player.fuel >= 10) {
      player.drainFuel(10);
      this._sonarWave = {
        sx:   player.x,
        sy:   player.y - player.baseH * 0.5,
        r:    0,
        maxR: 400,
      };
      this._sonarPings = [];  // limpa pings anteriores
    }

    // ── Atualizar e desenhar sonar ────────────────────────────────────────
    this._sonarGfx.clear();
    if (this._sonarWave) {
      const sw = this._sonarWave;
      sw.r += 0.9 * delta;  // ~360ms para raio total de 400px
      const camY2 = this.cameras.main.scrollY;
      const screenX = sw.sx;
      const screenY = sw.sy - camY2;
      const progress = sw.r / sw.maxR;
      const alpha = Math.max(0, 1 - progress) * 0.9;
      // Anel expansivo
      this._sonarGfx.lineStyle(2, 0x00e5ff, alpha);
      this._sonarGfx.strokeCircle(screenX, screenY, sw.r);
      // Anel mais fino atrás (eco)
      if (sw.r > 40) {
        this._sonarGfx.lineStyle(1, 0x00e5ff, alpha * 0.4);
        this._sonarGfx.strokeCircle(screenX, screenY, sw.r - 30);
      }

      if (sw.r >= sw.maxR) {
        // Sonar completo: escaneia células em raio e regista pings
        const GROUND_Y_LOCAL = GROUND_Y;
        const cs = CELL_SIZE;
        const terrain = this._terrain;
        const cx = sw.sx, cy = sw.sy;
        const rCells = Math.ceil(sw.maxR / cs) + 1;
        const centerCol = Math.floor(cx / cs);
        const centerRow = Math.floor((cy - GROUND_Y_LOCAL) / cs);
        for (let dr = -rCells; dr <= rCells; dr++) {
          for (let dc = -rCells; dc <= rCells; dc++) {
            const col = centerCol + dc;
            const row = centerRow + dr;
            if (row < 0 || col < 0 || col >= terrain.cols || row >= terrain.rows) continue;
            const cellType = terrain.cells[row][col];
            if (cellType !== 2 && cellType !== 3 && cellType !== 4) continue;
            const wx = col * cs + cs / 2;
            const wy = GROUND_Y_LOCAL + row * cs + cs / 2;
            const dist = Math.hypot(wx - cx, wy - cy);
            if (dist <= sw.maxR) {
              this._sonarPings.push({ wx, wy, phase: Math.random() * Math.PI * 2, life: 3000, maxLife: 3000 });
            }
          }
        }
        this._sonarWave = null;
      }
    }

    // Atualiza e desenha pings do sonar (desaparecem após 3 segundos)
    for (let i = this._sonarPings.length - 1; i >= 0; i--) {
      this._sonarPings[i].life -= delta;
      if (this._sonarPings[i].life <= 0) { this._sonarPings.splice(i, 1); }
    }
    if (this._sonarPings.length > 0) {
      const camY3 = this.cameras.main.scrollY;
      for (const ping of this._sonarPings) {
        const screenX = ping.wx;
        const screenY = ping.wy - camY3;
        if (screenY < -20 || screenY > H + 20) continue;
        const fadeAlpha = Math.max(0, ping.life / ping.maxLife);
        const blink = 0.45 + 0.55 * Math.sin(Date.now() * 0.003 + ping.phase);
        this._sonarGfx.fillStyle(0x00e5ff, blink * 0.9 * fadeAlpha);
        this._sonarGfx.fillCircle(screenX, screenY, 3);
        // Cruz pequena
        this._sonarGfx.lineStyle(1, 0x00e5ff, blink * 0.6 * fadeAlpha);
        this._sonarGfx.lineBetween(screenX - 5, screenY, screenX + 5, screenY);
        this._sonarGfx.lineBetween(screenX, screenY - 5, screenX, screenY + 5);
      }
    }

    // Temporizador de jogo
    this._worldTime += delta;
    {
      const DAY_MS  = 10 * 60 * 1000;   // 10 minutos por dia
      const HOUR_MS = DAY_MS / 24;      // ~25 s por hora de jogo
      const totalMs = this._worldTime;
      const day  = Math.floor(totalMs / DAY_MS) + 1;
      const hour = Math.floor((totalMs % DAY_MS) / HOUR_MS);
      this._timeHud.setText(`Dia ${day}  ${String(hour).padStart(2, '0')}h`);
    }

    // Altitude
    const metersFromGround = Math.round((GROUND_Y - player.y) / 10);
    if (metersFromGround >= 0) {
      this._altHud.setText(`⬆ ${metersFromGround}m do chão`).setColor('#88ddff');
    } else {
      this._altHud.setText(`⬇ ${Math.abs(metersFromGround)}m subsolo`).setColor('#ff8844');
    }
    // Posiciona temporizador à esquerda do medidor de altitude
    this._timeHud.setX(W - 12 - this._altHud.width - 14);

    // Prompt da mesa de ferramentas
    const wb = this._workbench;
    const nearVendor = this._qx === 0 &&
                       Math.abs(player.x - wb.x) < wb.interactDist &&
                       Math.abs(player.y - wb.y) < 100;

    // ── Cabo carregador ────────────────────────────────────────────────────
    const capsuleDist = Math.hypot(player.x - wb.x, player.y - wb.y);
    const nearCapsule = this._qx === 0 && capsuleDist < this._CABLE_MAX_DIST;

    // Desconecta automaticamente se afastar demais
    if (this._cableConnected && capsuleDist > this._CABLE_MAX_DIST) {
      this._cableConnected = false;
    }

    // Conecta/desconecta ao pressionar H
    if (Phaser.Input.Keyboard.JustDown(this._hKey) && !shopOpen) {
      if (nearCapsule && !this._cableConnected) {
        this._cableConnected = true;
        this._snd.sfxPlug();
      } else if (this._cableConnected) {
        this._cableConnected = false;
      }
    }

    // Usa med-kit [Q]
    if (Phaser.Input.Keyboard.JustDown(this._qKey) && !shopOpen
        && !player.medkitActive && player.medkits > 0) {
      player.medkits--;
      player.medkitActive    = true;
      player.medkitTimer     = 6000;
      player.medkitTickTimer = 1000;
    }

    // Carregamento — consome bateria da cápsula
    if (this._cableConnected && player.fuel < player.maxFuel && wb.battery > 0) {
      const charge = this._CHARGE_RATE * delta;
      player.fuel  = Math.min(player.maxFuel, player.fuel + charge);
      // 1 unidade de bateria = 1% de combustível carregado
      wb.battery   = Math.max(0, wb.battery - charge);
      if (wb.battery <= 0) this._cableConnected = false;
    }

    // ── Oxigênio ──────────────────────────────────────────────────────────
    if (!this._gameOverActive && this._wakeupDone) {
      if (this._cableConnected) {
        // Cabo conectado: regenera oxigênio (consome reserva da cápsula)
        const oxyGain = Math.min(
          this._OXY_REGEN * delta,
          player.maxOxygen - player.oxygen,
          wb.oxygen
        );
        player.oxygen = Math.min(player.maxOxygen, player.oxygen + oxyGain);
        wb.oxygen     = Math.max(0, wb.oxygen - oxyGain);
      } else {
        // Sempre consome oxigênio (ambiente lunar hostil)
        player.oxygen = Math.max(0, player.oxygen - this._OXY_DRAIN * delta);
        if (player.oxygen <= 0) {
          this._triggerGameOver();
        }
      }
    }

    // ── Game over timer ───────────────────────────────────────────────────
    if (this._gameOverActive) {
      this._gameOverTimer -= delta;
      if (this._gameOverTimer <= 0) {
        this.scene.restart();
      }
      return;  // congela o resto do update
    }

    // Desenha cabo
    this._cableGfx.clear();
    if (this._cableConnected) {
      const cx = wb.x + 2, cy = wb.y - 10;  // ponto de saída da cápsula
      const px = player.x, py = player.y - 10;
      const mx = (cx + px) / 2, my = Math.max(cy, py) + 18;  // curva para baixo
      // Sombra do cabo
      this._cableGfx.lineStyle(3, 0x004422, 0.40);
      this._cableGfx.beginPath();
      this._cableGfx.moveTo(cx, cy + 1);
      this._cableGfx.lineTo(mx, my + 2);
      this._cableGfx.lineTo(px, py + 1);
      this._cableGfx.strokePath();
      // Cabo principal (verde-elétrico)
      this._cableGfx.lineStyle(2, 0x44ff99, 0.90);
      this._cableGfx.beginPath();
      this._cableGfx.moveTo(cx, cy);
      this._cableGfx.lineTo(mx, my);
      this._cableGfx.lineTo(px, py);
      this._cableGfx.strokePath();
      // Brilho pulsante no conector do jogador
      const pulse = 0.55 + 0.45 * Math.sin(Date.now() * 0.006);
      this._cableGfx.fillStyle(0x44ff99, pulse);
      this._cableGfx.fillCircle(px, py, 4);
      this._cableGfx.fillStyle(0xaaffdd, pulse * 0.6);
      this._cableGfx.fillCircle(px, py, 7);
    }

    // Barras de bateria e oxigênio da cápsula (apenas no quadrante inicial)
    if (this._qx === 0) {
      const bx = wb.x, bw = 60, bh = 7;

      // ── Bateria ──
      const batY  = wb.y - 88;
      const batPct = wb.battery / wb.maxBattery;
      const batColor = batPct > 0.50 ? 0x44dd88 : batPct > 0.20 ? 0xffcc22 : 0xff4422;
      this._cableGfx.fillStyle(0x111111, 0.75);
      this._cableGfx.fillRoundedRect(bx - bw / 2 - 1, batY - 1, bw + 2, bh + 2, 2);
      this._cableGfx.fillStyle(batColor, 0.95);
      this._cableGfx.fillRoundedRect(bx - bw / 2, batY, Math.max(0, bw * batPct), bh, 2);
      this._cableGfx.lineStyle(1, 0x88ffcc, 0.55);
      this._cableGfx.strokeRoundedRect(bx - bw / 2 - 1, batY - 1, bw + 2, bh + 2, 2);
      if (!this._capsuleBatHud) {
        this._capsuleBatHud = this.add.text(0, 0, '', {
          fontFamily: 'monospace', fontSize: '10px', color: '#88ffcc',
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5).setDepth(4);
      }
      this._capsuleBatHud.setText(`🔋 ${Math.ceil(wb.battery)}`);
      this._capsuleBatHud.setPosition(bx + bw / 2 + 5, batY + bh / 2);

      // ── Oxigênio ──
      const oxyY   = wb.y - 76;
      const oxyPct = wb.oxygen / wb.maxOxygen;
      const oxyColor = oxyPct > 0.50 ? 0x44bbff : oxyPct > 0.20 ? 0xffcc22 : 0xff4422;
      this._cableGfx.fillStyle(0x111111, 0.75);
      this._cableGfx.fillRoundedRect(bx - bw / 2 - 1, oxyY - 1, bw + 2, bh + 2, 2);
      this._cableGfx.fillStyle(oxyColor, 0.95);
      this._cableGfx.fillRoundedRect(bx - bw / 2, oxyY, Math.max(0, bw * oxyPct), bh, 2);
      this._cableGfx.lineStyle(1, 0x88ccff, 0.55);
      this._cableGfx.strokeRoundedRect(bx - bw / 2 - 1, oxyY - 1, bw + 2, bh + 2, 2);
      if (!this._capsuleOxyHud) {
        this._capsuleOxyHud = this.add.text(0, 0, '', {
          fontFamily: 'monospace', fontSize: '10px', color: '#88ccff',
          stroke: '#000', strokeThickness: 2,
        }).setOrigin(0, 0.5).setDepth(4);
      }
      this._capsuleOxyHud.setText(`🫁 ${Math.ceil(wb.oxygen)}`);
      this._capsuleOxyHud.setPosition(bx + bw / 2 + 5, oxyY + bh / 2);
    }

    // Prompts [L] e [H] na mesma linha, acima da barra
    const capsuleDist2 = Math.hypot(player.x - wb.x, player.y - wb.y);
    const showPrompts  = this._qx === 0 && (nearVendor || this._cableConnected || capsuleDist2 < this._CABLE_MAX_DIST) && !shopOpen;
    this._vPrompt.setVisible(showPrompts);
    this._cablePrompt.setVisible(false);  // fundido no _vPrompt
    if (showPrompts) {
      const cableLabel = this._cableConnected ? `⚡[H] desconectar` : `[H] cabo`;
      this._vPrompt
        .setText(`[L] Mesa  |  ${cableLabel}`)
        .setPosition(wb.x, wb.y - 140);
    }

    // Abrir/fechar mesa
    if (Phaser.Input.Keyboard.JustDown(this._lKey) && nearVendor) {
      const wasOpen = shop.visible;
      shop.toggle();
      if (!wasOpen) this._snd.sfxShopOpen();
      else          this._snd.sfxShopClose();
    }
    // Lanterna [T]
    if (this._tJustDown && !shopOpen) {
      this._tJustDown = false;
      if (player.lanterns > 0) {
        player.lanternOn = !player.lanternOn;
        if (player.lanternOn) {
          // desliga escavadeira
          player.hasDrill    = false;
          player.isDrillingH = false;
          player.drillDirX   = 1; player.drillDirY = 0;
          this._drillTarget  = null;
          this._mineTimerH   = 0;
        }
      }
    }
    this._tJustDown = false;

    // Inventário [I]
    if (Phaser.Input.Keyboard.JustDown(this._iKey) && !shop.visible && !this.missionLog.visible && !this.mapView.visible) {
      this.inventory.toggle();
    }
    // Relatório da missão [J]
    if (Phaser.Input.Keyboard.JustDown(this._jKey) && !shop.visible && !this.inventory.visible && !this.mapView.visible) {
      this.missionLog.toggle();
    }
    // Mapa [M]
    if (Phaser.Input.Keyboard.JustDown(this._mKey) && !shop.visible && !this.inventory.visible && !this.missionLog.visible) {
      this.mapView.toggle();
    }
    if (Phaser.Input.Keyboard.JustDown(this._escKey)) {
      if (shop.visible) this._snd.sfxShopClose();
      shop.close();
      this.inventory.close();
      this.missionLog.close();
      this.mapView.close();
    }

    // ── Slot de equipamento ativo (rodapé) ──────────────────────────────────────────
    {
      const SW = 40, SH = 40;        // slot interno
      const BW = 160, BH = 50;       // barra de fundo
      const bx = W / 2 - BW / 2;
      const by = H - BH;             // encostado na base da tela
      const sx = W / 2 - SW / 2;
      const sy = by + (BH - SH) / 2; // slot centralizado verticalmente na barra

      let icon = '';
      let col  = 0xffffff;
      if (player.hasDrill)                               { icon = '⛏️'; col = 0xe8a060; }
      else if (player.lanternOn && player.lanterns > 0)  { icon = '🔦'; col = 0xffdd88; }

      this._equipGfx.clear();

      // ── Barra de fundo (cantos superiores arredondados, base colada na tela) ──
      const cr = 12;  // raio dos cantos superiores
      this._equipGfx.fillStyle(0x000000, 0.35);
      // sombra
      this._equipGfx.fillRect(bx + 2, by + 2, BW, BH);
      // fundo escuro
      this._equipGfx.fillStyle(0x0b1422, 0.92);
      this._equipGfx.fillRect(bx, by, BW, BH);
      // brilho topo
      this._equipGfx.fillStyle(0x2a4060, 0.30);
      this._equipGfx.fillRect(bx, by, BW, 14);
      // borda — só os três lados superiores + cantos arredondados
      this._equipGfx.lineStyle(2, 0x2a4a70, 0.75);
      this._equipGfx.beginPath();
      this._equipGfx.moveTo(bx, by + BH);
      this._equipGfx.lineTo(bx, by + cr);
      this._equipGfx.arc(bx + cr, by + cr, cr, Math.PI, Math.PI * 1.5);
      this._equipGfx.lineTo(bx + BW - cr, by);
      this._equipGfx.arc(bx + BW - cr, by + cr, cr, Math.PI * 1.5, 0);
      this._equipGfx.lineTo(bx + BW, by + BH);
      this._equipGfx.strokePath();

      // ── Slot interno ──────────────────────────────────────────────────────
      // sombra do slot
      this._equipGfx.fillStyle(0x000000, 0.50);
      this._equipGfx.fillRoundedRect(sx - 1, sy + 2, SW + 2, SH + 2, 10);
      // fundo slot
      this._equipGfx.fillStyle(0x0d1a28, 0.95);
      this._equipGfx.fillRoundedRect(sx, sy, SW, SH, 10);
      // brilho topo slot
      this._equipGfx.fillStyle(0x1e3048, 0.45);
      this._equipGfx.fillRoundedRect(sx, sy, SW, SH * 0.40, 10);
      // borda slot
      const borderCol = icon ? col : 0x2a3a50;
      this._equipGfx.lineStyle(2, borderCol, icon ? 0.88 : 0.40);
      this._equipGfx.strokeRoundedRect(sx, sy, SW, SH, 10);
      // glow externo quando ativo
      if (icon) {
        this._equipGfx.lineStyle(5, col, 0.15);
        this._equipGfx.strokeRoundedRect(sx - 3, sy - 3, SW + 6, SH + 6, 13);
      }

      if (icon) {
        this._equipText.setText(icon)
          .setPosition(W / 2, sy + SH / 2).setVisible(true);
      } else {
        this._equipText.setVisible(false);
      }
    }

    shop.update(delta);
    this.inventory.update();
    this.missionLog.update();
    this.mapView.update();
  }

  // ── Fundo do céu (fixo na tela) ────────────────────────────────────────────
  _triggerGameOver() {
    if (this._gameOverActive) return;
    this._gameOverActive = true;
    this._gameOverTimer  = 3000;  // 3s antes de reiniciar
    this._gameOverGfx.setVisible(true);
    this._gameOverGfx.fillStyle(0x000000, 0.72);
    this._gameOverGfx.fillRect(0, 0, this.game.config.width, this.game.config.height);
    this._gameOverText.setVisible(true);
    this._gameOverSub.setVisible(true);
    // Para sons
    this._snd.sfxDigStop();
  }

  // ── Transição entre quadrantes ────────────────────────────────────────────
  _startTransition(newQx, dir) {
    this._transitioning = true;
    this._transitionOut = true;
    const savedY  = this.player.y;
    const savedVy = this.player.vy;
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this._loadQuadrant(newQx);
      this.player.x  = dir === 'right' ? 24 : W - 24;
      // Preserva profundidade: tenta voltar ao mesmo Y;
      // se houver bloco sólido na posição, cai até encontrar chão livre
      this.player.y  = savedY;
      this.player.vy = Math.max(0, savedVy);  // não sobe ao entrar
      this.player.vx = 0;
      this.player.isOnGround = false;  // deixa a física resolver
      this.cameras.main.scrollY = Phaser.Math.Clamp(savedY - H * 0.5, 0, WORLD_H - H);
      this._transitionOut = false;
      this.cameras.main.fadeIn(300, 0, 0, 0);
      this.cameras.main.once('camerafadeincomplete', () => {
        this._transitioning = false;
      });
    });
  }

  _loadQuadrant(qx) {
    // Guarda o terreno actual antes de sair
    this._terrainCache.set(this._qx, this._terrain);
    this._alienCache.set(this._qx, this._aliens);

    this._qx = qx;
    this._visitedQuadrants.add(String(qx));
    // Restaura terreno já escavado, ou cria novo se for a primeira visita
    if (this._terrainCache.has(qx)) {
      this._terrain = this._terrainCache.get(qx);
    } else {
      const colsPerQ = Math.ceil(W / CELL_SIZE);
      this._terrain  = new TerrainGrid(GROUND_Y, WORLD_H, W, CELL_SIZE, qx * colsPerQ);
    }

    // Restaura aliens ou gera novos
    if (this._alienCache.has(qx)) {
      this._aliens = this._alienCache.get(qx);
    } else {
      this._aliens = this._spawnAliens(this._terrain);
    }
    // Limpa estado específico do quadrante
    this._placedStones   = [];
    this._stoneGfx.clear();
    this._sonarPings     = [];
    this._sonarWave      = null;
    this._drillTarget    = null;
    this._mineTimerH     = 0;
    if (this._drillingAudioH) { this._snd.sfxDigStop(); this._drillingAudioH = false; }
    this._cableConnected = false;
    // Mesa de ferramentas e bateria apenas no quadrante inicial
    this._workbenchGfx.setVisible(qx === 0);
    if (this._capsuleBatHud)  this._capsuleBatHud.setVisible(qx === 0);
    if (this._capsuleOxyHud)  this._capsuleOxyHud.setVisible(qx === 0);
    if (this._capsuleLabel)   this._capsuleLabel.setVisible(qx === 0);
  }

  _spawnAliens(terrain) {
    const aliens = [];
    for (let i = 0; i < terrain.caves.length; i++) {
      const cave = terrain.caves[i];
      if (cave.type === 'small') continue;
      const count = cave.type === 'large' ? 2 : 1;
      for (let j = 0; j < count; j++) {
        const offsetX = count === 2 ? (j === 0 ? -CELL_SIZE : CELL_SIZE) : 0;
        const al = new Alien(cave.wx + offsetX, cave.wy);
        al.facing    = j === 0 ? 1 : -1;
        al.patrolDir = al.facing;
        aliens.push(al);
      }
    }
    return aliens;
  }

  _spawnFloatText(wx, wy, msg, color = '#ffffff') {
    const camY = this.cameras.main.scrollY;
    const t = this.add.text(wx, wy - camY - 20, msg, {
      fontFamily: 'monospace', fontSize: '13px', color,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(15).setScrollFactor(0);
    this._floatTexts.push({ text: t, vy: 0.9, life: 900, maxLife: 900 });
  }

  _drawBackground(camY = 0, time = 0) {
    const g = this._bg;
    g.clear();

    const surfY = GROUND_Y - camY;  // Y da superfície em coords de ecrã

    // ── Céu (acima da superfície) ───────────────────────────────────
    const skyH = Math.max(0, Math.min(surfY, H));
    if (skyH > 0) {
      g.fillGradientStyle(0x060b18, 0x060b18, 0x0a1428, 0x0a1428, 1);
      g.fillRect(0, 0, W, skyH);

      // Estrelas com parallax vertical suave
      if (this._starData) {
        const starOff = camY * 0.08;  // acompanha parallax leve
        for (const s of this._starData) {
          const sy = s.y - starOff % H;
          if (sy < 0 || sy >= skyH) continue;
          const twinkle = 0.55 + 0.45 * Math.sin(time * 0.0015 + s.twinkle);
          g.fillStyle(0xffffff, twinkle);
          g.fillCircle(s.x, sy, s.r);
        }
      }

      // Lua (só visível se a área do céu for alta o suficiente)
      if (skyH > 70) {
        g.fillStyle(0xfffde0, 0.92);
        g.fillCircle(W - 80, 55, 28);
        g.fillStyle(0x060b18, 1);
        g.fillCircle(W - 68, 50, 22);
      }
    }

    // ── Caverna (abaixo da superfície) ───────────────────────────────
    const caveTop = Math.max(0, surfY);
    const caveH   = H - caveTop;
    if (caveH > 0) {
      // Fundo base: rocha cinzenta
      g.fillGradientStyle(0x454545, 0x454545, 0x383838, 0x383838, 1);
      g.fillRect(0, caveTop, W, caveH);

      // Veias e manchas determinísticas: tons cinzentos variados
      const rng = new Phaser.Math.RandomDataGenerator(['cave_bg']);
      for (let i = 0; i < 28; i++) {
        const vx  = rng.between(0, W);
        const vy  = rng.between(caveTop, H);
        const vw  = rng.between(18, 90);
        const vh  = rng.between(8, 32);
        const col = rng.pick([0x3a3a3a, 0x1e1e1e, 0x333333, 0x404040, 0x2a2a2a]);
        g.fillStyle(col, rng.realInRange(0.25, 0.60));
        g.fillEllipse(vx, vy, vw, vh);
      }
    }
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

  // ── Placa do vendedor (removida)
  _drawVendorSign() {}

  // ── Cápsula de emergência (caiu na superfície, lado esquerdo) ──────────
  _drawWorkbench() {
    const g = this._workbenchGfx;
    const x = WORKBENCH_X;
    const y = GROUND_Y;

    // ── Marca de impacto no chão ──────────────────────────────────────────
    g.fillStyle(0x1a0d00, 0.70);
    g.fillEllipse(x + 8, y - 2, 130, 14);
    g.fillStyle(0x2d1500, 0.40);
    g.fillEllipse(x + 4, y - 1, 90, 8);

    // ── Sulcos de aterragem ────────────────────────────────────────────────
    g.lineStyle(2, 0x1a0d00, 0.6);
    g.lineBetween(x - 55, y - 1, x - 10, y - 1);
    g.lineBetween(x + 20, y - 1, x + 65, y - 1);

    // ── Corpo da cápsula (óvalo metálico, ligeiramente inclinada) ─────────
    const tx = 7;   // deslocamento horizontal do topo (inclinação)
    const bw = 42, bh = 52;

    // Casco exterior (cinza escuro)
    g.fillStyle(0x3e4452, 1);
    g.fillPoints([
      { x: x - bw / 2 + tx, y: y - bh },
      { x: x + bw / 2 + tx, y: y - bh },
      { x: x + bw / 2,      y: y },
      { x: x - bw / 2,      y: y },
    ], true);

    // Domo superior (meio-elipse — parte mais clara)
    g.fillStyle(0x6a7284, 1);
    g.fillEllipse(x + tx, y - bh, bw + 6, 24);

    // Painel lateral esquerdo (dano de impacto — motim)
    g.fillStyle(0x2a2f3a, 1);
    g.fillPoints([
      { x: x - bw / 2 + tx + 2, y: y - bh + 6 },
      { x: x - bw / 2 + tx + 10, y: y - bh + 8 },
      { x: x - bw / 2 + 8,       y: y - 14 },
      { x: x - bw / 2 + 2,       y: y - 12 },
    ], true);

    // Linhas de painel estrutural
    g.lineStyle(1, 0x2a2f3a, 0.9);
    g.lineBetween(x - 12 + tx * 0.5, y - bh + 10, x - 12, y - 6);
    g.lineBetween(x + 14 + tx * 0.5, y - bh + 10, x + 14, y - 6);
    g.lineBetween(x      + tx * 0.3, y - bh + 14, x,      y - 6);

    // ── Escotilha aberta (pivoted atrás) ───────────────────────────────────
    // Painéis da escotilha — um aberto para a esquerda, inclinado
    g.fillStyle(0x505868, 1);
    g.fillPoints([
      { x: x + tx - 2,  y: y - bh + 6 },   // dobradiça sup
      { x: x + tx + 14, y: y - bh + 6 },
      { x: x + tx + 10, y: y - bh - 24 },   // ponta do painel aberto
      { x: x + tx - 6,  y: y - bh - 24 },
    ], true);
    // Interior escuro da escotilha
    g.fillStyle(0x0a0c12, 1);
    g.fillRect(x + tx - 1, y - bh + 7, 14, 20);
    // Cabo da escotilha
    g.fillStyle(0x888a95, 1);
    g.fillRect(x + tx + 4, y - bh + 9, 3, 14);

    // ── Visor lateral (olho da cápsula) ────────────────────────────────────
    g.fillStyle(0x112255, 0.95);
    g.fillEllipse(x + tx + 12, y - bh * 0.50, 14, 10);
    g.lineStyle(2, 0x6688bb, 1);
    g.strokeEllipse(x + tx + 12, y - bh * 0.50, 14, 10);
    // Reflexo
    g.fillStyle(0x4466cc, 0.35);
    g.fillEllipse(x + tx + 10, y - bh * 0.50 - 2, 6, 4);

    // ── Faixas de aviso (laranja/preto) ────────────────────────────────────
    for (let i = 0; i < 5; i++) {
      g.fillStyle(i % 2 === 0 ? 0xff8800 : 0x1a1a1a, 1);
      g.fillRect(x - bw / 2 + 3 + i * 8, y - 11, 7, 9);
    }

    // ── Luz de aviso (vermelha pulsante — estática laranja) ────────────────
    g.fillStyle(0xff2200, 1);
    g.fillCircle(x - bw / 2 + tx + 1, y - bh + 4, 4);
    g.fillStyle(0xff6644, 0.30);
    g.fillCircle(x - bw / 2 + tx + 1, y - bh + 4, 8);

    // ── Destroços ao redor ─────────────────────────────────────────────────
    g.fillStyle(0x5a5e68, 1);
    g.fillRect(x + 52, y - 7, 10, 4);
    g.fillPoints([
      { x: x + 64, y: y - 4 },
      { x: x + 74, y: y - 13 },
      { x: x + 76, y: y - 10 },
      { x: x + 66, y: y - 2 },
    ], true);
    g.fillStyle(0x484c56, 1);
    g.fillRect(x - 60, y - 6, 12, 4);
    g.fillRect(x + 40, y - 4, 7, 3);
    // Fragmento de painel
    g.fillPoints([
      { x: x - 62, y: y - 6 },
      { x: x - 50, y: y - 12 },
      { x: x - 48, y: y - 9 },
      { x: x - 60, y: y - 3 },
    ], true);

    // ── Fumaça (círculos semi-transparentes) ──────────────────────────────
    g.fillStyle(0x888888, 0.12);
    g.fillCircle(x + tx - 5, y - bh - 10, 14);
    g.fillStyle(0x666666, 0.08);
    g.fillCircle(x + tx,     y - bh - 22, 10);

    // ── Label flutuante ────────────────────────────────────────────────────
    this._capsuleLabel = this.add.text(x + 8, y - bh - 52, '🚨 Cápsula de Emergência', {
      fontFamily: 'monospace', fontSize: '11px', color: '#ff8844',
      stroke: '#000', strokeThickness: 2,
      backgroundColor: '#1a0800',
      padding: { x: 5, y: 3 },
    }).setOrigin(0.5).setDepth(3);
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

    // Helper: criar linha label + slider + valor + mute
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

      // Botão mute inline
      let muted = false, savedVol = null;
      const muteBtn = document.createElement('button');
      muteBtn.textContent = '🔔';
      css(muteBtn, {
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '16px', padding: '0 2px', lineHeight: '1',
      });
      muteBtn.title = 'Mute';
      muteBtn.addEventListener('click', () => {
        muted = !muted;
        if (muted) {
          savedVol = Number(slider.value) / 100;
          onChange(0);
          slider.value = '0';
          val.textContent = '0%';
          muteBtn.textContent = '🔕';
        } else {
          const v = savedVol ?? 0.5;
          onChange(v);
          slider.value = String(Math.round(v * 100));
          val.textContent = slider.value + '%';
          muteBtn.textContent = '🔔';
        }
      });

      slider.addEventListener('input', () => {
        val.textContent = slider.value + '%';
        onChange(Number(slider.value) / 100);
        if (muted && slider.value !== '0') { muted = false; muteBtn.textContent = '🔔'; }
      });

      row.append(lbl, slider, val, muteBtn);
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

