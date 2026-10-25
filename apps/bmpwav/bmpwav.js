// BMP↔WAV 変換(ブラウザ版)。workspaces/bmp-wav-conversion/tools/bmpwav.py と同じ規則で動く。
// 原則: 同じバイト列を、別のフォーマットの規則で読み替える。意味的な変換はしない。
//   WAVのPCMバイト列(ファイル順) → 4バイトずつを1画素(32bit BMP: B,G,R,A) → 正方形に並べる(不足はゼロで埋める)
// 外部ライブラリなし。ファイルは端末の中だけで処理し、どこにも送らない。

(function (root) {
  'use strict';

  // ---- WAV ----

  function readWav(buf) {
    const b = new Uint8Array(buf);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const tag = (o) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    if (b.length < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('WAVではありません');
    let fmt = null, data = null, o = 12;
    while (o + 8 <= b.length) {
      const id = tag(o), size = dv.getUint32(o + 4, true), body = o + 8;
      if (id === 'fmt ') {
        fmt = { format: dv.getUint16(body, true), channels: dv.getUint16(body + 2, true),
                framerate: dv.getUint32(body + 4, true), sampwidth: dv.getUint16(body + 14, true) / 8 };
      } else if (id === 'data') {
        data = b.slice(body, Math.min(body + size, b.length));
      }
      o = body + size + (size & 1);
    }
    if (!fmt || !data) throw new Error('WAVの中身(fmt / data)が見つかりません');
    if (fmt.format !== 1 && fmt.format !== 0xFFFE) throw new Error('非圧縮のPCMのWAVだけ対応しています(32bit floatなどは未対応)');
    const fb = fmt.channels * fmt.sampwidth;
    data = data.slice(0, data.length - (data.length % fb));
    return { meta: { channels: fmt.channels, sampwidth: fmt.sampwidth, framerate: fmt.framerate }, data };
  }

  function writeWav(meta, data) {
    const pad = data.length & 1;
    const out = new Uint8Array(44 + data.length + pad);
    const dv = new DataView(out.buffer);
    const put = (o, s) => { for (let i = 0; i < 4; i++) out[o + i] = s.charCodeAt(i); };
    put(0, 'RIFF'); dv.setUint32(4, 36 + data.length, true); put(8, 'WAVE');
    put(12, 'fmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true);
    dv.setUint16(22, meta.channels, true); dv.setUint32(24, meta.framerate, true);
    dv.setUint32(28, meta.framerate * meta.channels * meta.sampwidth, true);
    dv.setUint16(32, meta.channels * meta.sampwidth, true); dv.setUint16(34, meta.sampwidth * 8, true);
    put(36, 'data'); dv.setUint32(40, data.length, true);
    out.set(data, 44);
    return out;
  }

  // ---- BMP ----

  // BMPの予約領域(6〜9バイト目)に、元のWAVの形式を書いておく。画像ソフトで保存し直すと消えるので、そのときは画面の設定を使う。
  const RATES = [0, 44100, 48000, 96000, 22050, 88200, 32000, 16000, 8000, 11025, 192000];

  function bmpBytes(w, h, pixels, meta) {
    const stride = w * 4, off = 54, size = off + stride * h;
    const out = new Uint8Array(size);
    const dv = new DataView(out.buffer);
    out[0] = 0x42; out[1] = 0x4D; dv.setUint32(2, size, true);
    if (meta && meta.padding_bytes !== undefined && meta.padding_bytes < 65536) {
      const ri = RATES.indexOf(meta.framerate);
      if (ri > 0 && meta.channels < 16 && meta.sampwidth < 16) {
        dv.setUint16(6, meta.padding_bytes, true);
        dv.setUint16(8, (meta.channels << 12) | (meta.sampwidth << 8) | ri, true);
      }
    }
    dv.setUint32(10, off, true);
    dv.setUint32(14, 40, true); dv.setInt32(18, w, true); dv.setInt32(22, -h, true);
    dv.setUint16(26, 1, true); dv.setUint16(28, 32, true); dv.setUint32(30, 0, true);
    dv.setUint32(34, stride * h, true); dv.setInt32(38, 3780, true); dv.setInt32(42, 3780, true);
    out.set(pixels.subarray(0, stride * h), off);
    return out;
  }

  function parseBmp(buf) {
    const b = new Uint8Array(buf);
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    if (b[0] !== 0x42 || b[1] !== 0x4D) throw new Error('BMPではありません');
    const off = dv.getUint32(10, true);
    const w = dv.getInt32(18, true);
    let h = dv.getInt32(22, true);
    const bpp = dv.getUint16(28, true), comp = dv.getUint32(30, true);
    if ((bpp !== 24 && bpp !== 32) || comp !== 0) throw new Error('24bit・32bitの無圧縮(BI_RGB)のBMPだけ対応しています');
    const topDown = h < 0; h = Math.abs(h);
    const rowLen = w * bpp / 8, stride = Math.floor((rowLen + 3) / 4) * 4; // 24bitの行末の詰めは捨てる
    const px = new Uint8Array(rowLen * h);
    for (let i = 0; i < h; i++) {
      const src = off + i * stride, dst = (topDown ? i : h - 1 - i) * rowLen;
      px.set(b.subarray(src, src + rowLen), dst);
    }
    let meta = null;
    const code = dv.getUint16(8, true);
    if (code) {
      const ri = code & 0xFF;
      meta = { channels: code >> 12, sampwidth: (code >> 8) & 0xF, framerate: RATES[ri] || 0, padding_bytes: dv.getUint16(6, true) };
      if (!meta.framerate || !meta.channels || !meta.sampwidth) meta = null;
    }
    return { w, h, bpp, px, meta };
  }

  function wavToPixels(data) {
    const nPx = Math.ceil(data.length / 4);
    const side = Math.max(1, Math.ceil(Math.sqrt(nPx)));
    const px = new Uint8Array(side * side * 4);
    px.set(data);
    return { side, px, padding: side * side * 4 - data.length };
  }

  // ---- 加工(op) ----

  function pyRound(x) { // Pythonのround()と同じ、偶数丸め
    const f = Math.floor(x), d = x - f;
    if (d > 0.5) return f + 1;
    if (d < 0.5) return f;
    return f % 2 === 0 ? f : f + 1;
  }

  function rgbToHsv(r, g, b) { // Pythonのcolorsysと同じ計算
    const maxc = Math.max(r, g, b), minc = Math.min(r, g, b), rangec = maxc - minc, v = maxc;
    if (minc === maxc) return [0, 0, v];
    const s = rangec / maxc;
    const rc = (maxc - r) / rangec, gc = (maxc - g) / rangec, bc = (maxc - b) / rangec;
    let h;
    if (r === maxc) h = bc - gc; else if (g === maxc) h = 2.0 + rc - bc; else h = 4.0 + gc - rc;
    h = (h / 6.0) % 1.0;
    if (h < 0) h += 1.0;
    return [h, s, v];
  }

  function hsvToRgb(h, s, v) {
    if (s === 0) return [v, v, v];
    let i = Math.trunc(h * 6.0);
    const f = (h * 6.0) - i, p = v * (1.0 - s), q = v * (1.0 - s * f), t = v * (1.0 - s * (1.0 - f));
    i = ((i % 6) + 6) % 6;
    return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i];
  }

  const OPS = {
    negative: '全バイトのビット反転(16bitでは位相反転に近い。2回で元に戻る)',
    reverse: '音声の時間反転(1フレームごと)',
    flipx: '画像の左右反転(行ごとの短い逆再生が続く)',
    flipy: '画像の上下反転(短い時間ブロックの順が入れ替わる)',
    rot180: '画素列全体の反転(16bitステレオでは時間反転)',
    'crop-tl': '左上4分の1だけ残す(約4分の1の長さ)',
    gray: 'B,G,Rを平均にそろえる(音色が変わる)',
    satfade: '曲の頭から終わりへ、彩度を1→0',
    mosaic: '上から下へ、モザイクを1×1→128×128(サンプルホールド)',
    timeneg: '曲の頭から終わりへ、色のネガポジを0→1',
    grayfade: '曲の頭から終わりへ、モノクロ化を0→1',
  };

  function applyOps(w, h, px, meta, ops) {
    meta = Object.assign({}, meta);
    for (const op of ops) {
      if (op === 'negative') {
        const out = new Uint8Array(px.length);
        for (let i = 0; i < px.length; i++) out[i] = 255 - px[i];
        px = out;
      } else if (op === 'flipx') {
        const out = new Uint8Array(px.length);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
          const s = (y * w + x) * 4, d = (y * w + (w - 1 - x)) * 4;
          out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3];
        }
        px = out;
      } else if (op === 'flipy') {
        const out = new Uint8Array(px.length), rl = w * 4;
        for (let y = 0; y < h; y++) out.set(px.subarray(y * rl, (y + 1) * rl), (h - 1 - y) * rl);
        px = out;
      } else if (op === 'rot180') {
        const n = Math.floor(px.length / 4), out = new Uint8Array(px.length);
        for (let i = 0; i < n; i++) out.set(px.subarray(i * 4, i * 4 + 4), (n - 1 - i) * 4);
        px = out;
      } else if (op === 'reverse') {
        const fb = meta.channels * meta.sampwidth;
        const n = meta.data_bytes - (meta.data_bytes % fb), out = px.slice(), nf = n / fb;
        for (let i = 0; i < nf; i++) out.set(px.subarray(i * fb, i * fb + fb), (nf - 1 - i) * fb);
        px = out;
      } else if (op === 'crop-tl') {
        const nw = Math.floor(w / 2), nh = Math.floor(h / 2), out = new Uint8Array(nw * nh * 4);
        for (let y = 0; y < nh; y++) out.set(px.subarray(y * w * 4, y * w * 4 + nw * 4), y * nw * 4);
        px = out; w = nw; h = nh;
        meta.data_bytes = Math.min(meta.data_bytes, px.length);
      } else if (op === 'gray') {
        for (let i = 0; i < px.length; i += 4) {
          const v = Math.floor((px[i] + px[i + 1] + px[i + 2]) / 3);
          px[i] = px[i + 1] = px[i + 2] = v;
        }
      } else if (op === 'satfade' || op === 'timeneg' || op === 'grayfade') {
        const n = Math.max(Math.floor(meta.data_bytes / 4), 2), end = Math.min(px.length, n * 4);
        for (let i = 0; i < end; i += 4) {
          const a = i / 4 / (n - 1); // 曲の頭0 → 終わり1(BMPは上から下=時間順)
          const b = px[i], g = px[i + 1], r = px[i + 2];
          if (op === 'timeneg') {
            px[i] = pyRound(b + (255 - 2 * b) * a); px[i + 1] = pyRound(g + (255 - 2 * g) * a); px[i + 2] = pyRound(r + (255 - 2 * r) * a);
          } else if (op === 'grayfade') {
            const yy = 0.299 * r + 0.587 * g + 0.114 * b;
            px[i] = pyRound(b + (yy - b) * a); px[i + 1] = pyRound(g + (yy - g) * a); px[i + 2] = pyRound(r + (yy - r) * a);
          } else { // satfade: HSVの彩度だけ (1-a) 倍
            const [hh, ss, vv] = rgbToHsv(r / 255, g / 255, b / 255);
            const [rr, gg, bb] = hsvToRgb(hh, ss * (1 - a), vv);
            px[i] = pyRound(bb * 255); px[i + 1] = pyRound(gg * 255); px[i + 2] = pyRound(rr * 255);
          }
        }
      } else if (op === 'mosaic') {
        const out = new Uint8Array(w * h * 4);
        for (let y = 0; y < h; y++) {
          const bs = h > 1 ? 1 + Math.floor(127 * y / (h - 1)) : 1; // 上端1 → 下端128
          const sy = y - (y % bs);
          for (let x = 0; x < w; x++) {
            const sx = x - (x % bs), s = (sy * w + sx) * 4, d = (y * w + x) * 4;
            out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3];
          }
        }
        px = out;
      } else {
        throw new Error('未対応の op: ' + op);
      }
    }
    return { w, h, px, meta };
  }

  // ---- まとめ ----

  // WAV → (加工) → 正方形のBMPとWAV
  function fromWav(buf, ops) {
    const { meta, data } = readWav(buf);
    const { side, px, padding } = wavToPixels(data);
    meta.data_bytes = data.length;
    const r = applyOps(side, side, px, meta, ops);
    r.meta.padding_bytes = r.w * r.h * 4 - r.meta.data_bytes;
    return { src: { padding, side }, ...r };
  }

  // BMP(24bit・32bit) → 画素バイト列をそのままPCMとして読む → (加工) → BMPとWAV
  // meta が無いBMP(画像ソフトで保存し直したもの・絵の画像)は、fallback(画面の設定)の形式で読む。
  function fromPixelBytes(raw, meta, ops) {
    let n = raw.length;
    if (meta && meta.padding_bytes !== undefined) n = Math.max(0, n - meta.padding_bytes);
    const fb = meta.channels * meta.sampwidth;
    const data = raw.subarray(0, n - (n % Math.max(fb, 1)));
    const { side, px } = wavToPixels(data);
    const m = { channels: meta.channels, sampwidth: meta.sampwidth, framerate: meta.framerate, data_bytes: data.length };
    const r = applyOps(side, side, px, m, ops);
    r.meta.padding_bytes = r.w * r.h * 4 - r.meta.data_bytes;
    return r;
  }

  // 画素(B,G,R,A)をプレビュー用のRGBAにする(Aは255にそろえる。そうしないと透明で見えない)
  function toRGBA(px, w, h) {
    const out = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < out.length; i += 4) {
      out[i] = px[i + 2]; out[i + 1] = px[i + 1]; out[i + 2] = px[i]; out[i + 3] = 255;
    }
    return out;
  }

  const api = { readWav, writeWav, bmpBytes, parseBmp, wavToPixels, applyOps, fromWav, fromPixelBytes, toRGBA, OPS, pyRound };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.BmpWav = api;
})(this);
