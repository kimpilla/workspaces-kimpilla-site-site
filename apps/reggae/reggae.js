// レゲエ・ビート: 曲のリズムは1つ。ブロックは「そのリズムをどう変えるか」(抜く音・フィル・クラッシュ・アクセント)だけを並べる
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ---- 行(表の上から順)と、パート ----
  const ROWS = ['CRASH', 'HAT', 'OPEN', 'RIM', 'SNARE', 'T-HI', 'T-MID', 'T-LO', 'KICK'];
  const PART_OF = { CRASH: 'crash', HAT: 'hat', OPEN: 'hat', RIM: 'snare', SNARE: 'snare', 'T-HI': 'tom', 'T-MID': 'tom', 'T-LO': 'tom', KICK: 'kick' };
  const PARTS = [['hat', 'ハイハット'], ['kick', 'キック'], ['snare', 'スネア・リム'], ['tom', 'タム'], ['crash', 'クラッシュ']];
  const BASE_VEL = { CRASH: 0.85, OPEN: 0.7, RIM: 0.8, SNARE: 0.8, 'T-HI': 0.78, 'T-MID': 0.78, 'T-LO': 0.78, KICK: 0.85 };
  const BUF = { KICK: ['kickS', 'kickH'], RIM: ['ssS', 'ssH'], SNARE: ['snS', 'snH'], HAT: ['htS', 'htH'], OPEN: ['hoS', 'hoS'], 'T-HI': ['t1', 't1'], 'T-MID': ['t2', 't2'], 'T-LO': ['t3', 't3'], CRASH: ['cr', 'cr'] };

  const zero = () => { const r = {}; ROWS.forEach((n) => { r[n] = new Array(16).fill(0); }); return r; };
  const copyRows = (r) => { const o = {}; ROWS.forEach((n) => { o[n] = r[n].slice(); }); return o; };
  const hats8 = (r) => { for (let i = 0; i < 16; i += 2) r.HAT[i] = 1; };

  const PATTERNS = {
    'ワンドロップ': () => { const r = zero(); hats8(r); r.RIM[8] = 1; r.KICK[8] = 1; return r; },
    'ロッカーズ': () => { const r = zero(); hats8(r); r.RIM[8] = 1; r.KICK[0] = 1; r.KICK[8] = 1; return r; },
    'ステッパーズ': () => { const r = zero(); hats8(r); r.RIM[8] = 1; [0, 4, 8, 12].forEach((i) => { r.KICK[i] = 1; }); return r; },
    '空(自分で作る)': () => zero(),
  };

  // ---- フィル(最後の小節の後ろの部分を、置き換える)----
  const FILL_TYPES = [['none', 'なし'], ['tom', 'タムの下降'], ['light', '軽い飾り'], ['short', '半小節の短い頭'], ['roll', 'スネアロール']];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function genFill(type, alt, intro) {
    const r = zero(); let from = 0;
    if (type === 'tom') {
      from = 10;
      const seq = alt % 2 ? ['T-HI', 'T-MID', 'T-HI', 'T-MID', 'T-LO', 'T-LO'] : ['T-HI', 'T-HI', 'T-MID', 'T-MID', 'T-LO', 'T-LO'];
      seq.forEach((n, i) => { r[n][10 + i] = i === 5 ? 2 : 1; });
    } else if (type === 'light') {
      from = 12; r.HAT[12] = 1; r.OPEN[14] = 1; r.RIM[14] = 2; if (alt % 2) r.RIM[15] = 1;
    } else if (type === 'short') {
      from = 8; r.KICK[8] = 1; r.RIM[8] = 2;
      if (alt % 2) { for (let i = 9; i < 15; i++) r.SNARE[i] = 1; } else { [10, 12, 13, 14].forEach((i) => { r.SNARE[i] = 1; }); }
      r['T-HI'][15] = 2;
    } else if (type === 'roll') {
      from = intro ? 0 : 8;
      for (let i = from; i < 16; i++) {
        const k = (i - from) / (16 - from);
        const row = k < 0.5 ? (alt % 2 && i % 4 === 3 ? 'T-HI' : 'SNARE') : k < 0.75 ? pick(['T-HI', 'T-MID']) : k < 0.9 ? 'T-MID' : 'T-LO';
        r[row][i] = i === 15 ? 2 : 1;
      }
    }
    return { from, rows: r };
  }

  // ---- 曲のリズムと、ブロック(変え方)----
  const OFFS = [['HAT', 'ハット'], ['OPEN', 'オープン'], ['RIM', 'リム'], ['SNARE', 'スネア'], ['TOM', 'タム'], ['KICK', 'キック']];
  const OFF_ROWS = { HAT: ['HAT'], OPEN: ['OPEN'], RIM: ['RIM'], SNARE: ['SNARE'], TOM: ['T-HI', 'T-MID', 'T-LO'], KICK: ['KICK'] };
  const ACCENTS = [['keep', 'そのまま'], ['none', 'なし'], ['omote', '表(1拍目)'], ['ura', '裏(3拍目)'], ['rand', 'ランダム']];
  const ADDS = [['open', 'オープンハット'], ['ghost', 'リムのゴースト']];
  const LEVELS = [[0, 'なし'], [1, '少し'], [2, '多め']];
  const newBlock = (bars, fill) => {
    const b = { bars, reps: 1, ov: {}, off: {}, add: { open: 0, ghost: 0 }, crashAt: 0, accent: 'keep', fillType: fill || 'none', fillFrom: 0, fillBar: 0, fillRows: zero(), alt: 0, intro: false };
    if (b.fillType !== 'none') applyFill(b);
    return b;
  };
  const newIntro = () => { const b = newBlock(1, 'roll'); b.intro = true; applyFill(b); return b; };
  function applyFill(b) {
    if (b.fillType === 'none') { b.fillRows = zero(); b.fillFrom = 0; return; }
    const f = genFill(b.fillType, b.alt, b.intro); b.fillRows = f.rows; b.fillFrom = f.from;
  }
  const initial = () => [];      // 最初は、ブロックなし。「ブロックを作る」で足す

  const S = { song: { pat: 'ワンドロップ', rows: PATTERNS['ワンドロップ'](), bpm: 76 }, blocks: initial(), draft: newBlock(8), cur: null, mute: {}, solo: {}, p: { shuffle: 58, accvar: 35, sway: 30 } };
  const KEY = 'kimpilla_reggae_v2';
  const okRows = (r) => r && ROWS.every((n) => Array.isArray(r[n]) && r[n].length === 16);
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ song: S.song, blocks: S.blocks, draft: S.draft, p: S.p })); } catch (e) { /* 保存できなくても動く */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.song && okRows(o.song.rows) && Array.isArray(o.blocks)) {
        o.blocks.forEach((b) => { if (!okRows(b.fillRows)) b.fillRows = zero(); b.ov = b.ov || {}; b.off = b.off || {}; b.add = Object.assign({ open: 0, ghost: 0 }, b.add); b.alt = b.alt || 0; b.fillBar = b.fillBar || 0; b.crashAt = b.crashAt || 0; b.accent = b.accent || 'keep'; });
        S.song = { pat: o.song.pat, rows: o.song.rows, bpm: o.song.bpm || 76 }; S.blocks = o.blocks; if (o.draft && okRows(o.draft.fillRows)) { S.draft = Object.assign(newBlock(8), o.draft); S.draft.add = Object.assign({ open: 0, ghost: 0 }, S.draft.add); S.draft.off = S.draft.off || {}; } if (o.p) Object.assign(S.p, o.p);
      }
    } catch (e) { /* 読めなければ、最初の状態 */ }
  }

  // ---- 乱数(同じ場所は、いつも同じ値。ドラマーの「クセ」)----
  function rnd(seed) { let x = (seed * 2654435761) >>> 0; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }
  const hatFactor = (bi, step) => 1 + (rnd(bi * 131 + step * 7 + 3) - 0.5) * (S.p.accvar / 100) * 1.4;

  // ---- 並びを、音の予定(イベント)にする ----
  // 小節ごとの設定 = ブロックの設定(標準)に、その小節だけの例外(b.ov[bar])を重ねたもの
  const fillBarIdx = (b) => (b.fillBar > 0 ? Math.min(b.fillBar, b.bars) : b.bars) - 1;
  function barEff(b, bar) {
    const ov = (b.ov && b.ov[bar]) || {};
    const E = { off: ov.off || b.off, add: ov.add || b.add, accent: ov.accent !== undefined ? ov.accent : b.accent, crashAt: ov.crashAt !== undefined ? ov.crashAt : (bar === 0 ? b.crashAt : 0), fill: null, rows: ov.rows || null, ex: !!b.ov && !!b.ov[bar] };
    if (ov.fill) E.fill = ov.fill.type !== 'none' ? ov.fill : null;
    else if (bar === fillBarIdx(b) && b.fillType !== 'none') E.fill = { type: b.fillType, from: b.fillFrom, rows: b.fillRows, alt: b.alt };
    return E;
  }
  // 小節のメイン = 曲のリズムから、抜く音を除き、アクセントを置き直し、足す音を入れたもの
  function blockMain(E, bi, bar) {
    const o = copyRows(S.song.rows), sd = bi * 7919 + (bar || 0) * 104729;
    OFFS.forEach(([k]) => { if (E.off[k]) OFF_ROWS[k].forEach((n) => { o[n].fill(0); }); });
    if (E.accent !== 'keep') ['KICK', 'RIM', 'SNARE'].forEach((n, ni) => {
      for (let i = 0; i < 16; i++) {
        if (!o[n][i] || o[n][i] === 3) continue;
        o[n][i] = E.accent === 'none' ? 1 : E.accent === 'omote' ? (i === 0 ? 2 : 1) : E.accent === 'ura' ? (i === 8 ? 2 : 1) : (rnd(bi * 977 + ni * 131 + i * 7 + 5) < 0.4 ? 2 : 1);
      }
    });
    // 足す音: 小節ごとに、ほんの少しだけ入る(同じ小節は、いつも同じ)
    const ph = [0, 0.22, 0.5][E.add.open], pg = [0, 0.1, 0.28][E.add.ghost];
    if (ph && !E.off.OPEN) [6, 14].forEach((i, k) => { if (o.HAT[i] && !o.OPEN[i] && rnd(sd + 31 + k * 17) < ph * (k ? 1 : 0.6)) { o.HAT[i] = 0; o.OPEN[i] = 1; } });
    if (pg && !E.off.RIM) [3, 7, 11, 14, 15].forEach((i, k) => { if (!o.RIM[i] && !o.SNARE[i] && rnd(sd + 97 + k * 13) < pg) o.RIM[i] = 3; });
    return o;
  }
  const effRows = (b, bi, bar, E) => {
    if (b.intro) return copyRows(b.fillRows);
    if (E.rows) return copyRows(E.rows);
    const m = blockMain(E, bi, bar);
    if (E.fill) ROWS.forEach((n) => { for (let i = E.fill.from; i < 16; i++) m[n][i] = E.fill.rows[n][i]; });
    return m;
  };

  let previewBlocks = null, previewInfo = { kind: 'list', bi: 0 };      // 1ブロックだけ鳴らしている間
  const warp = (frac, s) => (frac < 0.5 ? frac * (s / 0.5) : s + (frac - 0.5) * ((1 - s) / 0.5));
  function timeline(list, off0) {
    const BL = list || S.blocks;
    const ev = []; let t = 0; const s = S.p.shuffle / 100; let landNext = false; const spb = 60 / S.song.bpm; const spans = [];
    BL.forEach((b, i0) => {
      const bi = i0 + (off0 || 0), tb = t;
      for (let rep = 0; rep < b.reps; rep++) {
        for (let bar = 0; bar < b.bars; bar++) {
          const E = b.intro ? { crashAt: 0, fill: b.fillType !== 'none' ? {} : null } : barEff(b, bar);
          const rows = effRows(b, bi, bar, E), t0 = t, seedBar = bi * 1000 + rep * 100 + bar;
          const withFill = !!E.fill;
          const landing = landNext && $('land').checked;
          if (landing && !rows.CRASH[0]) ev.push({ t: t0, row: 'CRASH', vel: 0.9, bi });
          if (E.crashAt) { const st = E.crashAt === 3 ? 8 : 0; if (!rows.CRASH[st] && !(st === 0 && landing)) ev.push({ t: t0 + (st / 4) * spb, row: 'CRASH', vel: 0.9, bi }); }
          landNext = withFill;

          ROWS.forEach((n) => {
            for (let i = 0; i < 16; i++) {
              const v = rows[n][i]; if (!v) continue;
              const beat = i / 4, frac = beat - Math.floor(beat);
              let tt = t0 + (Math.floor(beat) + warp(frac, s)) * spb, vel;
              if (n === 'HAT') {
                vel = (i % 4 === 0 ? 0.62 : i % 2 === 0 ? 0.42 : 0.34) * (v === 2 ? 1.45 : v === 3 ? 0.45 : 1) * hatFactor(bi, i);
                tt += (rnd(seedBar * 17 + i * 5 + 11) - 0.5) * 2 * (S.p.sway / 100) * 0.02;
              } else vel = BASE_VEL[n] * (v === 2 ? 1.25 : v === 3 ? 0.4 : 1);
              ev.push({ t: Math.max(0, tt), row: n, vel, bi });
            }
          });
          t += 4 * spb;
        }
      }
      spans.push({ t0: tb, t1: t });
    });
    return { ev, dur: t, spans };
  }

  // ---- 音 ----
  let ctx = null, master = null, partGain = {}, buffers = null, loading = null;
  const b64 = (s) => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u.buffer; };
  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      PARTS.forEach(([k]) => { const g = ctx.createGain(); g.connect(master); partGain[k] = g; });
      updateGains();
    } else if (ctx.state === 'suspended') ctx.resume();
    if (!loading) {
      loading = (async () => {
        const out = {};
        for (const k of Object.keys(window.REGGAE_WAV)) out[k] = await new Promise((res, rej) => ctx.decodeAudioData(b64(window.REGGAE_WAV[k]), res, rej));
        buffers = out;
      })();
    }
    return loading;
  }
  const anySolo = () => Object.keys(S.solo).some((k) => S.solo[k]);
  const audible = (part) => (anySolo() ? !!S.solo[part] : !S.mute[part]);
  function updateGains() { if (!ctx) return; PARTS.forEach(([k]) => { partGain[k].gain.value = audible(k) ? 1 : 0; }); }

  function hit(c, dest, t, row, vel) {
    const pair = BUF[row], name = vel >= 0.75 ? pair[1] : pair[0], src = c.createBufferSource(); src.buffer = buffers[name];
    const g = c.createGain(); g.gain.value = Math.min(1.3, Math.max(0.15, vel)); src.connect(g); g.connect(dest(row)); src.start(t);
  }

  // ---- 再生 ----
  let playing = false, timer = 0, session = 0, nodesUntil = 0;
  // 鳴らしている小節を、小節ビューで点滅させる
  let segs = [], raf = 0;
  function showPlaying() {
    document.querySelectorAll('.bar.play').forEach((x) => x.classList.remove('play'));
    if (!playing || !ctx) return;
    const now = ctx.currentTime; let seg = null;
    segs.forEach((sg) => { if (sg.t0 <= now && now < sg.t0 + sg.dur) seg = sg; });
    if (!seg || Math.floor(now * 4) % 2) return;       // 0.25秒ごとに、つく・消える
    const barDur = 4 * 60 / S.song.bpm; let el = now - seg.t0;
    for (let bi = 0; bi < seg.blocks.length; bi++) {
      const b = seg.blocks[bi], len = b.reps * b.bars * barDur;
      if (el < len) {
        const bar = Math.floor(el / barDur) % b.bars, x = document.querySelector('.bar[data-kind="' + (seg.preview ? seg.pk : 'list') + '"][data-bi="' + (seg.preview ? seg.pbi : bi) + '"][data-bar="' + bar + '"]');
        if (x) x.classList.add('play'); return;
      }
      el -= len;
    }
  }
  const trackLoop = () => { if (!playing) return; showPlaying(); raf = requestAnimationFrame(trackLoop); };
  async function play() {
    if (!previewBlocks && !S.blocks.length) { $('status').textContent = 'ブロックがまだない。「ブロックを作る」で足すか、「これだけ鳴らす」で聞く。'; return; }
    await ensure(); await loading;
    if (playing) return;
    playing = true; $('play').textContent = '▶ 再生中';
    const my = ++session; segs = []; cancelAnimationFrame(raf); raf = requestAnimationFrame(trackLoop);
    const run = () => {
      if (!playing || my !== session) return;
      const { ev, dur } = timeline(previewBlocks, previewInfo.bi), t0 = Math.max(ctx.currentTime + 0.08, nodesUntil);
      ev.forEach((e) => hit(ctx, (row) => partGain[PART_OF[row]], t0 + e.t, e.row, e.vel));
      segs.push({ t0, dur, preview: !!previewBlocks, pk: previewInfo.kind, pbi: previewInfo.bi, blocks: (previewBlocks || S.blocks).map((x) => ({ bars: x.bars, reps: x.reps })) }); if (segs.length > 3) segs.shift();
      nodesUntil = t0 + dur;
      if ($('loop').checked) timer = setTimeout(run, Math.max(50, (nodesUntil - ctx.currentTime - 1) * 1000));
      else timer = setTimeout(() => { if (my === session) stopAll(); }, (nodesUntil - ctx.currentTime + 1.5) * 1000);
    };
    run();
  }
  function stopAll() {
    playing = false; session++; clearTimeout(timer); cancelAnimationFrame(raf); segs = []; document.querySelectorAll('.bar.play').forEach((x) => x.classList.remove('play')); $('play').textContent = '▶ 再生'; previewBlocks = null; nodesUntil = 0; document.querySelectorAll('.bplay').forEach((x) => { x.textContent = '▶'; });
    if (ctx) {      // 予約済みの音を、まとめて止める(出力を作り直す)
      master.disconnect(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      PARTS.forEach(([k]) => { partGain[k].disconnect(); const g = ctx.createGain(); g.connect(master); partGain[k] = g; });
      updateGains();
    }
  }

  // ---- 書き出し ----
  // only: パート名(そのパートだけ) / blk: ブロック番号(そのブロックだけ。nullで全体) / unify: ブロックの長さを、いちばん長いものにそろえる
  async function render(only, blk, unify) {
    await ensure(); await loading;
    const { ev, dur, spans } = timeline(), rate = 44100, tail = 2.0, wrap = $('wrap').checked;
    let list = ev, len = dur, shift = 0;
    if (blk != null) {
      const sp = spans[blk]; shift = sp.t0; list = ev.filter((e) => e.bi === blk);
      const own = sp.t1 - sp.t0, ub = Math.round(+$('unifyBars').value || 0); len = unify ? (ub > 0 ? ub * 4 * 60 / S.song.bpm : Math.max(...spans.map((x) => x.t1 - x.t0))) : own;
      if (unify && Math.abs(len - own) > 0.001) {       // 足りない分は、くり返して、長さをそろえる
        const base = list.map((e) => ({ ...e, t: Math.max(0, e.t - shift) })); list = []; shift = 0;
        for (let k = 0; k * own < len - 0.001; k++) base.forEach((e) => { const t = e.t + k * own; if (t < len) list.push({ ...e, t }); });
      }
    }
    const off = new OfflineAudioContext(1, Math.ceil((len + tail) * rate), rate), out = off.createGain(); out.gain.value = 0.9; out.connect(off.destination);
    list.forEach((e) => { const part = PART_OF[e.row]; if (only ? part === only : audible(part)) hit(off, () => out, Math.max(0, e.t - shift), e.row, e.vel); });
    const buf = await off.startRendering(), n = Math.round(len * rate), d = buf.getChannelData(0);
    if (!wrap) return buf;
    const o = off.createBuffer(1, n, rate), od = o.getChannelData(0);
    for (let i = 0; i < d.length; i++) od[i % n] += d[i];
    return o;
  }
  async function exportWav(only, label, blk) {
    if (!S.blocks.length) { $('status').textContent = 'ブロックがまだない。'; return; }
    $('status').textContent = '書き出し中…';
    try { const buf = await render(only, blk, $('unify').checked), blob = audioBufferToWav(buf); saveBlob(blob, 'reggae_' + label + '.wav', $('status')); if (!window.claude) $('status').textContent = '書き出した: reggae_' + label + '.wav(' + (buf.length / buf.sampleRate).toFixed(1) + '秒)'; }
    catch (e) { $('status').textContent = '書き出せませんでした: ' + e.message; }
  }

  // ---- 画面 ----
  const el = (tag, attrs, html) => { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html !== undefined) e.innerHTML = html; return e; };
  const beatName = (st) => (st / 4 + 1).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + '拍目';
  function fmtTime(sec) { const m = Math.floor(sec / 60); return m + '分' + Math.round(sec - m * 60) + '秒'; }
  function updateTotal() { if (!S.blocks.length) { $('total').textContent = 'ブロックなし'; return; } const { dur } = timeline(), bars = S.blocks.reduce((a, b) => a + b.bars * b.reps, 0); $('total').textContent = bars + '小節 ' + fmtTime(dur); }
  const chip = (txt, cls, fn) => { const x = el('button', { type: 'button', className: 'chip' + (cls ? ' ' + cls : ''), textContent: txt }); x.onclick = fn; return x; };
  const line = (label, ...kids) => { const r = el('div', { className: 'bl' }); r.appendChild(el('span', { className: 'bk', textContent: label })); const w = el('span', { className: 'bv' }); kids.forEach((k) => w.appendChild(k)); r.appendChild(w); return r; };
  const OFF_SHORT = { HAT: 'ハ', OPEN: 'オ', RIM: 'リ', SNARE: 'ス', TOM: 'タ', KICK: 'キ' };
  const ACC_SHORT = { none: 'A無', omote: 'A表', ura: 'A裏', rand: 'A?' };
  const openB = new WeakSet();                       // 「⋯」を開いているブロック
  const curBlock = () => (S.cur ? (S.cur.k === 'draft' ? S.draft : S.blocks[S.cur.bi]) : null);
  const curBi = () => (S.cur && S.cur.k === 'list' ? S.cur.bi : 0);
  function changed(full) {
    save(); updateTotal();
    if (full) { const sc = $('seq').scrollTop; drawSeq(); $('seq').scrollTop = sc; drawSheet(); drawSongGrid(); }
  }

  // ---- ブロックの標準の設定(「⋯」の中) ----
  function controls(d, b, redraw) {
    const num = (label, key, min, max) => { const l = el('label', {}, label + ' '), inp = el('input', { type: 'number', min, max, value: b[key], inputMode: 'numeric' }); inp.onchange = () => { const v = Math.max(min, Math.min(max, Math.round(+inp.value || min))); inp.value = v; b[key] = v; changed(true); }; l.appendChild(inp); return l; };
    const r2 = el('div', { className: 'row' });
    if (!b.intro) {
      const bs = el('select'); [...new Set([4, 8, b.bars])].sort((x, y) => x - y).forEach((v) => { const o = el('option', { value: v, textContent: v + '小節' }); if (v === b.bars) o.selected = true; bs.appendChild(o); });
      bs.onchange = () => { b.bars = +bs.value; if (S.cur && curBlock() === b && S.cur.bar >= b.bars) S.cur.bar = 0; changed(true); };
      const bl = el('label', {}, '長さ '); bl.appendChild(bs); r2.appendChild(bl);
    }
    r2.appendChild(num('回数', 'reps', 1, 16)); d.appendChild(r2);
    if (b.intro) return;
    d.appendChild(el('div', { className: 'ttl2', textContent: '全小節の標準(小節ごとに、あとから変えられる)' }));
    const offs = el('span'); OFFS.forEach(([k, n]) => { offs.appendChild(chip(n, b.off[k] ? 'cut' : '', () => { b.off[k] = !b.off[k]; changed(true); redraw(); })); });
    d.appendChild(line('抜く音', offs));
    ADDS.forEach(([k, n]) => { const w = el('span'); LEVELS.forEach(([v, t]) => { w.appendChild(chip(t, b.add[k] === v ? 'on' : '', () => { b.add[k] = v; changed(true); redraw(); })); }); d.appendChild(line(n, w)); });
    const cr = el('span'); [[0, 'なし'], [1, '1拍目'], [3, '3拍目']].forEach(([v, n]) => { cr.appendChild(chip(n, b.crashAt === v ? 'on' : '', () => { b.crashAt = v; changed(true); redraw(); })); });
    cr.appendChild(el('small', { className: 'small', textContent: ' 最初の小節だけ' })); d.appendChild(line('クラッシュ', cr));
    const ac = el('span'); ACCENTS.forEach(([k, n]) => { ac.appendChild(chip(n, b.accent === k ? 'on' : '', () => { b.accent = k; changed(true); redraw(); })); });
    d.appendChild(line('アクセント', ac));
    const fs = el('select'); FILL_TYPES.forEach(([k, n]) => { const o = el('option', { value: k, textContent: n }); if (k === b.fillType) o.selected = true; fs.appendChild(o); });
    fs.onchange = () => { b.fillType = fs.value; b.alt = 0; applyFill(b); changed(true); redraw(); };
    const idea = el('button', { type: 'button', className: 'chip', textContent: '案を出す' }); idea.onclick = () => { if (b.fillType === 'none') b.fillType = 'tom'; b.alt++; applyFill(b); changed(true); redraw(); };
    d.appendChild(line('フィル', fs, idea));
    if (b.fillType !== 'none') {
      const ps = el('select'); ps.appendChild(el('option', { value: 0, textContent: '最後の小節(' + b.bars + '小節目)' }));
      for (let k = 1; k < b.bars; k++) { const o = el('option', { value: k, textContent: k + '小節目' }); if (k === b.fillBar) o.selected = true; ps.appendChild(o); }
      ps.onchange = () => { b.fillBar = +ps.value; changed(true); redraw(); };
      d.appendChild(line('入れる小節', ps));
    }
  }

  // ---- 並び: 小節の四角 ----
  function barCell(b, bi, k, kind) {
    const E = barEff(b, k), isSel = S.cur && S.cur.k === kind && S.cur.bi === bi && S.cur.bar === k;
    const x = el('button', { type: 'button', className: 'bar' + (E.fill ? ' fl' : E.ex ? ' ex' : '') + (isSel ? ' sel' : '') });
    x.dataset.kind = kind; x.dataset.bi = bi; x.dataset.bar = k;
    x.appendChild(el('span', { className: 'bn', textContent: String(k + 1) + (E.fill ? ' F' : '') }));
    const marks = [];
    if (E.crashAt) marks.push('C' + E.crashAt);
    if (E.add.open || E.add.ghost) marks.push('+' + (E.add.open ? 'O' : '') + (E.add.ghost ? 'ゴ' : ''));
    const cuts = OFFS.filter(([key]) => E.off[key]).map(([key]) => OFF_SHORT[key]).join('');
    if (cuts) marks.push('抜' + cuts);
    if (E.accent !== 'keep') marks.push(ACC_SHORT[E.accent]);
    if (marks.length) x.appendChild(el('i', { textContent: marks.join(' ') }));
    x.onclick = () => { const same = isSel; S.cur = same ? null : { k: kind, bi, bar: k }; S.pg.bar = 0; drawSeq(); drawSheet(); };
    return x;
  }
  function playOnly(b, kind, bi, btn) {
    if (playing && previewBlocks && previewBlocks[0] === b) { stopAll(); return; }
    if (playing) stopAll();
    previewBlocks = [b]; previewInfo = { kind, bi }; btn.textContent = '■'; play();
  }
  function blockCard(b, kind, bi) {
    const d = el('div', { className: 'bcard' + (kind === 'draft' ? ' draft' : '') });
    const head = el('div', { className: 'bt' });
    const title = kind === 'draft' ? 'ためす(まだ並びに入れていない)' : 'ブロック ' + (bi + 1) + (b.intro ? '(曲頭ロール)' : '') + '　× ' + b.reps + '回';
    head.appendChild(el('span', { className: 'btt', textContent: title }));
    const btns = el('span', { className: 'bbtns' });
    const pl = el('button', { type: 'button', className: 'sbtn bplay', textContent: '▶' }); pl.onclick = () => playOnly(b, kind, bi, pl); pl.title = 'このブロックだけ鳴らす'; btns.appendChild(pl);
    if (kind === 'draft') { const ad = el('button', { type: 'button', className: 'sbtn', textContent: '＋ 並びに入れる' }); ad.onclick = () => { S.blocks.push(JSON.parse(JSON.stringify(S.draft))); S.cur = { k: 'list', bi: S.blocks.length - 1, bar: 0 }; changed(true); setTimeout(() => { $('seq').scrollTop = $('seq').scrollHeight; }, 0); }; btns.appendChild(ad); }
    const more = el('button', { type: 'button', className: 'sbtn', textContent: '⋯' }); more.title = '長さ・回数・標準の設定・並べ替え・複製・削除'; more.onclick = () => { if (openB.has(b)) openB.delete(b); else openB.add(b); drawSeq(); }; btns.appendChild(more);
    head.appendChild(btns); d.appendChild(head);
    const g = el('div', { className: 'ovg' });
    if (b.intro) { const x = el('div', { className: 'bar fl intro' }); x.dataset.kind = kind; x.dataset.bi = bi; x.dataset.bar = 0; x.appendChild(el('span', { className: 'bn', textContent: 'ロール' })); g.appendChild(x); }
    else for (let k = 0; k < b.bars; k++) g.appendChild(barCell(b, bi, k, kind));
    d.appendChild(g);
    if (openB.has(b)) {
      const m = el('div', { className: 'bmore' });
      controls(m, b, drawSeq);
      if (kind === 'list') {
        const bt = el('div', { className: 'btns' });
        const mk = (txt, fn) => { const x = el('button', { type: 'button', className: 'sbtn', textContent: txt }); x.onclick = fn; bt.appendChild(x); };
        const fix = (n) => { if (S.cur && S.cur.k === 'list') { if (S.cur.bi === bi) S.cur.bi = n; else if (S.cur.bi === n) S.cur.bi = bi; } };
        mk('↑ 前へ', () => { if (bi > 0) { [S.blocks[bi - 1], S.blocks[bi]] = [S.blocks[bi], S.blocks[bi - 1]]; fix(bi - 1); changed(true); } });
        mk('↓ 後ろへ', () => { if (bi < S.blocks.length - 1) { [S.blocks[bi + 1], S.blocks[bi]] = [S.blocks[bi], S.blocks[bi + 1]]; fix(bi + 1); changed(true); } });
        mk('複製', () => { S.blocks.splice(bi + 1, 0, JSON.parse(JSON.stringify(b))); changed(true); });
        mk('🗑 消す', () => { S.blocks.splice(bi, 1); S.cur = null; changed(true); });
        m.appendChild(bt);
      }
      d.appendChild(m);
    }
    return d;
  }
  function drawSeq() {
    const box = $('seq'); box.innerHTML = '';
    box.appendChild(blockCard(S.draft, 'draft', 0));
    if (!S.blocks.length) box.appendChild(el('p', { className: 'small', textContent: 'まだブロックがない。上の「ためす」を直して、「＋ 並びに入れる」で足す。' }));
    S.blocks.forEach((b, i) => box.appendChild(blockCard(b, 'list', i)));
    const bt = el('div', { className: 'row' });
    const ai = el('button', { type: 'button', className: 'sbtn', textContent: '＋ 曲頭ロール' }); ai.onclick = () => { S.blocks.unshift(newIntro()); S.cur = null; changed(true); }; bt.appendChild(ai);
    const rs = el('button', { type: 'button', className: 'sbtn', textContent: 'ブロックを全部消す' }); rs.onclick = () => { if (!S.blocks.length || !window.confirm('並びのブロックを、全部消しますか？')) return; S.blocks = initial(); S.cur = null; changed(true); }; bt.appendChild(rs);
    box.appendChild(bt);
    box.appendChild(el('p', { className: 'small', textContent: '白=標準　黒=その小節だけ変えた　赤=フィル。C1・C3=クラッシュ(拍)　+O=オープン　+ゴ=ゴースト　抜=抜く音　A=アクセント。点滅=いま鳴っている小節。' }));
  }

  // ---- 選んだ小節の編集(下に固定) ----
  function barPanel(d, b, bar, bi) {
    const ovs = b.ov || (b.ov = {}), ov = () => ovs[bar] || (ovs[bar] = {}), E = barEff(b, bar);
    if (E.rows) d.appendChild(el('p', { className: 'small', textContent: 'この小節は、グリッドの形がそのまま鳴る。抜く音・足す音・アクセントは、効かない(「標準に戻す」で、また効く)。' }));
    const offs = el('span'); OFFS.forEach(([k, n]) => { offs.appendChild(chip(n, E.off[k] ? 'cut' : '', () => { const o = ov(); o.off = Object.assign({}, E.off); o.off[k] = !E.off[k]; changed(true); })); });
    d.appendChild(line('抜く音', offs));
    ADDS.forEach(([k, n]) => { const w = el('span'); LEVELS.forEach(([v, t]) => { w.appendChild(chip(t, E.add[k] === v ? 'on' : '', () => { const o = ov(); o.add = Object.assign({}, E.add); o.add[k] = v; changed(true); })); }); d.appendChild(line(n, w)); });
    const cr = el('span'); [[0, 'なし'], [1, '1拍目'], [3, '3拍目']].forEach(([v, n]) => { cr.appendChild(chip(n, E.crashAt === v ? 'on' : '', () => { ov().crashAt = v; changed(true); })); });
    d.appendChild(line('クラッシュ', cr));
    const ac = el('span'); ACCENTS.forEach(([k, n]) => { ac.appendChild(chip(n, E.accent === k ? 'on' : '', () => { ov().accent = k; changed(true); })); });
    d.appendChild(line('アクセント', ac));
    const fs = el('select'); FILL_TYPES.forEach(([k, n]) => { const o = el('option', { value: k, textContent: n }); if (k === (E.fill ? E.fill.type : 'none')) o.selected = true; fs.appendChild(o); });
    const setFill = (type, alt) => {
      const o = ov();
      if (type === 'none') { o.fill = { type: 'none' }; }
      else {
        const g = genFill(type, alt, false); o.fill = { type, alt, from: g.from, rows: g.rows }; focusFrom(g.from);
        if (o.rows) ROWS.forEach((n) => { for (let i = g.from; i < 16; i++) o.rows[n][i] = g.rows[n][i]; });   // グリッドを直した小節は、グリッドにフィルを書き込む
      }
      changed(true);
    };
    fs.onchange = () => setFill(fs.value, 0);
    const idea = el('button', { type: 'button', className: 'chip', textContent: '案を出す' }); idea.onclick = () => setFill(E.fill && E.fill.type ? E.fill.type : 'tom', ((E.fill && E.fill.alt) || 0) + 1);
    d.appendChild(line('フィル', fs, idea));
  }
  const focusFrom = (from) => { S.pg.bar = from >= 8 ? 1 : 0; };
  S.pg = { song: 0, bar: 0 };
  S.sheetTab = 'grid';
  function drawSheet() {
    const box = $('sheet'); box.innerHTML = '';
    const b = curBlock();
    if (!b || b.intro || S.cur.bar >= b.bars) { box.appendChild(el('p', { className: 'small', textContent: '小節の四角をタップすると、ここで、その小節のグリッドを直せる。' })); return; }
    const bar = S.cur.bar, bi = curBi(), ovs = b.ov || (b.ov = {});
    const sh = el('div', { className: 'sh' });
    sh.appendChild(el('b', { textContent: (S.cur.k === 'draft' ? 'ためす' : 'ブロック ' + (bi + 1)) + '・' + (bar + 1) + '小節目' + (ovs[bar] ? ' (変えた)' : '') }));
    const sb = el('span');
    const rb = el('button', { type: 'button', className: 'sbtn', textContent: '標準に戻す' }); rb.disabled = !ovs[bar]; rb.onclick = () => { delete ovs[bar]; changed(true); }; sb.appendChild(rb);
    const cb = el('button', { type: 'button', className: 'sbtn', textContent: '前の小節をコピー' }); cb.disabled = !(bar > 0 && ovs[bar - 1]); cb.onclick = () => { ovs[bar] = JSON.parse(JSON.stringify(ovs[bar - 1])); changed(true); }; sb.appendChild(cb);
    sh.appendChild(sb); box.appendChild(sh);
    const tabs = el('div', { className: 'stabs' });
    [['grid', 'グリッド'], ['how', '変え方']].forEach(([k, n]) => { const x = el('button', { type: 'button', className: 'stab' + (S.sheetTab === k ? ' on' : ''), textContent: n }); x.onclick = () => { S.sheetTab = k; drawSheet(); }; tabs.appendChild(x); });
    box.appendChild(tabs);
    if (S.sheetTab === 'how') { const d = el('div', { className: 'shbody' }); barPanel(d, b, bar, bi); box.appendChild(d); return; }
    const E = barEff(b, bar), g = el('div', { className: 'g sm' });
    const cur = () => (ovs[bar] && ovs[bar].rows) || effRows(b, bi, bar, barEff(b, bar));
    gridInto(g, {
      get: (n, i) => cur()[n][i],
      set: (n, i, v) => { const o = ovs[bar] || (ovs[bar] = {}); if (!o.rows) o.rows = copyRows(effRows(b, bi, bar, barEff(b, bar))); o.rows[n][i] = v; },
      tintFrom: E.fill ? E.fill.from : null,
    }, 'bar');
    box.appendChild(g);
  }

  // ---- グリッド(曲のリズム / 選んだ小節)----
  // 長押しが効いたあと、指を離したときのタップを1回だけ無視する(長押しでグリッドが作り直されるので、ページ全体で見る)
  let lpHeld = false, lpSwallow = false;
  document.addEventListener('pointerup', () => { if (lpHeld) { lpHeld = false; lpSwallow = true; setTimeout(() => { lpSwallow = false; }, 250); } }, true);
  document.addEventListener('pointercancel', () => { lpHeld = false; }, true);
  document.addEventListener('click', (e) => { if (lpSwallow) { lpSwallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
  function gridInto(g, o, key) {
    g.innerHTML = '';
    const pg = S.pg[key] || 0;
    const nav = el('div', { className: 'gnav' });
    const arrow = (txt, to) => { const x = el('button', { type: 'button', className: 'garrow', textContent: txt }); x.disabled = pg === to; x.onclick = () => { S.pg[key] = to; (key === 'song' ? drawSongGrid : drawSheet)(); }; return x; };
    nav.appendChild(arrow('←', 0)); nav.appendChild(el('span', { className: 'gpage', textContent: pg ? '3〜4拍目' : '1〜2拍目' })); nav.appendChild(arrow('→', 1));
    g.appendChild(nav);
    const hd = el('div', { className: 'ln hd' }); hd.appendChild(el('span', { className: 'nm' }));
    for (let i = pg * 8; i < pg * 8 + 8; i++) hd.appendChild(el('b', { textContent: i % 4 === 0 ? String(i / 4 + 1) : '' })); g.appendChild(hd);
    ROWS.forEach((n) => {
      const ln = el('div', { className: 'ln' }); ln.appendChild(el('span', { className: 'nm', textContent: n }));
      for (let i = pg * 8; i < pg * 8 + 8; i++) {
        const v = o.get(n, i), c = el('button', { type: 'button', className: 'c' + (i % 4 === 0 ? ' q' : '') + (v ? ' on' : '') + (v === 2 ? ' ac' : '') + (v === 3 ? ' gh' : '') + (n === 'HAT' && v === 1 ? ' hat' : '') });
        if (n === 'HAT' && v === 1) c.style.opacity = String(Math.min(1, Math.max(0.3, 0.25 + 0.75 * (hatFactor(curBi(), i) * 0.9) / 1.3)));
        if (o.tintFrom !== null && o.tintFrom !== undefined && i >= o.tintFrom) c.classList.add('fz');
        // タップ: 鳴る/休み。長押し: 休み→ゴースト、鳴る→アクセント、アクセント→鳴る、ゴースト→アクセント(ハードコアのビートと同じ)
        const setV = (f) => { o.set(n, i, f(o.get(n, i))); changed(true); };
        let lpT = null, lpDone = false, sx = 0, sy = 0;
        const lpClear = () => { if (lpT) { clearTimeout(lpT); lpT = null; } };
        c.addEventListener('pointerdown', (e) => {
          lpDone = false; sx = e.clientX; sy = e.clientY; lpClear();
          lpT = setTimeout(() => { lpT = null; lpDone = true; lpHeld = true; if (navigator.vibrate) navigator.vibrate(15); setV((v0) => ({ 0: 3, 1: 2, 2: 1, 3: 2 }[v0] || 2)); }, 450);
        });
        c.addEventListener('pointermove', (e) => { if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) lpClear(); });
        ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => c.addEventListener(t, lpClear));
        c.addEventListener('contextmenu', (e) => e.preventDefault());
        c.onclick = () => { if (lpDone) { lpDone = false; return; } setV((v0) => (v0 ? 0 : 1)); };
        ln.appendChild(c);
      }
      g.appendChild(ln);
    });
  }
  function drawSongGrid() {
    gridInto($('grid'), { get: (n, i) => S.song.rows[n][i], set: (n, i, v) => { S.song.rows[n][i] = v; }, tintFrom: null }, 'song');
  }

  // ---- パート・書き出し ----
  function drawParts() {
    const t = $('parts'); t.innerHTML = '';
    PARTS.forEach(([k, n]) => {
      const tr = el('tr'); tr.appendChild(el('td', { textContent: n }));
      const m = el('td', { className: 'm' }), mb = el('button', { type: 'button', textContent: 'M' }), sb = el('button', { type: 'button', textContent: 'S' });
      const sync = () => { mb.classList.toggle('on', !!S.mute[k]); sb.classList.toggle('on', !!S.solo[k]); };
      mb.onclick = () => { S.mute[k] = !S.mute[k]; sync(); updateGains(); }; sb.onclick = () => { S.solo[k] = !S.solo[k]; sync(); updateGains(); };
      m.appendChild(mb); m.appendChild(sb); tr.appendChild(m); sync();
      const e = el('td'), eb = el('button', { type: 'button', textContent: '書き出し' }); eb.onclick = () => exportWav(k, k); e.appendChild(eb); tr.appendChild(e); t.appendChild(tr);
    });
    [['ベース(仮)'], ['上音']].forEach(([n]) => { const tr = el('tr', { className: 'off' }); tr.appendChild(el('td', { textContent: n })); tr.appendChild(el('td', { colSpan: 2, textContent: 'あとで決める' })); t.appendChild(tr); });
  }
  function drawBlockExports() {
    const box = $('blkExp'); box.innerHTML = '';
    if (!S.blocks.length) { box.appendChild(el('p', { className: 'small', textContent: '並びにブロックを入れると、ここに、ブロックごとの書き出しが出る。' })); return; }
    S.blocks.forEach((b, i) => { const x = el('button', { type: 'button', textContent: 'ブロック ' + (i + 1) + (b.intro ? '(ロール)' : '(' + b.bars + '小節)') }); x.onclick = () => exportWav(null, 'block' + (i + 1), i); box.appendChild(x); });
  }
  const origChanged = changed;

  // ---- タブ ----
  function showTab(k) {
    ['r', 's', 'o'].forEach((t) => { $('pane' + t.toUpperCase()).hidden = t !== k; $('tab' + t.toUpperCase()).classList.toggle('on', t === k); });
    if (k === 'o') drawBlockExports();
    if (k === 's') { drawSeq(); drawSheet(); }
    if (k === 'r') drawSongGrid();
  }

  // ---- 起動 ----
  load();
  buildKnobs($('songBox'), [['shuffle', 'シャッフル', 50, 75, (v) => Math.round(v) + '%']], S.p, () => { changed(true); });
  buildKnobs($('hatBox'), [
    ['accvar', 'アクセントのブレ', 0, 100, (v) => String(Math.round(v))],
    ['sway', 'ゆれ', 0, 100, (v) => String(Math.round(v))],
  ], S.p, () => { changed(true); });
  const ps = $('pat'); Object.keys(PATTERNS).forEach((k) => { const o = el('option', { textContent: k }); if (k === S.song.pat) o.selected = true; ps.appendChild(o); });
  ps.onchange = () => { S.song.pat = ps.value; S.song.rows = PATTERNS[ps.value](); changed(true); };
  $('bpm').value = S.song.bpm; $('bpm').onchange = () => { const v = Math.max(50, Math.min(140, Math.round(+$('bpm').value || 76))); $('bpm').value = v; S.song.bpm = v; changed(false); };
  drawParts(); drawBlockExports(); drawSongGrid(); drawSeq(); drawSheet(); updateTotal();
  $('tabR').onclick = () => showTab('r'); $('tabS').onclick = () => showTab('s'); $('tabO').onclick = () => showTab('o');
  showTab('s');
  $('play').onclick = () => { if (playing) stopAll(); previewBlocks = null; play(); };
  $('stop').onclick = stopAll;
  $('land').onchange = updateTotal;
  $('saveMix').onclick = () => exportWav(null, 'mix');
})();
