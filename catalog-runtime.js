import { formatPrice, watchProducts, whatsappUrl } from "./firebase.js";

const catalogMount = document.getElementById("archive-cards-container");
const homeMount = document.querySelector("#curated-chapters .grid");
let activeDesigner = "all";

function designerKey(value = "") {
  const slug = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const aliases = {
    "rick-owens": "owens",
    "maison-margiela-artisanal": "margiela",
    "maison-margiela": "margiela",
    "comme-des-garcons": "cdg",
    "comme-des-garcons-homme-plus": "cdg",
    "helmut-lang": "lang",
    "raf-simons": "raf",
    "the-row": "row",
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

export function renderProducts(products) {
  syncDesignerFilters(products);

  if (catalogMount) {
    catalogMount.querySelectorAll(".firestore-product-card").forEach((card) => card.remove());
    products.forEach((product) => {
      const card = makeProductCard(product);
      card.style.display = activeDesigner === "all" || card.dataset.designer === activeDesigner ? "flex" : "none";
      catalogMount.append(card);
    });
  }

  if (homeMount) {
    homeMount.querySelectorAll(".firestore-product-card").forEach((card) => card.remove());
    products.slice(0, 6).forEach((product) => homeMount.append(makeProductCard(product, true)));
  }
}

function syncDesignerFilters(products) {
  const filterBar = document.getElementById("designer-filter-bar");
  if (!filterBar) return;

  filterBar.querySelectorAll(".firestore-designer-filter").forEach((button) => button.remove());
  const knownDesigners = new Set(
    [...filterBar.querySelectorAll(".designer-btn")].map((button) => button.dataset.designer)
  );
  const designers = new Map();
  products.forEach((product) => {
    const key = designerKey(product.designer);
    if (!knownDesigners.has(key)) designers.set(key, product.designer);
  });

  designers.forEach((label, key) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "designer-btn firestore-designer-filter bg-surface-container text-on-surface font-label-md text-label-md uppercase tracking-[0.14em] px-space-md py-2 whitespace-nowrap transition-colors hover:bg-surface-container-highest";
    button.dataset.designer = key;
    button.textContent = label;
    filterBar.append(button);
  });

  filterBar.querySelectorAll(".designer-btn").forEach((button) => {
    button.onclick = () => {
      activeDesigner = button.dataset.designer || "all";
      filterBar.querySelectorAll(".designer-btn").forEach((filter) => {
        filter.classList.remove("bg-primary", "text-on-primary");
        filter.classList.add("bg-surface-container", "text-on-surface");
      });
      button.classList.add("bg-primary", "text-on-primary");
      button.classList.remove("bg-surface-container", "text-on-surface");
      document.querySelectorAll(".garment-card").forEach((card) => {
        card.style.display = activeDesigner === "all" || card.dataset.designer === activeDesigner ? "flex" : "none";
      });
    };
  });
}

if (catalogMount || homeMount) {
  watchProducts(renderProducts, (error) => {
    console.error("Could not load live catalog listings:", error);
    const notice = document.createElement("p");
    notice.className = "font-body-sm text-body-sm text-error";
    notice.textContent = "Live catalog updates are temporarily unavailable. Showing the archive listings.";
    (catalogMount || homeMount)?.before(notice);
  });
}
