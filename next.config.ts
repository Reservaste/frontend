import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @reservaste/domain ships plain TypeScript source (no build step, see
  // ADR-0016) -- this tells Next to run it through its own compiler
  // instead of expecting pre-built JS like a normal npm package.
  transpilePackages: ["@reservaste/domain"],
};

export default nextConfig;
