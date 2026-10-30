// あいうえおシンセ: もじの こえを ボコーダーに とおして、えらんだ たかさの ロボットの こえで ならす
(() => {
  const $ = (id) => document.getElementById(id);
  const KANA = 'あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん';   // voice/<ばんごう>.wav の じゅん
  // 50おんの ひょう(れつ = あ・か・さ…、みぎから。'' は あき)
  const COLS = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わ   を', 'ん    '];
  // こどもが うたう たかさ(まんなかの ド〜うえの ド)
  const NOTES = [['ド', 261.63, '#ff6b6b'], ['レ', 293.66, '#ff9f43'], ['ミ', 329.63, '#f7c948'], ['ファ', 349.23, '#6bd68c'], ['ソ', 392.0, '#4ecdc4'], ['ラ', 440.0, '#5b9cff'], ['シ', 493.88, '#9b7bff'], ['ド', 523.25, '#ff7ac4']];
  let note = 0, last = 0, robot = true;

  // ---- ボコーダー(こえを 18の たかさの おびに わけて、おびごとの おおきさで のこぎりなみを うごかす) ----
  function buildVocoder(c, dest) {
    const modIn = c.createGain(), out = c.createGain(); out.gain.value = 1.2;
    const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = NOTES[note][1];
    const noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate), nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource(); noise.buffer = noiseBuf; noise.loop = true;
    const carSum = c.createGain(), oscG = c.createGain(), noiseG = c.createGain();
    oscG.gain.value = 1; noiseG.gain.value = 0.12;                 // すこし ノイズを まぜると、「か」「さ」なども ききとりやすい
    osc.connect(oscG); oscG.connect(carSum); noise.connect(noiseG); noiseG.connect(carSum);
    const rect = new Float32Array(1025); for (let i = 0; i < 1025; i++) rect[i] = Math.abs(i / 512 - 1);   // ぜったいち(ぜんぶ プラスに。まんなか=0 が ちょうど 0 に なるよう、かずは きすう)
    const N = 18, lo = 140, hi = 7000;
    for (let k = 0; k < N; k++) {
      const f = lo * Math.pow(hi / lo, k / (N - 1));
      const mb = c.createBiquadFilter(); mb.type = 'bandpass'; mb.frequency.value = f; mb.Q.value = 5;
      const sh = c.createWaveShaper(); sh.curve = rect;
      const env = c.createBiquadFilter(); env.type = 'lowpass'; env.frequency.value = 45;
      const amt = c.createGain(); amt.gain.value = 9;
      const cb = c.createBiquadFilter(); cb.type = 'bandpass'; cb.frequency.value = f; cb.Q.value = 5;
      const vca = c.createGain(); vca.gain.value = 0;
      modIn.connect(mb); mb.connect(sh); sh.connect(env); env.connect(amt); amt.connect(vca.gain);
      carSum.connect(cb); cb.connect(vca); vca.connect(out);
    }
    const ss = c.createBiquadFilter(); ss.type = 'highpass'; ss.frequency.value = 4500;   // たかい いきの おと(シュッ)は もとの こえから すこし
    const ssG = c.createGain(); ssG.gain.value = 0.35;
    modIn.connect(ss); ss.connect(ssG); ssG.connect(out);
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 8; comp.attack.value = 0.003;
    out.connect(comp); comp.connect(dest);
    osc.start(); noise.start();
    return { modIn, osc, out };
  }

  let ac = null, voc = null, plainOut = null;
  const bufs = new Array(KANA.length);
  function ensure() {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      voc = buildVocoder(ac, ac.destination); voc.out.gain.value = 0;   // こえが ないときは だまる
      plainOut = ac.createGain(); plainOut.gain.value = 0.9; plainOut.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  }
  async function load(i) {
    if (bufs[i]) return bufs[i];
    const r = await fetch('voice/' + i + '.wav');
    bufs[i] = await ac.decodeAudioData(await r.arrayBuffer());
    return bufs[i];
  }
  async function play(i) {
    ensure(); last = i;
    $('nowK').textContent = KANA[i];
    voc.osc.frequency.setTargetAtTime(NOTES[note][1], ac.currentTime, 0.01);
    const b = await load(i);
    const s = ac.createBufferSource(); s.buffer = b;
    s.connect(robot ? voc.modIn : plainOut); s.start();
    if (robot) {                                                   // こえが なっている あいだだけ ロボットの おとを だす
      const g = voc.out.gain, t = ac.currentTime;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(1.2, t + 0.01);
      g.setTargetAtTime(0, t + b.duration + 0.03, 0.04);
    }
    const bot = $('bot'); bot.classList.remove('sing'); void bot.offsetWidth; bot.classList.add('sing');
  }

  // ---- がめん ----
  for (let r = 0; r < 5; r++) for (let c = 0; c < COLS.length; c++) {
    const ch = COLS[c][r] || ' ', b = document.createElement('button'); b.type = 'button';
    if (ch === ' ') { b.className = 'kk blank'; b.tabIndex = -1; b.setAttribute('aria-hidden', 'true'); }
    else {
      b.className = 'kk'; b.textContent = ch;
      const i = KANA.indexOf(ch);
      b.addEventListener('pointerdown', (e) => { e.preventDefault(); play(i); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 150); });
      b.addEventListener('click', (e) => { if (e.detail === 0) play(i); });   // キーボード
    }
    $('kana').appendChild(b);
  }
  NOTES.forEach(([name, , color], k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'key' + (k === note ? ' sel' : '');
    b.textContent = name; b.style.background = color;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault(); note = k;
      document.querySelectorAll('.key').forEach((x, j) => x.classList.toggle('sel', j === k));
      $('nowN').textContent = 'たかさ: ' + name;
      play(last);                                                  // さいごの もじを、この たかさで
    });
    $('keys').appendChild(b);
  });
  const setMode = (r) => { robot = r; $('mRobot').classList.toggle('sel', r); $('mPlain').classList.toggle('sel', !r); };
  $('mRobot').onclick = () => setMode(true);
  $('mPlain').onclick = () => setMode(false);
  // さきに こえを よみこんでおく(さいしょに さわった とき)
  document.addEventListener('pointerdown', () => { ensure(); KANA.split('').forEach((_, i) => load(i).catch(() => {})); }, { once: true });
  window.__aiueoBuild = buildVocoder;                              // たしかめよう(オフラインで ならして みる)
})();
