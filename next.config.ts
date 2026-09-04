import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // kuromoji の辞書は require ではなくファイルパスで読むため、トレースだけでは
  // 検出されない。Vercel の関数に確実に同梱されるよう明示する。
  outputFileTracingIncludes: {
    "/**": ["./node_modules/kuromoji/dict/**"],
  },
};

export default nextConfig;
