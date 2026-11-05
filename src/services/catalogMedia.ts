import { MEN_PRODUCTS, WOMEN_PRODUCTS } from "../constants";
const originals = new Map(
  [...MEN_PRODUCTS, ...WOMEN_PRODUCTS].map((p) => [p.id, p.image]),
);
const cached = new Set(["w1", "w3", "w4", "w5", "w6"]);
export function catalogImage(product: { id: string; image: string }) {
  return cached.has(product.id) && originals.get(product.id) === product.image
    ? `/catalog/${product.id}.jpg`
    : product.image;
}
export function missingCatalogImage(event: {
  currentTarget: HTMLImageElement;
}) {
  if (!event.currentTarget.src.endsWith("/catalog/unavailable.svg"))
    event.currentTarget.src = "/catalog/unavailable.svg";
}
