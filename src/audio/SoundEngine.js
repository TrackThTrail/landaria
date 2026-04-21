/**
 * SoundEngine — áudio procedural via Web Audio API.
 * Não requer arquivos externos.
 */
export class SoundEngine {
  constructor() {
    this._ctx        = null;
    this._masterMusic = null;  // GainNode só da música
    this._masterSfx   = null;  // GainNode só dos SFX
    this._master      = null;  // GainNode de destino final
    this._musicVol    = 0.45;
    this._sfxVol      = 0.55;
    this._walkTimer   = 0;
    this._walkInterval = 330;
    this._digLoop     = null;  // nós do loop contínuo de escavação
  }

  init() {
    if (this._ctx) return;
    this._ctx         = new AudioContext();
    this._master      = this._ctx.createGain();
    this._master.gain.value = 1.0;
    this._master.connect(this._ctx.destination);

    this._masterMusic = this._ctx.createGain();
    this._masterMusic.gain.value = this._musicVol;
    this._masterMusic.connect(this._master);

    this._masterSfx = this._ctx.createGain();
    this._masterSfx.gain.value = this._sfxVol;
    this._masterSfx.connect(this._master);

    this._startAmbient();
  }

  setMusicVolume(v) {
    this._musicVol = v;
    if (this._masterMusic) this._masterMusic.gain.setTargetAtTime(v, this._ctx.currentTime, 0.05);
  }

  setSfxVolume(v) {
    this._sfxVol = v;
    if (this._masterSfx) this._masterSfx.gain.setTargetAtTime(v, this._ctx.currentTime, 0.05);
  }

  getMusicVolume() { return this._musicVol; }
  getSfxVolume()   { return this._sfxVol; }


  // ── SFX públicas ─────────────────────────────────────────────────────────

  sfxJump() {
    this._tone({ type: 'sine',   freq: 220, endFreq: 520, dur: 0.18, vol: 0.18, attack: 0.005 });
  }

  sfxLand() {
    this._noise({ dur: 0.09, vol: 0.10, freq: 90 });
  }

  sfxParachute() {
    this._tone({ type: 'sine', freq: 380, endFreq: 180, dur: 0.35, vol: 0.14, attack: 0.04 });
    setTimeout(() => this._tone({ type: 'sine', freq: 200, endFreq: 120, dur: 0.25, vol: 0.08, attack: 0.02 }), 250);
  }

  sfxStep() {
    this._noise({ dur: 0.06, vol: 0.07, freq: 60 });
  }

  /** Pulsos rítmicos "tchk tchk tchk" — chame ao começar a escavar. */
  sfxDigStart() {
    if (!this._ctx || this._digLoop) return;
    const ctx = this._ctx;

    const fireTchk = () => {
      if (!this._ctx) return;
      const now = ctx.currentTime;

      // "tchk" — burst de ruído metálico seco e curto
      const size = ctx.sampleRate * 0.055;
      const buf  = ctx.createBuffer(1, size, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

      const src  = ctx.createBufferSource();
      src.buffer = buf;

      const flt = ctx.createBiquadFilter();
      flt.type            = 'bandpass';
      flt.frequency.value = 3200;  // brilhante, clique de picareta
      flt.Q.value         = 3.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      src.connect(flt); flt.connect(gain); gain.connect(this._masterSfx);
      src.start(now); src.stop(now + 0.06);

      // toque grave seco junto ("tchk" mais encorpado)
      const body     = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      body.type = 'sine';
      body.frequency.setValueAtTime(200, now);
      body.frequency.exponentialRampToValueAtTime(60, now + 0.055);
      bodyGain.gain.setValueAtTime(0.12, now);
      bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
      body.connect(bodyGain); bodyGain.connect(this._masterSfx);
      body.start(now); body.stop(now + 0.06);
    };

    fireTchk();  // dispara imediatamente
    const id = setInterval(fireTchk, 270);  // ~3.7 tchks/s
    this._digLoop = { id };
  }

  /** Para os pulsos de escavação. */
  sfxDigStop() {
    if (!this._digLoop) return;
    clearInterval(this._digLoop.id);
    this._digLoop = null;
  }

  /** Inicia o som contínuo do jetpack (hiss + rumble). */
  sfxJetpackStart() {
    if (!this._ctx || this._jetpackLoop) return;
    const ctx = this._ctx;

    const bufSize = ctx.sampleRate * 2;
    const buf     = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data    = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const src  = ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;

    const flt = ctx.createBiquadFilter();
    flt.type            = 'bandpass';
    flt.frequency.value = 700;
    flt.Q.value         = 0.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.12);

    const rumble     = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = 'sawtooth';
    rumble.frequency.value = 70;
    rumbleGain.gain.setValueAtTime(0, ctx.currentTime);
    rumbleGain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.12);

