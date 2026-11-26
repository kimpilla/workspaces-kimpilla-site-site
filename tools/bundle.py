#!/usr/bin/env python3
"""配る形を作る: アプリ1本を、1枚のHTML(ダウンロード用)と、そのまま置けるフォルダ・zip(公開用サイト用)にする。

使い方(リポジトリ直下で):
    python3 tools/bundle.py spaceship            # apps/spaceship を dist/spaceship/ に
    python3 tools/bundle.py spaceship noisedrum  # 何本でも

できるもの(dist/ は git に入れない):
    dist/<app>/index.html          1枚で完結するHTML。ダウンロードして開けば、ネットなしで動く
    dist/<app>/manifest.webmanifest ホーム画面に追加したときの名前とアイコン
    dist/<app>/sw.js               オフラインで開くための仕組み(ネットがあれば毎回新しい版を取りに行く)
    dist/<app>/icon-192.png, icon-512.png
    dist/<app>/<app>.zip           上の全部をまとめたもの(itch.io などに上げる。index.html が一番上)
    (tools/manual.py を先に動かすと、マニュアルのPDFも dist/<app>/ に入り、zip に含まれる)

外部のファイルを fetch() で読むアプリ(aiueo・reggaeup・voicechanger など)は、そのままでは1枚にならない。
見つけたら警告を出すので、音をJSに埋め込む(hcbeat・reggae と同じやり方)などしてから配る。
"""
import base64, json, mimetypes, os, re, shutil, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')


