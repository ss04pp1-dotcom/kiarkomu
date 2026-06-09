import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/checkout",
        "/cart",
        "/order-success",
        "/order-tracking",
        "/login",
        "/register",
        "/forgot-password",
      ],
    },
    sitemap: "https://shohure.com/sitemap.xml",
  };
}
