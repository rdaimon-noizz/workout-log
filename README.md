# 筋トレ記録（workout-log）

ジムでスマートフォンから数秒で筋トレを記録し、前回記録・履歴・種目別の重量推移を確認でき、全データを CSV で持ち出せる個人用 Web アプリ（PWA）です。

- **ローカルファースト**: サーバーを持ちません。データはすべて端末ブラウザの IndexedDB に保存され、外部へ送信されません。
- **オフライン動作**: Service Worker がアプリ本体を事前キャッシュするため、電波の無い場所でも起動・記録できます。
- **持ち出し**: CSV（分析用）と JSON（バックアップ／復元用）で全データを書き出せます（Phase 4 で実装予定）。

## 技術スタック

TypeScript / Vite / React / React Router / Dexie（IndexedDB）/ Tailwind CSS / vite-plugin-pwa / Recharts（グラフ。種目別履歴の画面だけ別チャンクで遅延読み込み）/ Vitest / ESLint

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

1. ホームの「新しいトレーニング」で日付・開始時刻（初期値は現在時刻。「今の時刻にする」で戻せる）・体重（任意）・メモ（任意）を入れて開始する。進行中のトレーニングがあれば自動で終了する。開始・終了時刻は後から「編集」で直せる。
2. 「＋ 種目を追加」で種目を検索して選ぶ。無ければその場で作成できる。
3. セット入力画面で重量・Reps・秒を入れて「セット追加」。Reps と秒はどちらか一方でよい（プランクは重量 0・秒 60、ポーズデッドリフトは重量 200・Reps 3・秒 2 など）。追加後も値が残るので、同じ重量なら次のセットは 1 タップ。
4. セット行をタップすると編集・削除。ヘッダーの「削除」で種目ごと削除。
5. 「トレーニングを終了」で終了時刻を記録する。終了後もセットの編集はできる。

## 使い方（履歴）

- 「履歴」タブにトレーニングが新しい順に並ぶ。タップするとその日の全種目・全セットを見られ、そこからセットの編集もできる。
- 「種目別の履歴・重量推移」で種目を選ぶと、Workout ごとの最高重量の折れ線グラフ（点をタップすると日付とその重量での最大 reps）と、日付ごとのセット一覧が出る。
- セット入力画面の上部に「前回」として、同じ種目を前にやった日の全セットが出る。セットがまだ無いときは前回の 1 セット目が入力欄の初期値になる。

「種目」タブで種目をタップすると、既存の種目（初期7種目を含む）の名前と部位を変更できる。作成・アーカイブ（選択肢から外す。過去の記録は残る）・復元もここで行う。セット入力画面のヘッダー「種目編集」からも同じ編集ができる。部位は候補（大胸筋・広背筋・僧帽筋・脊柱起立筋・三角筋・上腕二頭筋・上腕三頭筋・前腕・腹直筋・腹斜筋・大腿四頭筋・ハムストリング・大臀筋・内転筋・ふくらはぎ・全身・その他）から複数選べ、無い部位は自由に追加できる。追加した部位は次回から候補に出る。

## データの規約

- 重量は kg。小数可（2.5 kg・1.25 kg 刻みなど）。自重種目は 0。
- 秒はセットごとの任意項目。ホールド時間（プランク）として使うか、ポーズ秒（ポーズデッドリフト）として使うかは**同じ種目の中では統一**する。
- 部位は文字列の配列。表記ゆれ（「広背筋」と「背中」など）は分析時に別物になるので、候補にあるものは候補から選ぶ。
- ダンベル種目を片手の重量で記録するか合計で記録するかは決めていません。**同じ種目の中では統一**してください（分析時に混ざると比較できなくなります）。
- 日付（`date`）は端末ローカルの `YYYY-MM-DD`。時刻は ISO 8601 オフセット付き（例 `2026-09-18T19:30:00+09:00`）。
- ID は UUID。

### データモデル

| テーブル | 内容 | 主な項目 |
|---|---|---|
| exercises | 種目マスタ | name, nameKey（一意）, muscles（部位の配列）, archivedAt |
| workouts | 1 回のトレーニング | date, startedAt, endedAt, bodyweightKg, memo |
| exerciseSessions | Workout 内の 1 種目 | workoutId, exerciseId, order, memo |
| workoutSets | 1 セット | exerciseSessionId, setNumber, weightKg, reps（null 可）, durationSec（null 可）, memo |

種目の削除は物理削除ではなくアーカイブ（`archivedAt`）です。過去の記録は残ります。
スキーマの版は 2 です。版 1（部位が単一の category、秒なし）で保存されたデータは、初回起動時に自動で変換されます。

### CSV（Phase 4 で実装予定）

1 行 = 1 セット。UTF-8 with BOM、CRLF。列順は次のとおり固定し、将来の追加は末尾にのみ行います。

```
date, workout_id, started_at, ended_at, bodyweight_kg, workout_memo,
exercise_id, exercise, exercise_muscles, exercise_order, exercise_session_id, exercise_memo,
set_id, set_number, weight_kg, reps, set_memo, set_created_at, duration_sec
```

- pandas で読む場合は `pd.read_csv(path, encoding="utf-8-sig")` を使ってください（既定の `utf-8` だと先頭列名に BOM が混じります）。
- `exercise_muscles` は部位を `;` 区切りで 1 列に入れます（pandas では `str.split(';')` → `explode` で部位別に集計）。`reps` と `duration_sec` は無い側が空になります。
- セットが 1 つも無い Workout は CSV に現れません。

## 開発の進み方

| Phase | 内容 | 状態 |
|---|---|---|
| 1 | 基盤（Vite / Dexie スキーマ / PWA / CI / デプロイ） | 完了（2026-09-18） |
| 2 | 記録（種目 CRUD・Workout・セットの追加/編集/削除） | 完了（2026-09-18） |
| 2.5 | 仕様追加（セットの秒、開始時刻の指定、部位の複数選択・自由追加） | 完了（2026-09-18） |
| 3 | 履歴（Workout 一覧/詳細・種目別履歴・前回記録・重量推移） | 完了（2026-09-18） |
| 4 | 出力（CSV・JSON バックアップ/復元） | 未着手 |
| 5 | 実機での UI 改善 | 未着手 |

仕様の正本は開発フォルダ側の `docs/03_指示書_v3.md`（リポジトリ外）にあります。
