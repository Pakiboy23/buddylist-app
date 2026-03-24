import type { NextConfig } from "next";

const isNativeStaticExport = process.env.NATIVE_STATIC_EXPORT === "1";

const nextConfig: NextConfig = {
  reactCompiler: true,
  turbopack: {
    root: __dirname,
  },
  ...(isNativeStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        skipTrailingSlashRedirect: true,
        distDir: ".next-native",
      }
    : {}),
};

export default nextConfig;
