"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  GeoJSON,
  CircleMarker,
  Marker,
  Popup,
  LayersControl,
  Tooltip,
  useMap,
} from "react-leaflet";
import type { Feature, GeoJsonObject, FeatureCollection, Point } from "geojson";
import type { PathOptions, Layer, Path } from "leaflet";
import L from "leaflet";
import MapLegend from "./MapLegend";

// エリア別カラー
const AREA_COLORS: Record<string, string> = {
  "中心部": "#ef4444",
  "東部":   "#f59e0b",
  "南部":   "#10b981",
  "北部":   "#3b82f6",
};

// 種別アイコン（絵文字）
const TYPE_ICONS: Record<string, string> = {
  "スーパー":   "🛒",
  "コンビニ":   "🏪",
  "個人商店":   "🏬",
};

function makeRetailIcon(area: string, type: string) {
  const color = AREA_COLORS[area] ?? "#6b7280";
  const emoji = TYPE_ICONS[type] ?? "📍";
  return L.divIcon({
    className: "",
    html: `<div style="
      background:${color};
      border:2px solid white;
      border-radius:50%;
      width:30px;
      height:30px;
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:15px;
      box-shadow:0 2px 5px rgba(0,0,0,0.35);
    ">${emoji}</div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -18],
  });
}

const { BaseLayer, Overlay } = LayersControl;

interface SupermarketElement {
  type: string;
  id: number;
  lat: number;
  lon: number;
  tags: Record<string, string>;
}

interface RetailStore {
  id: number;
  name: string;
  type: string;
  chain: string;
  area: string;
  address: string;
  lat: number;
  lng: number;
}

// 人口に応じた色を返す
function getPopulationColor(population: number): string {
  if (population > 1000) return "#084594";
  if (population > 700) return "#2171b5";
  if (population > 500) return "#4292c6";
  if (population > 300) return "#6baed6";
  if (population > 100) return "#9ecae1";
  return "#c6dbef";
}

// 高齢化率（65歳以上割合 %）に応じた色を返す
function getAgingRateColor(rate: number): string {
  if (rate >= 60) return "#4a0000";
  if (rate >= 55) return "#7f0000";
  if (rate >= 50) return "#b30000";
  if (rate >= 45) return "#d7301f";
  if (rate >= 40) return "#ef6548";
  if (rate >= 35) return "#fc8d59";
  if (rate >= 30) return "#fdbb84";
  return "#fef0d9";
}

function MapPanes() {
  const map = useMap();

  useEffect(() => {
    if (!map.getPane("townPane")) {
      const townPane = map.createPane("townPane");
      townPane.style.zIndex = "430";
      townPane.style.pointerEvents = "auto";
    }
    if (!map.getPane("storePane")) {
      const storePane = map.createPane("storePane");
      storePane.style.zIndex = "650";
      storePane.style.pointerEvents = "auto";
    }
    if (!map.getPane("busStopPane")) {
      const busStopPane = map.createPane("busStopPane");
      busStopPane.style.zIndex = "640";
      busStopPane.style.pointerEvents = "auto";
    }
    if (!map.getPane("deliveryPane")) {
      const deliveryPane = map.createPane("deliveryPane");
      deliveryPane.style.zIndex = "435";
      deliveryPane.style.pointerEvents = "auto";
    }
    if (!map.getPane("mobilityPane")) {
      const mobilityPane = map.createPane("mobilityPane");
      mobilityPane.style.zIndex = "436";
      mobilityPane.style.pointerEvents = "auto";
    }

    const tooltipPane = map.getPane("tooltipPane");
    if (tooltipPane) {
      tooltipPane.style.zIndex = "800";
    }

    const popupPane = map.getPane("popupPane");
    if (popupPane) {
      popupPane.style.zIndex = "810";
    }
  }, [map]);

  return null;
}


// ---- 町輪郭レイヤー（Voronoi GeoJSON を Leaflet で直接描画）----
function TownLayer({
  data,
  visible,
  colorMode,
}: {
  data: GeoJsonObject | null;
  visible: boolean;
  colorMode: "population" | "aging_rate";
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!data) return;

    const popup = L.popup();

    const geoLayer = L.geoJSON(data, {
      pane: "townPane",
      style: (feature) => {
        const props = (feature?.properties as Record<string, number>) ?? {};
        const fillColor =
          colorMode === "aging_rate"
            ? getAgingRateColor(props.aging_rate ?? 0)
            : getPopulationColor(props.population_age_65_and_over ?? 0);
        return {
          fillColor,
          fillOpacity: 0.55,
          color: "#ffffff",
          weight: 0.8,
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as {
          town_name: string;
          population_age_65_and_over: number;
          total_population: number;
          aging_rate: number;
        };
        const baseColor =
          colorMode === "aging_rate"
            ? getAgingRateColor(props.aging_rate ?? 0)
            : getPopulationColor(props.population_age_65_and_over ?? 0);

        const popupDetail =
          colorMode === "aging_rate"
            ? `<span style="font-size:12px">高齢化率: <strong>${(props.aging_rate ?? 0).toFixed(1)}</strong>%</span><br/>` +
              `<span style="font-size:12px">65歳以上: ${(props.population_age_65_and_over ?? 0).toLocaleString()} 人 / 総人口: ${(props.total_population ?? 0).toLocaleString()} 人</span>`
            : `<span style="font-size:12px">65歳以上人口: <strong>${(props.population_age_65_and_over ?? 0).toLocaleString()}</strong> 人</span>`;

        layer.on("mouseover", (e: L.LeafletMouseEvent) => {
          (layer as L.Path).setStyle({
            fillOpacity: 0.9,
            color: "#fff",
            weight: 2,
          });
        });
        layer.on("mouseout", () => {
          (layer as L.Path).setStyle({
            fillColor: baseColor,
            fillOpacity: 0.55,
            color: "#ffffff",
            weight: 0.8,
          });
        });
        layer.on("click", (e: L.LeafletMouseEvent) => {
          popup
            .setLatLng(e.latlng)
            .setContent(
              `<strong style="font-size:13px">${props.town_name}</strong><br/>` + popupDetail
            )
            .openOn(map);
        });
      },
    });

    layerRef.current = geoLayer;
    geoLayer.addTo(map);

    return () => {
      geoLayer.remove();
      popup.remove();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, data, colorMode]);

  // 表示/非表示の切り替え
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) {
      layer.addTo(map);
    } else {
      layer.remove();
    }
  }, [map, visible]);

  return null;
}
// -----------------------------------------------------------------------

// ---- 配達エリアレイヤー ----
const DELIVERY_SERVICE_COLORS: Record<string, string> = {
  "移動販売": "#f97316",
  "宅配":   "#92400e",
  "ネットスーパー": "#10b981",
  "送迎":   "#8b5cf6",
};

function DeliveryLayer({
  data,
  visible,
}: {
  data: FeatureCollection | null;
  visible: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!data) return;

    const popup = L.popup();

    const geoLayer = L.geoJSON(data as GeoJsonObject, {
      pane: "deliveryPane",
      style: (feature) => {
        const svc = (feature?.properties as Record<string, string>)?.service_type ?? "";
        const color = DELIVERY_SERVICE_COLORS[svc] ?? "#6b7280";
        return {
          fillColor: color,
          fillOpacity: 0.2,
          color: color,
          weight: 2,
          dashArray: "4 3",
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as {
          store_name: string;
          service_type: string;
          products: string;
          town_count: number;
        };
        const color = DELIVERY_SERVICE_COLORS[props.service_type] ?? "#6b7280";

        layer.on("mouseover", () => {
          (layer as L.Path).setStyle({ fillOpacity: 0.45, weight: 3 });
        });
        layer.on("mouseout", () => {
          (layer as L.Path).setStyle({
            fillColor: color,
            fillOpacity: 0.2,
            color: color,
            weight: 2,
          });
        });
        layer.on("click", (e: L.LeafletMouseEvent) => {
          popup
            .setLatLng(e.latlng)
            .setContent(
              `<strong style="font-size:13px">${props.store_name}</strong><br/>` +
              `<span style="font-size:12px">サービス: ${props.service_type}</span><br/>` +
              `<span style="font-size:12px">取扱品: ${props.products}</span><br/>` +
              `<span style="font-size:12px; color:#6b7280">対応 ${props.town_count} 町</span>`
            )
            .openOn(map);
        });
      },
    });

    layerRef.current = geoLayer;
    if (visible) geoLayer.addTo(map);

    return () => {
      geoLayer.remove();
      popup.remove();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, data]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) {
      layer.addTo(map);
    } else {
      layer.remove();
    }
  }, [map, visible]);

  return null;
}
// -----------------------------------------------------------------------

// ---- モビリティサービスレイヤー ----
const MOBILITY_SERVICE_COLORS: Record<string, string> = {
  "乗合タクシー":            "#f59e0b",
  "コミュニティバス":         "#3b82f6",
  "デマンド型交通":           "#8b5cf6",
  "移送支援サービス（乗降・付き添い介助）": "#ec4899",
  "介護予防運動および買い物送迎バス":    "#10b981",
  "移動販売（店舗同価格・出張手数料制）": "#f97316",
  "買い物代行タクシー":        "#eab308",
  "買い物支援（タクシーによる救援事業）": "#06b6d4",
  "福祉車両による外出・買い物送迎":    "#84cc16",
  "送迎":                   "#6b7280",
};

function MobilityLayer({
  data,
  visible,
}: {
  data: FeatureCollection | null;
  visible: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!data) return;

    const popup = L.popup();

    const geoLayer = L.geoJSON(data as GeoJsonObject, {
      pane: "mobilityPane",
      style: (feature) => {
        const svc = (feature?.properties as Record<string, string>)?.service_type ?? "";
        const color = MOBILITY_SERVICE_COLORS[svc] ?? "#6b7280";
        return {
          fillColor: color,
          fillOpacity: 0.2,
          color: color,
          weight: 2,
          dashArray: "6 3",
        };
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as {
          service_name: string;
          provider: string;
          service_type: string;
          features: string;
          area_raw: string;
        };
        const color = MOBILITY_SERVICE_COLORS[props.service_type] ?? "#6b7280";

        layer.on("mouseover", () => {
          (layer as L.Path).setStyle({ fillOpacity: 0.45, weight: 3 });
        });
        layer.on("mouseout", () => {
          (layer as L.Path).setStyle({
            fillColor: color,
            fillOpacity: 0.2,
            color: color,
            weight: 2,
          });
        });
        layer.on("click", (e: L.LeafletMouseEvent) => {
          popup
            .setLatLng(e.latlng)
            .setContent(
              `<strong style="font-size:13px">${props.service_name}</strong><br/>` +
              `<span style="font-size:12px">種別: ${props.service_type}</span><br/>` +
              (props.provider ? `<span style="font-size:11px; color:#6b7280">${props.provider}</span><br/>` : "") +
              (props.features ? `<span style="font-size:11px; color:#6b7280">特徴: ${props.features}</span>` : "")
            )
            .openOn(map);
        });
      },
    });

    layerRef.current = geoLayer;
    if (visible) geoLayer.addTo(map);

    return () => {
      geoLayer.remove();
      popup.remove();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, data]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) {
      layer.addTo(map);
    } else {
      layer.remove();
    }
  }, [map, visible]);

  return null;
}
// -----------------------------------------------------------------------

// ---- バス停レイヤー（GeoJSON を Leaflet で直接描画）----
function BusStopLayer({
  data,
  visible,
}: {
  data: FeatureCollection | null;
  visible: boolean;
}) {
  const map = useMap();
  const layerRef = useRef<L.GeoJSON | null>(null);

  useEffect(() => {
    if (!data) return;

    const tooltip = L.tooltip({ direction: "top", offset: L.point(0, -5) });

    const geoLayer = L.geoJSON(data, {
      pane: "busStopPane",
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, {
          pane: "busStopPane",
          radius: 5,
          fillColor: "#3b82f6",
          fillOpacity: 0.85,
          color: "#1d4ed8",
          weight: 1,
        }),
      onEachFeature: (feature, layer) => {
        const name =
          (feature.properties as Record<string, string>)?.P11_001 ?? "";
        layer.on("mouseover", (e: L.LeafletMouseEvent) => {
          tooltip.setContent(name).setLatLng(e.latlng).addTo(map);
        });
        layer.on("mouseout", () => {
          tooltip.remove();
        });
      },
    });

    layerRef.current = geoLayer;
    if (visible) geoLayer.addTo(map);

    return () => {
      geoLayer.remove();
      tooltip.remove();
      layerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, data]);

  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    if (visible) {
      layer.addTo(map);
    } else {
      layer.remove();
    }
  }, [map, visible]);

  return null;
}
// -----------------------------------------------------------------------

export default function NagasakiMap() {
  const [cityBoundary, setCityBoundary] = useState<GeoJsonObject | null>(null);
  const [supermarkets, setSupermarkets] = useState<SupermarketElement[]>([]);
  const [retailStores, setRetailStores] = useState<RetailStore[]>([]);
  const [supermarketMode, setSupermarketMode] = useState<"osm" | "retail" | "none">("none");
  const [townsGeoJSON, setTownsGeoJSON] = useState<GeoJsonObject | null>(null);
  const [townViewMode, setTownViewMode] = useState<"none" | "population" | "aging_rate">("none");
  const [busStopsGeoJSON, setBusStopsGeoJSON] = useState<FeatureCollection | null>(null);
  const [deliveryGeoJSON, setDeliveryGeoJSON] = useState<FeatureCollection | null>(null);
  const [showBusStops, setShowBusStops] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showDeliveryAll, setShowDeliveryAll] = useState(false);
  const [mobilityGeoJSON, setMobilityGeoJSON] = useState<FeatureCollection | null>(null);
  const [showMobility, setShowMobility] = useState(false);
  const [showMobilityAll, setShowMobilityAll] = useState(false);

  // パネル位置（ドラッグ移動）
  const [panelPos, setPanelPos] = useState({ x: 50, y: 10 });
  const panelDragRef = useRef<{ startMX: number; startMY: number; startPX: number; startPY: number } | null>(null);

  // town_count < 488: エリア限定、=== 488: 市内全域
  const deliveryAreaGeoJSON = useMemo<FeatureCollection | null>(() => {
    if (!deliveryGeoJSON) return null;
    return { ...deliveryGeoJSON, features: deliveryGeoJSON.features.filter((f) => (f.properties?.town_count ?? 0) < 488) };
  }, [deliveryGeoJSON]);

  const deliveryCityWideGeoJSON = useMemo<FeatureCollection | null>(() => {
    if (!deliveryGeoJSON) return null;
    return { ...deliveryGeoJSON, features: deliveryGeoJSON.features.filter((f) => (f.properties?.town_count ?? 0) === 488) };
  }, [deliveryGeoJSON]);

  // モビリティ: area_raw が "長崎市内" 以外はエリア限定、"長崎市内" は市内全域
  const mobilityAreaGeoJSON = useMemo<FeatureCollection | null>(() => {
    if (!mobilityGeoJSON) return null;
    return { ...mobilityGeoJSON, features: mobilityGeoJSON.features.filter((f) => f.properties?.area_raw !== "長崎市内" && f.geometry !== null) };
  }, [mobilityGeoJSON]);

  const mobilityCityWideGeoJSON = useMemo<FeatureCollection | null>(() => {
    if (!mobilityGeoJSON) return null;
    return { ...mobilityGeoJSON, features: mobilityGeoJSON.features.filter((f) => f.properties?.area_raw === "長崎市内") };
  }, [mobilityGeoJSON]);

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!panelDragRef.current) return;
      const dx = e.clientX - panelDragRef.current.startMX;
      const dy = e.clientY - panelDragRef.current.startMY;
      setPanelPos({
        x: panelDragRef.current.startPX + dx,
        y: panelDragRef.current.startPY + dy,
      });
    };
    const onMouseUp = () => { panelDragRef.current = null; };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useEffect(() => {
    // 市境界GeoJSONの読み込み
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/nagasaki-city.geojson`)
      .then((r) => r.json())
      .then(setCityBoundary)
      .catch(console.error);

    // スーパーマーケットデータの読み込み（OSM / Overpass取得版）
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/supermarkets.json`)
      .then((r) => r.json())
      .then((d) => setSupermarkets(d.elements ?? []))
      .catch(console.error);

    // 小売店データの読み込み（拡張）
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/retail_stores_nagasaki.json`)
      .then((r) => r.json())
      .then(setRetailStores)
      .catch(console.error);

    // 町輪郭 Voronoi GeoJSON の読み込み（65歳以上人口付き）
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/towns-voronoi.geojson`)
      .then((r) => r.json())
      .then(setTownsGeoJSON)
      .catch(console.error);

    // バス停 GeoJSON の読み込み（長崎市内のみ）
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/bus-stops-nagasaki.geojson`)
      .then((r) => r.json())
      .then(setBusStopsGeoJSON)
      .catch(console.error);

    // 配達エリア GeoJSON の読み込み
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/delivery.geojson`)
      .then((r) => r.json())
      .then(setDeliveryGeoJSON)
      .catch(console.error);

    // モビリティサービス GeoJSON の読み込み
    fetch(`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/data/mobility_service.geojson`)
      .then((r) => r.json())
      .then(setMobilityGeoJSON)
      .catch(console.error);
  }, []);

  const cityStyle: PathOptions = {
    color: "#d97706",
    weight: 2.5,
    opacity: 0.9,
    fillColor: "#fef3c7",
    fillOpacity: 0.15,
  };

  const onEachCityFeature = (feature: Feature, layer: Layer) => {
    const name = (feature.properties as Record<string, string>)?.name ?? "長崎市";
    (layer as Path).bindPopup(`<strong>${name}</strong>`);
  };

  return (
    <div style={{ height: "100%", width: "100%", position: "relative" }}>
      {/* レイヤー操作パネル（右上） */}
      <div
        style={{
          position: "absolute",
          top: `${panelPos.y}px`,
          left: `${panelPos.x}px`,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          background: "white",
          padding: "8px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          minWidth: "160px",
        }}
      >
        {/* ドラッグハンドル */}
        <div
          onMouseDown={(e) => {
            panelDragRef.current = {
              startMX: e.clientX,
              startMY: e.clientY,
              startPX: panelPos.x,
              startPY: panelPos.y,
            };
            e.preventDefault();
          }}
          style={{
            cursor: "grab",
            textAlign: "center",
            fontSize: "12px",
            color: "#9ca3af",
            marginBottom: "4px",
            userSelect: "none",
            letterSpacing: "2px",
          }}
        >
          ⋮⋮
        </div>
        <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "bold", marginBottom: "2px" }}>🛒 店舗データ</div>
        <button
          onClick={() => setSupermarketMode((v) => v === "osm" ? "none" : "osm")}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #ef4444",
            background: supermarketMode === "osm" ? "#ef4444" : "white",
            color: supermarketMode === "osm" ? "white" : "#ef4444",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {supermarketMode === "osm" ? "✓ " : ""} OSMデータ
        </button>
        <button
          onClick={() => setSupermarketMode((v) => v === "retail" ? "none" : "retail")}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #8b5cf6",
            background: supermarketMode === "retail" ? "#8b5cf6" : "white",
            color: supermarketMode === "retail" ? "white" : "#8b5cf6",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {supermarketMode === "retail" ? "✓ " : ""} 拡張データ
        </button>
        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "2px 0" }} />
        <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "bold", marginBottom: "2px" }}>👴 高齢者人口</div>
        <button
          onClick={() => setTownViewMode((v) => v === "population" ? "none" : "population")}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #10b981",
            background: townViewMode === "population" ? "#10b981" : "white",
            color: townViewMode === "population" ? "white" : "#10b981",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {townViewMode === "population" ? "✓ " : ""} 65歳以上人口
        </button>
        <button
          onClick={() => setTownViewMode((v) => v === "aging_rate" ? "none" : "aging_rate")}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #b45309",
            background: townViewMode === "aging_rate" ? "#b45309" : "white",
            color: townViewMode === "aging_rate" ? "white" : "#b45309",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {townViewMode === "aging_rate" ? "✓ " : ""} 高齢化率
        </button>
        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "2px 0" }} />
        <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "bold", marginBottom: "2px" }}>🚌 交通</div>
        <button
          onClick={() => setShowBusStops((v) => !v)}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #3b82f6",
            background: showBusStops ? "#3b82f6" : "white",
            color: showBusStops ? "white" : "#3b82f6",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {showBusStops ? "✓ " : ""} 🚌 バス停
        </button>
        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "2px 0" }} />
        <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "bold", marginBottom: "2px" }}>🚚 配達・宅配</div>
        <button
          onClick={() => setShowDelivery((v) => !v)}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #f97316",
            background: showDelivery ? "#f97316" : "white",
            color: showDelivery ? "white" : "#f97316",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {showDelivery ? "✓ " : ""} 移動販売＆宅配
        </button>
        <button
          onClick={() => setShowDeliveryAll((v) => !v)}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #6b7280",
            background: showDeliveryAll ? "#6b7280" : "white",
            color: showDeliveryAll ? "white" : "#6b7280",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {showDeliveryAll ? "✓ " : ""} 🌐 市内全域サービス
        </button>
        <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "2px 0" }} />
        <div style={{ fontSize: "11px", color: "#6b7280", fontWeight: "bold", marginBottom: "2px" }}>🚐 モビリティ</div>
        <button
          onClick={() => setShowMobility((v) => !v)}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #f59e0b",
            background: showMobility ? "#f59e0b" : "white",
            color: showMobility ? "white" : "#f59e0b",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {showMobility ? "✓ " : ""} モビリティサービス
        </button>
        <button
          onClick={() => setShowMobilityAll((v) => !v)}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "2px solid #a78bfa",
            background: showMobilityAll ? "#a78bfa" : "white",
            color: showMobilityAll ? "white" : "#a78bfa",
            fontWeight: "bold",
            cursor: "pointer",
            fontSize: "13px",
            textAlign: "left",
          }}
        >
          {showMobilityAll ? "✓ " : ""} 🌐 モビリティ市内全域
        </button>
      </div>

      <MapContainer
        center={[32.7503, 129.8777]}
        zoom={13}
        preferCanvas={false}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={true}
      >
      <MapPanes />
      <LayersControl position="bottomright">
        {/* ベースマップ */}
        <BaseLayer checked name="地理院標準地図">
          <TileLayer
            url="https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png"
            attribution='<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>'
            maxZoom={18}
          />
        </BaseLayer>
        <BaseLayer name="地理院淡色地図">
          <TileLayer
            url="https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png"
            attribution='<a href="https://maps.gsi.go.jp/development/ichiran.html" target="_blank">国土地理院</a>'
            maxZoom={18}
          />
        </BaseLayer>
        <BaseLayer name="OpenStreetMap">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            maxZoom={19}
          />
        </BaseLayer>

        {/* 長崎市境界 */}
        <Overlay checked name="長崎市境界">
          {cityBoundary && (
            <GeoJSON
              data={cityBoundary}
              style={cityStyle}
              onEachFeature={onEachCityFeature}
            />
          )}
        </Overlay>

        {/* 65歳以上人口（Canvasレイヤー / ボタンで表示切替） */}

        {/* スーパーマーケット */}
        <Overlay checked name="スーパーマーケット">
          <>
            {supermarketMode === "none" ? null : supermarketMode === "osm"
              ? supermarkets.map((s) => (
                  <CircleMarker
                    key={s.id}
                    center={[s.lat, s.lon]}
                    pane="storePane"
                    radius={7}
                    pathOptions={{
                      fillColor: "#ef4444",
                      fillOpacity: 0.9,
                      stroke: false,
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -5]}>
                      {s.tags?.name ?? "スーパーマーケット"}
                    </Tooltip>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-base mb-1">
                          🛒 {s.tags?.name ?? "スーパーマーケット"}
                        </p>
                        {s.tags?.["addr:full"] && (
                          <p className="text-gray-600">{s.tags["addr:full"]}</p>
                        )}
                        {s.tags?.["addr:city"] && s.tags?.["addr:street"] && (
                          <p className="text-gray-600">
                            {s.tags["addr:city"]} {s.tags["addr:street"]}
                          </p>
                        )}
                        {s.tags?.["opening_hours"] && (
                          <p className="text-xs text-gray-500 mt-1">
                            🕐 {s.tags["opening_hours"]}
                          </p>
                        )}
                        {s.tags?.["brand"] && (
                          <p className="text-xs text-gray-500">
                            🏪 {s.tags["brand"]}
                          </p>
                        )}
                      </div>
                    </Popup>
                  </CircleMarker>
                ))
              : retailStores.map((s) => (
                  <Marker
                    key={s.id}
                    position={[s.lat, s.lng]}
                    pane="storePane"
                    icon={makeRetailIcon(s.area, s.type)}
                  >
                    <Tooltip direction="top" offset={[0, -18]} opacity={0.95}>
                      <div>
                        <div><strong>{s.name}</strong></div>
                        <div>{s.chain} / {s.type}</div>
                        <div>{s.address}</div>
                      </div>
                    </Tooltip>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-bold text-base mb-1">
                          {TYPE_ICONS[s.type] ?? "📍"} {s.name}
                        </p>
                        <p className="text-gray-600">{s.address}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          🏪 {s.chain} / {s.type}
                        </p>
                        <p className="text-xs text-gray-500">
                          📍 {s.area}
                        </p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
          </>
        </Overlay>
        {/* バス停 */}
        <Overlay checked name="バス停">
          <>
          </>
        </Overlay>
      </LayersControl>

      <MapLegend mode={townViewMode} />
      {/* 町輪郭レイヤー（MapContainer 内で useMap を使うためここに配置） */}
      {townsGeoJSON && (
        <TownLayer
          data={townsGeoJSON}
          visible={townViewMode !== "none"}
          colorMode={townViewMode === "none" ? "population" : townViewMode}
        />
      )}
      <BusStopLayer data={busStopsGeoJSON} visible={showBusStops} />
      <DeliveryLayer data={deliveryAreaGeoJSON} visible={showDelivery} />
      <DeliveryLayer data={deliveryCityWideGeoJSON} visible={showDeliveryAll} />
      <MobilityLayer data={mobilityAreaGeoJSON} visible={showMobility} />
      <MobilityLayer data={mobilityCityWideGeoJSON} visible={showMobilityAll} />
    </MapContainer>
    </div>
  );
}
