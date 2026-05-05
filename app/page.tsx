import MapWrapper from "../components/MapWrapper";

export default function Home() {
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-3 flex items-center gap-4 z-10 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-800">
            🏯 長崎市 GIS データ可視化マップ
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            地区別人口統計 / スーパーマーケット分布 — ベースマップ: 国土地理院
          </p>
        </div>
        <div className="ml-auto flex gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-blue-400 border border-white shadow-sm"></span>
            人口統計
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-full bg-red-500 border border-white shadow-sm"></span>
            スーパーマーケット
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-10 h-1 bg-amber-600 rounded"></span>
            市境界
          </span>
        </div>
      </header>

      {/* 地図 */}
      <main className="flex-1 relative">
        <MapWrapper />
      </main>

      {/* フッター */}
      <footer className="bg-white border-t border-gray-200 px-6 py-2 text-xs text-gray-400 flex gap-4 flex-shrink-0">
        <span>
          地図タイル:{" "}
          <a
            href="https://maps.gsi.go.jp/development/ichiran.html"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            国土地理院
          </a>
        </span>
        <span>
          スーパーマーケット位置:{" "}
          <a
            href="https://www.openstreetmap.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600"
          >
            © OpenStreetMap contributors
          </a>
        </span>
        <span>人口データ: 参考値（実装時に e-Stat 等で更新してください）</span>
      </footer>
    </div>
  );
}

