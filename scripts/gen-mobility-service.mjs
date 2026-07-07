/**
 * mobility_service.csv のサービスエリアを towns-voronoi.geojson の
 * 町境界ポリゴンをベースに合成して mobility_service.geojson を生成するスクリプト
 *
 * 使い方: node scripts/gen-mobility-service.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as turf from "@turf/turf";

const __dirname = dirname(fileURLToPath(import.meta.url));

const towns = JSON.parse(
  readFileSync(
    resolve(__dirname, "../public/data/towns-voronoi.geojson"),
    "utf8"
  )
);

const cityGeoJSON = JSON.parse(
  readFileSync(
    resolve(__dirname, "../public/data/nagasaki-city.geojson"),
    "utf8"
  )
);

/** 町名パターン（文字列: 完全一致 / RegExp: 前方一致等）でフィルタ */
function matchTowns(patterns) {
  if (!patterns || patterns.length === 0) return [];
  return towns.features.filter((f) => {
    const name = f.properties.town_name;
    return patterns.some((p) =>
      typeof p === "string" ? name === p : p.test(name)
    );
  });
}

/** 複数のポリゴンフィーチャーを1つにUnion */
function unionFeatures(features) {
  if (!features || features.length === 0) return null;
  if (features.length === 1) return features[0].geometry;

  let result = turf.feature(features[0].geometry);
  for (let i = 1; i < features.length; i++) {
    try {
      result = turf.union(
        turf.featureCollection([result, turf.feature(features[i].geometry)])
      );
    } catch (e) {
      console.warn(`  Union skip (${e.message})`);
    }
  }
  return result ? result.geometry : null;
}

/** 長崎市全体のポリゴン（nagasaki-city.geojsonを使用）*/
function nagasakiCityGeometry() {
  return cityGeoJSON.features[0].geometry;
}

