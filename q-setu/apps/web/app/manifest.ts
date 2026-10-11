import type { MetadataRoute } from "next";
import { serverToken } from "@/lib/brand/tokens-server";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Q-Setu",
    short_name: "Q-Setu",
    description: "Make anything in India quantum-safe, in one line.",
    start_url: "/",
    display: "standalone",
    background_color: serverToken("--bg"),
    theme_color: serverToken("--bg"),
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
