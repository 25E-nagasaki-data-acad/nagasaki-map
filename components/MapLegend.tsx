"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const populationLegendItems = [
  { color: "#084594", label: "1,001人以上" },
  { color: "#2171b5", label: "701〜1,000人" },
  { color: "#4292c6", label: "501〜700人" },
  { color: "#6baed6", label: "301〜500人" },
  { color: "#9ecae1", label: "101〜300人" },
  { color: "#c6dbef", label: "100人以下" },
];

const agingRateLegendItems = [
  { color: "#4a0000", label: "60%以上" },
  { color: "#7f0000", label: "55〜60%" },
  { color: "#b30000", label: "50〜55%" },
  { color: "#d7301f", label: "45〜50%" },
  { color: "#ef6548", label: "40〜45%" },
  { color: "#fc8d59", label: "35〜40%" },
  { color: "#fdbb84", label: "30〜35%" },
  { color: "#fef0d9", label: "30%未満" },
];

interface MapLegendProps {
  mode: "none" | "population" | "aging_rate";
}

export default function MapLegend({ mode }: MapLegendProps) {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: "bottomright" });

    const items = mode === "aging_rate" ? agingRateLegendItems : populationLegendItems;
    const header = mode === "aging_rate" ? "📊 高齢化率（65歳以上割合）" : "📊 65歳以上人口";

    legend.onAdd = () => {
      const div = L.DomUtil.create("div", "map-legend");
      div.innerHTML = `
        <div style="
          background: white;
          padding: 10px 14px;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          font-size: 12px;
          font-family: sans-serif;
          min-width: 160px;
        ">
          ${mode !== "none" ? `
          <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">${header}</div>
          ${items
            .map(
              (item) => `
            <div style="display: flex; align-items: center; margin-bottom: 4px;">
              <span style="
                display: inline-block;
                width: 14px;
                height: 14px;
                border-radius: 50%;
                background: ${item.color};
                margin-right: 7px;
                flex-shrink: 0;
                border: 1px solid #fff;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.15);
              "></span>
              <span style="color: #374151;">${item.label}</span>
            </div>
          `
            )
            .join("")}
          <div style="
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid #e5e7eb;
            font-size: 11px;
          ">` : `<div style="font-size: 11px;">`}
            <div style="display: flex; align-items: center; margin-bottom: 3px;">
              <span style="
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                background: #ef4444;
                margin-right: 7px;
                border: 1.5px solid #fff;
                box-shadow: 0 0 0 1px rgba(0,0,0,0.15);
              "></span>
              <span style="color: #374151;">🛒 スーパーマーケット</span>
            </div>
            <div style="display: flex; align-items: center;">
              <span style="
                display: inline-block;
                width: 12px;
                height: 5px;
                background: #d97706;
                margin-right: 7px;
                border-radius: 1px;
              "></span>
              <span style="color: #374151;">長崎市境界</span>
            </div>
          </div>
        </div>
      `;
      return div;
    };

    legend.addTo(map);

    return () => {
      legend.remove();
    };
  }, [map, mode]);

  return null;
}