// ──────────────────────────────────────────────────────────────
// サービス定義
// town_patterns: null → 長崎市内全体
//                []   → エリア特定不可（geometryはnull）
// ──────────────────────────────────────────────────────────────
const SERVICE_DEFINITIONS = [
  {
    service_name: "乗合タクシー",
    provider: "長崎市（委託: ラッキー自動車・丸寿タクシー・文化タクシー・城山交通・住吉タクシー）",
    service_type: "乗合タクシー",
    features: "",
    area_raw: "丸善団地地区|矢の平・伊良林地区|北大浦地区|金堀地区|西北地区",
    // 矢の平・伊良林地区、金堀地区、西北地区は町名特定可能
    // 丸善団地地区・北大浦地区は町名が特定困難なため除外
    town_patterns: [/^矢の平/, /^伊良林/, "金堀町", "西北町"],
  },
  {
    service_name: "長崎市コミュニティバス",
    provider: "長崎市（委託: さいかい交通・長崎自動車・富川運送・長崎県交通局）",
    service_type: "コミュニティバス",
    features: "",
    area_raw: "外海線|琴海尾戸線|香焼三和線|三和線|野母崎線|伊王島線|高島線|東部線",
    town_patterns: [
      // 外海線
      /^神浦/,
      "西出津町",
      "東出津町",
      // 琴海尾戸線
      "琴海尾戸町",
      // 香焼三和線 + 三和線
      "香焼町",
      "三和町",
      "為石町",
      "以下宿町",
      "蚊焼町",
      /^深堀町/,
      // 野母崎線
      "野母町",
      "野母崎樺島町",
      "脇岬町",
      "樺島町",
      "高浜町",
      // 伊王島線
      "伊王島町",
      // 高島線
      "高島町",
      // 東部線
      "矢上町",
      "戸石町",
      "網場町",
      "宿町",
      "田中町",
    ],
  },
  {
    service_name: "デマンド交通",
    provider: "長崎市（委託: 琴海タクシー）",
    service_type: "デマンド型交通",
    features: "坂や階段があり自力移動が困難な要支援・要介護者等向け",
    area_raw: "琴海村松町|琴海戸根町|琴海戸根原町|琴海形上町|琴海大平町|琴海尾戸町|長浦町|西海町全域",
    town_patterns: [
      "琴海村松町",
      "琴海戸根町",
      "琴海戸根原町",
      "琴海形上町",
      "琴海大平町",
      "琴海尾戸町",
      "長浦町",
      "西海町",
    ],
  },
  {
    service_name: "いこ～で",
    provider: "長崎市（指定移送支援事業者: ラッキーグループ・合同会社TAIDE等）",
    service_type: "移送支援サービス（乗降・付き添い介助）",
    features: "坂や階段があり自力移動が困難な要支援・要介護者等向け",
    area_raw: "長崎市内",
    town_patterns: null, // 長崎市全体
  },
  {
    service_name: "みんなでいごこーで（水の浦地区お買い物バス）",
    provider: "長崎市社会福祉協議会水の浦支部・チューリップスポーツクラブ",
    service_type: "介護予防運動および買い物送迎バス",
    features: "",
    area_raw: "長崎市水の浦地区",
    town_patterns: ["水の浦町"],
  },
  {
    service_name: "イオンの移動販売",
    provider: "イオン東長崎店",
    service_type: "移動販売（店舗同価格・出張手数料制）",
    features: "",
    area_raw: "長崎市川平地区市内7箇所|老人ホーム等",
    town_patterns: ["川平町"],
  },
  {
    service_name: "〈エレタク〉お買い物タクシー代行サービス",
    provider: "長崎県タクシー協会・スーパー「エレナ」",
    service_type: "買い物代行タクシー",
    features: "エレナ各店舗と提携",
    area_raw: "長崎市内",
    town_patterns: null, // 長崎市全体
  },
  {
    service_name: "お買い物タクシー",
    provider: "安全タクシー",
    service_type: "買い物支援（タクシーによる救援事業）",
    features: "",
    area_raw: "長崎市内",
    town_patterns: null, // 長崎市全体
  },
  {
    service_name: "福祉タクシー",
    provider: "福祉タクシー一歩 など",
    service_type: "福祉車両による外出・買い物送迎",
    features: "",
    area_raw: "長崎市内",
    town_patterns: null, // 長崎市全体
  },
  {
    service_name: "新鮮工房 大門 サニーピア店",
    provider: "新鮮工房 大門 サニーピア店",
    service_type: "送迎",
    features: "",
    area_raw: "店舗近隣",
    // サニーピア長崎は飽の浦町に所在
    town_patterns: ["飽の浦町"],
  },
  {
    service_name: "ララなめし",
    provider: "ララなめし",
    service_type: "送迎",
    features: "",
    area_raw: "各店舗周辺",
    // 「なめし」= 滑石（なめし）エリア
    town_patterns: [/^滑石/],
  },
  {
    service_name: "ララ新戸町",
    provider: "ララ新戸町",
    service_type: "送迎",
    features: "",
    area_raw: "各店舗周辺",
    town_patterns: [/^新戸町/],
  },
  {
    service_name: "ララあたご",
    provider: "ララあたご",
    service_type: "送迎",
    features: "",
    area_raw: "各店舗周辺",
    town_patterns: [/^愛宕/],
  },
  {
    service_name: "ララながよ",
    provider: "ララながよ",
    service_type: "送迎",
    features: "",
    area_raw: "各店舗周辺（長崎市外・長与町）",
    // 長与町は長崎市外のため対象外
    town_patterns: [],
  },
  {
    service_name: "ララ矢上",
    provider: "ララ矢上",
    service_type: "送迎",
    features: "",
    area_raw: "東町・矢上町|田中町|宿町|網場町|新中川町|矢の平|愛宕|本河内",
    town_patterns: [
      "東町",
      "矢上町",
      "田中町",
      "宿町",
      "網場町",
      "新中川町",
      /^矢の平/,
      /^愛宕/,
      /^本河内/,
    ],
  },
];

// ──────────────────────────────────────────────────────────────
// 長崎市全体のジオメトリを事前計算
// ──────────────────────────────────────────────────────────────
let cityGeometry = null;

// ──────────────────────────────────────────────────────────────
// フィーチャー生成
// ──────────────────────────────────────────────────────────────
const features = [];

for (const def of SERVICE_DEFINITIONS) {
  console.log(`処理中: ${def.service_name}`);

  let geometry = null;

  if (def.town_patterns === null) {
    // 長崎市全体
    if (!cityGeometry) {
      cityGeometry = nagasakiCityGeometry();
    }
    geometry = cityGeometry;
  } else if (def.town_patterns.length === 0) {
    // エリア特定不可
    console.log("  → エリア特定不可（geometryはnull）");
  } else {
    const matched = matchTowns(def.town_patterns);
    console.log(`  → マッチした町: ${matched.map((f) => f.properties.town_name).join(", ")}`);
    if (matched.length > 0) {
      geometry = unionFeatures(matched);
    }
  }

  features.push(
    turf.feature(geometry, {
      service_name: def.service_name,
      provider: def.provider,
      service_type: def.service_type,
      features: def.features,
      area_raw: def.area_raw,
    })
  );
}

const output = turf.featureCollection(features);

const outPath = resolve(__dirname, "../public/data/mobility_service.geojson");
writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
console.log(`\n✓ ${outPath} に書き出しました（${features.length} フィーチャー）`);
