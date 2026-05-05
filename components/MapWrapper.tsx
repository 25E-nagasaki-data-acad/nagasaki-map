"use client";

import dynamic from "next/dynamic";

const NagasakiMap = dynamic(() => import("./NagasakiMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="text-center">
        <div className="mb-3 text-4xl">🗺️</div>
        <p className="text-gray-500">地図を読み込み中...</p>
      </div>
    </div>
  ),
});

export default function MapWrapper() {
  return <NagasakiMap />;
}
