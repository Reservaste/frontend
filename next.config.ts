import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-hosted on a 1GB droplet: standalone emits a minimal server with
  // only the traced dependencies, which keeps the image small enough to
  // build and restart on a box that size.
  output: "standalone",
  // @reservaste/domain ships plain TypeScript source (no build step, see
  // ADR-0016) -- this tells Next to run it through its own compiler
  // instead of expecting pre-built JS like a normal npm package.
  transpilePackages: ["@reservaste/domain"],
};

export default nextConfig;
