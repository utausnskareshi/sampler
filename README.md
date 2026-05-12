# Sampler — オフライン音楽サンプラー (PWA)

iPhone / Android / PC のブラウザだけで動く、オフライン対応の音楽サンプラーです。
GitHub Pages で公開し、PWA としてホーム画面に追加すればネイティブアプリのように使えます。

公開 URL: <https://utausnskareshi.github.io/sampler/>

## 主な機能

1. 録音 / オーディオファイル取り込み
2. 4×4 パッド演奏 + クロマチック・ピッチ
3. トリミング / スライス / ループ / エフェクト (Reverb / Filter / Delay)
4. ポン出し + 16 ステップ・シーケンサー
5. ノーマライズ
6. チョップ (オンセット検出 + 手動マーカー)
7. リサンプリング (FX 込みオフラインレンダリング)
8. タイムストレッチ (SoundTouch.js)
9. スキップバック・サンプリング (30 秒リングバッファ)
10. ベロシティ感度 (Touch.force / Y 座標 / MIDI)

## 開発

```bash
npm install
npm run dev      # 開発サーバ
npm run build    # 本番ビルド
npm run preview  # ビルド成果物のプレビュー
```

## ライセンス

- **ソースコード**: MIT License (`LICENSE` を参照)
- **同梱音源**: すべて Web Audio API による合成音、外部素材は不使用
- **サードパーティ依存**: `THIRD_PARTY_NOTICES.md` を参照 (`soundtouchjs` は LGPL-2.1)
