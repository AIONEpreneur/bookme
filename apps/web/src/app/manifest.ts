import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BookMe",
    short_name: "BookMe",
    description: "Schnapp dir einen Termin. Werde gebucht.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#F5F8FC",
    theme_color: "#2563EB",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
