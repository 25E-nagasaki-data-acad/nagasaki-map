import { readFileSync, writeFileSync } from "fs";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";

const cityGeoJSON = JSON.parse(
  readFileSync("public/data/nagasaki-city.geojson", "utf-8")
);
const busStopsGeoJSON = JSON.parse(
  readFileSync("public/data/P11-22_42.geojson", "utf-8")
);

const cityPolygon = cityGeoJSON.features[0];

const filtered = busStopsGeoJSON.features.filter((f) => {
  if (f.geometry.type !== "Point") return false;
  const [lng, lat] = f.geometry.coordinates;
  return booleanPointInPolygon(point([lng, lat]), cityPolygon);
});

const output = {
  type: "FeatureCollection",
  name: "bus-stops-nagasaki",
  features: filtered,
};

writeFileSync(
  "public/data/bus-stops-nagasaki.geojson",
  JSON.stringify(output),
  "utf-8"
);

console.log(`元データ: ${busStopsGeoJSON.features.length} 件`);
console.log(`長崎市内: ${filtered.length} 件`);
