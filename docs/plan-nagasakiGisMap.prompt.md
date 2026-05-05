## Plan: 長崎市GISデータ可視化 Next.jsアプリ

Next.js 16 (App Router) + react-leaflet を使い、長崎市の地図上に **市境界・人口統計・スーパーマーケット位置** を重ねて表示するWebアプリを構築します。GISデータは Nominatim API・Overpass API・地理院タイルから取得し、独自データ（スーパー位置）はJSON形式で管理します。

---

**Steps**

1. **プロジェクト作成**
   - `npx create-next-app@latest nagasaki-map --typescript --app --tailwind --eslint --no-src-dir --import-alias "@/*"` で新規プロジェクト作成
   - 実際にインストールされたバージョン: **Next.js 16.2.4**
   - `npm install leaflet react-leaflet @types/leaflet` をインストール

2. **ディレクトリ作成**
   - `public/data/` と `components/` を作成

3. **長崎市境界GeoJSONデータの取得**
   - Nominatim API で OSM リレーション（relation ID: 4011885）から市境界を取得：
     ```
     https://nominatim.openstreetmap.org/search?city=長崎市&country=Japan&format=geojson&polygon_geojson=1&limit=1
     ```
   - `public/data/nagasaki-city.geojson` に保存（FeatureCollection / Polygon 形式）
   - ⚠️ 国土数値情報の直接URLや非公式 GitHub リポジトリ（`niiyz/JapanCityGeoJson`）は 404 のため使用不可

4. **スーパーマーケットデータの取得**
   - Overpass API（GETリクエスト + `User-Agent` ヘッダー必須）で長崎市付近のスーパーを取得：
     ```
     https://overpass-api.de/api/interpreter?data=[out:json][timeout:25];node["shop"="supermarket"](32.3,129.5,33.1,130.1);out body;
     ```
   - `public/data/supermarkets.json` に保存（**52件**取得）
   - ⚠️ `curl --data`（POST）では 406 エラーになるため、GETクエリパラメータ形式を使用すること

5. **人口統計データの準備**
   - e-Stat からのCSV自動取得は省略し、参考値として15地区のJSONデータを手動作成
   - `public/data/population.json` に以下の形式で保存：

     | フィールド | 型 | 説明 |
     |---|---|---|
     | `id` | number | レコードの連番ID |
     | `name` | string | 地区名（例: "長崎駅周辺"） |
     | `lat` | number | 地区代表点の緯度（WGS84） |
     | `lng` | number | 地区代表点の経度（WGS84） |
     | `population` | number | 地区の推計人口（人） |
     | `area_km2` | number | 地区の面積（km²） |

     地図上での利用方法：
     - `lat` / `lng` → `CircleMarker` の中心座標
     - `population` → 円の色（青グラデーション）と半径（`√population / 4`）
     - `population / area_km2` → 人口密度（ポップアップ内で計算表示）

   - ⚠️ 本番利用時は [e-Stat 国勢調査](https://www.e-stat.go.jp/) の実データで差し替えること

6. **マップコンポーネントの実装**
   - `components/NagasakiMap.tsx`：`"use client"` クライアントコンポーネント
     - `react-leaflet` の `MapContainer`, `TileLayer`, `GeoJSON`, `CircleMarker`, `Popup`, `Tooltip`, `LayersControl` を使用
     - ベースタイル3種（地理院標準・地理院淡色・OSM）を `LayersControl.BaseLayer` で切替可能
     - 人口統計は `CircleMarker`（青系グラデーション・半径は人口の平方根に比例）
     - スーパーは赤い `CircleMarker`（radius=7）
     - ⚠️ Leaflet の型は `import type { PathOptions, Layer, Path } from "leaflet"` で個別インポート（`L.Layer` 記法は型エラーになる）
   - `components/MapLegend.tsx`：`useMap()` フックで Leaflet `Control` をカスタム作成、右下に表示
   - `components/MapWrapper.tsx`：**SSR回避専用クライアントラッパー（必須）**
     - ⚠️ Next.js 16 App Router では Server Component の `page.tsx` 内で `dynamic(..., { ssr: false })` は Turbopack ビルドエラーになる
     - `"use client"` な `MapWrapper.tsx` 内で `dynamic(() => import("./NagasakiMap"), { ssr: false })` を呼び出す構成で解決

7. **page.tsx の実装** (`app/page.tsx`)
   - `MapWrapper` をインポートしてヘッダー・地図・フッターを配置
   - `"use client"` 不要（Server Component のまま）

8. **ビルド確認**
   - `npm run build` で TypeScript・Turbopack エラーなしを確認
   - Route `/` が Static として正常に生成されることを確認

---

**Verification**
- ✅ `npm run build` 成功（TypeScript・Turbopack エラーなし）
- ✅ `http://localhost:3000` で長崎市の地図が表示される
- ✅ 地理院標準地図ベースで長崎市境界（オレンジ枠）が描画される
- ✅ 地区別人口円（青系グラデーション）がホバーでツールチップ、クリックでポップアップ表示
- ✅ スーパーマーケット52件が赤丸マーカーで表示され、クリックで店名ポップアップ表示
- ✅ 右上レイヤーコントロールでベースマップ切替・各レイヤーON/OFF可能
- ✅ 右下凡例が表示される
- ✅ SSR関連ビルドエラーなし

---

**Decisions**
- **react-leaflet 採用**：MapLibreより導入が簡単で、コロプレス・マーカー・ポップアップの要件を十分に満たす
- **国土地理院タイルをベースマップに採用**：日本語表記で長崎の地名が正確に表示される
- **Nominatim APIで市境界を取得**：国土数値情報URL・非公式GitHubリポジトリが404のため代替採用
- **Overpass APIでスーパー位置を取得（GETリクエスト）**：52件のデータを `public/data/` にキャッシュ済み
- **MapWrapper パターンで SSR 回避**：Next.js 16 Turbopack では Server Component 内の `dynamic + ssr:false` がビルドエラーになるため、Client Component ラッパーで `dynamic` を呼び出す構成に変更
- **人口データは参考値**：実データは e-Stat 国勢調査データで更新要

---

**Known Issues / TODO**
- 人口データが参考値のため、[e-Stat 国勢調査](https://www.e-stat.go.jp/) の実データへの差し替えが必要
- 行政区の町丁目境界ポリゴンは未実装（市全体アウトラインのみ）。詳細境界が必要な場合は国土数値情報 N03 データ（GeoJSON変換後）を追加すること
- スーパーのデータは取得時点のもの。定期更新が必要な場合はビルド時スクリプト化を検討すること
