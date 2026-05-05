"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

const legendItems = [
  { color: "#084594", label: "22,001人以上" },
  { color: "#2171b5", label: "18,001〜22,000人" },
  { color: "#4292c6", label: "14,001〜18,000人" },
  { color: "#6baed6", label: "10,001〜14,000人" },
  { color: "#9ecae1", label: "7,001〜10,000人" },
  { color: "#c6dbef", label: "7,000人以下" },
];

export default function MapLegend() {
  const map = useMap();

  useEffect(() => {
    const legend = new L.Control({ position: "bottomright" });

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
          <div style="font-weight: bold; margin-bottom: 8px; font-size: 13px;">📊 地区別人口</div>
          ${legendItems
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
          ">
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
          <div style="
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid #e5e7eb;
            font-size: 10px;
            color: #9ca3af;
          ">
            ※円の大きさは人口に比例
          </div>
        </div>
      `;
      return div;
    };

    legend.addTo(map);

    return () => {
      legend.remove();
    };
  }, [map]);

  return null;
}
