import { formatPrice, watchProducts, whatsappUrl } from "./firebase.js";

const catalogMount = document.getElementById("archive-cards-container");
const homeMount = document.querySelector("#curated-chapters .grid");
const folioMount = document.getElementById("home-folio-grid");
const sortSelect = document.getElementById("catalog-sort");
let activeDesigner = "all";
let latestProducts = [];

function designerKey(value = "") {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const aliases = {
    "rick-owens": "owens",
    "maison-margiela-artisanal": "margiela",
    "maison-margiela": "margiela",
    "comme-des-garcons": "cdg",
    "comme-des-garcons-homme-plus": "cdg",
    "helmut-lang": "lang",
    "raf-simons": "raf",
    "the-row": "row",
    "yohji-yamamoto": "yohji",
    "yohji-yamamoto-pour-homme": "yohji"
  };
  return aliases[slug] || slug || "other";
}

function makeTag(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

function makeProductCard(product, home = false) {
  const article = document.createElement("article");
  article.className = home
    ? "firestore-product-card flex flex-col bg-surface-container-low group"
    : "firestore-product-card garment-card group flex flex-col bg-surface-container-low transition-all duration-300 hover:shadow-md";
  article.dataset.designer = designerKey(product.designer);
  article.dataset.productId = product.id;

  const imageFrame = document.createElement("div");
  imageFrame.className = home
    ? "relative aspect-[3/4] bg-surface-container overflow-hidden"
    : "relative w-full aspect-[3/4] bg-surface-container-highest overflow-hidden";
  const image = document.createElement("img");
  image.className = "w-full h-full object-cover transition-transform duration-700 group-hover:scale-105";
  image.src = product.imageUrl;
  image.alt = `${product.designer}: ${product.name}`;
  image.loading = "lazy";
  imageFrame.append(image);

  if (product.lotNumber) {
    const lot = makeTag("span", "absolute top-4 left-4 bg-primary text-on-primary px-space-xs py-0.5 font-label-sm text-[9px] uppercase tracking-widest", `Lot ${product.lotNumber}`);
    imageFrame.append(lot);
  }

  const content = document.createElement("div");
  content.className = home
    ? "p-space-md flex flex-col flex-grow"
    : "p-space-md flex flex-col flex-1 justify-between gap-space-sm bg-surface-container-low";
  content.append(makeTag("span", "font-label-sm text-label-sm uppercase tracking-[0.18em] text-secondary", product.designer));
  content.append(makeTag(home ? "h3" : "h2", "font-headline-sm text-headline-sm text-on-surface font-normal leading-tight group-hover:text-secondary transition-colors", product.name));

  if (product.description) {
    const description = makeTag("p", "font-body-sm text-body-sm text-on-surface-variant mt-1 line-clamp-2", product.description);
    content.append(description);
  }

  const priceRow = document.createElement("div");
  priceRow.className = "flex items-baseline justify-between mt-space-sm";
  priceRow.append(makeTag("span", "font-headline-sm text-headline-sm text-on-surface font-semibold", formatPrice(product.price, product.currency)));
  if (Number.isFinite(Number(product.compareAtPrice)) && Number(product.compareAtPrice) > Number(product.price)) {
    priceRow.append(makeTag("span", "font-body-sm text-body-sm text-on-surface-variant line-through", formatPrice(product.compareAtPrice, product.currency)));
  }
  content.append(priceRow);

  const actions = document.createElement("div");
  actions.className = "grid grid-cols-2 gap-2 mt-space-sm";
  const details = document.createElement("a");
  details.className = "bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-label-md uppercase tracking-wider py-2.5 transition-colors text-center";
  details.href = `description.html?id=${encodeURIComponent(product.id)}`;
  details.textContent = "Inspect Spec";
  const acquire = document.createElement("a");
  acquire.className = "bg-primary text-on-primary hover:bg-on-surface-variant font-label-md text-label-md uppercase tracking-wider py-2.5 transition-colors text-center flex items-center justify-center";
  acquire.href = whatsappUrl(product);
  acquire.target = "_blank";
  acquire.rel = "noopener noreferrer";
  acquire.textContent = "Acquire via WhatsApp";
  actions.append(details, acquire);
  content.append(actions);
  article.append(imageFrame, content);
  return article;
}

function priceOf(product) {
  const amount = Number(product.price);
  return Number.isFinite(amount) ? amount : Infinity;
}

function createdAtOf(product) {
  return product.createdAt?.toMillis?.() ?? 0;
}

function discountOf(product) {
  const compare = Number(product.compareAtPrice);
  const price = Number(product.price);
  if (Number.isFinite(compare) && Number.isFinite(price) && price > 0 && compare > price) {
    return (compare - price) / price;
  }
  return -1;
}

function eraYear(product) {
  const years = String(product.era || "").match(/\b(?:19|20)\d{2}\b/g);
  return years ? Number(years[years.length - 1]) : 0;
}

function sortProducts(products) {
  const mode = sortSelect?.value || "curatorial-rarity";
  const list = [...products];
  if (mode === "price-asc") list.sort((left, right) => priceOf(left) - priceOf(right));
  else if (mode === "price-desc") list.sort((left, right) => priceOf(right) - priceOf(left));
  else if (mode === "discount-desc") list.sort((left, right) => discountOf(right) - discountOf(left));
  else if (mode === "recent") list.sort((left, right) => createdAtOf(right) - createdAtOf(left));
  else list.sort((left, right) => eraYear(right) - eraYear(left) || createdAtOf(right) - createdAtOf(left));
  return list;
}

function updateCounters(products) {
  const setText = (id, text) => {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  };

  const lots = products.length;
  setText("salon-lot-count", `${lots} Lot${lots === 1 ? "" : "s"}`);
  setText("ledger-piece-count", `${lots} PIECES`);
  setText("ledger-editions-count", `${lots} Edition${lots === 1 ? "" : "s"}`);

  const houses = new Set(products.map((product) => designerKey(product.designer))).size;
  setText("salon-house-count", `${houses} Atelier${houses === 1 ? "" : "s"}`);
}

function updateEmptyStates(hasProducts) {
  document.querySelectorAll(".catalog-empty-state").forEach((element) => {
    if (hasProducts) element.remove();
    else element.textContent = "No lots are published in the archive yet.";
  });
}

export function renderProducts(products) {
  latestProducts = products;
  const sorted = sortProducts(products);

  if (catalogMount) {
    catalogMount.querySelectorAll(".firestore-product-card").forEach((card) => card.remove());
    sorted.forEach((product) => {
      const card = makeProductCard(product);
      card.style.display = activeDesigner === "all" || card.dataset.designer === activeDesigner ? "flex" : "none";
      catalogMount.append(card);
    });
  }

  if (homeMount) {
    homeMount.querySelectorAll(".firestore-product-card").forEach((card) => card.remove());
    sorted.slice(0, 6).forEach((product) => homeMount.append(makeProductCard(product, true)));
  }

  if (folioMount) {
    folioMount.querySelectorAll(".firestore-product-card").forEach((card) => card.remove());
    sorted.slice(0, 4).forEach((product) => folioMount.append(makeProductCard(product, true)));
  }

  syncDesignerFilters(products);
  updateCounters(products);
  updateEmptyStates(products.length > 0);
}

function syncDesignerFilters(products) {
  const filterBar = document.getElementById("designer-filter-bar");
  if (!filterBar) return;

  const counts = new Map();
  products.forEach((product) => {
    const key = designerKey(product.designer);
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  filterBar.querySelectorAll(".firestore-designer-filter").forEach((button) => button.remove());
  const knownDesigners = new Set(
    [...filterBar.querySelectorAll(".designer-btn")].map((button) => button.dataset.designer)
  );

  const dynamicDesigners = new Map();
  products.forEach((product) => {
    const key = designerKey(product.designer);
    if (!knownDesigners.has(key)) dynamicDesigners.set(key, product.designer);
  });

  dynamicDesigners.forEach((label, key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "designer-btn firestore-designer-filter bg-surface-container text-on-surface font-label-md text-label-md uppercase tracking-[0.14em] px-space-md py-2 whitespace-nowrap transition-colors hover:bg-surface-container-highest";
    button.dataset.designer = key;
    button.textContent = label;
    filterBar.append(button);
  });

  filterBar.querySelectorAll(".designer-btn").forEach((button) => {
    const key = button.dataset.designer || "all";
    const count = key === "all" ? products.length : (counts.get(key) || 0);
    const baseLabel = button.textContent.replace(/\s*\(\d+\)\s*$/, "");
    button.textContent = `${baseLabel} (${count})`;
    button.hidden = key !== "all" && products.length > 0 && count === 0;

    const isActive = key === activeDesigner;
    button.classList.toggle("bg-primary", isActive);
    button.classList.toggle("text-on-primary", isActive);
    button.classList.toggle("bg-surface-container", !isActive);
    button.classList.toggle("text-on-surface", !isActive);

    button.onclick = () => {
      activeDesigner = key;
      filterBar.querySelectorAll(".designer-btn").forEach((filter) => {
        const filterKey = filter.dataset.designer || "all";
        const active = filterKey === activeDesigner;
        filter.classList.toggle("bg-primary", active);
        filter.classList.toggle("text-on-primary", active);
        filter.classList.toggle("bg-surface-container", !active);
        filter.classList.toggle("text-on-surface", !active);
      });
      document.querySelectorAll(".garment-card").forEach((card) => {
        card.style.display = activeDesigner === "all" || card.dataset.designer === activeDesigner ? "flex" : "none";
      });
    };
  });
}

if (sortSelect) {
  sortSelect.addEventListener("change", () => renderProducts(latestProducts));
}

if (catalogMount || homeMount || folioMount) {
  watchProducts(renderProducts, (error) => {
    console.error("Could not load live catalog listings:", error);
    const notice = document.createElement("p");
    notice.className = "font-body-sm text-body-sm text-error";
    notice.textContent = "Live catalog updates are temporarily unavailable. Showing the archive listings.";
    (catalogMount || homeMount || folioMount)?.before(notice);
    document.querySelectorAll(".catalog-empty-state").forEach((element) => {
      element.textContent = "The live archive could not be loaded right now.";
    });
  });
}
