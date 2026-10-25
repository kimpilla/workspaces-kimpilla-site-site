// AudioBuffer を 16bit PCM の WAV にする(書き出し用。外部ライブラリなし)
function audioBufferToWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, rate = buf.sampleRate;
  const out = new DataView(new ArrayBuffer(44 + n * ch * 2));
  const put = (o, s) => { for (let i = 0; i < 4; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  put(0, 'RIFF'); out.setUint32(4, 36 + n * ch * 2, true); put(8, 'WAVE');
  put(12, 'fmt '); out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true);
  out.setUint32(24, rate, true); out.setUint32(28, rate * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  put(36, 'data'); out.setUint32(40, n * ch * 2, true);
  const data = []; for (let c = 0; c < ch; c++) data.push(buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, data[c][i]));
    out.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2;
  }
  return new Blob([out.buffer], { type: 'audio/wav' });
}

// つまみの共通部品: [キー, 名前, 最小, 最大, 表示, 対数か] の並びから、スライダーを作る
function buildKnobs(box, defs, p, onchange) {
  const toS = (v, min, max, log) => log ? Math.log(v / min) / Math.log(max / min) : (v - min) / (max - min);
  const fromS = (s, min, max, log) => log ? min * Math.pow(max / min, s) : min + s * (max - min);
  box.innerHTML = '';
  const sync = [];
  for (const [key, label, min, max, fmt, log] of defs) {
    const l = document.createElement('label');
    l.textContent = label;
    const o = document.createElement('output');
    const r = document.createElement('input');
    r.type = 'range'; r.min = 0; r.max = 1000; r.step = 1;
    const show = () => { r.value = Math.round(toS(p[key], min, max, log) * 1000); o.textContent = fmt(p[key]); };
    r.oninput = () => { p[key] = fromS(r.value / 1000, min, max, log); o.textContent = fmt(p[key]); onchange && onchange(key); };
    show(); sync.push(show);
    l.appendChild(o); l.appendChild(r); box.appendChild(l);
  }
  return () => sync.forEach((f) => f());   // p を書き換えたあとに、スライダーの位置を合わせ直す
}

// ファイルを保存する。claude.aiの試し版(ページの中から保存できない)では、そのことを表示する
function saveBlob(blob, filename, statusEl) {
  if (window.claude) {
    if (statusEl) statusEl.textContent = 'この試し版のページでは、ファイルを保存できません(公開版のサイトでは保存できます)。';
    return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