    src.connect(flt); flt.connect(gain); gain.connect(this._masterSfx);
    rumble.connect(rumbleGain); rumbleGain.connect(this._masterSfx);
    src.start();
    rumble.start();

    this._jetpackLoop = { src, rumble, gain, rumbleGain };
  }

  /** Para o som do jetpack com fade-out. */
  sfxJetpackStop() {
    if (!this._ctx || !this._jetpackLoop) return;
    const { src, rumble, gain, rumbleGain } = this._jetpackLoop;
    const now = this._ctx.currentTime;
    gain.gain.setTargetAtTime(0, now, 0.08);
    rumbleGain.gain.setTargetAtTime(0, now, 0.08);
    setTimeout(() => { try { src.stop(); rumble.stop(); } catch (_) {} }, 400);
    this._jetpackLoop = null;
  }

  /** Thud pesado ao cair de grande altura. */
  sfxFallDamage() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // Impacto grave — "THUD" corporal
    const body     = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(120, now);
    body.frequency.exponentialRampToValueAtTime(28, now + 0.25);
    bodyGain.gain.setValueAtTime(0.55, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    body.connect(bodyGain); bodyGain.connect(this._masterSfx);
    body.start(now); body.stop(now + 0.30);

    // Ruído de impacto — "crack" de ossos
    const size = ctx.sampleRate * 0.12;
    const buf  = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const nSrc  = ctx.createBufferSource();
    nSrc.buffer = buf;
    const nFlt  = ctx.createBiquadFilter();
    nFlt.type = 'bandpass'; nFlt.frequency.value = 400; nFlt.Q.value = 0.8;
    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.30, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    nSrc.connect(nFlt); nFlt.connect(nGain); nGain.connect(this._masterSfx);
    nSrc.start(now); nSrc.stop(now + 0.14);
  }

  sfxDigImpact() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // crack seco — ruído de alta freq com decay curto
    const size = ctx.sampleRate * 0.10;
    const buf  = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const cracSrc  = ctx.createBufferSource();
    cracSrc.buffer = buf;
    const cracFlt  = ctx.createBiquadFilter();
    cracFlt.type = 'highpass'; cracFlt.frequency.value = 1800;
    const cracGain = ctx.createGain();
    cracGain.gain.setValueAtTime(0.35, now);
    cracGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    cracSrc.connect(cracFlt); cracFlt.connect(cracGain); cracGain.connect(this._masterSfx);
    cracSrc.start(now); cracSrc.stop(now + 0.11);

    // tum grave rápido — sensação de bloco caindo
    const body     = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    body.type = 'sine';
    body.frequency.setValueAtTime(180, now);
    body.frequency.exponentialRampToValueAtTime(40, now + 0.12);
    bodyGain.gain.setValueAtTime(0.20, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    body.connect(bodyGain); bodyGain.connect(this._masterSfx);
    body.start(now); body.stop(now + 0.14);
  }

  /** "Clink" metálico ao quebrar bloco de cobre. */
  sfxDigImpactCopper() {
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;

    // ping metálico — sine de alta freq com decay médio
    const ping     = ctx.createOscillator();
    const pingGain = ctx.createGain();
    ping.type = 'triangle';
    ping.frequency.setValueAtTime(1100, now);
    ping.frequency.exponentialRampToValueAtTime(600, now + 0.18);
    pingGain.gain.setValueAtTime(0.28, now);
    pingGain.gain.exponentialRampToValueAtTime(0.001, now + 0.20);
    ping.connect(pingGain); pingGain.connect(this._masterSfx);
    ping.start(now); ping.stop(now + 0.22);

    // segundo harmônico mais suave
    const ping2     = ctx.createOscillator();
    const ping2Gain = ctx.createGain();
    ping2.type = 'sine';
    ping2.frequency.setValueAtTime(660, now + 0.02);
    ping2.frequency.exponentialRampToValueAtTime(340, now + 0.22);
    ping2Gain.gain.setValueAtTime(0.15, now + 0.02);
    ping2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    ping2.connect(ping2Gain); ping2Gain.connect(this._masterSfx);
    ping2.start(now + 0.02); ping2.stop(now + 0.26);
  }

  sfxShopOpen() {
    [0, 80, 160].forEach((delay, i) => {
      const freqs = [440, 550, 660];
      setTimeout(() => this._tone({ type: 'sine', freq: freqs[i], endFreq: freqs[i] * 1.02,
        dur: 0.18, vol: 0.12, attack: 0.005 }), delay);
    });
  }

  sfxShopClose() {
    [0, 80].forEach((delay, i) => {
      const freqs = [440, 330];
      setTimeout(() => this._tone({ type: 'sine', freq: freqs[i], endFreq: freqs[i] * 0.97,
        dur: 0.15, vol: 0.10, attack: 0.005 }), delay);
    });
  }

  /**
   * Deve ser chamado a cada frame quando o personagem está andando.
   * @param {number} delta ms
   */
  tickWalk(delta) {
    this._walkTimer += delta;
    if (this._walkTimer >= this._walkInterval) {
      this._walkTimer = 0;
      this.sfxStep();
    }
  }

  resetWalk() { this._walkTimer = 0; }

  // ── Música ambiente ───────────────────────────────────────────────────────

  _startAmbient() {
    const ctx = this._ctx;
    const out = this._masterMusic;  // toda a música passa pelo bus de música

    // Reverb convolution simples (impulse sintético)
    const reverbNode = this._makeReverb(ctx, 2.4);
    reverbNode.connect(out);

    // Bus de reverb com gain reduzido
    const reverbBus = ctx.createGain();
    reverbBus.gain.value = 0.38;
    reverbBus.connect(reverbNode);

    // Função helper: nota de pad (sine + triangle misturados, com envelope lento)
    const pad = (freq, vol, detuneHz = 0) => {
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const mix  = ctx.createGain();
      osc1.type = 'sine';     osc1.frequency.value = freq;
      osc2.type = 'triangle'; osc2.frequency.value = freq + detuneHz;
      mix.gain.value = vol;
      osc1.connect(mix); osc2.connect(mix);
      mix.connect(out);
      mix.connect(reverbBus);
      osc1.start(); osc2.start();
    };

    // ── Baixo suave (pedal Dó) ─────────────────────────────────────────────
    pad(65.4,  0.045, 0.15);  // C2 + detuning suave
    pad(130.8, 0.022, 0.08);  // C3

    // ── Acorde maior (Dó Maior: C–E–G–B) — som de flauta/harpa ────────────
    const chordFreqs = [261.6, 329.6, 392.0, 493.9]; // C4 E4 G4 B4
    chordFreqs.forEach((f, i) => pad(f, 0.018 - i * 0.002, 0.05 * (i + 1)));

    // ── LFO de volume global suave (respiração) ────────────────────────────
    const breathLFO  = ctx.createOscillator();
    const breathGain = ctx.createGain();
    breathLFO.frequency.value = 0.07;
    breathGain.gain.value     = 0.06;
    breathLFO.connect(breathGain);
    // Liga ao gain do reverbBus em vez de ao master, para não vazar quando muted
    breathGain.connect(reverbBus.gain);
    breathLFO.start();

    // ── Melodia pentatônica (notas de caixinha de música) ─────────────────
    // Escala: C D E G A C' (pentatônica maior de Dó)
    const melody = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 392.0, 329.6,
                    261.6, 329.6, 440.0, 392.0, 261.6, 293.7, 392.0, 523.3];
    let melIdx = 0;
    const BPM  = 76;
    const beat = (60 / BPM) * 1000;  // ms por beat

    const melodyTick = () => {
      if (!this._ctx || this._ctx.state === 'closed') return;
      const f    = melody[melIdx % melody.length];
      const dur  = beat * (melIdx % 4 === 0 ? 1.6 : 0.9) / 1000;

      // Nota de caixinha de música: sine com decay rápido
      const now  = ctx.currentTime;
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * 2;  // oitava acima para timbre de caixa
      gain.gain.setValueAtTime(0.065, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
      osc.connect(gain);
      gain.connect(out);
      gain.connect(reverbBus);
      osc.start(now);
      osc.stop(now + dur + 0.05);

      // Harmônico suave junto (soa mais rico)
      const osc2 = ctx.createOscillator();
      const g2   = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.value = f * 2;
      g2.gain.setValueAtTime(0.028, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.4);
      osc2.connect(g2);
      g2.connect(reverbBus);
      osc2.start(now);
      osc2.stop(now + dur * 1.4 + 0.05);

      melIdx++;
      // Pausa ocasional entre frases
      const pause = (melIdx % 8 === 0) ? beat * 2 : beat * (0.9 + Math.random() * 0.3);
      setTimeout(melodyTick, pause);
    };
    setTimeout(melodyTick, 600);

    // ── Campaninha aleatória (brilho) ──────────────────────────────────────
    const bell = [523.3, 659.3, 783.9, 1046.5, 1318.5];
    const bellTick = () => {
      if (!this._ctx || this._ctx.state === 'closed') return;
      const f   = bell[Math.floor(Math.random() * bell.length)];
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g   = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f;
      g.gain.setValueAtTime(0.030, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.6);
      osc.connect(g); g.connect(reverbBus);
      osc.start(now); osc.stop(now + 1.8);
      setTimeout(bellTick, 2800 + Math.random() * 3500);
    };
    setTimeout(bellTick, 1400);
  }

  /** Reverb sintético via impulse response de ruído filtrado. */
  _makeReverb(ctx, durationSec) {
    const rate    = ctx.sampleRate;
    const length  = rate * durationSec;
    const buffer  = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.2);
      }
    }
    const conv = ctx.createConvolver();
    conv.buffer = buffer;
    return conv;
  }

  // ── Primitivas internas ───────────────────────────────────────────────────

  _tone({ type = 'sine', freq, endFreq, dur, vol, attack = 0.01 }) {
    if (!this._ctx) return;
    const ctx  = this._ctx;
    const now  = ctx.currentTime;
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.linearRampToValueAtTime(endFreq, now + dur);
    }

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol, now + attack);
    gain.gain.setTargetAtTime(0, now + dur * 0.6, dur * 0.25);

    osc.connect(gain);
    gain.connect(this._masterSfx);
    osc.start(now);
    osc.stop(now + dur + 0.1);
  }

  _noise({ dur, vol, freq = 80 }) {
    if (!this._ctx) return;
    const ctx    = this._ctx;
    const now    = ctx.currentTime;
    const size   = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data   = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1);

    const src    = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain   = ctx.createGain();

    src.buffer = buffer;
    filter.type      = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value   = 1.2;

    gain.gain.setValueAtTime(vol, now);
    gain.gain.setTargetAtTime(0, now + dur * 0.3, dur * 0.2);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterSfx);
    src.start(now);
    src.stop(now + dur + 0.05);
  }
}
