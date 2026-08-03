import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
})({
  reactStrictMode: true,
  output: "export",
  distDir: "dist",
  trailingSlash: true,
  basePath,
  assetPrefix: basePath,
});

export default nextConfig;
