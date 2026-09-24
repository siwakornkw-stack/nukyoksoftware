import type { MetadataRoute } from "next";

// "Add to home screen" on phones. Served at /manifest.webmanifest (public in
// src/proxy.ts: browsers fetch it without cookies).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "เทวาวณิชกิจ",
    short_name: "เทวาวณิชกิจ",
    description: "ระบบบริหารจัดการ กองรถ น้ำมัน หนี้",
    start_url: "/",
    display: "standalone",
    background_color: "#020617",
    theme_color: "#020617",
    lang: "th",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
