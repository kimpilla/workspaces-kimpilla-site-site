// レゲエ・ビート: パターン(16分音符の並び)を、ブロック(パターン・長さ・テンポ・回数)として並べて鳴らす
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

  // ---- ブロック ----
  const newBlock = (pat, bars, fill) => {
    const b = { pat, bars, bpm: 76, reps: 1, rows: PATTERNS[pat](), fillType: fill || 'none', fillFrom: 0, fillRows: zero(), alt: 0, intro: false };
    if (b.fillType !== 'none') applyFill(b);
    return b;
  };
  const newIntro = () => { const b = newBlock('空(自分で作る)', 1, 'roll'); b.intro = true; applyFill(b); return b; };
  function applyFill(b) {
    if (b.fillType === 'none') { b.fillRows = zero(); b.fillFrom = 0; return; }
    const f = genFill(b.fillType, b.alt, b.intro); b.fillRows = f.rows; b.fillFrom = f.from;
  }
  const initial = () => [newBlock('ワンドロップ', 8), newBlock('ワンドロップ', 4, 'tom'), newBlock('ロッカーズ', 8, 'light')];

  const S = { blocks: initial(), sel: 0, mode: 'main', mute: {}, solo: {}, p: { shuffle: 58, accvar: 35, sway: 30 } };
  const KEY = 'kimpilla_reggae_v1';
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ blocks: S.blocks, p: S.p })); } catch (e) { /* 保存できなくても動く */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && Array.isArray(o.blocks) && o.blocks.length && o.blocks.every((b) => b && b.rows && ROWS.every((n) => Array.isArray(b.rows[n]) && b.rows[n].length === 16))) {
        o.blocks.forEach((b) => { if (!b.fillRows || !ROWS.every((n) => Array.isArray(b.fillRows[n]))) b.fillRows = zero(); b.alt = b.alt || 0; });
        S.blocks = o.blocks; if (o.p) Object.assign(S.p, o.p);
      }
    } catch (e) { /* 読めなければ、最初の状態 */ }
  }

  // ---- 乱数(同じ場所は、いつも同じ値。ドラマーの「クセ」)----
  function rnd(seed) { let x = (seed * 2654435761) >>> 0; x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 4294967296; }
  const hatFactor = (bi, step) => 1 + (rnd(bi * 131 + step * 7 + 3) - 0.5) * (S.p.accvar / 100) * 1.4;

  // ---- 並びを、音の予定(イベント)にする ----
  const effRows = (b, bar, repLast) => {
    if (!repLast || b.fillType === 'none') return b.rows;
    const o = {}; ROWS.forEach((n) => { o[n] = b.rows[n].map((v, i) => (i >= b.fillFrom ? b.fillRows[n][i] : v)); });
    if (b.intro) ROWS.forEach((n) => { o[n] = b.fillRows[n].slice(); });
    return o;
  };
  const warp = (frac, s) => (frac < 0.5 ? frac * (s / 0.5) : s + (frac - 0.5) * ((1 - s) / 0.5));
  function timeline() {
    const ev = []; let t = 0; const s = S.p.shuffle / 100; let landNext = false;
    S.blocks.forEach((b, bi) => {
      const spb = 60 / b.bpm;
      for (let rep = 0; rep < b.reps; rep++) {
        for (let bar = 0; bar < b.bars; bar++) {
          const last = bar === b.bars - 1, rows = effRows(b, bar, last), t0 = t, seedBar = bi * 1000 + rep * 100 + bar;
          const withFill = last && b.fillType !== 'none';
          if (landNext && $('land').checked && !rows.CRASH[0]) ev.push({ t: t0, row: 'CRASH', vel: 0.9 });
          landNext = withFill;
          ROWS.forEach((n) => {
            for (let i = 0; i < 16; i++) {
              const v = rows[n][i]; if (!v) continue;
              const beat = i / 4, frac = beat - Math.floor(beat);
              let tt = t0 + (Math.floor(beat) + warp(frac, s)) * spb, vel;
              if (n === 'HAT') {
                vel = (i % 4 === 0 ? 0.62 : i % 2 === 0 ? 0.42 : 0.34) * (v === 2 ? 1.45 : 1) * hatFactor(bi, i);
                tt += (rnd(seedBar * 17 + i * 5 + 11) - 0.5) * 2 * (S.p.sway / 100) * 0.02;
              } else vel = BASE_VEL[n] * (v === 2 ? 1.25 : 1);
              ev.push({ t: Math.max(0, tt), row: n, vel });
            }
          });
          t += 4 * spb;
        }
      }
    });
    return { ev, dur: t };
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
  async function render(only) {
    await ensure(); await loading;
    const { ev, dur } = timeline(), rate = 44100, tail = 2.0, wrap = $('wrap').checked;
    const off = new OfflineAudioContext(1, Math.ceil((dur + tail) * rate), rate), out = off.createGain(); out.gain.value = 0.9; out.connect(off.destination);
    ev.forEach((e) => { const part = PART_OF[e.row]; if (only ? part === only : audible(part)) hit(off, () => out, e.t, e.row, e.vel); });
    const buf = await off.startRendering(), n = Math.round(dur * rate), d = buf.getChannelData(0);
    if (!wrap) return buf;
    const o = off.createBuffer(1, n, rate), od = o.getChannelData(0);
    for (let i = 0; i < d.length; i++) od[i % n] += d[i];
    return o;
  }
  async function exportWav(only, label) {
    $('status').textContent = '書き出し中…';
    try { const buf = await render(only), blob = audioBufferToWav(buf); saveBlob(blob, 'reggae_' + label + '.wav', $('status')); if (!window.claude) $('status').textContent = '書き出した: reggae_' + label + '.wav(' + (buf.length / buf.sampleRate).toFixed(1) + '秒)'; }
    catch (e) { $('status').textContent = '書き出せませんでした: ' + e.message; }
  }

  // ---- 画面: ブロック ----
  const el = (tag, attrs, html) => { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html !== undefined) e.innerHTML = html; return e; };
  function fmtTime(sec) { const m = Math.floor(sec / 60); return m + '分' + Math.round(sec - m * 60) + '秒'; }
  function updateTotal() { const { dur } = timeline(), bars = S.blocks.reduce((a, b) => a + b.bars * b.reps, 0); $('total').textContent = '全体で ' + bars + '小節、' + fmtTime(dur); }
  function changed(redrawGrid) { save(); updateTotal(); if (redrawGrid) drawGrid(); }

  function accent(b, kind) {
    ['KICK', 'RIM', 'SNARE'].forEach((n) => {
      for (let i = 0; i < 16; i++) {
        if (!b.rows[n][i]) continue;
        const on = i % 4 === 0;
        b.rows[n][i] = kind === 'none' ? 1 : kind === 'omote' ? (on ? 2 : 1) : kind === 'ura' ? (on ? 1 : 2) : (Math.random() < 0.4 ? 2 : 1);
      }
    });
  }

  function drawBlocks() {
    const box = $('rows'); box.innerHTML = '';
    S.blocks.forEach((b, i) => {
      const d = el('div', { className: 'blk' + (i === S.sel ? ' sel' : '') });
      d.innerHTML = '<div class="ttl">ブロック ' + (i + 1) + (b.intro ? '<span class="tag">曲頭</span>' : '') + (b.fillType !== 'none' && !b.intro ? '<span class="tag fl">フィル入り</span>' : '') + '</div>';
      const row1 = el('div', { className: 'row' });
      if (!b.intro) {
        const sel = el('select'); Object.keys(PATTERNS).forEach((k) => { const o = el('option', { textContent: k }); if (k === b.pat) o.selected = true; sel.appendChild(o); });
        sel.onchange = () => { b.pat = sel.value; b.rows = PATTERNS[b.pat](); if (b.fillType !== 'none') applyFill(b); changed(true); drawBlocks(); };
        row1.appendChild(el('label', {}, 'パターン ')); row1.lastChild.appendChild(sel);
      }
      const num = (label, key, min, max) => { const l = el('label', {}, label + ' '), inp = el('input', { type: 'number', min, max, value: b[key], inputMode: 'numeric' }); inp.onchange = () => { const v = Math.max(min, Math.min(max, Math.round(+inp.value || min))); inp.value = v; b[key] = v; changed(false); }; l.appendChild(inp); return l; };
      const r2 = el('div', { className: 'row' });
      if (!b.intro) r2.appendChild(num('長さ(小節)', 'bars', 1, 64));
      r2.appendChild(num('テンポ', 'bpm', 50, 140)); r2.appendChild(num('回数', 'reps', 1, 16));
      d.appendChild(row1); d.appendChild(r2);
      if (!b.intro) {
        const ac = el('div', { className: 'acc' }); ac.appendChild(el('span', {}, 'アクセント<small class="small"> キック・スネア</small> '));
        [['omote', '表'], ['ura', '裏'], ['rand', 'ランダム'], ['none', 'なし']].forEach(([k, n]) => { const bt = el('button', { type: 'button', textContent: n }); bt.onclick = () => { accent(b, k); changed(true); }; ac.appendChild(bt); });
        d.appendChild(ac);
        const fr = el('div', { className: 'row' }), fs = el('select');
        FILL_TYPES.forEach(([k, n]) => { const o = el('option', { value: k, textContent: n }); if (k === b.fillType) o.selected = true; fs.appendChild(o); });
        fs.onchange = () => { b.fillType = fs.value; b.alt = 0; applyFill(b); if (b.fillType === 'none' && S.mode === 'fill' && i === S.sel) S.mode = 'main'; changed(true); drawBlocks(); };
        const idea = el('button', { type: 'button', textContent: '案を出す' }); idea.onclick = () => { if (b.fillType === 'none') { b.fillType = 'tom'; } b.alt++; applyFill(b); changed(true); drawBlocks(); };
        fr.appendChild(el('label', {}, 'フィル ')); fr.lastChild.appendChild(fs); fr.appendChild(idea);
        d.appendChild(fr);
      }
      const bt = el('div', { className: 'btns' });
      const mk = (txt, fn) => { const x = el('button', { type: 'button', textContent: txt }); x.onclick = fn; bt.appendChild(x); return x; };
      mk('編集', () => { S.sel = i; drawBlocks(); drawGrid(); $('gridTitle').scrollIntoView({ behavior: 'smooth' }); });
      mk('↑', () => { if (i > 0) { [S.blocks[i - 1], S.blocks[i]] = [S.blocks[i], S.blocks[i - 1]]; if (S.sel === i) S.sel = i - 1; changed(true); drawBlocks(); } });
      mk('↓', () => { if (i < S.blocks.length - 1) { [S.blocks[i + 1], S.blocks[i]] = [S.blocks[i], S.blocks[i + 1]]; if (S.sel === i) S.sel = i + 1; changed(true); drawBlocks(); } });
      mk('複製', () => { S.blocks.splice(i + 1, 0, JSON.parse(JSON.stringify(b))); changed(true); drawBlocks(); });
      mk('🗑', () => { if (S.blocks.length > 1) { S.blocks.splice(i, 1); S.sel = Math.min(S.sel, S.blocks.length - 1); changed(true); drawBlocks(); } });
      d.appendChild(bt); box.appendChild(d);
    });
  }

  // ---- 画面: グリッド ----
  function drawGrid() {
    const b = S.blocks[S.sel]; if (!b) return;
    if (S.mode === 'fill' && b.fillType === 'none') S.mode = 'main';
    $('modeMain').classList.toggle('on', S.mode === 'main'); $('modeFill').classList.toggle('on', S.mode === 'fill'); $('modeFill').disabled = b.fillType === 'none';
    $('gridTitle').textContent = 'ブロック ' + (S.sel + 1) + ' を直す' + (S.mode === 'fill' ? '(最後の小節のフィル)' : '');
    const g = $('grid'); g.innerHTML = '';
    const hd = el('div', { className: 'ln hd' }); hd.appendChild(el('span', { className: 'nm' })); for (let i = 0; i < 16; i++) hd.appendChild(el('b', { textContent: i % 4 === 0 ? String(i / 4 + 1) : '' })); g.appendChild(hd);
    const src = S.mode === 'fill' ? b.fillRows : b.rows;
    ROWS.forEach((n) => {
      const ln = el('div', { className: 'ln' }); ln.appendChild(el('span', { className: 'nm', textContent: n }));
      for (let i = 0; i < 16; i++) {
        const v = src[n][i], c = el('button', { type: 'button', className: 'c' + (i % 4 === 0 ? ' q' : '') + (v ? ' on' : '') + (v === 2 ? ' x' : '') + (n === 'HAT' && v ? ' hat' : '') });
        if (n === 'HAT' && v) c.style.opacity = String(Math.min(1, Math.max(0.3, 0.25 + 0.75 * (hatFactor(S.sel, i) * (v === 2 ? 1 : 0.9)) / 1.3)));
        if (S.mode === 'fill') { if (i < b.fillFrom) c.classList.add('dim'); }
        else if (b.fillType !== 'none' && i >= b.fillFrom) c.classList.add('fz');
        c.onclick = () => { src[n][i] = (src[n][i] + 1) % 3; changed(true); };
        ln.appendChild(c);
      }
      g.appendChild(ln);
    });
    $('gridNote').textContent = S.mode === 'fill'
      ? '薄い部分は、メインの小節がそのまま鳴る。濃い部分(' + (b.fillFrom / 4 + 1).toFixed(1).replace('.0', '') + '拍目から)を、フィルとして、タップで直せる。'
      : 'マスをタップするたびに、なし → 鳴る → アクセント(X)→ なし。ハイハットの濃さは、鳴る強さ(アクセントのブレで変わる)。' + (b.fillType !== 'none' ? '赤い部分は、最後の小節だけ、フィルに置き換わる。' : '');
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
  buildKnobs($('hatBox'), [
    ['shuffle', 'シャッフル', 50, 75, (v) => Math.round(v) + '%'],
    ['accvar', 'アクセントのブレ', 0, 100, (v) => String(Math.round(v))],
    ['sway', 'ゆれ', 0, 100, (v) => String(Math.round(v))],
  ], S.p, () => { changed(true); });
  drawBlocks(); drawParts(); drawGrid(); updateTotal();
  $('play').onclick = () => { play(); };
  $('stop').onclick = stopAll;
  $('add').onclick = () => { S.blocks.push(newBlock('ワンドロップ', 4)); S.sel = S.blocks.length - 1; changed(true); drawBlocks(); };
  $('addIntro').onclick = () => { S.blocks.unshift(newIntro()); S.sel = 0; changed(true); drawBlocks(); };
  $('reset').onclick = () => { S.blocks = initial(); S.sel = 0; S.mode = 'main'; changed(true); drawBlocks(); };
  $('modeMain').onclick = () => { S.mode = 'main'; drawGrid(); };
  $('modeFill').onclick = () => { S.mode = 'fill'; drawGrid(); };
  $('land').onchange = updateTotal;
  $('saveMix').onclick = () => exportWav(null, 'mix');
})();
