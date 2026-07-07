/**
 * delivery.csv をベースに、各店舗の対応エリア輪郭を示す delivery.geojson を生成するスクリプト
 *
 * 使い方: node scripts/gen-delivery.mjs <delivery.csv のパス>
 *   例:   node scripts/gen-delivery.mjs "C:/Users/r23000700/Downloads/delivery.csv"
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as turf from "@turf/turf";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── 引数チェック ────────────────────────────────────────────────────────
const csvPath = process.argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/gen-delivery.mjs <path to delivery.csv>");
  process.exit(1);
}

// ── データ読み込み ───────────────────────────────────────────────────────
const csvRaw = readFileSync(csvPath, "utf8").replace(/^\uFEFF/, ""); // BOM除去
const townsGeoJSON = JSON.parse(
  readFileSync(resolve(__dirname, "../public/data/towns-voronoi.geojson"), "utf8")
);

// ── 町名 → Feature マップ作成 ──────────────────────────────────────────
/** @type {Map<string, import("@turf/turf").Feature>} */
const townMap = new Map();
for (const feature of townsGeoJSON.features) {
  const name = feature.properties.normalized_town_name;
  if (name) {
    townMap.set(name, feature);
    // 「○○町」の「町」省略形も登録（部分一致の補完用）
  }
}

// ── CSV パース（RFC4180 簡易対応） ─────────────────────────────────────
function parseCsv(raw) {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim());
  const [header, ...rows] = lines;
  const keys = header.split(",");
  return rows.map((row) => {
    // フィールドが多い場合の対応（対応エリアにカンマが含まれないことが前提）
    const cols = row.split(",");
    const obj = {};
    keys.forEach((k, i) => {
      obj[k.trim()] = (cols[i] ?? "").trim();
    });
    return obj;
  });
}

const stores = parseCsv(csvRaw);
console.log(`店舗数: ${stores.length}`);

// ── 町名の正規化（CSV 側の表記ゆれ吸収） ──────────────────────────────
function normalizeTownName(name) {
  return name
    .trim()
    // CSV データ破損の読み替え（け কমপক্ষে台町 → けやき台町）
    .replace(/^け\s*\S*台町$/, "けやき台町")
    // 全角数字 → 半角
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    // 全角ハイフン・長音符
    .replace(/[‐‑‒–—―]/g, "-")
    // 小書きヶ → 大書きケ（小ヶ倉 → 小ケ倉）
    .replace(/ヶ/g, "ケ")
    // 大書きツ → 小書きつ（八ツ尾 → 八つ尾）
    .replace(/ツ尾/g, "つ尾")
    // 丁目の漢数字対応（一〜九 → 1〜9）
    .replace(/一丁目/, "1丁目")
    .replace(/二丁目/, "2丁目")
    .replace(/三丁目/, "3丁目")
    .replace(/四丁目/, "4丁目")
    .replace(/五丁目/, "5丁目")
    .replace(/六丁目/, "6丁目")
    .replace(/七丁目/, "7丁目")
    .replace(/八丁目/, "8丁目")
    .replace(/九丁目/, "9丁目");
}

// ── 町 Feature の検索（前方一致含む） ─────────────────────────────────
function findTownFeatures(name) {
  // 完全一致
  if (townMap.has(name)) return [townMap.get(name)];

  // 前方一致（「滑石」→「滑石1〜6丁目」等）
  const byPrefix = [...townMap.entries()]
    .filter(([k]) => k.startsWith(name))
    .map(([, v]) => v);
  if (byPrefix.length > 0) return byPrefix;

  // 末尾「町」を除いた前方一致（「江平町」→「江平1丁目」等）
  if (name.endsWith("町")) {
    const base = name.slice(0, -1);
    const byBase = [...townMap.entries()]
      .filter(([k]) => k.startsWith(base))
      .map(([, v]) => v);
    if (byBase.length > 0) return byBase;
  }

  return [];
}

// ── 各店舗のエリアポリゴンを生成 ─────────────────────────────────────
const features = [];
const unmatched = new Set();

for (const store of stores) {
  const storeName = store["店舗名"];
  const serviceType = store["サービス"];
  const products = store["主な取り扱い品"];
  const areaRaw = store["対応エリア"] ?? "";

  if (!areaRaw) continue;

  const townNames = areaRaw.split("|").map(normalizeTownName).filter(Boolean);

  const matched = [];
  const notFound = [];

  for (const name of townNames) {
    const found = findTownFeatures(name);
    if (found.length > 0) {
      matched.push(...found);
    } else {
      notFound.push(name);
      unmatched.add(name);
    }
  }

  if (matched.length === 0) {
    console.warn(`[SKIP] ${storeName}: マッチした町がありません`);
    continue;
  }

  // 複数ポリゴンをユニオンして1つの輪郭に（turf v7: FeatureCollection 一括処理）
  let unionPoly;
  try {
    if (matched.length === 1) {
      unionPoly = matched[0];
    } else {
      unionPoly = turf.union(turf.featureCollection(matched));
    }
  } catch (err) {
    console.warn(`[WARN] ${storeName}: union 失敗 (${err.message})、MultiPolygon にフォールバック`);
    // union 失敗時は MultiPolygon として結合
    const coords = matched.map((f) => {
      if (f.geometry.type === "Polygon") return [f.geometry.coordinates];
      return f.geometry.coordinates;
    }).flat();
    unionPoly = turf.multiPolygon(coords);
  }

  features.push(
    turf.feature(turf.truncate(unionPoly, { precision: 5, mutate: true }).geometry, {
      store_name: storeName,
      service_type: serviceType,
      products: products,
      town_count: matched.length,
      unmatched_towns: notFound.length > 0 ? notFound.join("|") : null,
    })
  );

  if (notFound.length > 0) {
    console.warn(
      `[WARN] ${storeName}: 未マッチ町名 ${notFound.join(", ")}`
    );
  } else {
    console.log(
      `[OK]   ${storeName}: ${matched.length} 町 → ${serviceType}`
    );
  }
}

// ── 出力 ───────────────────────────────────────────────────────────────
const outputPath = resolve(__dirname, "../public/data/delivery.geojson");
const outputGeoJSON = turf.featureCollection(features);

writeFileSync(outputPath, JSON.stringify(outputGeoJSON), "utf8");
console.log(`\n✓ ${features.length} 店舗分を書き出しました: ${outputPath}`);

if (unmatched.size > 0) {
  console.log(`\n未マッチ町名一覧 (${unmatched.size} 件):`);
  for (const name of [...unmatched].sort()) {
    console.log(`  - ${name}`);
  }
}
