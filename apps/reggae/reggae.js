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
    const b = { bars, reps: 1, off: {}, add: { open: 0, ghost: 0 }, crashAt: 0, accent: 'keep', fillType: fill || 'none', fillFrom: 0, fillBar: 0, fillRows: zero(), alt: 0, intro: false };
    if (b.fillType !== 'none') applyFill(b);
    return b;
  };
  const newIntro = () => { const b = newBlock(1, 'roll'); b.intro = true; applyFill(b); return b; };
  function applyFill(b) {
    if (b.fillType === 'none') { b.fillRows = zero(); b.fillFrom = 0; return; }
    const f = genFill(b.fillType, b.alt, b.intro); b.fillRows = f.rows; b.fillFrom = f.from;
  }
  const initial = () => [newBlock(8), newBlock(4, 'tom'), newBlock(8, 'light')];

  const S = { song: { pat: 'ワンドロップ', rows: PATTERNS['ワンドロップ'](), bpm: 76 }, blocks: initial(), sel: 0, mute: {}, solo: {}, p: { shuffle: 58, accvar: 35, sway: 30 } };
  const KEY = 'kimpilla_reggae_v2';
  const okRows = (r) => r && ROWS.every((n) => Array.isArray(r[n]) && r[n].length === 16);
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ song: S.song, blocks: S.blocks, p: S.p })); } catch (e) { /* 保存できなくても動く */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.song && okRows(o.song.rows) && Array.isArray(o.blocks) && o.blocks.length) {
        o.blocks.forEach((b) => { if (!okRows(b.fillRows)) b.fillRows = zero(); b.off = b.off || {}; b.add = Object.assign({ open: 0, ghost: 0 }, b.add); b.alt = b.alt || 0; b.fillBar = b.fillBar || 0; b.crashAt = b.crashAt || 0; b.accent = b.accent || 'keep'; });
        S.song = { pat: o.song.pat, rows: o.song.rows, bpm: o.song.bpm || 76 }; S.blocks = o.blocks; if (o.p) Object.assign(S.p, o.p);
      }
    } catch (e) { /* 読めなければ、最初の状態 */ }
  }

  // ---- 乱数(同じ場所は、いつも同じ値。ドラマーの「クセ」)----
  function rnd(seed) { let x = (seed * 2654435761) >>> 0; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }
  const hatFactor = (bi, step) => 1 + (rnd(bi * 131 + step * 7 + 3) - 0.5) * (S.p.accvar / 100) * 1.4;

  // ---- 並びを、音の予定(イベント)にする ----
  // ブロックのメインの小節 = 曲のリズムから、抜く音を除き、アクセントを置き直したもの
  function blockMain(b, bi, bar) {
    const o = copyRows(S.song.rows), sd = bi * 7919 + (bar || 0) * 104729;
    OFFS.forEach(([k]) => { if (b.off[k]) OFF_ROWS[k].forEach((n) => { o[n].fill(0); }); });
    if (b.accent !== 'keep') ['KICK', 'RIM', 'SNARE'].forEach((n, ni) => {
      for (let i = 0; i < 16; i++) {
        if (!o[n][i]) continue;
        o[n][i] = b.accent === 'none' ? 1 : b.accent === 'omote' ? (i === 0 ? 2 : 1) : b.accent === 'ura' ? (i === 8 ? 2 : 1) : (rnd(bi * 977 + ni * 131 + i * 7 + 5) < 0.4 ? 2 : 1);
      }
    });
    // 足す音: 小節ごとに、ほんの少しだけ入る(同じ小節は、いつも同じ)
    const ph = [0, 0.22, 0.5][b.add.open], pg = [0, 0.1, 0.28][b.add.ghost];
    if (ph && !b.off.OPEN) [6, 14].forEach((i, k) => { if (o.HAT[i] && !o.OPEN[i] && rnd(sd + 31 + k * 17) < ph * (k ? 1 : 0.6)) { o.HAT[i] = 0; o.OPEN[i] = 1; } });
    if (pg && !b.off.RIM) [3, 7, 11, 14, 15].forEach((i, k) => { if (!o.RIM[i] && !o.SNARE[i] && rnd(sd + 97 + k * 13) < pg) o.RIM[i] = 3; });
    return o;
  }
  const effRows = (b, bi, isFill, bar) => {
    if (b.intro) return copyRows(b.fillRows);
    const m = blockMain(b, bi, bar);
    if (!isFill || b.fillType === 'none') return m;
    ROWS.forEach((n) => { for (let i = b.fillFrom; i < 16; i++) m[n][i] = b.fillRows[n][i]; });
    return m;
  };

  const warp = (frac, s) => (frac < 0.5 ? frac * (s / 0.5) : s + (frac - 0.5) * ((1 - s) / 0.5));
  function timeline() {
    const ev = []; let t = 0; const s = S.p.shuffle / 100; let landNext = false; const spb = 60 / S.song.bpm; const spans = [];
    S.blocks.forEach((b, bi) => {
      const tb = t;
      for (let rep = 0; rep < b.reps; rep++) {
        for (let bar = 0; bar < b.bars; bar++) {
          const fb = b.fillBar > 0 ? Math.min(b.fillBar, b.bars) - 1 : b.bars - 1;
          const last = bar === fb, rows = effRows(b, bi, last, bar), t0 = t, seedBar = bi * 1000 + rep * 100 + bar;
          const withFill = last && b.fillType !== 'none';
          const landing = landNext && $('land').checked;
          if (landing && !rows.CRASH[0]) ev.push({ t: t0, row: 'CRASH', vel: 0.9, bi });
          if (b.crashAt && bar === 0) { const st = b.crashAt === 3 ? 8 : 0; if (!rows.CRASH[st] && !(st === 0 && landing)) ev.push({ t: t0 + (st / 4) * spb, row: 'CRASH', vel: 0.9, bi }); }
          landNext = withFill;

          ROWS.forEach((n) => {
            for (let i = 0; i < 16; i++) {
              const v = rows[n][i]; if (!v) continue;
              const beat = i / 4, frac = beat - Math.floor(beat);
              let tt = t0 + (Math.floor(beat) + warp(frac, s)) * spb, vel;
              if (n === 'HAT') {
                vel = (i % 4 === 0 ? 0.62 : i % 2 === 0 ? 0.42 : 0.34) * (v === 2 ? 1.45 : 1) * hatFactor(bi, i);
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
  async function play() {
    await ensure(); await loading;
    if (playing) return;
    playing = true; $('play').textContent = '▶ 再生中';
    const my = ++session;
    const run = () => {
      if (!playing || my !== session) return;
      const { ev, dur } = timeline(), t0 = Math.max(ctx.currentTime + 0.08, nodesUntil);
      ev.forEach((e) => hit(ctx, (row) => partGain[PART_OF[row]], t0 + e.t, e.row, e.vel));
      nodesUntil = t0 + dur;
      if ($('loop').checked) timer = setTimeout(run, Math.max(50, (nodesUntil - ctx.currentTime - 1) * 1000));
      else timer = setTimeout(() => { if (my === session) stopAll(); }, (nodesUntil - ctx.currentTime + 1.5) * 1000);
    };
    run();
  }
  function stopAll() {
    playing = false; session++; clearTimeout(timer); $('play').textContent = '▶ 再生'; nodesUntil = 0;
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
    $('status').textContent = '書き出し中…';
    try { const buf = await render(only, blk, $('unify').checked), blob = audioBufferToWav(buf); saveBlob(blob, 'reggae_' + label + '.wav', $('status')); if (!window.claude) $('status').textContent = '書き出した: reggae_' + label + '.wav(' + (buf.length / buf.sampleRate).toFixed(1) + '秒)'; }
    catch (e) { $('status').textContent = '書き出せませんでした: ' + e.message; }
  }

  // ---- 画面: ブロック ----
  const el = (tag, attrs, html) => { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html !== undefined) e.innerHTML = html; return e; };
  const fillBarLabel = (b) => (b.fillBar > 0 ? Math.min(b.fillBar, b.bars) : b.bars) + '小節目';
  const beatName = (st) => (st / 4 + 1).toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + '拍目';
  function fmtTime(sec) { const m = Math.floor(sec / 60); return m + '分' + Math.round(sec - m * 60) + '秒'; }
  function updateTotal() { const { dur } = timeline(), bars = S.blocks.reduce((a, b) => a + b.bars * b.reps, 0); $('total').textContent = '全体で ' + bars + '小節、' + fmtTime(dur); }
  function changed(redrawGrid) { save(); updateTotal(); if (redrawGrid) drawGrid(); }
  const chip = (txt, cls, fn) => { const x = el('button', { type: 'button', className: 'chip' + (cls ? ' ' + cls : ''), textContent: txt }); x.onclick = fn; return x; };
  const line = (label, ...kids) => { const r = el('div', { className: 'bl' }); r.appendChild(el('span', { className: 'bk', textContent: label })); const w = el('span', { className: 'bv' }); kids.forEach((k) => w.appendChild(k)); r.appendChild(w); return r; };

  function drawBlocks() {
    const box = $('rows'); box.innerHTML = '';
    S.blocks.forEach((b, i) => {
      const d = el('div', { className: 'blk' + (i === S.sel ? ' sel' : '') });
      d.innerHTML = '<div class="ttl">ブロック ' + (i + 1) + '　' + (b.intro ? '' : b.bars + '小節 × ') + b.reps + '回' + (b.intro ? '<span class="tag">曲頭ロール</span>' : '') + (b.fillType !== 'none' && !b.intro ? '<span class="tag fl">フィル ' + fillBarLabel(b) + ' ' + beatName(b.fillFrom) + 'から</span>' : '') + '</div>';
      const num = (label, key, min, max) => { const l = el('label', {}, label + ' '), inp = el('input', { type: 'number', min, max, value: b[key], inputMode: 'numeric' }); inp.onchange = () => { const v = Math.max(min, Math.min(max, Math.round(+inp.value || min))); inp.value = v; b[key] = v; changed(false); drawBlocks(); }; l.appendChild(inp); return l; };
      const r2 = el('div', { className: 'row' });
      if (!b.intro) {
        const bs = el('select'); [...new Set([4, 8, b.bars])].sort((x, y) => x - y).forEach((v) => { const o = el('option', { value: v, textContent: v + '小節' }); if (v === b.bars) o.selected = true; bs.appendChild(o); });
        bs.onchange = () => { b.bars = +bs.value; changed(true); drawBlocks(); };
        const bl = el('label', {}, '長さ '); bl.appendChild(bs); r2.appendChild(bl);
      }
      r2.appendChild(num('回数', 'reps', 1, 16)); d.appendChild(r2);
      if (!b.intro) {
        const offs = el('span'); OFFS.forEach(([k, n]) => { offs.appendChild(chip(n, b.off[k] ? 'cut' : '', () => { b.off[k] = !b.off[k]; changed(true); drawBlocks(); })); });
        d.appendChild(line('抜く音', offs));
        ADDS.forEach(([k, n]) => { const w = el('span'); LEVELS.forEach(([v, t]) => { w.appendChild(chip(t, b.add[k] === v ? 'on' : '', () => { b.add[k] = v; changed(true); drawBlocks(); })); }); d.appendChild(line(n, w)); });
        const cr = el('span'); [[0, 'なし'], [1, '1拍目'], [3, '3拍目']].forEach(([v, n]) => { cr.appendChild(chip(n, b.crashAt === v ? 'on' : '', () => { b.crashAt = v; changed(false); drawBlocks(); })); });
        cr.appendChild(el('small', { className: 'small', textContent: ' 最初の小節だけ' })); d.appendChild(line('クラッシュ', cr));
        const ac = el('span'); ACCENTS.forEach(([k, n]) => { ac.appendChild(chip(n, b.accent === k ? 'on' : '', () => { b.accent = k; changed(true); drawBlocks(); })); });
        d.appendChild(line('アクセント', ac));
        const fs = el('select'); FILL_TYPES.forEach(([k, n]) => { const o = el('option', { value: k, textContent: n }); if (k === b.fillType) o.selected = true; fs.appendChild(o); });
        fs.onchange = () => { b.fillType = fs.value; b.alt = 0; applyFill(b); S.sel = i; changed(true); drawBlocks(); };
        const idea = el('button', { type: 'button', className: 'chip', textContent: '案を出す' }); idea.onclick = () => { if (b.fillType === 'none') b.fillType = 'tom'; b.alt++; applyFill(b); S.sel = i; changed(true); drawBlocks(); };
        d.appendChild(line('フィル', fs, idea));
        if (b.fillType !== 'none') {
          const ps = el('select'); ps.appendChild(el('option', { value: 0, textContent: '最後の小節(' + b.bars + '小節目)' }));
          for (let k = 1; k < b.bars; k++) { const o = el('option', { value: k, textContent: k + '小節目' }); if (k === b.fillBar) o.selected = true; ps.appendChild(o); }
          ps.onchange = () => { b.fillBar = +ps.value; changed(true); drawBlocks(); };
          d.appendChild(line('入れる小節', ps));
        }
      }
      const bt = el('div', { className: 'btns' });
      const mk = (txt, fn) => { const x = el('button', { type: 'button', textContent: txt }); x.onclick = fn; bt.appendChild(x); return x; };
      mk('書き出し', () => exportWav(null, 'block' + (i + 1), i));
      if (b.fillType !== 'none') mk('フィルを直す', () => { S.sel = i; drawBlocks(); drawGrid(); $('gridTitle').scrollIntoView({ behavior: 'smooth' }); });
      mk('↑', () => { if (i > 0) { [S.blocks[i - 1], S.blocks[i]] = [S.blocks[i], S.blocks[i - 1]]; if (S.sel === i) S.sel = i - 1; changed(true); drawBlocks(); } });
      mk('↓', () => { if (i < S.blocks.length - 1) { [S.blocks[i + 1], S.blocks[i]] = [S.blocks[i], S.blocks[i + 1]]; if (S.sel === i) S.sel = i + 1; changed(true); drawBlocks(); } });
      mk('複製', () => { S.blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(b))); changed(true); drawBlocks(); });
      mk('🗑', () => { if (S.blocks.length > 1) { S.blocks.splice(i, 1); S.sel = Math.min(S.sel, S.blocks.length - 1); changed(true); drawBlocks(); } });
      d.appendChild(bt); box.appendChild(d);
    });
  }

  // ---- 画面: グリッド(曲のリズム / 選んだブロックのフィル)----
  function gridInto(g, getSrc, opts) {
    g.innerHTML = '';
    const src = getSrc();
    for (let h = 0; h < 2; h++) {      // 1小節を、前半(1〜2拍)と後半(3〜4拍)の2段に分けて、マスを大きくする
      const hd = el('div', { className: 'ln hd' }); hd.appendChild(el('span', { className: 'nm' }));
      for (let i = h * 8; i < h * 8 + 8; i++) hd.appendChild(el('b', { textContent: i % 4 === 0 ? String(i / 4 + 1) : '' })); g.appendChild(hd);
      ROWS.forEach((n) => {
        const ln = el('div', { className: 'ln' }); ln.appendChild(el('span', { className: 'nm', textContent: n }));
        for (let i = h * 8; i < h * 8 + 8; i++) {
          const before = opts.fill && i < opts.from;      // フィルの前の部分は、メインの小節がそのまま鳴る(見るだけ)
          const v = before ? opts.pre[n][i] : src[n][i], c = el('button', { type: 'button', className: 'c' + (i % 4 === 0 ? ' q' : '') + (v ? ' on' : '') + (v === 2 ? ' x' : '') + (n === 'HAT' && v ? ' hat' : '') });
          if (n === 'HAT' && v) c.style.opacity = String(Math.min(1, Math.max(0.3, 0.25 + 0.75 * (hatFactor(S.sel, i) * (v === 2 ? 1 : 0.9)) / 1.3)));
          if (v === 3) { c.classList.add('on'); c.style.opacity = '.45'; }
          if (opts.fill) { c.classList.add(before ? 'pre' : 'fz'); if (before) c.disabled = true; }
          c.onclick = () => { if (before) return; src[n][i] = (src[n][i] + 1) % 3; changed(true); };
          ln.appendChild(c);
        }
        g.appendChild(ln);
      });
      if (h === 0) g.appendChild(el('div', { className: 'gap' }));
    }
  }
  function drawGrid() {
    gridInto($('grid'), () => S.song.rows, { fill: false });
    $('gridNote0').textContent = 'マスを1回タップ=鳴る(黒)、2回=アクセント(黒に白のX。強く鳴る)、3回=消える。ここを直すと、全ブロックに効く。ハイハットの濃さは、鳴る強さ(アクセントのブレで変わる)。';
    const b = S.blocks[S.sel], has = b && b.fillType !== 'none';
    $('fillBox').hidden = !has;
    if (!has) { $('fillNone').hidden = false; return; }
    $('fillNone').hidden = true;
    $('gridTitle').textContent = 'フィルを直す(ブロック ' + (S.sel + 1) + ')';
    const bi = S.sel;
    gridInto($('fgrid'), () => b.fillRows, { fill: true, from: b.fillFrom, pre: blockMain(b, bi, b.fillBar > 0 ? Math.min(b.fillBar, b.bars) - 1 : b.bars - 1) });
    $('gridNote').textContent = 'フィルの小節(' + fillBarLabel(b) + ')が、実際に鳴るとおりの形。左の灰色の部分は、そのブロックのメインの小節(抜く音・アクセント反映済み)がそのまま鳴る(ここでは直せない)。赤い部分(' + beatName(b.fillFrom) + 'から)が、フィル。タップで直せる。';
  }


  // ---- 画面: パート ----
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
  drawBlocks(); drawParts(); drawGrid(); updateTotal();
  $('play').onclick = () => { play(); };
  $('stop').onclick = stopAll;
  $('add').onclick = () => { S.blocks.push(newBlock(4)); S.sel = S.blocks.length - 1; changed(true); drawBlocks(); };
  $('addIntro').onclick = () => { S.blocks.unshift(newIntro()); S.sel = 0; changed(true); drawBlocks(); };
  $('reset').onclick = () => { S.blocks = initial(); S.song.rows = PATTERNS[S.song.pat](); S.sel = 0; changed(true); drawBlocks(); };
  $('land').onchange = updateTotal;
  $('saveMix').onclick = () => exportWav(null, 'mix');
})();
