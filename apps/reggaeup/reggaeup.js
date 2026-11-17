// レゲエ・上音: コード進行を決めると、スカンク(ギター)・バブル(オルガン)・ホーン(サックス)の刻みが入る。
// 入った音は、小節ごとのピアノロールでそのまま直せる(コードと単音を行き来して編集する。GarageBand の作り方に近づけた)。
// 音は FreePats の CC0 の録音(各音の頭から数秒)。書き出しはパートごとの WAV(Loopy Pro 用)。
(() => {
  const $ = (id) => document.getElementById(id);
  const KEY = 'reggaeup-v1', NB = 8, STEPS = 16;
  const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const TYPES = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], sus4: [0, 5, 7] };
  const SAMPLES = {"organ":[{"lo":33,"hi":37,"c":36,"f":"organ/36.mp3"},{"lo":38,"hi":41,"c":40,"f":"organ/40.mp3"},{"lo":42,"hi":45,"c":44,"f":"organ/44.mp3"},{"lo":46,"hi":49,"c":48,"f":"organ/48.mp3"},{"lo":50,"hi":53,"c":52,"f":"organ/52.mp3"},{"lo":54,"hi":57,"c":56,"f":"organ/56.mp3"},{"lo":58,"hi":61,"c":60,"f":"organ/60.mp3"},{"lo":62,"hi":65,"c":64,"f":"organ/64.mp3"},{"lo":66,"hi":69,"c":68,"f":"organ/68.mp3"},{"lo":70,"hi":73,"c":72,"f":"organ/72.mp3"},{"lo":74,"hi":77,"c":76,"f":"organ/76.mp3"},{"lo":78,"hi":81,"c":80,"f":"organ/80.mp3"},{"lo":82,"hi":85,"c":84,"f":"organ/84.mp3"},{"lo":86,"hi":89,"c":88,"f":"organ/88.mp3"},{"lo":90,"hi":93,"c":92,"f":"organ/92.mp3"},{"lo":94,"hi":98,"c":96,"f":"organ/96.mp3"}],"guitar":[{"lo":35,"hi":38,"c":36,"f":"guitar/36.mp3"},{"lo":39,"hi":42,"c":41,"f":"guitar/41.mp3"},{"lo":43,"hi":46,"c":45,"f":"guitar/45.mp3"},{"lo":47,"hi":49,"c":48,"f":"guitar/48.mp3"},{"lo":50,"hi":53,"c":52,"f":"guitar/52.mp3"},{"lo":54,"hi":56,"c":55,"f":"guitar/55.mp3"},{"lo":57,"hi":61,"c":59,"f":"guitar/59.mp3"},{"lo":62,"hi":65,"c":64,"f":"guitar/64.mp3"},{"lo":66,"hi":69,"c":67,"f":"guitar/67.mp3"},{"lo":70,"hi":72,"c":71,"f":"guitar/71.mp3"},{"lo":73,"hi":76,"c":74,"f":"guitar/74.mp3"},{"lo":77,"hi":82,"c":80,"f":"guitar/80.mp3"},{"lo":83,"hi":86,"c":85,"f":"guitar/85.mp3"}],"sax":[{"lo":38,"hi":42,"c":40,"f":"sax/40.mp3"},{"lo":43,"hi":46,"c":44,"f":"sax/44.mp3"},{"lo":47,"hi":50,"c":48,"f":"sax/48.mp3"},{"lo":51,"hi":54,"c":52,"f":"sax/52.mp3"},{"lo":55,"hi":58,"c":56,"f":"sax/56.mp3"},{"lo":59,"hi":62,"c":60,"f":"sax/60.mp3"},{"lo":63,"hi":66,"c":64,"f":"sax/64.mp3"},{"lo":67,"hi":70,"c":68,"f":"sax/68.mp3"},{"lo":71,"hi":74,"c":72,"f":"sax/72.mp3"},{"lo":75,"hi":78,"c":76,"f":"sax/76.mp3"},{"lo":79,"hi":82,"c":80,"f":"sax/80.mp3"},{"lo":83,"hi":86,"c":84,"f":"sax/84.mp3"},{"lo":87,"hi":90,"c":88,"f":"sax/88.mp3"}]};

  // パートと、刻みの型(仮。手本と聴き比べて直す)。steps は16分のマス、len はマス数、which は和音の上(hi)か下(lo)か
  const PARTS = {
    skank: { name: 'スカンク', inst: 'ギター', smp: 'guitar', range: [52, 76], strum: 0.007, rel: 0.03,
      pats: {
        '2・4拍': [[4, 1, 'hi'], [12, 1, 'hi']],
        '毎拍のウラ': [[2, 1, 'hi'], [6, 1, 'hi'], [10, 1, 'hi'], [14, 1, 'hi']],
        'ダブル': [[4, 1, 'hi'], [6, 1, 'hi'], [12, 1, 'hi'], [14, 1, 'hi']],
      } },
    bubble: { name: 'バブル', inst: 'オルガン', smp: 'organ', range: [45, 72], strum: 0, rel: 0.05,
      pats: {
        'バブル': [[2, 1, 'hi'], [3, 1, 'lo'], [6, 1, 'hi'], [7, 1, 'lo'], [10, 1, 'hi'], [11, 1, 'lo'], [14, 1, 'hi'], [15, 1, 'lo']],
        '8分のウラ': [[2, 2, 'hi'], [6, 2, 'hi'], [10, 2, 'hi'], [14, 2, 'hi']],
        'のばす': [[0, 16, 'hi']],
      } },
    horn: { name: 'ホーン', inst: 'サックス', smp: 'sax', range: [50, 76], strum: 0, rel: 0.08,
      pats: {
        'なし(自分で置く)': [],
        '1拍目のキメ': [[0, 2, 'hi']],
        'コードの音をのばす': [[0, 16, 'root']],
      } },
  };
  const PK = Object.keys(PARTS);

  // ---- 状態 ----
  const blankBars = () => Array.from({ length: NB }, () => ({ edited: false, notes: [] }));
  let S = {
    bpm: 76, bars: 4, page: 0, part: 'skank', sel: -1,
    chords: [{ r: 9, t: 'm' }, { r: 2, t: '' }, { r: 9, t: 'm' }, { r: 2, t: '' }, { r: 9, t: 'm' }, { r: 2, t: '' }, { r: 9, t: 'm' }, { r: 2, t: '' }],
    parts: {
      skank: { on: true, pat: '2・4拍', oct: 0, vol: 80, bars: blankBars() },
      bubble: { on: true, pat: 'バブル', oct: 0, vol: 70, bars: blankBars() },
      horn: { on: false, pat: 'なし(自分で置く)', oct: 0, vol: 75, bars: blankBars() },
    },
  };
  try { const o = JSON.parse(localStorage.getItem(KEY) || 'null'); if (o && o.parts && o.chords) S = Object.assign(S, o); } catch (e) { /* 保存なしでも動く */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* そのまま */ } };

  // ---- コードから音を作る ----
  const chordName = (c) => NAMES[c.r] + c.t;
  const tones = (c) => TYPES[c.t].map((x) => (c.r + x) % 12);
  // 和音の音を、lo〜lo+11 の中に並べる
  const voice = (pcs, lo) => pcs.map((pc) => lo + ((pc - lo % 12 + 12) % 12)).sort((a, b) => a - b);
  function gen(pk, b) {
    const P = PARTS[pk], st = S.parts[pk], c = S.chords[b], pat = P.pats[st.pat] || [];
    const pcs = tones(c), out = [];
    const hiLo = pk === 'horn' ? 60 : pk === 'bubble' ? 60 : 60, loLo = 48;
    pat.forEach(([s, l, w]) => {
      let ps;
      if (w === 'root') ps = [voice([c.r], 55)[0], voice([pcs[1]], 60)[0]];
      else if (w === 'lo') ps = voice([c.r, pcs[2]], loLo);
      else ps = voice(pcs.slice(0, 3), hiLo);
      ps.forEach((p) => out.push({ s, p: p + st.oct, l }));
    });
    return out;
  }
  function regenAll(force) {
    PK.forEach((pk) => S.parts[pk].bars.forEach((bar, b) => { if (force || !bar.edited) { bar.notes = gen(pk, b); bar.edited = false; } }));
  }
  if (!S.parts.skank.bars[0].notes.length && !S.parts.skank.bars[0].edited) regenAll(true);

  // ---- 音 ----
  let ctx = null, out = null;
  const bufs = {};
  function ensure() {
    if (!ctx || ctx.state === 'closed') { ctx = new (window.AudioContext || window.webkitAudioContext)(); out = ctx.createDynamicsCompressor(); out.threshold.value = -10; out.ratio.value = 4; out.connect(ctx.destination); }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
  }
  async function loadAll(c) {
    const jobs = [];
    Object.values(SAMPLES).forEach((list) => list.forEach((r) => {
      if (bufs[r.f]) return;
      jobs.push(fetch(r.f).then((x) => x.arrayBuffer()).then((ab) => c.decodeAudioData(ab)).then((b) => { bufs[r.f] = b; }).catch(() => {}));
    }));
    await Promise.all(jobs);
  }
  function voiceAt(c, dest, smp, p, t, dur, gain, rel) {
    const list = SAMPLES[smp]; let r = list.find((x) => p >= x.lo && p <= x.hi);
    if (!r) r = p < list[0].lo ? list[0] : list[list.length - 1];
    const b = bufs[r.f]; if (!b) return;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = Math.pow(2, (p - r.c) / 12);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.setValueAtTime(gain, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + rel);
    s.connect(g).connect(dest); s.start(t); s.stop(t + dur + rel + 0.02);
  }
  const stepDur = () => 60 / S.bpm / 4;
  // あるパートの、ある小節の音を鳴らす(t0 は小節の頭)
  function scheduleBar(c, dest, pk, b, t0) {
    const P = PARTS[pk], st = S.parts[pk]; if (!st.on) return;
    const sd = stepDur(), g = (st.vol / 100) * 0.5;
    const byStep = {};
    st.bars[b].notes.forEach((n) => { (byStep[n.s] = byStep[n.s] || []).push(n); });
    Object.values(byStep).forEach((ns) => ns.sort((a, b2) => a.p - b2.p).forEach((n, i) => voiceAt(c, dest, P.smp, n.p, t0 + n.s * sd + i * P.strum, n.l * sd - 0.01, g, P.rel)));
  }

  // ---- 再生 ----
  let playing = false, timer = null, nextBar = 0, nextAt = 0, raf = null, startAt = 0;
  async function play() {
    ensure(); await loadAll(ctx);
    playing = true; $('play').textContent = '■ 止める';
    nextBar = 0; nextAt = ctx.currentTime + 0.08; startAt = nextAt;
    const tick = () => {
      while (nextAt < ctx.currentTime + 0.25) {
        PK.forEach((pk) => scheduleBar(ctx, out, pk, nextBar, nextAt));
        nextAt += STEPS * stepDur(); nextBar = (nextBar + 1) % S.bars;
      }
    };
    tick(); timer = setInterval(tick, 50);
    const draw = () => { if (!playing) return; const pos = Math.floor((ctx.currentTime - startAt) / stepDur()); const bar = Math.floor(pos / STEPS) % S.bars, st = ((pos % STEPS) + STEPS) % STEPS; mark(bar, st); raf = requestAnimationFrame(draw); };
    draw();
  }
  function stop() { playing = false; clearInterval(timer); cancelAnimationFrame(raf); $('play').textContent = '▶ 再生'; mark(-1, -1); if (ctx) { try { ctx.close(); } catch (e) {} ctx = null; } }
  $('play').onclick = () => (playing ? stop() : play());
  document.addEventListener('visibilitychange', () => { if (document.hidden && playing) stop(); });

  // ---- 画面 ----
  function drawChords() {
    const box = $('chords'); box.innerHTML = '';
    for (let b = 0; b < S.bars; b++) {
      const bt = document.createElement('button'); bt.type = 'button';
      bt.innerHTML = chordName(S.chords[b]) + '<small>' + (b + 1) + '小節目</small>';
      if (S.sel === b) bt.classList.add('sel');
      bt.onclick = () => { S.sel = S.sel === b ? -1 : b; S.page = b; drawAll(); };
      box.appendChild(bt);
    }
    const pk = $('picker'); pk.hidden = S.sel < 0;
    if (S.sel >= 0) {
      const c = S.chords[S.sel];
      $('pkeys').innerHTML = ''; $('ptypes').innerHTML = '';
      NAMES.forEach((n, i) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = n; if (c.r === i) x.classList.add('on'); x.onclick = () => { c.r = i; chordChanged(); }; $('pkeys').appendChild(x); });
      Object.keys(TYPES).forEach((t) => { const x = document.createElement('button'); x.type = 'button'; x.textContent = t || 'メジャー'; if (c.t === t) x.classList.add('on'); x.onclick = () => { c.t = t; chordChanged(); }; $('ptypes').appendChild(x); });
    }
  }
  function chordChanged() { PK.forEach((pk) => { const bar = S.parts[pk].bars[S.sel]; if (!bar.edited) bar.notes = gen(pk, S.sel); }); save(); drawAll(); }
  function drawTabs() {
    const box = $('tabs'); box.innerHTML = '';
    PK.forEach((pk) => {
      const P = PARTS[pk], b = document.createElement('button'); b.type = 'button';
      b.innerHTML = P.name + '<br><span class="off">' + P.inst + (S.parts[pk].on ? '' : '・鳴らさない') + '</span>';
      if (S.part === pk) b.classList.add('on');
      b.onclick = () => { S.part = pk; save(); drawAll(); };
      box.appendChild(b);
    });
    const st = S.parts[S.part], P = PARTS[S.part];
    $('pon').checked = st.on; $('pvol').value = st.vol; $('poct').value = String(st.oct);
    $('ppat').innerHTML = ''; Object.keys(P.pats).forEach((k) => { const o = document.createElement('option'); o.textContent = k; if (k === st.pat) o.selected = true; $('ppat').appendChild(o); });
  }
  $('pon').onchange = () => { S.parts[S.part].on = $('pon').checked; save(); drawTabs(); };
  $('pvol').oninput = () => { S.parts[S.part].vol = +$('pvol').value; save(); };
  $('ppat').onchange = () => { const st = S.parts[S.part]; st.pat = $('ppat').value; st.bars.forEach((bar, b) => { if (!bar.edited) bar.notes = gen(S.part, b); }); save(); drawRoll(); };
  $('poct').onchange = () => { const st = S.parts[S.part]; st.oct = +$('poct').value; st.bars.forEach((bar, b) => { if (!bar.edited) bar.notes = gen(S.part, b); }); save(); drawRoll(); };

  let rollCells = [];
  function drawRoll() {
    const roll = $('roll'), P = PARTS[S.part], st = S.parts[S.part], bar = st.bars[S.page];
    const lo = P.range[0] + st.oct, hi = P.range[1] + st.oct, ct = new Set(tones(S.chords[S.page]));
    $('pageLbl').textContent = (S.page + 1) + '小節目 ・ ' + chordName(S.chords[S.page]);
    $('pageSub').innerHTML = P.name + '(' + P.inst + ')' + (bar.edited ? '<span class="edited">手で直した</span>' : '');
    roll.innerHTML = ''; rollCells = [];
    for (let p = hi; p >= lo; p--) {
      const pc = p % 12, black = [1, 3, 6, 8, 10].includes(pc), isCt = ct.has(pc);
      const k = document.createElement('div'); k.className = 'k' + (isCt ? ' ct' : '') + (black ? ' black' : ''); k.textContent = NAMES[pc] + (Math.floor(p / 12) - 1);
      roll.appendChild(k);
      for (let s = 0; s < STEPS; s++) {
        const c = document.createElement('div'); c.className = 'c' + (s % 4 === 0 ? ' beat' : '') + (isCt ? ' ct' : '') + (black ? ' black' : '');
        c.dataset.p = p; c.dataset.s = s;
        const head = bar.notes.find((n) => n.p === p && n.s === s), cont = bar.notes.find((n) => n.p === p && s > n.s && s < n.s + n.l);
        if (head) c.classList.add('on'); else if (cont) c.classList.add('cont');
        roll.appendChild(c); rollCells.push(c);
      }
    }
  }
  // マスを押す: 音を置く・消す(続きの部分を押したら、その音を消す)
  $('roll').addEventListener('pointerdown', (e) => {
    const c = e.target.closest('.c'); if (!c) return; e.preventDefault();
    const p = +c.dataset.p, s = +c.dataset.s, bar = S.parts[S.part].bars[S.page];
    const i = bar.notes.findIndex((n) => n.p === p && s >= n.s && s < n.s + n.l);
    if (i >= 0) bar.notes.splice(i, 1);
    else {
      const l = Math.min(+$('plen').value, STEPS - s);
      bar.notes.push({ s, p, l });
      // 置いた音を鳴らして聴かせる
      ensure(); loadAll(ctx).then(() => voiceAt(ctx, out, PARTS[S.part].smp, p, ctx.currentTime + 0.01, Math.min(l * stepDur(), 0.6), 0.4, PARTS[S.part].rel));
    }
    bar.edited = true; save(); drawRoll();
  });
  $('regen').onclick = () => { const bar = S.parts[S.part].bars[S.page]; bar.notes = gen(S.part, S.page); bar.edited = false; save(); drawRoll(); };
  $('clearBar').onclick = () => { const bar = S.parts[S.part].bars[S.page]; bar.notes = []; bar.edited = true; save(); drawRoll(); };
  $('prev').onclick = () => { S.page = (S.page - 1 + S.bars) % S.bars; save(); drawRoll(); };
  $('next').onclick = () => { S.page = (S.page + 1) % S.bars; save(); drawRoll(); };
  function mark(bar, st) { rollCells.forEach((c) => c.classList.toggle('now', bar === S.page && +c.dataset.s === st)); }
  $('bpm').value = S.bpm; $('bpm').onchange = () => { S.bpm = Math.max(50, Math.min(140, Math.round(+$('bpm').value || 76))); $('bpm').value = S.bpm; save(); };
  $('bars').value = String(S.bars); $('bars').onchange = () => { S.bars = +$('bars').value; if (S.page >= S.bars) S.page = 0; if (S.sel >= S.bars) S.sel = -1; save(); drawAll(); };
  function drawAll() { drawChords(); drawTabs(); drawRoll(); }

  // ---- 書き出し: パートごとに、ループ1周ぶん。終わりの余韻は頭に足して、くり返しでつながる形にする ----
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (u) => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = crcT[(c ^ u[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function zip(files) {
    const parts = [], cen = []; let off = 0;
    files.forEach((f) => {
      const name = new TextEncoder().encode(f.name), d = f.data, c = crc(d);
      const h = new DataView(new ArrayBuffer(30)); h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint32(14, c, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true); h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, d);
      const e = new DataView(new ArrayBuffer(46)); e.setUint32(0, 0x02014b50, true); e.setUint16(4, 20, true); e.setUint16(6, 20, true); e.setUint16(8, 0x0800, true); e.setUint32(16, c, true); e.setUint32(20, d.length, true); e.setUint32(24, d.length, true); e.setUint16(28, name.length, true); e.setUint32(42, off, true);
      cen.push(new Uint8Array(e.buffer), name); off += 30 + name.length + d.length;
    });
    const size = cen.reduce((a, x) => a + x.length, 0), e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, off, true);
    return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
  }
  $('exp').onclick = async () => {
    const msg = (t) => { $('msg').textContent = t; };
    const list = PK.filter((pk) => S.parts[pk].on);
    if (!list.length) { msg('鳴らすパートがありません'); return; }
    if (playing) stop();
    msg('書き出し中…');
    const SR = 44100, loop = S.bars * STEPS * stepDur(), tail = 2.5, files = [];
    for (const pk of list) {
      const oc = new OfflineAudioContext(1, Math.ceil((loop + tail) * SR), SR);
      await loadAll(oc);
      const g = oc.createGain(); g.connect(oc.destination);
      for (let b = 0; b < S.bars; b++) scheduleBar(oc, g, pk, b, b * STEPS * stepDur());
      const r = await oc.startRendering();
      const n = Math.round(loop * SR), src = r.getChannelData(0), outB = new AudioBuffer({ length: n, numberOfChannels: 1, sampleRate: SR }), d = outB.getChannelData(0);
      for (let i = 0; i < src.length; i++) d[i % n] += src[i];
      let pk2 = 0; for (let i = 0; i < n; i++) pk2 = Math.max(pk2, Math.abs(d[i])); if (pk2 > 0.95) for (let i = 0; i < n; i++) d[i] *= 0.95 / pk2;
      const blob = audioBufferToWav(outB), u8 = new Uint8Array(await blob.arrayBuffer());
      files.push({ name: PARTS[pk].name + '_' + S.bpm + 'BPM_' + S.bars + '小節.wav', data: u8 });
    }
    saveBlob(zip(files), 'レゲエ上音_' + S.bpm + 'BPM_' + S.bars + '小節.zip', $('msg'));
    if (!window.claude) msg('保存しました(' + files.map((f) => f.name).join('、') + ')');
  };

  drawAll();
})();
