#!/usr/bin/env python3
"""操作マニュアルのPDFを作る: apps/<app>/MANUAL.md → dist/<app>/<アプリ名>_操作マニュアル.pdf

使い方(リポジトリ直下で。bundle.py より先に動かすと、PDFが zip に入る):
    python3 tools/manual.py spaceship
    python3 tools/manual.py spaceship --html   # PDFにせず、確認用のHTMLだけ作る

MANUAL.md の書き方(読む人は DTM をやっている人。ブロック・テンポ・書き出しなどの言葉は説明しない。操作だけ):
    # アプリの名前            (1つ目の見出しが、表紙の題とファイル名になる)
    ## 見出し
    ふつうの段落。**太字**、`ボタン名`、[リンク](https://...)
    - 箇条書き
    1. 手順
    | 表 | の行 |
    ![説明](画像のパス。apps/<app>/ から見た位置)

PDFにする道具: Playwright(pip の playwright と chromium)があれば使う。無ければ、Mac の Google Chrome を
ヘッドレスで使う(/Applications/Google Chrome.app)。どちらも無ければ、HTMLだけ作るので、ブラウザで開いて印刷→PDF。
"""
import base64, html, mimetypes, os, re, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST = os.path.join(ROOT, 'dist')
CSS = """
@page { size: A4; margin: 16mm 15mm; }
body { font-family: "Hiragino Sans", "Noto Sans JP", "Yu Gothic", sans-serif; font-size: 10.5pt; line-height: 1.7; color: #1a1a1a; }
h1 { font-size: 20pt; margin: 0 0 4mm; border-bottom: 2px solid #1a1a1a; padding-bottom: 2mm; }
h2 { font-size: 13pt; margin: 7mm 0 2mm; border-left: 4px solid #1a1a1a; padding-left: 3mm; break-after: avoid; }
h3 { font-size: 11pt; margin: 5mm 0 1mm; break-after: avoid; }
p, li { margin: 1mm 0; }
code { font-family: Menlo, Consolas, monospace; background: #eee; padding: 0 3px; border-radius: 3px; font-size: 9.5pt; }
table { border-collapse: collapse; margin: 2mm 0; width: 100%; break-inside: avoid; }
td, th { border: 1px solid #999; padding: 1.5mm 2mm; vertical-align: top; text-align: left; }
th { background: #eee; }
img { max-width: 100%; border: 1px solid #ccc; margin: 2mm 0; break-inside: avoid; }
.foot { margin-top: 8mm; font-size: 8.5pt; color: #666; }
"""


def inline(s, base):
    s = html.escape(s, quote=False)
    s = re.sub(r'`([^`]+)`', r'<code>\1</code>', s)
    s = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', s)

    def img(m):
        p = os.path.normpath(os.path.join(base, m.group(2)))
        src = m.group(2)
        if os.path.isfile(p):
            src = 'data:%s;base64,%s' % (mimetypes.guess_type(p)[0] or 'image/png', base64.b64encode(open(p, 'rb').read()).decode())
        return '<img alt="%s" src="%s">' % (m.group(1), src)
    s = re.sub(r'!\[([^\]]*)\]\(([^)]+)\)', img, s)
    s = re.sub(r'\[([^\]]+)\]\((https?://[^)]+)\)', r'<a href="\2">\1</a>', s)
    return s


def md2html(md, base):
    out, para, lst, tbl = [], [], None, []

    def flush():
        nonlocal para, lst, tbl
        if para:
            out.append('<p>%s</p>' % '<br>'.join(inline(x, base) for x in para)); para = []
        if lst:
            out.append('<%s>%s</%s>' % (lst[0], ''.join('<li>%s</li>' % inline(x, base) for x in lst[1]), lst[0])); lst = None
        if tbl:
            rows = [r for r in tbl if not re.match(r'^\|?[\s:|-]+\|?$', r)]
            cells = [[c.strip() for c in r.strip().strip('|').split('|')] for r in rows]
            h = '<tr>%s</tr>' % ''.join('<th>%s</th>' % inline(c, base) for c in cells[0])
            b = ''.join('<tr>%s</tr>' % ''.join('<td>%s</td>' % inline(c, base) for c in r) for r in cells[1:])
            out.append('<table>%s%s</table>' % (h, b)); tbl = []
    for line in md.split('\n'):
        m = re.match(r'^(#{1,3})\s+(.*)', line)
        if m:
            flush(); n = len(m.group(1)); out.append('<h%d>%s</h%d>' % (n, inline(m.group(2), base), n)); continue
        if line.startswith('|'):
            if para or lst:
                flush()
            tbl.append(line); continue
        m = re.match(r'^\s*([-*]|\d+\.)\s+(.*)', line)
        if m:
            kind = 'ol' if m.group(1)[0].isdigit() else 'ul'
            if para or tbl or (lst and lst[0] != kind):
                flush()
            lst = lst or (kind, [])
            lst[1].append(m.group(2)); continue
        if not line.strip():
            flush(); continue
        if lst or tbl:
            flush()
        para.append(line.strip())
    flush()
    return '\n'.join(out)


def to_pdf(src_html, pdf):
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch()
            pg = b.new_page()
            pg.goto('file://' + src_html)
            pg.pdf(path=pdf, format='A4', print_background=True, prefer_css_page_size=True)
            b.close()
        return True
    except Exception:
        pass
    for c in ('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', shutil.which('google-chrome') or '', shutil.which('chromium') or ''):
        if c and os.path.exists(c):
            r = subprocess.run([c, '--headless', '--disable-gpu', '--no-pdf-header-footer', '--print-to-pdf=' + pdf, 'file://' + src_html],
                               capture_output=True)
            if os.path.exists(pdf):
                return True
    return False


def manual(app, html_only=False):
    adir = os.path.join(ROOT, 'apps', app)
    src = os.path.join(adir, 'MANUAL.md')
    if not os.path.isfile(src):
        print('%s: apps/%s/MANUAL.md が無い(先に書く)' % (app, app)); return False
    md = open(src, encoding='utf-8').read()
    title = (re.search(r'^#\s+(.+)', md, re.M) or [None, app])[1].strip()
    body = md2html(md, adir)
    doc = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>%s 操作マニュアル</title><style>%s</style></head><body>%s<p class="foot">kimpilla</p></body></html>' % (html.escape(title), CSS, body)
    out = os.path.join(DIST, app); os.makedirs(out, exist_ok=True)
    name = re.sub(r'[\\/:*?"<>| ]', '_', title) + '_操作マニュアル'
    hp = os.path.join(out, name + '.html')
    open(hp, 'w', encoding='utf-8').write(doc)
    if html_only:
        print('%s: dist/%s/%s.html' % (app, app, name)); return True
    pdf = os.path.join(out, name + '.pdf')
    if to_pdf(hp, pdf):
        os.remove(hp)
        print('%s: dist/%s/%s.pdf' % (app, app, name)); return True
    print('%s: PDFにする道具が見つからない。dist/%s/%s.html をブラウザで開いて、印刷→PDF' % (app, app, name)); return False


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not args:
        sys.exit(__doc__)
    ok = all([manual(a, '--html' in sys.argv) for a in args])
    sys.exit(0 if ok else 2)
