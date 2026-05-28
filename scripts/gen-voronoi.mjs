/**
 * population2.json の中心点から Voronoi ポリゴンを生成して
 * public/data/towns-voronoi.geojson に保存するスクリプト
 *
 * 使い方: node scripts/gen-voronoi.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as turf from "@turf/turf";

const __dirname = dirname(fileURLToPath(import.meta.url));

const population = JSON.parse(
  readFileSync(resolve(__dirname, "../public/data/population2.json"), "utf8")
);

// ── 1. 中心点の FeatureCollection を作成 ─────────────────────────────────
const points = turf.featureCollection(
  population.map((d) =>
    turf.point([d.longitude, d.latitude], {
      id: d.id,
      town_name: d.town_name,
      population_age_65_and_over: d.population_age_65_and_over,
    })
  )
);

// ── 2. バウンディングボックスを少し広げて Voronoi を計算 ─────────────────
const [minLng, minLat, maxLng, maxLat] = turf.bbox(points);
const pad = 0.05;
const bbox = [minLng - pad, minLat - pad, maxLng + pad, maxLat + pad];

const voronoi = turf.voronoi(points, { bbox });

if (!voronoi || !voronoi.features.length) {
  console.error("Voronoi 生成失敗");
  process.exit(1);
}

// ── 3. 入力点の properties を Voronoi ポリゴンへ転写 ──────────────────────
//    turf.voronoi は入力と同順で出力するが properties は空なのでマージする
const features = voronoi.features.map((poly, i) => ({
  ...poly,
  properties: points.features[i].properties,
}));

const result = turf.featureCollection(features);

// ── 4. 保存 ───────────────────────────────────────────────────────────────
const outPath = resolve(__dirname, "../public/data/towns-voronoi.geojson");
writeFileSync(outPath, JSON.stringify(result), "utf8");

console.log(`✓ ${features.length} 町の Voronoi ポリゴンを生成しました`);
console.log("出力:", outPath);
console.log("サンプル properties:", JSON.stringify(features[0].properties));
