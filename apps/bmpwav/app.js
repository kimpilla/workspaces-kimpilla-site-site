// BMP-WAV の画面。変換の中身は bmpwav.js。
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let src = null;      // { kind: 'wav' | 'bmp' | 'image', buf, raw, meta, name }
  let urls = [];

  for (const [k, desc] of Object.entries(BmpWav.OPS)) {
    const l = document.createElement('label');
    l.className = 'op';
    l.innerHTML = '<input type="checkbox" value="' + k + '"> <code>' + k + '</code> <span class="small"></span>';
    l.querySelector('span').textContent = desc;
    $('ops').appendChild(l);
  }

  function fmtMeta(m) {
    return m.framerate + 'Hz・' + m.channels + 'ch・' + (m.sampwidth * 8) + 'bit';
  }
  function seconds(bytes, m) {
    return (bytes / (m.channels * m.sampwidth) / m.framerate).toFixed(1) + '秒';
  }
  function setStatus(t) { $('status').textContent = t; }

  $('file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    $('go').disabled = true; $('fmt').hidden = true; setStatus('');
    const buf = new Uint8Array(await f.arrayBuffer());
    const name = f.name.replace(/\.[^.]+$/, '');
    try {
      if (buf[0] === 0x52 && buf[1] === 0x49) {                  // RIFF
        const { meta, data } = BmpWav.readWav(buf);
        src = { kind: 'wav', buf, name };
        $('srcinfo').textContent = 'WAV: ' + fmtMeta(meta) + '、' + seconds(data.length, meta);
      } else if (buf[0] === 0x42 && buf[1] === 0x4D) {           // BM
        const b = BmpWav.parseBmp(buf);
        src = { kind: 'bmp', raw: b.px, meta: b.meta, name };
        $('srcinfo').textContent = 'BMP: ' + b.w + '×' + b.h + 'px・' + b.bpp + 'bit';
        showFormat(b.meta);
      } else {
        const raw = await imageToBGRA(f);
        src = { kind: 'image', raw: raw.px, meta: null, name };
        $('srcinfo').textContent = '画像: ' + raw.w + '×' + raw.h + 'px(32bitの画素として読む)';
        showFormat(null);
      }
      $('go').disabled = false;
    } catch (err) {
      src = null;
      $('srcinfo').textContent = '読めませんでした: ' + err.message;
    }
  });

  function showFormat(meta) {
    $('fmt').hidden = false;
    if (meta) {
      $('rate').value = String(meta.framerate); $('ch').value = String(meta.channels); $('sw').value = String(meta.sampwidth);
      $('fmtnote').textContent = 'このBMPには元の音の形式(' + fmtMeta(meta) + ')が書いてあったので、それに合わせました。';
    } else {
      $('fmtnote').textContent = '元の音の形式が書いていない画像です。好きな形式で読めます(ふつうは44100Hz・2ch・16bit)。';
    }
  }

  // JPEG・PNGなどをブラウザで開き、画素を B,G,R,A の順に並べる(Python版がsipsで32bit BMPにするのと同じ並び)
  function imageToBGRA(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const u = URL.createObjectURL(file);
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        const px = new Uint8Array(d.length);
        for (let i = 0; i < d.length; i += 4) { px[i] = d[i + 2]; px[i + 1] = d[i + 1]; px[i + 2] = d[i]; px[i + 3] = d[i + 3]; }
        URL.revokeObjectURL(u);
        resolve({ w: c.width, h: c.height, px });
      };
      img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('画像として開けません')); };
      img.src = u;
    });
  }

  $('go').addEventListener('click', () => {
    if (!src) return;
    const ops = [...document.querySelectorAll('#ops input:checked')].map((x) => x.value);
    setStatus('変換中…');
    $('go').disabled = true;
    setTimeout(() => {           // 「変換中…」を先に表示させる
      try { run(ops); } catch (err) { setStatus('失敗しました: ' + err.message); }
      $('go').disabled = false;
    }, 30);
  });

  function run(ops) {
    let r;
    if (src.kind === 'wav') {
      r = BmpWav.fromWav(src.buf, ops);
    } else {
      const m = { framerate: +$('rate').value, channels: +$('ch').value, sampwidth: +$('sw').value };
      if (src.meta && src.meta.framerate === m.framerate && src.meta.channels === m.channels && src.meta.sampwidth === m.sampwidth) {
        m.padding_bytes = src.meta.padding_bytes;   // 元のWAVの長さに戻す(末尾のゼロ埋めを外す)
      }
      r = BmpWav.fromPixelBytes(src.raw, m, ops);
    }
    const wav = BmpWav.writeWav(r.meta, r.px.subarray(0, r.meta.data_bytes));
    const bmp = BmpWav.bmpBytes(r.w, r.h, r.px, r.meta);

    const cv = $('preview');
    cv.width = r.w; cv.height = r.h;
    cv.getContext('2d').putImageData(new ImageData(BmpWav.toRGBA(r.px, r.w, r.h), r.w, r.h), 0, 0);
    cv.hidden = false;

    urls.forEach((u) => URL.revokeObjectURL(u));
    const wu = URL.createObjectURL(new Blob([wav], { type: 'audio/wav' }));
    urls = [wu];
    $('player').src = wu; $('player').hidden = false;
    const tag = ops.length ? '_' + ops.join('-') : '';
    $('downloads').innerHTML = '';
    for (const [data, type, fn, label] of [[wav, 'audio/wav', src.name + tag + '.wav', 'WAVを保存'], [bmp, 'image/bmp', src.name + tag + '.bmp', 'BMPを保存']]) {
      const b = document.createElement('button');
      b.textContent = label;
      b.onclick = () => saveBlob(new Blob([data], { type }), fn, $('status'));
      $('downloads').appendChild(b);
    }
    setStatus('できました: ' + r.w + '×' + r.h + 'px、' + fmtMeta(r.meta) + '、' + seconds(r.meta.data_bytes, r.meta) +
      (ops.length ? '(加工: ' + ops.join(' → ') + ')' : ''));
  }
})();
