import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/nagasaki-map",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
