import { doc, formatPrice, onSnapshot, db, whatsappUrl } from "./firebase.js";

const productId = new URLSearchParams(window.location.search).get("id");

const el = (id) => document.getElementById(id);
const setText = (id, value) => {
  const node = el(id);
  if (node) node.textContent = value;
};
const setHidden = (id, hidden) => {
  const node = el(id);
  if (node) node.hidden = hidden;
};

function showNotice(message) {
  let notice = el("live-product-notice");
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "live-product-notice";
    notice.className = "font-body-sm text-body-sm text-error px-margin-mobile md:px-margin pt-space-sm";
    document.querySelector("main")?.prepend(notice);
  }
  notice.textContent = message;
}

function clearNotice() {
  el("live-product-notice")?.remove();
}

function showMissingListing() {
  setText("product-title", "Listing not found");
  setText("product-designer", "The Queens Archive");
  setText("product-subtitle", "");
  setText("product-status", "Unavailable");
  setText("registry-status", "Not in the archive");
  setText("product-price", "");
  setText("product-currency", "");
  setText("breadcrumb-lot", "Not found");
  setHidden("product-compare-price", true);
  setHidden("archive-discount-badge", true);

  const image = el("main-garment-image");
  if (image) image.hidden = true;

  el("product-specs")?.replaceChildren();
  const actions = el("product-acquire");
  if (actions) actions.hidden = true;

  showNotice("This listing is no longer available. Please return to the archive.");
}

if (productId) {
  onSnapshot(
    doc(db, "products", productId),
    (snapshot) => {
      if (!snapshot.exists()) {
        showMissingListing();
        return;
      }
      renderProduct({ id: snapshot.id, ...snapshot.data() });
    },
    (error) => {
      console.error("Could not load the requested listing:", error);
      showNotice("This listing could not be loaded right now. Please try again shortly.");
    }
  );
} else {
  showMissingListing();
  setText("product-title", "No listing selected");
  showNotice("Open a piece from the archive to view its dossier.");
}

function createRow(label, value) {
  const row = document.createElement("div");
  row.className = "flex items-baseline justify-between gap-space-md py-1.5 border-b border-outline-variant/30 last:border-b-0";

  const heading = document.createElement("span");
  heading.className = "font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant";
  heading.textContent = label;

  const content = document.createElement("span");
  content.className = "font-body-sm text-body-sm text-on-surface text-right";
  content.textContent = value || "Not specified";

  row.append(heading, content);
  return row;
}

function createSpecs(product) {
  const wrap = el("product-specs");
  if (!wrap) return;
  wrap.replaceChildren();

  const rows = [
    ["Collection / era", product.era],
    ["Condition", product.condition],
    ["Category", product.category],
    ["Lot reference", product.lotNumber]
  ].filter(([, value]) => value);

  if (!rows.length) return;
  rows.forEach(([label, value]) => wrap.append(createRow(label, value)));
}

function createDescription(product) {
  const wrap = el("product-description");
  if (wrap) {
    wrap.textContent = product.description || "";
    wrap.hidden = !product.description;
  }
}

export function renderProduct(product) {
  const name = product.name || "Untitled listing";
  const designer = product.designer || "The Queens Archive";

  document.title = `${name} | The Queens Archive`;

  setText("product-title", name);
  setText("product-designer", designer);
  setText("product-subtitle", [product.era, product.condition].filter(Boolean).join(" · "));
  setText("product-status", "Archive Listing");
  setText("registry-status", "Archive Listing");
  setText("breadcrumb-designer", designer);
  setText("breadcrumb-lot", product.lotNumber ? `Lot ${product.lotNumber}` : "Listing");

  const image = el("main-garment-image");
  if (image && product.imageUrl) {
    image.src = product.imageUrl;
    image.alt = `${designer}: ${name}`;
  }
  setHidden("archival-edition-tag", !product.lotNumber);
  setText("archival-edition-tag", product.lotNumber ? `Lot ${product.lotNumber}` : "");

  setText("product-price", formatPrice(product.price, product.currency));
  setText("product-currency", product.currency || "USD");

  const hasReduction =
    Number.isFinite(Number(product.compareAtPrice)) &&
    Number(product.compareAtPrice) > Number(product.price);

  if (hasReduction) {
    setText("product-compare-price", formatPrice(product.compareAtPrice, product.currency));
    setText("archive-discount-badge", `${Math.round((1 - product.price / product.compareAtPrice) * 100)}% Archive Reduction`);
  }
  setHidden("product-compare-price", !hasReduction);
  setHidden("archive-discount-badge", !hasReduction);

  createSpecs(product);
  createDescription(product);

  const inquiry = el("product-acquire");
  if (inquiry) {
    inquiry.href = whatsappUrl(product);
    inquiry.target = "_blank";
    inquiry.rel = "noopener noreferrer";
    inquiry.hidden = false;
  }

  clearNotice();
}
