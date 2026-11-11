// レゲエ・ビート: 曲のリズムは1つ。ブロックは「そのリズムをどう変えるか」(抜く音・フィル・クラッシュ・アクセント)だけを並べる
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);

  // ---- 行(表の上から順)と、パート ----
  const ROWS = ['CRASH', 'HAT', 'OPEN', 'RIM', 'SNARE', 'TIMB', 'T-HI', 'T-MID', 'T-LO', 'KICK'];
  const PART_OF = { CRASH: 'crash', HAT: 'hat', OPEN: 'hat', RIM: 'snare', SNARE: 'snare', TIMB: 'timb', 'T-HI': 'tom', 'T-MID': 'tom', 'T-LO': 'tom', KICK: 'kick' };
  const PARTS = [['hat', 'ハイハット'], ['kick', 'キック'], ['snare', 'スネア・リム'], ['tom', 'タム'], ['timb', 'ティンバレス'], ['crash', 'クラッシュ']];
  const BASE_VEL = { CRASH: 0.85, OPEN: 0.7, RIM: 0.8, SNARE: 0.8, TIMB: 0.75, 'T-HI': 0.78, 'T-MID': 0.78, 'T-LO': 0.78, KICK: 0.85 };
  const BUF = { KICK: ['kickS', 'kickH'], RIM: ['ssS', 'ssH'], SNARE: ['snS', 'snH'], HAT: ['htS', 'htH'], OPEN: ['hoS', 'hoS'], 'T-HI': ['t1', 't1'], 'T-MID': ['t2', 't2'], 'T-LO': ['t3', 't3'], CRASH: ['cr', 'cr'] };

  // 1小節 = 96コマ(1拍 = 24コマ)。16分(6コマごと)・8分3連(8コマ)・16分3連=6連(4コマ)・32分(3コマ)が、どれも置ける
  const SL = 24, NS = 96, U16 = 6;
  const zero = () => { const r = {}; ROWS.forEach((n) => { r[n] = new Array(NS).fill(0); }); return r; };
  const up16 = (r16) => { const r = {}; ROWS.forEach((n) => { r[n] = new Array(NS).fill(0); (r16[n] || []).forEach((v, i) => { if (v) r[n][i * U16] = v; }); }); return r; };
  const copyRows = (r) => { const o = {}; ROWS.forEach((n) => { o[n] = r[n].slice(); }); return o; };
  const hats8 = (r) => { for (let i = 0; i < NS; i += 12) r.HAT[i] = 1; };

  const PATTERNS = {
    'ワンドロップ': () => { const r = zero(); hats8(r); r.RIM[48] = 1; r.KICK[48] = 1; return r; },
    'ロッカーズ': () => { const r = zero(); hats8(r); r.RIM[48] = 1; r.KICK[0] = 1; r.KICK[48] = 1; return r; },
    'ステッパーズ': () => { const r = zero(); hats8(r); r.RIM[48] = 1; [0, 24, 48, 72].forEach((i) => { r.KICK[i] = 1; }); return r; },
    '空(自分で作る)': () => zero(),
  };

  // ---- フィル(最後の小節の後ろの部分を、置き換える)----
  const FILL_TYPES = [['none', 'なし'], ['tom', 'タムの下降'], ['light', '軽い飾り'], ['short', '半小節の短い頭'], ['roll', 'スネアロール']];
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  function genFill(type, alt, intro) {
    const r = {}; ROWS.forEach((n) => { r[n] = new Array(16).fill(0); }); let from = 0;
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
    return { from: from * U16, rows: up16(r) };
  }

  // ---- 曲のリズムと、ブロック(変え方)----
  const OFFS = [['HAT', 'ハット'], ['OPEN', 'オープン'], ['RIM', 'リム'], ['SNARE', 'スネア'], ['TIMB', 'ティンバレス'], ['TOM', 'タム'], ['KICK', 'キック']];
  const OFF_ROWS = { HAT: ['HAT'], OPEN: ['OPEN'], RIM: ['RIM'], SNARE: ['SNARE'], TIMB: ['TIMB'], TOM: ['T-HI', 'T-MID', 'T-LO'], KICK: ['KICK'] };
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

  const S = { song: { pat: 'ワンドロップ', rows: PATTERNS['ワンドロップ'](), bpm: 76 }, blocks: initial(), draft: newBlock(8), cur: null, mute: {}, solo: {}, p: { shuffle: 58, accvar: 35, sway: 30 }, kit: 'real', myFills: [] };
  const KEY = 'kimpilla_reggae_v2';
  const okRows = (r) => r && ROWS.filter((n) => n !== 'TIMB').every((n) => Array.isArray(r[n]) && (r[n].length === 16 || r[n].length === NS));
  const fix96 = (r) => { if (r && r.CRASH && r.CRASH.length === 16) return up16(r); if (r && r.CRASH && !r.TIMB) r.TIMB = new Array(r.CRASH.length).fill(0); return r; };
  const okFill = (f) => f && (f.grp === 'song' || f.grp === 'intro') && typeof f.name === 'string' && f.len > 0 && f.bars && f.bars[0] && Array.isArray(f.bars[0].hits) && f.bars[0].hits.every((h) => ROWS.includes(h[0]) && h[1] >= 0 && h[1] < 16);
  // テキスト保存: 96マスの段は、数字の文字列にして短くする
  const packRows = (k, v) => (Array.isArray(v) && v.length === NS && v.every((x) => x === 0 || x === 1 || x === 2 || x === 3)) ? 'r' + v.join('') : v;
  const unpackRows = (k, v) => (typeof v === 'string' && /^r[0-3]{96}$/.test(v)) ? v.slice(1).split('').map(Number) : v;
  const dataText = () => JSON.stringify({ app: 'reggae-beat', v: 1, song: S.song, blocks: S.blocks, draft: S.draft, p: S.p, kit: S.kit, myFills: S.myFills }, packRows, 1);
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ song: S.song, blocks: S.blocks, draft: S.draft, p: S.p, kit: S.kit, myFills: S.myFills })); } catch (e) { /* 保存できなくても動く */ } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (o && o.song && okRows(o.song.rows) && Array.isArray(o.blocks)) {
        o.blocks.forEach((b) => { if (!okRows(b.fillRows)) b.fillRows = zero(); else { if (b.fillRows.CRASH.length === 16 && b.fillFrom) b.fillFrom = b.fillFrom * U16; b.fillRows = fix96(b.fillRows); } if (b.ov) Object.keys(b.ov).forEach((k) => { const q = b.ov[k]; if (q.rows) q.rows = fix96(q.rows); if (q.fill && q.fill.rows) { if (q.fill.rows.CRASH.length === 16) q.fill.from *= U16; q.fill.rows = fix96(q.fill.rows); } }); b.ov = b.ov || {}; b.off = b.off || {}; b.add = Object.assign({ open: 0, ghost: 0 }, b.add); b.alt = b.alt || 0; b.fillBar = b.fillBar || 0; b.crashAt = b.crashAt || 0; b.accent = b.accent || 'keep'; });
        S.song = { pat: o.song.pat, rows: fix96(o.song.rows), bpm: o.song.bpm || 76, hat: o.song.hat || 12 }; S.blocks = o.blocks; if (o.draft && okRows(o.draft.fillRows)) { o.draft.fillRows = fix96(o.draft.fillRows); S.draft = Object.assign(newBlock(8), o.draft); S.draft.add = Object.assign({ open: 0, ghost: 0 }, S.draft.add); S.draft.off = S.draft.off || {}; } if (o.p) Object.assign(S.p, o.p); if (o.kit && o.kit in KITS) S.kit = o.kit; if (Array.isArray(o.myFills)) S.myFills = o.myFills.filter(okFill).map((f) => Object.assign(f, { mine: true }));
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
      for (let i = 0; i < NS; i++) {
        if (!o[n][i] || o[n][i] === 3) continue;
        o[n][i] = E.accent === 'none' ? 1 : E.accent === 'omote' ? (i === 0 ? 2 : 1) : E.accent === 'ura' ? (i === 48 ? 2 : 1) : (rnd(bi * 977 + ni * 131 + i * 7 + 5) < 0.4 ? 2 : 1);
      }
    });
    // 足す音: 小節ごとに、ほんの少しだけ入る(同じ小節は、いつも同じ)
    const ph = [0, 0.22, 0.5][E.add.open], pg = [0, 0.1, 0.28][E.add.ghost];
    if (E.det) {   // 小節の「足す音」タブ: 押したら必ず見える形に決める(少し=1か所、多め=2か所/4か所)
      if (E.add.open && !E.off.OPEN) (E.add.open === 1 ? [36] : [36, 84]).forEach((i) => { o.HAT[i] = 0; o.OPEN[i] = 1; });
      if (E.add.ghost && !E.off.RIM) (E.add.ghost === 1 ? [18] : [18, 42, 66, 90]).forEach((i) => { if (!o.RIM[i] && !o.SNARE[i]) o.RIM[i] = 3; });
      return o;
    }
    if (ph && !E.off.OPEN) [36, 84].forEach((i, k) => { if (o.HAT[i] && !o.OPEN[i] && rnd(sd + 31 + k * 17) < ph * (k ? 1 : 0.6)) { o.HAT[i] = 0; o.OPEN[i] = 1; } });
    if (pg && !E.off.RIM) [18, 42, 66, 84, 90].forEach((i, k) => { if (!o.RIM[i] && !o.SNARE[i] && rnd(sd + 97 + k * 13) < pg) o.RIM[i] = 3; });
    return o;
  }
  S.works = {};      // 小節ごとの「まだ保存していない直し」(別の小節を選んでも残る)
  const pendingHere = (bi, bar) => { const w = S.works['list-' + bi + '-' + bar]; return w && w.dirty ? w : null; };
  const effRows = (b, bi, bar, E) => {
    if (b.intro) return copyRows(b.fillRows);
    const pw = pendingHere(bi, bar); if (pw) E = Object.assign({}, E, { rows: pw.rows });     // まだ保存していない直しも、鳴らすと聞こえる
    let m;
    if (E.rows) m = copyRows(E.rows);
    else { m = blockMain(E, bi, bar); if (E.fill) ROWS.forEach((n) => { for (let i = E.fill.from; i < NS; i++) m[n][i] = E.fill.rows[n][i]; }); }
    OFFS.forEach(([k]) => { if (b.off && b.off[k]) OFF_ROWS[k].forEach((n) => { m[n].fill(0); }); });     // ミュートは、グリッドを直した小節にも効く
    return m;
  };
  // ミュートをかける前の、その小節の形(グリッド編集の元)。クラッシュも、グリッドの中に入れておく
  function baseRows(b, bi, bar) {
    const E = barEff(b, bar), E2 = Object.assign({}, E, { off: {} });
    let m;
    if (E.rows) m = copyRows(E.rows);
    else { m = blockMain(E2, bi, bar); if (E.fill) ROWS.forEach((n) => { for (let i = E.fill.from; i < NS; i++) m[n][i] = E.fill.rows[n][i]; }); }
    if (E.crashAt && !E.rows) m.CRASH[E.crashAt === 3 ? 48 : 0] = 1;
    return m;
  }

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
          const withFill = !!E.fill || !!(b.ov && b.ov[bar] && b.ov[bar].fl) || (pendingHere(bi, bar) ? pendingHere(bi, bar).fl : false);
          const landing = landNext && $('land').checked;
          if (landing && !rows.CRASH[0]) ev.push({ t: t0, row: 'CRASH', vel: 0.9, bi });
          if (E.crashAt) { const st = E.crashAt === 3 ? 48 : 0; if (!rows.CRASH[st] && !(st === 0 && landing)) ev.push({ t: t0 + (st / SL) * spb, row: 'CRASH', vel: 0.9, bi }); }
          landNext = withFill;

          ROWS.forEach((n) => {
            for (let i = 0; i < NS; i++) {
              const v = rows[n][i]; if (!v) continue;
              const beat = i / SL, frac = beat - Math.floor(beat);
              let tt = t0 + (Math.floor(beat) + (i % U16 === 0 ? warp(frac, s) : frac)) * spb, vel;     // シャッフルは16分の格子にだけかかる(3連・6連・32分は、そのまま)
              if (n === 'HAT') {
                vel = (i % 24 === 0 ? 0.62 : i % 12 === 0 ? 0.42 : 0.34) * (v === 2 ? 1.45 : v === 3 ? 0.45 : 1) * hatFactor(bi, i);
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

  // ---- 合成音(ハードコア・ビートと同じ作り): 録音を使わずに、その場で作る ----
  const nbCache = new WeakMap();
  const noiseBuf = (c) => { let b = nbCache.get(c); if (!b) { b = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; nbCache.set(c, b); } return b; };
  function noiseHit(c, out, t, type, freq, q, dec, g) {
    const s = c.createBufferSource(); s.buffer = noiseBuf(c);
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const e = c.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + dec);
    s.connect(f); f.connect(e); e.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.02);
  }
  function toneHit(c, out, t, f0, f1, dec, g, drop) {
    const o = c.createOscillator(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + (drop || 0.05));
    const e = c.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + dec);
    o.connect(e); e.connect(out); o.start(t); o.stop(t + dec + 0.02);
  }
  const METAL = [1, 1.4471, 1.6170, 1.9265, 2.5028, 2.6637];
  function metalHit(c, out, t, base, hp, dec, g) {
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp;
    const e = c.createGain(); e.gain.setValueAtTime(g, t); e.gain.exponentialRampToValueAtTime(0.001, t + dec);
    f.connect(e); e.connect(out);
    for (const m of METAL) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = base * m; o.connect(f); o.start(t); o.stop(t + dec + 0.02); }
  }
  const SYN_BAND = { K: { f0: 120, f1: 52, td: 0.06, dec: 0.3, click: 0.35, clickHz: 3500 }, S: { tone: 185, toneG: 0.45, toneDec: 0.1, nHz: 2000, nQ: 0.6, nDec: 0.17, wire: 0.45, wireDec: 0.2 }, T: { f0: 130, f1: 82, td: 0.07, dec: 0.45, click: 0.3 }, M: { f0: 175, f1: 118, td: 0.06, dec: 0.38, click: 0.3 }, O: { hp: 7500, dec: 0.4 }, H: { hp: 8500, dec: 0.05 }, C: { base: 300, hp: 4500, dec: 1.6, n: 0.5 } };
  // 最初の「レゲエドラム音の試作」の合成音(キック・リム・スネア・ハット・シンドラム風のタム・クラッシュ)
  function pnoise(c, out, t, dur, type, f, q, vol, decay) { const s = c.createBufferSource(); s.buffer = noiseBuf(c); s.loop = true; const bq = c.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q; const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + (decay || dur)); s.connect(bq); bq.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); }
  function ptone(c, out, t, type, f0, f1, sw, dur, vol) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + sw); const g = c.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur); o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05); }
  const PROTO = {
    KICK: (c, o, t, v) => { ptone(c, o, t, 'sine', 115, 46, 0.09, 0.42, 0.95 * v); pnoise(c, o, t, 0.02, 'lowpass', 1800, 0.7, 0.18 * v, 0.02); },
    RIM: (c, o, t, v) => { ptone(c, o, t, 'triangle', 1750, 1250, 0.02, 0.05, 0.5 * v); ptone(c, o, t, 'sine', 420, 380, 0.02, 0.06, 0.35 * v); pnoise(c, o, t, 0.04, 'bandpass', 2400, 1.2, 0.5 * v, 0.035); },
    SNARE: (c, o, t, v) => { ptone(c, o, t, 'triangle', 210, 160, 0.06, 0.14, 0.55 * v); pnoise(c, o, t, 0.2, 'highpass', 1600, 0.7, 0.75 * v, 0.17); },
    HAT: (c, o, t, v) => { pnoise(c, o, t, 0.06, 'highpass', 7200, 0.9, 0.42 * v, 0.045); },
    OPEN: (c, o, t, v) => { pnoise(c, o, t, 0.34, 'highpass', 6500, 0.9, 0.4 * v, 0.3); },
    'T-HI': (c, o, t, v) => { ptone(c, o, t, 'sine', 780, 230, 0.13, 0.34, 0.85 * v); pnoise(c, o, t, 0.02, 'highpass', 3000, 0.7, 0.2 * v, 0.015); },
    'T-MID': (c, o, t, v) => { ptone(c, o, t, 'sine', 600, 165, 0.15, 0.42, 0.9 * v); pnoise(c, o, t, 0.02, 'highpass', 3000, 0.7, 0.18 * v, 0.015); },
    'T-LO': (c, o, t, v) => { ptone(c, o, t, 'sine', 440, 112, 0.17, 0.52, 0.95 * v); pnoise(c, o, t, 0.02, 'highpass', 3000, 0.7, 0.16 * v, 0.015); },
    TIMB: (c, o, t, v) => { ptone(c, o, t, 'sine', 640, 600, 0.02, 0.3, 0.5 * v); ptone(c, o, t, 'sine', 1010, 960, 0.02, 0.22, 0.32 * v); ptone(c, o, t, 'sine', 1640, 1600, 0.02, 0.14, 0.2 * v); pnoise(c, o, t, 0.03, 'bandpass', 4200, 1.4, 0.55 * v, 0.03); },
    CRASH: (c, o, t, v) => { pnoise(c, o, t, 1.5, 'highpass', 4800, 0.7, 0.55 * v, 1.4); [3300, 4130, 5210, 6370].forEach((f) => ptone(c, o, t, 'square', f, f, 0, 0.9, 0.025 * v)); },
  };
  const KITS = { 'proto': 'レゲエ合成音(最初の試作)', 'real': '実録音(Big Rusty Drums)', 'machine': 'マシン(合成音)', 'band': 'バンド寄り(合成音)' };
  function synthHit(c, out, t, row, vel) {
    const v = Math.min(1.3, Math.max(0.15, vel));
    if (S.kit === 'proto') { PROTO[row](c, out, t, Math.min(1.2, Math.max(0.15, vel))); return; }
    if (S.kit === 'machine') {
      if (row === 'KICK') { toneHit(c, out, t, 160, 50, 0.22, v); noiseHit(c, out, t, 'lowpass', 2500, 1, 0.01, v * 0.3); }
      else if (row === 'SNARE') { toneHit(c, out, t, 300, 180, 0.08, v * 0.5); noiseHit(c, out, t, 'bandpass', 2200, 0.7, 0.14, v); }
      else if (row === 'RIM') { toneHit(c, out, t, 1800, 1500, 0.03, v * 0.5, 0.01); noiseHit(c, out, t, 'bandpass', 3200, 2, 0.03, v * 0.6); }
      else if (row === 'HAT') noiseHit(c, out, t, 'highpass', 7500, 1, 0.04, v);
      else if (row === 'OPEN') noiseHit(c, out, t, 'highpass', 6500, 1, 0.4, v * 0.9);
      else if (row === 'CRASH') noiseHit(c, out, t, 'highpass', 4000, 0.5, 1.2, v);
      else { const f = row === 'T-HI' ? [190, 125] : row === 'T-MID' ? [165, 110] : [120, 75]; toneHit(c, out, t, f[0], f[1], 0.3, v * 0.9, 0.06); noiseHit(c, out, t, 'bandpass', 1000, 1, 0.05, v * 0.25); }
      return;
    }
    const K = SYN_BAND, vv = v * (0.88 + 0.24 * Math.random());
    if (row === 'KICK') { toneHit(c, out, t, K.K.f0, K.K.f1, K.K.dec, vv, K.K.td); noiseHit(c, out, t, 'highpass', K.K.clickHz, 1, 0.008, vv * K.K.click); }
    else if (row === 'SNARE') { const P = K.S; toneHit(c, out, t, P.tone * 1.2, P.tone, P.toneDec, vv * P.toneG, 0.02); toneHit(c, out, t, P.tone * 1.9, P.tone * 1.8, P.toneDec * 0.7, vv * P.toneG * 0.4, 0.02); noiseHit(c, out, t, 'bandpass', P.nHz, P.nQ, P.nDec, vv); noiseHit(c, out, t, 'highpass', 5500, 0.7, P.wireDec, vv * P.wire); }
    else if (row === 'RIM') { toneHit(c, out, t, 1700, 1400, 0.035, vv * 0.5, 0.01); noiseHit(c, out, t, 'bandpass', 3000, 2, 0.03, vv * 0.6); }
    else if (row === 'HAT') noiseHit(c, out, t, 'highpass', K.H.hp, 1, K.H.dec, vv * 0.8);
    else if (row === 'OPEN') { noiseHit(c, out, t, 'highpass', K.O.hp, 1, K.O.dec, vv * 0.8); metalHit(c, out, t, 320, 6500, K.O.dec, vv * 0.05); }
    else if (row === 'CRASH') { const P = K.C; noiseHit(c, out, t, 'highpass', P.hp, 0.6, P.dec, vv * P.n); metalHit(c, out, t, P.base, P.hp, P.dec, vv * 0.07); }
    else { const P = row === 'T-LO' ? K.T : K.M, m = row === 'T-HI' ? 1.25 : 1; toneHit(c, out, t, P.f0 * m, P.f1 * m, P.dec, vv, P.td); toneHit(c, out, t, P.f0 * m * 1.5, P.f1 * m * 1.5, P.dec * 0.5, vv * 0.3, P.td); noiseHit(c, out, t, 'bandpass', 1200, 0.8, 0.03, vv * P.click); }
  }
  function hit(c, dest, t, row, vel) {
    if (row === 'TIMB') { PROTO.TIMB(c, dest(row), t, Math.min(1.2, Math.max(0.15, vel))); return; }      // ティンバレスは録音素材がないので、どの音でも合成音
    if (S.kit !== 'real') { synthHit(c, dest(row), t, row, vel); return; }
    const pair = BUF[row], name = vel >= 0.75 ? pair[1] : pair[0], src = c.createBufferSource(); src.buffer = buffers[name];
    const g = c.createGain(); g.gain.value = Math.min(1.3, Math.max(0.15, vel)); src.connect(g); g.connect(dest(row)); src.start(t);
  }

  // ---- 再生 ----
  let playing = false, timer = 0, session = 0, nodesUntil = 0, startAt = 0;
  // 鳴らしている小節を、小節ビューで点滅させる
  let segs = [], raf = 0;
  function showPlaying() {
    document.querySelectorAll('.bar.play').forEach((x) => x.classList.remove('play'));
    if (!playing || !ctx) return;
    const now = ctx.currentTime; let seg = null;
    segs.forEach((sg) => { if (sg.t0 <= now && now < sg.t0 + sg.dur) seg = sg; });
    if (!seg || Math.floor(now * 4) % 2) return;
    if (seg.audition) { const q = document.querySelector('.bar.sel'); if (q) q.classList.add('play'); return; }       // 0.25秒ごとに、つく・消える
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
      const tl = timeline(previewBlocks, previewInfo.bi); let ev = tl.ev; const dur = tl.dur, skip = startAt > 0 && startAt < dur ? startAt : 0; startAt = 0;
      if (skip) ev = ev.filter((e) => e.t >= skip).map((e) => Object.assign({}, e, { t: e.t - skip }));
      const t0 = Math.max(ctx.currentTime + 0.08, nodesUntil);
      ev.forEach((e) => hit(ctx, (row) => partGain[PART_OF[row]], t0 + e.t, e.row, e.vel));
      segs.push({ audition: !!S.audition, t0: t0 - skip, dur, preview: !!previewBlocks, pk: previewInfo.kind, pbi: previewInfo.bi, blocks: (previewBlocks || S.blocks).map((x) => ({ bars: x.bars, reps: x.reps })) }); if (segs.length > 3) segs.shift();
      nodesUntil = t0 + dur - skip;
      if ($('loop').checked || S.audition) timer = setTimeout(run, Math.max(50, (nodesUntil - ctx.currentTime - 1) * 1000));
      else timer = setTimeout(() => { if (my === session) stopAll(); }, (nodesUntil - ctx.currentTime + 1.5) * 1000);
    };
    run();
  }
  function stopAll() {
    const wasAud = S.audition; playing = false; session++; clearTimeout(timer); cancelAnimationFrame(raf); segs = []; document.querySelectorAll('.bar.play').forEach((x) => x.classList.remove('play')); $('play').textContent = '▶ 再生'; previewBlocks = null; S.audition = false; nodesUntil = 0; document.querySelectorAll('.bplay').forEach((x) => { x.textContent = '▶'; });
    if (ctx) {      // 予約済みの音を、まとめて止める(出力を作り直す)
      master.disconnect(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      PARTS.forEach(([k]) => { partGain[k].disconnect(); const g = ctx.createGain(); g.connect(master); partGain[k] = g; });
      updateGains();
    }
    if (wasAud) drawSheet();
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
  let rfT = 0;
  function refreshPlay() {       // 鳴らしている間に直したら、すぐ鳴らし直す(音は、ループの頭でまとめて予約しているため)
    if (!playing) return; clearTimeout(rfT);
    rfT = setTimeout(() => {
      if (!playing) return; const aud = S.audition, pb = previewBlocks, pi = previewInfo; let pos = 0;
      if (ctx) { const now = ctx.currentTime; segs.forEach((sg) => { if (sg.t0 <= now && now < sg.t0 + sg.dur) pos = now - sg.t0; }); }
      stopAll(); startAt = pos;     // いまの位置から続ける(頭に戻らない)
      if (aud) auditionBar(); else { previewBlocks = pb; previewInfo = pi; play(); }
    }, 120);
  }
  function changed(full) {
    save(); updateTotal(); refreshPlay();
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
    d.appendChild(line('ミュート', offs));
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
    const E = barEff(b, k), o = b.ov && b.ov[k], isSel = S.cur && S.cur.k === kind && S.cur.bi === bi && S.cur.bar === k;
    const dirty = !!pendingHere(bi, k);
    const x = el('button', { type: 'button', className: 'bar' + (E.fill || (o && o.fl) ? ' fl' : E.ex ? ' ex' : '') + (isSel ? ' sel' : '') + (dirty ? ' pend' : ''), textContent: String(k + 1) });
    x.dataset.kind = kind; x.dataset.bi = bi; x.dataset.bar = k;
    x.onclick = () => { S.cur = { k: kind, bi, bar: k }; drawSeq(); drawSheet(); const q = document.querySelector('.bar.sel'); if (q) q.scrollIntoView({ block: 'nearest' }); };
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
    const mu = OFFS.filter(([k]) => b.off && b.off[k]).map(([, n]) => n).join('・'), title = 'ブロック ' + (bi + 1) + (b.intro ? '・曲頭フィルイン' : '・' + b.bars + '小節・' + b.reps + '回') + (mu ? '・ミュート: ' + mu : '');
    head.appendChild(el('span', { className: 'btt', textContent: title }));
    const btns = el('span', { className: 'bbtns' });
    const pl = el('button', { type: 'button', className: 'sbtn bplay', textContent: '▶' }); pl.onclick = () => playOnly(b, kind, bi, pl); pl.title = 'このブロックだけ鳴らす'; btns.appendChild(pl);
    if (kind === 'draft') { const ad = el('button', { type: 'button', className: 'sbtn', textContent: '＋ 並びに入れる' }); ad.onclick = () => { S.blocks.push(JSON.parse(JSON.stringify(S.draft))); S.cur = { k: 'list', bi: S.blocks.length - 1, bar: 0 }; changed(true); setTimeout(() => { $('seq').scrollTop = $('seq').scrollHeight; }, 0); }; btns.appendChild(ad); }
    const more = el('button', { type: 'button', className: 'sbtn', textContent: '⋯' }); more.title = '長さ・回数・標準の設定・並べ替え・複製・削除'; more.onclick = () => { if (openB.has(b)) openB.delete(b); else openB.add(b); drawSeq(); }; btns.appendChild(more);
    head.appendChild(btns); d.appendChild(head);
    const g = el('div', { className: 'ovg' });
    if (b.intro) { const x = el('div', { className: 'bar fl intro' }); x.dataset.kind = kind; x.dataset.bi = bi; x.dataset.bar = 0; x.appendChild(el('span', { className: 'bn', textContent: '曲頭フィル' })); g.appendChild(x); }
    else for (let k = 0; k < b.bars; k++) g.appendChild(barCell(b, bi, k, kind));
    d.appendChild(g);
    if (openB.has(b)) {
      const m = el('div', { className: 'bmore' });
      controls(m, b, drawSeq);
      if (kind === 'list') {
        const bt = el('div', { className: 'btns' });
        const mk = (txt, fn) => { const x = el('button', { type: 'button', className: 'sbtn', textContent: txt }); x.onclick = fn; bt.appendChild(x); };
        const fix = (n) => { if (S.cur && S.cur.k === 'list') { if (S.cur.bi === bi) S.cur.bi = n; else if (S.cur.bi === n) S.cur.bi = bi; } };
        mk('↑ 前へ', () => { if (bi > 0) { S.works = {}; S.work = null; [S.blocks[bi - 1], S.blocks[bi]] = [S.blocks[bi], S.blocks[bi - 1]]; fix(bi - 1); changed(true); } });
        mk('↓ 後ろへ', () => { if (bi < S.blocks.length - 1) { S.works = {}; S.work = null; [S.blocks[bi + 1], S.blocks[bi]] = [S.blocks[bi], S.blocks[bi + 1]]; fix(bi + 1); changed(true); } });
        mk('複製', () => { S.works = {}; S.work = null; S.blocks.splice(bi + 1, 0, JSON.parse(JSON.stringify(b))); changed(true); });
        mk('🗑 消す', () => { S.works = {}; S.work = null; S.blocks.splice(bi, 1); S.cur = null; changed(true); });
        m.appendChild(bt);
      }
      d.appendChild(m);
    }
    return d;
  }
  function drawSeq() {
    const box = $('seq'); box.innerHTML = '';
    if (!S.blocks.length) {
      box.appendChild(el('p', { textContent: 'ブロックを作ると、小節の四角が出る。四角をタップして、小節を直す。曲頭の導入だけを書き出したいときは、1小節のブロックを作って、フィルのタブで導入を置く。' }));
      const r0 = el('div', { className: 'row' });
      [8, 4, 1].forEach((n) => { const x = el('button', { type: 'button', textContent: '＋ ' + n + '小節のブロックを作る' }); x.onclick = () => { S.blocks.push(newBlock(n)); S.cur = { k: 'list', bi: 0, bar: 0 }; S.work = null; S.works = {}; changed(true); }; r0.appendChild(x); });
      box.appendChild(r0);
    }
    S.blocks.forEach((b, i) => box.appendChild(blockCard(b, 'list', i)));
    const bt = el('div', { className: 'row' });
    const addB = (n) => { S.blocks.push(newBlock(n)); S.cur = { k: 'list', bi: S.blocks.length - 1, bar: 0 }; S.work = null; changed(true); };
    if (S.askLen) { bt.appendChild(el('span', { className: 'small', textContent: '長さ: ' })); [1, 4, 8].forEach((n) => { const x = el('button', { type: 'button', className: 'sbtn', textContent: n + '小節' }); x.onclick = () => { S.askLen = false; addB(n); }; bt.appendChild(x); }); }
    else { const ab = el('button', { type: 'button', className: 'sbtn', textContent: '＋ ブロック' }); ab.onclick = () => { S.askLen = true; drawSeq(); }; bt.appendChild(ab); }
    const rs = el('button', { type: 'button', className: 'sbtn', textContent: 'ブロックを全部消す' }); rs.onclick = () => { if (!S.blocks.length || !window.confirm('並びのブロックを、全部消しますか？')) return; S.blocks = initial(); S.cur = null; S.work = null; S.works = {}; changed(true); }; bt.appendChild(rs);
    box.appendChild(bt);
    box.appendChild(el('p', { className: 'small', textContent: '白=標準　黒=変えた小節　赤=フィル　点線=まだ保存していない　点滅=いま鳴っている小節' }));
  }

  // ---- 選んだ小節の編集(下に固定): 直して → 聞いて → 保存 ----
  S.pg = { song: 0, bar: 0 };
  S.sheetOpen = true; S.sheetTab = 'grid'; S.fillHalf = 1; S.fillSel = ''; S.fillAt = null; S.scope = 'this';
  const MUTE_OF = (b) => (n) => OFFS.some(([k]) => b.off && b.off[k] && OFF_ROWS[k].includes(n));
  // フィルのブロック。手本: スライ・ダンバーの曲頭ロール譜面(Todd Bishop 採譜、Serge Gainsbourg『Aux Armes et caetera』)を、譜面の位置のまま起こしたもの。
  // bars[i] = { from: この小節の何拍目から置き換えるか(0=1拍目), hits: [[行, 小節の頭からの拍(1拍=1), 1=鳴る/2=アクセント/3=ゴースト], …] }。3連・6連・32分も、そのまま(1/3拍=8コマ)
  // 譜面は、ゴーストの小さい音符=ゴースト(3)、アクセント記号=アクセント(2)、バズロール=2連打、ペダルのハイハット(下のx)=ゴーストのハット。タンバレやシンドラムは、近いタムに置く
  const T = 1 / 3, S6 = 1 / 6;
  const FILL_BLOCKS = [
    { grp: 'intro', name: 'Javanaise Remake の出だし(3拍)', at: 1, len: 3, note: '2拍目から。16分3連のスネア → 8分 → タム', bars: [{ from: 1, hits: [['SNARE', 1.5, 1], ['SNARE', 1.5 + S6, 1], ['SNARE', 1.5 + 2 * S6, 1], ['SNARE', 2, 1], ['T-HI', 2.5, 1], ['T-HI', 2.75, 1], ['T-HI', 3, 1]] }] },
    { grp: 'intro', name: 'Ecce Homo の出だし(2拍)', at: 2, len: 2, note: '3拍目から。ゴーストのスネア3つ → スネア → スネア → タム', bars: [{ from: 2, hits: [['SNARE', 2, 3], ['SNARE', 2.25, 3], ['SNARE', 2.5, 3], ['SNARE', 2.75, 1], ['SNARE', 3, 1], ['T-HI', 3.5, 1]] }] },
    { grp: 'intro', name: 'Overseas Telegram の出だし(1小節)', at: 0, len: 4, note: '1小節。バズのスネアとキック、最後にオープンハット', bars: [{ from: 0, hits: [['SNARE', 0, 1], ['SNARE', 0.125, 3], ['KICK', 0.5, 1], ['SNARE', 1.5, 1], ['SNARE', 1.625, 3], ['KICK', 2, 1], ['KICK', 2.5, 1], ['SNARE', 3, 2], ['OPEN', 3, 2], ['HAT', 3.5, 3]] }] },

    // 手本2: Stephen Taylor「5 Reggae Drum Fills」(無料PDF、stephensdrumshed.com)。PDFの音符の位置を数値で読み出して起こした。ゴースト=括弧つきの音、アクセント=>、x=クラッシュ
    // 譜面の高さ: 下のスペース=キック、2番目のスペース=フロアタム、3番目=スネア、上の線=ミドル、一番上のスペース=ハイタム
    { grp: 'song', name: 'Sinsemilla(Black Uhuru、Sly Dunbar)', at: 0, len: 4, note: '1小節。32分のタム → キック → フロア → 最後にスネア+クラッシュ', bars: [{ hits: [['T-HI', 0, 1], ['T-HI', 0.125, 1], ['KICK', 0.25, 1], ['KICK', 0.5, 1], ['T-MID', 0.75, 1], ['T-MID', 0.875, 1], ['KICK', 1, 1], ['KICK', 1.25, 1], ['T-LO', 1.5, 1], ['T-LO', 1.625, 1], ['KICK', 1.75, 1], ['KICK', 2, 1], ['T-LO', 2.25, 1], ['T-LO', 2.375, 1], ['KICK', 2.5, 1], ['KICK', 2.75, 1], ['KICK', 3, 1], ['SNARE', 3.5, 2], ['CRASH', 3.5, 1]] }] },
    { grp: 'song', name: 'Stranger in Town(Gregory Isaacs、Style Scott)', at: 1.5, len: 2.5, note: '2拍目の裏から。ゴーストのスネア3連 → スネア(アクセント) → フロア → ハイタム', bars: [{ hits: [['SNARE', 1.5, 3], ['SNARE', 1.5 + S6 * 1, 3], ['SNARE', 1.5 + S6 * 2, 3], ['SNARE', 2, 2], ['T-LO', 2.5, 1], ['T-HI', 3, 1]] }] },
    { grp: 'song', name: 'I Need a Roof(The Mighty Diamonds、Benbow Creary)', at: 3.5, len: 4.5, note: '4拍目の裏から次の小節の終わりまで(小節をまたぐ)。ゴースト3連 → スネア → フロア → ハイタム → フロア', bars: [{ hits: [['SNARE', 3.5, 3], ['SNARE', 3.5 + S6, 3], ['SNARE', 3.5 + 2 * S6, 1], ['SNARE', 4, 2], ['T-LO', 4.5, 1], ['T-HI', 5.5, 1], ['T-LO', 6.5, 1], ['T-LO', 7, 1]] }] },
    { grp: 'song', name: 'Soul Rebel(Bunny Wailer)', at: 2.75, len: 1.25, note: '4拍目の頭だけ。直前に、ゴーストのキック → スネア+クラッシュ', bars: [{ hits: [['KICK', 2.75, 3], ['SNARE', 3, 2], ['CRASH', 3, 1]] }] },
    { grp: 'song', name: 'Buffalo Soldier(Bob Marley、Carlton Barrett)', at: 0, len: 4, note: '1小節。4分3連のキック・スネア・スネア → スネア+キック → スネア → 8分3連のフロア2つ', bars: [{ hits: [['KICK', 0, 1], ['SNARE', 2 * T, 1], ['SNARE', 4 * T, 1], ['SNARE', 2, 1], ['KICK', 2, 1], ['SNARE', 2 + 2 * T, 1], ['T-LO', 2 + 4 * T, 1], ['T-LO', 2 + 5 * T, 1]] }] },
  ];
  FILL_BLOCKS.sort((a, b) => (a.grp === 'song' ? 0 : 1) - (b.grp === 'song' ? 0 : 1));
  const allFills = () => FILL_BLOCKS.concat(S.myFills).sort((a, b) => (a.grp === 'song' ? 0 : 1) - (b.grp === 'song' ? 0 : 1));
  function mkWork(b, bi, bar) {
    const key = 'list-' + bi + '-' + bar;
    if (S.works[key] && S.works[key].dirty) return S.works[key];      // 直している途中のものは、そのまま
    if (S.works[key]) { S.works[key].rows = baseRows(b, bi, bar); return S.works[key]; }      // 直していないものは、曲のリズムの変更などを、毎回取り込む
    const rows = baseRows(b, bi, bar), E = barEff(b, bar);
    return (S.works[key] = { key, rows, dirty: false, fl: !!(b.ov[bar] && b.ov[bar].fl) || !!E.fill, opts: { add: Object.assign({}, E.add), accent: E.accent, crashAt: rows.CRASH[0] ? 1 : rows.CRASH[48] ? 3 : 0 } });
  }
  function getWork(b, bi, bar) { S.work = mkWork(b, bi, bar); return S.work; }
  function auditionBar() {
    if (playing && S.audition) { stopAll(); drawSheet(); return; }
    if (playing) stopAll();
    const b = curBlock(), w = S.work;
    const tmp = { bars: 1, reps: 1, ov: { 0: { rows: w.rows, fl: w.fl } }, off: b.off, add: { open: 0, ghost: 0 }, crashAt: 0, accent: 'keep', fillType: 'none', fillFrom: 0, fillBar: 0, fillRows: zero(), alt: 0, intro: false };
    previewBlocks = [tmp]; previewInfo = { kind: S.cur.k, bi: curBi() }; S.audition = true; play().then(drawSheet);
  }
  function drawSheet() {
    const box = $('sheet'); box.innerHTML = '';
    const b = curBlock();
    if (!b || b.intro || S.cur.bar >= b.bars) { document.body.classList.add('shut'); box.appendChild(el('p', { className: 'small', textContent: S.blocks.length ? '上の小節の四角をタップすると、ここで、その小節を直せる。' : 'まず、上の「＋ 8小節のブロックを作る」を押す。' })); return; }
    const bar = S.cur.bar, bi = curBi(), ovs = b.ov || (b.ov = {}), w = getWork(b, bi, bar);
    const sh = el('div', { className: 'sh' });
    sh.appendChild(el('b', { textContent: 'ブロック ' + (bi + 1) + '・' + (bar + 1) + '小節目' }));
    sh.appendChild(el('span', { className: w.dirty ? 'pendtxt' : 'small', textContent: w.dirty ? 'まだ保存していない' : (ovs[bar] ? '変えた小節' : '標準') }));
    const fold = el('button', { type: 'button', className: 'sbtn foldbtn', textContent: S.sheetOpen ? '▼ グリッドを閉じる' : '▲ グリッドを開く' });
    fold.onclick = () => { S.sheetOpen = !S.sheetOpen; drawSheet(); };
    sh.appendChild(fold);
    document.body.classList.toggle('shut', !S.sheetOpen);
    box.appendChild(sh);
    const mini = el('div', { className: 'minirow' }); mini.style.gridTemplateColumns = 'repeat(' + b.bars + ', 1fr)';
    for (let k = 0; k < b.bars; k++) { const x = barCell(b, bi, k, S.cur.k); x.classList.add('mini'); mini.appendChild(x); }
    box.appendChild(mini);
    const act = el('div', { className: 'row' });
    const pl = el('button', { type: 'button', className: 'sbtn' + (playing && S.audition ? ' on' : ''), textContent: playing && S.audition ? '■ 止める' : '▶ この小節を鳴らす' }); pl.onclick = auditionBar; act.appendChild(pl);
    const pends = Object.keys(S.works).filter((k) => S.works[k].dirty && k.indexOf('list-' + bi + '-') === 0).map((k) => +k.split('-')[2]);
    const sv = el('button', { type: 'button', className: 'sbtn', textContent: '保存' }); sv.disabled = !(w.dirty || pends.length);
    sv.onclick = () => {
      const put = (k, src) => { const o = ovs[k] || (ovs[k] = {}); o.rows = copyRows(src.rows); o.fl = !!src.fl; o.crashAt = 0; delete o.fill; delete o.off; delete o.add; delete o.accent; };
      if (S.scope === 'pend') { pends.forEach((k) => { put(k, S.works['list-' + bi + '-' + k]); delete S.works['list-' + bi + '-' + k]; }); }
      else {
        const from = S.scope === 'all' ? 0 : bar, to = S.scope === 'this' ? bar : b.bars - 1;
        for (let k = from; k <= to; k++) { put(k, w); delete S.works['list-' + bi + '-' + k]; }
      }
      S.work = null; changed(true);
    };
    act.appendChild(sv);
    const rs = el('button', { type: 'button', className: 'sbtn', textContent: '元に戻す' }); rs.disabled = !w.dirty; rs.onclick = () => { delete S.works[w.key]; S.work = null; changed(true); }; act.appendChild(rs);
    const sc = el('select'); [['this', '保存: この小節だけ'], ['pend', '保存: 直した小節すべて(点線)'], ['tail', '保存: ここから最後まで'], ['all', '保存: ブロックの全部']].forEach(([v, t]) => { const o = el('option', { value: v, textContent: t }); if (v === S.scope) o.selected = true; sc.appendChild(o); });
    sc.onchange = () => { S.scope = sc.value; }; act.appendChild(sc);
    box.appendChild(act);
    const act2 = el('div', { className: 'row' });
    const std = el('button', { type: 'button', className: 'sbtn', textContent: '標準にする' }); std.disabled = !ovs[bar]; std.onclick = () => { delete ovs[bar]; delete S.works[w.key]; S.work = null; changed(true); }; act2.appendChild(std);
    const cp = el('button', { type: 'button', className: 'sbtn', textContent: '前の小節をコピー' }); cp.disabled = !(bar > 0 && ovs[bar - 1]); cp.onclick = () => { ovs[bar] = JSON.parse(JSON.stringify(ovs[bar - 1])); delete S.works[w.key]; S.work = null; changed(true); }; act2.appendChild(cp);
    if (!S.sheetOpen) return;
    const tabs = el('div', { className: 'stabs' });
    [['grid', 'グリッド'], ['fill', 'フィル'], ['how', '足す音'], ['mute', 'ミュート']].forEach(([k, n]) => { const x = el('button', { type: 'button', className: 'stab' + (S.sheetTab === k ? ' on' : ''), textContent: n }); x.onclick = () => { S.sheetTab = k; drawSheet(); }; tabs.appendChild(x); });
    box.appendChild(tabs);
    const muted = MUTE_OF(b), edit = (n, i, v) => { w.rows[n][i] = v; w.dirty = true; };
    const grid = (page) => { const g = el('div', { className: 'g sm' }); gridInto(g, { get: (n, i) => w.rows[n][i], set: edit, tintFrom: null, muted, onChange: () => { drawSeq(); drawSheet(); refreshPlay(); } }, 'bar', page); return g; };
    const body = el('div', { className: 'shbody' });
    if (S.sheetTab === 'grid') { body.appendChild(grid()); body.appendChild(el('p', { className: 'small', textContent: 'タップ=鳴る/休み。長押し=アクセント・ゴースト。薄い行は、ミュート中。' })); }
    else if (S.sheetTab === 'mute') {
      const offs = el('span'); OFFS.forEach(([k, n]) => { offs.appendChild(chip(n, b.off[k] ? 'cut' : '', () => { b.off[k] = !b.off[k]; changed(true); })); });
      body.appendChild(line('ミュート', offs));
      body.appendChild(el('p', { className: 'small', textContent: '押した楽器は、このブロックの全部の小節で鳴らない(書き出しでも抜ける)。もう一度押すと戻る。保存はいらない。' }));
    } else if (S.sheetTab === 'how') {
      const recompute = () => {
        const E = barEff(b, bar), o = w.opts, m = blockMain({ off: {}, add: o.add, accent: o.accent, det: true }, bi, bar);
        if (o.crashAt) m.CRASH[o.crashAt === 3 ? 48 : 0] = 1;
        w.rows = m; w.dirty = true; w.fl = false; changed(true);
      };
      ADDS.forEach(([k, n]) => { const wv = el('span'); LEVELS.forEach(([v, t]) => { wv.appendChild(chip(t, w.opts.add[k] === v ? 'on' : '', () => { w.opts.add[k] = v; recompute(); })); }); body.appendChild(line(n, wv)); });
      const cr = el('span'); [[0, 'なし'], [1, '1拍目'], [3, '3拍目']].forEach(([v, n]) => { cr.appendChild(chip(n, w.opts.crashAt === v ? 'on' : '', () => { w.opts.crashAt = v; recompute(); })); }); body.appendChild(line('クラッシュ', cr));
      const ac = el('span'); ACCENTS.forEach(([k, n]) => { ac.appendChild(chip(n, w.opts.accent === k ? 'on' : '', () => { w.opts.accent = k; recompute(); })); }); body.appendChild(line('アクセント', ac));
      body.appendChild(el('p', { className: 'small', textContent: '押すと、この小節のグリッドが作り直される(グリッドで手直しした分は消える)。「少し」は1〜2拍目に1か所、「多め」は小節の中に複数入る。グリッドのタブで確認して、聞いて、良ければ「保存」。' }));
    } else {
      body.appendChild(el('p', { className: 'small', textContent: '「置く場所」を決めて、フィルのブロックを「あてはめる」と、いま選んでいる小節(から後ろ)のグリッドが、その形に替わる。小節の終わりを越える分は、次の小節に続く(点線の小節ができる)。聞いて、良ければ「保存」。手本の譜面から、譜面の位置のまま起こしたもの(3連・6連は、グリッドの「細かさ」を切り替えると見える)。' }));
      // 置く場所: ブロックを、選んでいる小節の何拍目から置くか(小節の終わりを越える分は、次の小節に続く)
      const atSel = el('select'); atSel.appendChild(el('option', { value: '', textContent: '元の位置' }));
      for (let h = 0; h < 8; h++) { const v = h / 2; const o = el('option', { value: String(v), textContent: (Math.floor(v) + 1) + '拍目' + (h % 2 ? 'の裏' : '') }); if (S.fillAt === v) o.selected = true; atSel.appendChild(o); }
      atSel.onchange = () => { S.fillAt = atSel.value === '' ? null : Number(atSel.value); drawSheet(); };
      body.appendChild(line('置く場所(この小節の)', atSel));
      let lastGrp = '';
      allFills().forEach((fb) => {
        if (fb.grp !== lastGrp) { lastGrp = fb.grp; body.appendChild(el('p', { className: 'small', textContent: fb.grp === 'song' ? '【曲の途中・つなぎのフィル】手本: Stephen Taylor「5 Reggae Drum Fills」(Black Uhuru、Gregory Isaacs など、実際の曲)' : '【曲頭の導入】手本: Sly Dunbar の曲頭ロール。曲の頭に入るもの(途中のフィルの手本ではない)' })); }
        const r = el('div', { className: 'row' });
        const start = S.fillAt == null ? fb.at : S.fillAt, endB = start + fb.len, need = Math.ceil(endB / 4), ok = bar + need <= b.bars;
        const x = el('button', { type: 'button', className: 'sbtn', textContent: 'あてはめる' }); x.disabled = !ok;
        x.onclick = () => {
          let fine = 0;
          const g0 = Math.round(start * SL), g1 = Math.round(endB * SL), wks = {};
          const W = (k) => wks[k] || (wks[k] = mkWork(b, bi, bar + k));
          for (let g = g0; g < g1; g++) { const wk = W(Math.floor(g / NS)); ROWS.forEach((n) => { if (n !== 'CRASH') wk.rows[n][g % NS] = 0; }); }
          fb.bars[0].hits.forEach(([n, pos, v]) => { const g = Math.round((start + pos - fb.at) * SL), wk = W(Math.floor(g / NS)), s = g % NS; wk.rows[n][s] = v; if (s % U16 && s % 4 === 0) fine = 6; else if (s % U16 && s % 3 === 0 && !fine) fine = 8; });
          Object.values(wks).forEach((wk) => { wk.dirty = true; wk.fl = true; });
          if (fine) S.res = fine;
          S.sheetTab = 'grid'; if (need > 1) S.scope = 'pend'; S.pg.bar = Math.floor((g0 % NS) / (SL * (S.res <= 6 ? 2 : 1))); drawSeq(); drawSheet(); refreshPlay();
        };
        r.appendChild(x); r.appendChild(el('span', { textContent: fb.name + (fb.mine ? '(自分)' : '') + (ok ? '' : '(この小節からは入らない)') }));
        if (fb.mine) { const dl = el('button', { type: 'button', className: 'sbtn', textContent: '消す' }); dl.onclick = () => { S.myFills = S.myFills.filter((f) => f !== fb); save(); drawSheet(); }; r.appendChild(dl); } r.appendChild(el('span', { className: 'small', textContent: ' ' + (need > 1 ? '【次の小節に続く】' : '') + (Math.abs(endB / 4 - Math.round(endB / 4)) > 1e-6 ? '【終わりが小節の頭に着かない】' : '') + fb.note }));
        body.appendChild(r);
      });
      // 自分のフィルを作る: いま選んでいる小節のグリッドの、決めた範囲を登録する
      const mk = el('details', { className: 'fold' }); mk.open = !!S.mkOpen; mk.ontoggle = () => { S.mkOpen = mk.open; };
      mk.appendChild(el('summary', { textContent: '自分のフィルを作る(グリッドの形を登録)' }));
      mk.appendChild(el('p', { className: 'small', textContent: '先に「グリッド」のタブで、この小節をフィルの形に直しておく(フィルにしたい範囲以外は、そのままでよい)。ここで範囲を決めて登録すると、その範囲の音が、一覧に加わる。' }));
      const mGrp = el('select'); [['song', '曲の途中のフィル'], ['intro', '曲頭の導入']].forEach(([v, t]) => mGrp.appendChild(el('option', { value: v, textContent: t })));
      const mSt = el('select'); for (let h = 0; h < 8; h++) mSt.appendChild(el('option', { value: String(h / 2), textContent: (Math.floor(h / 2) + 1) + '拍目' + (h % 2 ? 'の裏' : '') }));
      const mLn = el('select'); for (let h = 1; h <= 16; h++) { const o = el('option', { value: String(h / 2), textContent: h / 2 + '拍' }); if (h === 4) o.selected = true; mLn.appendChild(o); }
      const mNm = el('input', { type: 'text', placeholder: '名前(例: 4小節目のフィル)' }); mNm.style.width = '12em';
      const mGo = el('button', { type: 'button', className: 'sbtn', textContent: '登録する' });
      mGo.onclick = () => {
        const st = Number(mSt.value), ln = Number(mLn.value), g0 = Math.round(st * SL), g1 = Math.round((st + ln) * SL), need = Math.ceil((st + ln) / 4), hits = [];
        if (bar + need > b.bars) { mMsg.textContent = 'この小節からでは、範囲がブロックの終わりを越える。'; return; }
        for (let g = g0; g < g1; g++) { const wk = mkWork(b, bi, bar + Math.floor(g / NS)), q = g % NS; ROWS.forEach((n) => { const v = wk.rows[n][q]; if (v) hits.push([n, Math.round(g / SL * 10000) / 10000, v]); }); }
        if (!hits.length) { mMsg.textContent = 'その範囲には、音がない。'; return; }
        const nm = mNm.value.trim() || ('自分のフィル ' + (S.myFills.length + 1));
        S.myFills.push({ grp: mGrp.value, mine: true, name: nm, at: st, len: ln, note: '自分で作った(' + (Math.floor(st) + 1) + '拍目' + (st % 1 ? 'の裏' : '') + 'から' + ln + '拍、音' + hits.length + '個)', bars: [{ hits }] });
        S.mkOpen = true; save(); drawSheet();
      };
      const mMsg = el('p', { className: 'small' });
      mk.appendChild(line('種類', mGrp)); mk.appendChild(line('始まり(この小節の)', mSt)); mk.appendChild(line('長さ', mLn)); mk.appendChild(line('名前', mNm)); mk.appendChild(mGo); mk.appendChild(mMsg);
      body.appendChild(mk);
      body.appendChild(el('p', { className: 'small', textContent: 'フィルのあとの小節の1拍目には、クラッシュが鳴る(「曲のリズム」の設定)。' }));
    }
    box.appendChild(body);
    box.appendChild(act2);
  }

  // ---- グリッド(曲のリズム / 選んだ小節)----
  // 長押しが効いたあと、指を離したときのタップを1回だけ無視する(長押しでグリッドが作り直されるので、ページ全体で見る)
  let lpHeld = false, lpSwallow = false;
  document.addEventListener('pointerup', () => { if (lpHeld) { lpHeld = false; lpSwallow = true; setTimeout(() => { lpSwallow = false; }, 250); } }, true);
  document.addEventListener('pointercancel', () => { lpHeld = false; }, true);
  document.addEventListener('click', (e) => { if (lpSwallow) { lpSwallow = false; e.stopPropagation(); e.preventDefault(); } }, true);
  const RES = [[2, '8分'], [4, '16分'], [3, '8分3連'], [6, '16分3連'], [8, '32分']];
  S.res = 4;       // 1拍を何個に割るか(3連・6連・32分は、譜面のフィルを置くため)
  function gridInto(g, o, key) {
    g.innerHTML = '';
    const res = S.res, step = SL / res, bpp = res <= 6 ? 2 : 1, pages = 4 / bpp, pg = Math.min(S.pg[key] || 0, pages - 1), cols = bpp * res, redraw = () => (key === 'song' ? drawSongGrid : drawSheet)();
    const rr = el('div', { className: 'row' }); rr.appendChild(el('span', { className: 'small', textContent: '細かさ' }));
    RES.forEach(([v, t]) => { const x = el('button', { type: 'button', className: 'chip' + (v === res ? ' on' : ''), textContent: t }); x.onclick = () => { S.res = v; S.pg[key] = 0; redraw(); }; rr.appendChild(x); });
    g.appendChild(rr);
    const nav = el('div', { className: 'gnav' });
    const arrow = (txt, to) => { const x = el('button', { type: 'button', className: 'garrow', textContent: txt }); x.disabled = to < 0 || to >= pages; x.onclick = () => { S.pg[key] = to; redraw(); }; return x; };
    nav.appendChild(arrow('←', pg - 1)); nav.appendChild(el('span', { className: 'gpage', textContent: bpp === 1 ? (pg + 1) + '拍目' : (pg * bpp + 1) + '〜' + (pg * bpp + bpp) + '拍目' })); nav.appendChild(arrow('→', pg + 1));
    g.appendChild(nav);
    const hd = el('div', { className: 'ln hd' }); hd.appendChild(el('span', { className: 'nm' }));
    for (let k = 0; k < cols; k++) hd.appendChild(el('b', { textContent: k % res === 0 ? String(pg * bpp + k / res + 1) : '' })); g.appendChild(hd);
    let hidden = 0;
    ROWS.forEach((n) => {
      const ln = el('div', { className: 'ln' }); ln.appendChild(el('span', { className: 'nm', textContent: n })); if (o.muted && o.muted(n)) ln.style.opacity = '.35';
      for (let i = 0; i < NS; i++) if (o.get(n, i) && i % step) hidden++;
      for (let k = 0; k < cols; k++) {
        const i = pg * bpp * SL + k * step;
        const v = o.get(n, i), c = el('button', { type: 'button', className: 'c' + (k % res === 0 ? ' q' : '') + (v ? ' on' : '') + (v === 2 ? ' ac' : '') + (v === 3 ? ' gh' : '') + (n === 'HAT' && v === 1 ? ' hat' : '') });
        if (n === 'HAT' && v === 1) c.style.opacity = String(Math.min(1, Math.max(0.3, 0.25 + 0.75 * (hatFactor(curBi(), i) * 0.9) / 1.3)));
        if (o.tintFrom !== null && o.tintFrom !== undefined && i >= o.tintFrom) c.classList.add('fz');
        // タップ: 鳴る/休み。長押し: 休み→ゴースト、鳴る→アクセント、アクセント→鳴る、ゴースト→アクセント(ハードコアのビートと同じ)
        const setV = (f) => { o.set(n, i, f(o.get(n, i))); if (o.onChange) o.onChange(); else changed(true); };
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
    if (hidden) g.appendChild(el('p', { className: 'small', textContent: 'この細かさでは見えない音が ' + hidden + ' 個ある(細かさを変えると見える)。' }));
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
    S.blocks.forEach((b, i) => { const x = el('button', { type: 'button', textContent: 'ブロック ' + (i + 1) + (b.intro ? '(曲頭フィルイン)' : '(' + b.bars + '小節)') }); x.onclick = () => exportWav(null, 'block' + (i + 1), i); box.appendChild(x); });
  }
  const origChanged = changed;

  // ---- タブ ----
  function showTab(k) {
    $('sheet').hidden = k !== 's'; document.body.classList.toggle('onS', k === 's');
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
  // ハイハットの細かさ: 曲のリズムのハイハットの段だけを、選んだ間隔で並べ直す(オープンハットの位置は残す)
  const HATRES = [[24, '4分'], [12, '8分'], [8, '8分3連'], [6, '16分'], [4, '16分3連'], ['gu', '8分+16分2つ(Get Up Stand Up)']];   // 最後は、1拍ごとに8分1つ+16分2つ(譜面: Get Up Stand Up のハイハット)
  const applyHat = () => { const st = S.song.hat || 12, r = S.song.rows; for (let i = 0; i < NS; i++) r.HAT[i] = ((st === 'gu' ? [0, 12, 18].includes(i % 24) : i % st === 0) && !r.OPEN[i]) ? 1 : 0; };
  const hs = $('hatres'); HATRES.forEach(([v, t]) => { const o = el('option', { value: String(v), textContent: t }); if (String(v) === String(S.song.hat || 12)) o.selected = true; hs.appendChild(o); });
  hs.onchange = () => { S.song.hat = hs.value === 'gu' ? 'gu' : Number(hs.value); applyHat(); changed(true); drawSongGrid(); };
  const ps = $('pat'); Object.keys(PATTERNS).forEach((k) => { const o = el('option', { textContent: k }); if (k === S.song.pat) o.selected = true; ps.appendChild(o); });
  ps.onchange = () => { S.song.pat = ps.value; S.song.rows = PATTERNS[ps.value](); if ((S.song.hat || 12) !== 12) applyHat(); changed(true); };
  $('bpm').value = S.song.bpm; $('bpm').onchange = () => { const v = Math.max(50, Math.min(140, Math.round(+$('bpm').value || 76))); $('bpm').value = v; S.song.bpm = v; changed(false); };
  drawParts(); drawBlockExports(); drawSongGrid(); drawSeq(); drawSheet(); updateTotal();
  $('tabR').onclick = () => showTab('r'); $('tabS').onclick = () => showTab('s'); $('tabO').onclick = () => showTab('o');
  showTab('s');
  Object.keys(KITS).forEach((k) => { const o = el('option', { value: k, textContent: KITS[k] }); if (k === S.kit) o.selected = true; $('kit').appendChild(o); });
  $('kit').onchange = () => { S.kit = $('kit').value; save(); refreshPlay(); };
  $('play').onclick = () => { if (playing) stopAll(); previewBlocks = null; play(); };
  $('stop').onclick = stopAll;
  $('land').onchange = updateTotal;
  $('saveMix').onclick = () => exportWav(null, 'mix');
  // ---- 曲データのテキスト ----
  const dmsg = (t) => { $('dataMsg').textContent = t; };
  $('dataOut').onclick = () => { $('dataTxt').value = dataText(); dmsg('テキストにした(' + $('dataTxt').value.length + '文字)。「コピー」で、メモやGitHubに貼れる。'); };
  $('dataCopy').onclick = async () => { $('dataTxt').value = dataText(); try { await navigator.clipboard.writeText($('dataTxt').value); dmsg('コピーした。'); } catch (e) { $('dataTxt').select(); dmsg('自動でコピーできなかった。欄を長押しして、コピーして。'); } };
  let inArm = false;
  $('dataIn').onclick = () => {
    const t = $('dataTxt').value.trim();
    if (!t) { dmsg('欄に、貼ったテキストがない。'); return; }
    let o; try { o = JSON.parse(t, unpackRows); } catch (e) { dmsg('テキストが読めない(途中で切れていないか確認して)。'); inArm = false; $('dataIn').textContent = '貼ったテキストを読み込む'; return; }
    if (!(o && o.app === 'reggae-beat' && o.song && okRows(fix96(o.song.rows)) && Array.isArray(o.blocks))) { dmsg('レゲエ・ビートのテキストではないみたい。'); return; }
    if (!inArm) { inArm = true; $('dataIn').textContent = 'もう一度押すと、いまのデータを置き換える'; dmsg('いまのデータは、置き換わる。先に「テキストにする」で残しておくと安心。'); return; }
    try { localStorage.setItem(KEY, JSON.stringify(o)); location.reload(); } catch (e) { dmsg('このブラウザには、保存できなかった。'); }
  };
})();
