# 筋トレ記録（workout-log）

ジムでスマートフォンから数秒で筋トレを記録し、前回記録・履歴・種目別の重量推移を確認でき、全データを CSV で持ち出せる個人用 Web アプリ（PWA）です。

- **ローカルファースト**: サーバーを持ちません。データはすべて端末ブラウザの IndexedDB に保存され、外部へ送信されません。
- **オフライン動作**: Service Worker がアプリ本体を事前キャッシュするため、電波の無い場所でも起動・記録できます。
- **持ち出し**: CSV（分析用）と JSON（バックアップ／復元用）で全データを書き出せます（Phase 4 で実装予定）。

## 技術スタック

TypeScript / Vite / React / React Router / Dexie（IndexedDB）/ Tailwind CSS / vite-plugin-pwa / Vitest / ESLint

## セットアップ

Node.js 22 以上が必要です。

```bash
npm install
npm run dev        # 開発サーバー（http://localhost:5173）
```

## スクリプト

| コマンド | 内容 |
|---|---|
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド（`dist/`） |
| `npm run preview` | ビルド結果をローカル配信 |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript 型チェック |
| `npm test` | Vitest（fake-indexeddb で IndexedDB を再現） |
| `npm run check` | lint → typecheck → test → build を一括実行 |

## デプロイ（GitHub Pages）

`main` ブランチへ push すると GitHub Actions（`.github/workflows/deploy.yml`）が lint / typecheck / test / build を実行し、GitHub Pages へ配信します。

- 配信 URL は `https://rdaimon-noizz.github.io/workout-log/`
- サブパス配信のため、CI では環境変数 `VITE_BASE=/workout-log/` を渡してビルドしています。ローカルで同じビルドを再現する場合は PowerShell で `$env:VITE_BASE='/workout-log/'; npm run build` を実行してください（Git Bash では `/workout-log/` が Windows パスに変換されてしまうため、`MSYS_NO_PATHCONV=1` を付けるか PowerShell を使います）。
- GitHub Pages に SPA 用のフォールバックは無いため、ビルド後に `index.html` を `404.html` としてもコピーしています。

## iPhone へのインストール

1. Safari で配信 URL を開く
2. 共有ボタン →「ホーム画面に追加」
3. 以後はホーム画面のアイコンから起動する

ホーム画面に追加したアプリと Safari は保存領域が別です。**先にホーム画面へ追加してから記録を始めてください**（Safari 上で入力したデータはホーム画面版には引き継がれません）。
データは端末内にのみ保存されるため、アプリの削除や「Safari の履歴と Web サイトデータを消去」で消えます。定期的に JSON バックアップを取ってください。

## 使い方（記録）

1. ホームの「新しいトレーニング」で日付・体重（任意）・メモ（任意）を入れて開始する。進行中のトレーニングがあれば自動で終了する。
2. 「＋ 種目を追加」で種目を検索して選ぶ。無ければその場で作成できる。
3. セット入力画面で重量と reps を入れて「セット追加」。追加後も値が残るので、同じ重量なら次のセットは 1 タップ。
4. セット行をタップすると編集・削除。ヘッダーの「削除」で種目ごと削除。
5. 「トレーニングを終了」で終了時刻を記録する。終了後もセットの編集はできる。

「種目」タブで種目の作成・名前変更・カテゴリ変更・アーカイブ（選択肢から外す。過去の記録は残る）・復元ができる。

## データの規約

- 重量は kg。小数可（2.5 kg・1.25 kg 刻みなど）。自重種目は 0。
- ダンベル種目を片手の重量で記録するか合計で記録するかは決めていません。**同じ種目の中では統一**してください（分析時に混ざると比較できなくなります）。
- 日付（`date`）は端末ローカルの `YYYY-MM-DD`。時刻は ISO 8601 オフセット付き（例 `2026-09-18T19:30:00+09:00`）。
- ID は UUID。

### データモデル

| テーブル | 内容 | 主な項目 |
|---|---|---|
| exercises | 種目マスタ | name, nameKey（一意）, category, archivedAt |
| workouts | 1 回のトレーニング | date, startedAt, endedAt, bodyweightKg, memo |
| exerciseSessions | Workout 内の 1 種目 | workoutId, exerciseId, order, memo |
| workoutSets | 1 セット | exerciseSessionId, setNumber, weightKg, reps, memo |

種目の削除は物理削除ではなくアーカイブ（`archivedAt`）です。過去の記録は残ります。

### CSV（Phase 4 で実装予定）

1 行 = 1 セット。UTF-8 with BOM、CRLF。列順は次のとおり固定し、将来の追加は末尾にのみ行います。

```
date, workout_id, started_at, ended_at, bodyweight_kg, workout_memo,
exercise_id, exercise, exercise_category, exercise_order, exercise_session_id, exercise_memo,
set_id, set_number, weight_kg, reps, set_memo, set_created_at
```

- pandas で読む場合は `pd.read_csv(path, encoding="utf-8-sig")` を使ってください（既定の `utf-8` だと先頭列名に BOM が混じります）。
- セットが 1 つも無い Workout は CSV に現れません。

## 開発の進み方

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | 基盤（Vite / Dexie スキーマ / PWA / CI / デプロイ） | 完了（2026-09-18） |
| 2 | 記録（種目 CRUD・Workout・セットの追加/編集/削除） | 完了（2026-09-18） |
| 3 | 履歴（Workout 一覧/詳細・種目別履歴・前回記録・重量推移） | 未着手 |
| 4 | 出力（CSV・JSON バックアップ/復元） | 未着手 |
| 5 | 実機での UI 改善 | 未着手 |

仕様の正本は開発フォルダ側の `docs/02_指示書_v2.md`（リポジトリ外）にあります。
