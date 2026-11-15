import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const siteUrl = "https://www.kuraxfoodloungeandbistro.com";

const pages = {
  "/": {
    title: "Kurax Food Lounge & Bistro | Fine Dining in Kampala",
    description: "Kurax Food Lounge & Bistro in Kampala: gourmet cuisine, cocktails, events and table reservations. Book a table today.",
  },
  "/menus": {
    title: "Menus | Kurax Food Lounge & Bistro",
    description: "Explore the food and drink menus at Kurax Food Lounge & Bistro in Kampala, featuring gourmet dishes and crafted cocktails.",
  },
  "/combos": {
    title: "Combos | Kurax Food Lounge & Bistro",
    description: "Discover meal combos from Kurax Food Lounge & Bistro in Kampala and find a delicious option for your next visit.",
  },
  "/events": {
    title: "Events | Kurax Food Lounge & Bistro",
    description: "See upcoming events at Kurax Food Lounge & Bistro in Kampala, from live entertainment to special dining experiences.",
  },
  "/reservations": {
    title: "Reservations | Kurax Food Lounge & Bistro",
    description: "Reserve a table at Kurax Food Lounge & Bistro in Kampala and plan your next dining experience with us.",
  },
};

function setMeta(selector, attribute, value, content) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, value);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function SEO() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname === "/" ? "/" : pathname.replace(/\/+$/, "");
    const page = pages[path];
    let robots = document.head.querySelector('meta[name="robots"]');

    if (!page) {
      if (!robots) {
        robots = document.createElement("meta");
        robots.name = "robots";
        document.head.appendChild(robots);
      }
      robots.content = "noindex, nofollow";
      document.head.querySelector('link[rel="canonical"]')?.removeAttribute("href");
      return;
    }

    document.title = page.title;
    setMeta('meta[name="description"]', "name", "description", page.description);
    setMeta('meta[property="og:title"]', "property", "og:title", page.title);
    setMeta('meta[property="og:description"]', "property", "og:description", page.description);

    if (robots) robots.remove();

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = `${siteUrl}${path}`;
  }, [pathname]);

  return null;
}
