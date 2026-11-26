# 配る形を作る道具

kimpilla-site のアプリを、配る形にする(2026-11-26)。方針は ai-memory の workspaces/kimpilla-site/README.md の「方針」:
サイトそのものは公開しない。配るときは、登録先(note・BOOTH・itch.io など)で、ダウンロードと、その場で動かすことの両方ができる形にする。
操作マニュアルはPDF(読む人はDTMをやっている人)。

## 手順(1本ぶん)

1. マニュアルを書く: `tools/MANUAL_ひな形.md` を `apps/<app>/MANUAL.md` に写して、中身を書く。
2. PDFにする: `python3 tools/manual.py <app>` → `dist/<app>/<名前>_操作マニュアル.pdf`
3. 配る形にする: `python3 tools/bundle.py <app>` → `dist/<app>/`
   - `index.html`: 1枚で完結。ダウンロードして開けば、ネットなしで動く(note・BOOTH に置くのはこれ。PDFと一緒に zip でもよい)
   - `<app>.zip`: 全部入り(index.html・PDF・ホーム画面用のアイコンとオフラインの仕組み)。itch.io に「HTML」として上げると、その場で動き、ダウンロードもできる
4. ライセンスを決めたら `tools/LICENSE.txt` に置く。以後の bundle で全部のアプリに入る。

`dist/` は git に入れない(作り直せるので)。

## 警告が出たら

- `fetch(...)で外のファイルを読んでいる`(aiueo・reggaeup・voicechanger): 音のファイルを別に読んでいる。1枚にするには、音をJSに埋め込む(hcbeat と同じ形)。
- `あとから別のJSファイルを読み込んでいる`(reggae): キットを選んだときに samples_<キット>.js を読む。全部のキットを最初から埋め込むか、配る版ではキットを絞る。

## 確かめたこと(2026-11-26)

- spaceship・seqkids・synthkids・chorusglitch・noisedrum・hcbeat: 1枚にして、ネットを切った状態で開き、エラーなし。
- noisedrum: http で開いたあと、ネットを切って読み込み直しても開けた(オフラインの仕組み)。
- マニュアルのPDF: ひな形から作れた(Chromium のヘッドレス)。

## 登録先に上げるのは本人

アカウント作り・ログイン・アップロードは、本人が行う(AIはしない)。