def read(p, mode='r'):
    with open(p, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def local(base, ref):
    """ローカルのファイルなら、その実際のパス。外のURLなら None"""
    if re.match(r'^(https?:|data:|//|#|mailto:)', ref):
        return None
    p = os.path.normpath(os.path.join(base, ref.split('?')[0].split('#')[0]))
    return p if os.path.isfile(p) else None


def data_uri(p):
    mt = mimetypes.guess_type(p)[0] or ('font/woff2' if p.endswith('.woff2') else 'application/octet-stream')
    return 'data:%s;base64,%s' % (mt, base64.b64encode(read(p, 'rb')).decode())


def inline_css_urls(css, base):
    def rep(m):
        p = local(base, m.group(2))
        return 'url(%s)' % data_uri(p) if p else m.group(0)
    return re.sub(r'url\((["\']?)([^)"\']+)\1\)', rep, css)


def bundle(app):
    adir = os.path.join(ROOT, 'apps', app)
    src = os.path.join(adir, 'index.html')
    if not os.path.isfile(src):
        sys.exit('見つからない: ' + src)
    h = read(src)
    warn = []

    # <link rel="stylesheet" href="..."> → <style>
    def css(m):
        p = local(adir, m.group(1))
        if not p:
            return m.group(0)
        return '<style>\n%s\n</style>' % inline_css_urls(read(p), os.path.dirname(p))
    h = re.sub(r'<link[^>]*rel=["\']stylesheet["\'][^>]*href=["\']([^"\']+)["\'][^>]*>', css, h)
    h = re.sub(r'<link[^>]*href=["\']([^"\']+)["\'][^>]*rel=["\']stylesheet["\'][^>]*>', css, h)

    # <script src="..."></script> → <script>中身</script>
    def js(m):
        p = local(adir, m.group(2))
        if not p:
            return m.group(0)
        code = read(p)
        for f in re.findall(r"fetch\(\s*['\"`]([^'\"`]+)", code):
            warn.append('%s が fetch("%s") で外のファイルを読んでいる' % (os.path.relpath(p, ROOT), f))
        if re.search(r"createElement\(\s*['\"]script['\"]", code):
            warn.append('%s が、あとから別のJSファイルを読み込んでいる(例: キットを選んだときの音)。配る前に、それも埋め込む形にする' % os.path.relpath(p, ROOT))
        return '<script>\n%s\n</script>' % code.replace('</script', '<\\/script')
    h = re.sub(r'<script([^>]*?)\ssrc=["\']([^"\']+)["\']([^>]*)>\s*</script>', js, h)

    # ページ内の <style> の url(...)(フォントなど)
    h = re.sub(r'<style>(.*?)</style>', lambda m: '<style>%s</style>' % inline_css_urls(m.group(1), adir), h, flags=re.S)
    # <img src="ローカル">
    h = re.sub(r'(<img[^>]*\ssrc=["\'])([^"\']+)(["\'])',
               lambda m: m.group(1) + (data_uri(local(adir, m.group(2))) if local(adir, m.group(2)) else m.group(2)) + m.group(3), h)

    # サイトの中のページへのリンク(一覧・トップなど)は、配る形では行き先がないので外す
    h = re.sub(r'<a[^>]*href=["\']\.\./\.\./[^"\']*["\'][^>]*>.*?</a>', '', h, flags=re.S)
    left = sorted(set(r for r in re.findall(r'(?:src|href)=["\']([^"\']+)["\']', h) if local(adir, r)))
    for r in left:
        warn.append('まだ外のファイルを指している: ' + r)

    title = (re.search(r'<title>(.*?)</title>', h, re.S) or [None, app])[1].strip()
    # ホーム画面に追加・オフライン(http/https で開いたときだけ。ファイルを直接開いたときは何もしない)
    pwa = ('<link rel="manifest" href="manifest.webmanifest">\n'
           '<script>if(location.protocol.startsWith("http")&&"serviceWorker" in navigator){'
           'navigator.serviceWorker.register("sw.js").catch(function(){})}</script>\n')
    h = h.replace('</head>', pwa + '</head>', 1) if '</head>' in h else pwa + h

    out = os.path.join(DIST, app)
    os.makedirs(out, exist_ok=True)
    open(os.path.join(out, 'index.html'), 'w', encoding='utf-8').write(h)
    json.dump({'name': title, 'short_name': title[:12], 'start_url': './index.html', 'display': 'standalone',
               'background_color': '#ffffff', 'theme_color': '#222222',
               'icons': [{'src': 'icon-192.png', 'sizes': '192x192', 'type': 'image/png'},
                         {'src': 'icon-512.png', 'sizes': '512x512', 'type': 'image/png'}]},
              open(os.path.join(out, 'manifest.webmanifest'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    open(os.path.join(out, 'sw.js'), 'w', encoding='utf-8').write(SW.replace('__APP__', app))
    icon(app, out)
    lic = os.path.join(ROOT, 'tools', 'LICENSE.txt')  # ライセンスを決めたら、ここに置く(全部のアプリに同じものが入る)
    if os.path.isfile(lic):
        shutil.copy(lic, os.path.join(out, 'LICENSE.txt'))

    z = os.path.join(out, app + '.zip')
    if os.path.exists(z):
        os.remove(z)
    with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as zf:
        for f in sorted(os.listdir(out)):
            if f != app + '.zip':
                zf.write(os.path.join(out, f), f)
    kb = os.path.getsize(os.path.join(out, 'index.html')) // 1024
    print('%s: dist/%s/index.html(%dKB)と %s.zip' % (app, app, kb, app))
    for w in warn:
        print('  警告: ' + w)
    return not warn


def icon(app, out):
    thumb = os.path.join(ROOT, 'thumbs', app + '.jpg')
    for s in (192, 512):
        dst = os.path.join(out, 'icon-%d.png' % s)
        try:
            from PIL import Image
            im = Image.open(thumb) if os.path.exists(thumb) else Image.new('RGB', (s, s), (34, 34, 34))
            w, hh = im.size
            m = min(w, hh)
            im.crop(((w - m) // 2, (hh - m) // 2, (w + m) // 2, (hh + m) // 2)).resize((s, s)).save(dst)
        except ImportError:
            if os.path.exists(thumb) and shutil.which('ffmpeg'):
                subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', thumb, '-vf',
                                'crop=min(iw\\,ih):min(iw\\,ih),scale=%d:%d' % (s, s), dst], check=False)


# ネットがあるときは毎回新しい版を取りに行き、取れたら保存する。ネットがないときだけ保存した版を出す
SW = """// __APP__ をオフラインで開くための仕組み(tools/bundle.py が作った)
const C = '__APP__-v1';
self.addEventListener('install', e => { e.waitUntil(caches.open(C).then(c => c.addAll(['./', './index.html', './manifest.webmanifest']))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c2 = r.clone(); caches.open(C).then(c => c.put(e.request, c2)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
"""

if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    ok = all([bundle(a) for a in sys.argv[1:]])
    sys.exit(0 if ok else 2)
