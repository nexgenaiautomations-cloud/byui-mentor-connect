import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ICAN",
    short_name: "ICAN",
    description:
      "Independent, student-run peer mentorship — find a mentor, request, match, and check in monthly.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#4A2585",
    theme_color: "#4A2585",
    categories: ["education", "productivity", "social"],
    icons: [
      { src: "/favicon-128.png", sizes: "128x128", type: "image/png", purpose: "any" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
