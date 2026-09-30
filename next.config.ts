import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uploaded evidence images can be large; allow generous server action / body limits.
  experimental: {
    serverActions: { bodySizeLimit: "25mb" },
  },
  // sharp is a native dep used server-side for image compression (fuel bills).
  serverExternalPackages: ["sharp", "@prisma/client", "bcryptjs"],
  poweredByHeader: false,
  // nginx adds none of these, and its config is not editable from a session.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
