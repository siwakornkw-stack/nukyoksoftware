import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploaded evidence images can be large; allow generous server action / body limits.
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  // sharp is a native dep used server-side for image compression (fuel bills).
  serverExternalPackages: ["sharp", "@prisma/client", "bcryptjs"],
};

export default nextConfig;
