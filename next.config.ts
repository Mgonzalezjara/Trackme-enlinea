import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    ignoreDuringBuilds: true, // ✅ Ignora ESLint en Vercel
};

export default nextConfig;
