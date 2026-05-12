# サードパーティ・ライセンス通知 / Third-Party Notices

本プロジェクトは以下のオープンソースソフトウェアを利用しています。
This project includes the following open source software.

## SoundTouchJS

- 用途: タイムストレッチ / ピッチシフト DSP
- 公式: <https://github.com/cutterbl/SoundTouchJS>
- ライセンス: **LGPL-2.1** (GNU Lesser General Public License v2.1)
- ライセンス全文: <https://github.com/cutterbl/SoundTouchJS/blob/master/LICENSE>

SoundTouchJS は LGPL-2.1 でライセンスされています。本プロジェクトでは npm 経由でライブラリとして利用しており、ビルド時に Vite が静的にバンドルしています。LGPL の要件に従い、利用者は本プロジェクトのソースコード一式 (本リポジトリ) から再ビルドすることで、SoundTouchJS を任意のバージョンに置き換えることが可能です。

---

## Vite / vite-plugin-pwa / TypeScript

- ライセンス: **MIT License**
- すべて MIT ライセンスのもとで配布されています。

ビルドツールおよび TypeScript コンパイラ等の開発依存ライブラリの完全な一覧は `package.json` および `package-lock.json` を参照してください。

---

## 同梱音源

本アプリの内蔵音源 (ドラム / シンセ / 動物の鳴き声 / 自然音 / FX) は、**すべて Web Audio API による合成音**であり、外部の録音素材は使用していません。本プロジェクトのライセンス (MIT) の対象となります。
