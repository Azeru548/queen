import { doc, formatPrice, onSnapshot, db, whatsappUrl } from "./firebase.js";

const productId = new URLSearchParams(window.location.search).get("id");
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
}

function showNotice(message) {
  let notice = document.getElementById("live-product-notice");
  if (!notice) {
    notice = document.createElement("p");
    notice.id = "live-product-notice";
    notice.className = "font-body-sm text-body-sm text-error mt-space-sm";
    document.querySelector("main")?.prepend(notice);
  }
  notice.textContent = message;
}

function showMissingListing() {
  const title = document.querySelector("main h1");
  if (title) title.textContent = "Listing not found";
  const image = document.getElementById("main-garment-image");
  if (image) image.hidden = true;
  showNotice("This listing is no longer available. Please return to the archive.");
}

export function renderProduct(product) {
  const main = document.querySelector("main");
  const title = main?.querySelector("h1");
  const image = document.getElementById("main-garment-image");
  const designer = main?.querySelector("a.font-label-sm.uppercase");
  const subtitle = title?.nextElementSibling;
  const price = main?.querySelector("span.font-display-md");

  if (title) title.textContent = product.name || "Untitled listing";
  if (product.name) document.title = `${product.name} | The Queens Archive`;
  if (image && product.imageUrl) {
    image.src = product.imageUrl;
    image.alt = `${product.designer || "Archive"}: ${product.name || "Product image"}`;
  }
  if (designer) designer.textContent = product.designer || "The Queens Archive";
  if (subtitle) subtitle.textContent = [product.era, product.condition].filter(Boolean).join(" · ");
  if (price) price.textContent = formatPrice(product.price, product.currency);
  const comparisonPrice = main?.querySelector("span.line-through");
  if (comparisonPrice) {
    const hasComparisonPrice = Number(product.compareAtPrice) > Number(product.price);
    comparisonPrice.hidden = !hasComparisonPrice;
    if (hasComparisonPrice) {
      comparisonPrice.textContent = formatPrice(product.compareAtPrice, product.currency);
    }
  }

  const inquiry = main?.querySelector('a[href*="wa.me"]');
  if (inquiry) {
    inquiry.href = whatsappUrl(product);
    inquiry.target = "_blank";
    inquiry.rel = "noopener noreferrer";
  }

  main?.querySelectorAll(".thumb-btn").forEach((button) => {
    button.hidden = true;
  });

  const staticVerification = [...(main?.querySelectorAll("span") || [])]
    .find((element) => element.textContent.includes("Physical Verification Passed"));
  if (staticVerification) staticVerification.closest("div.absolute")?.remove();

  const registryStatus = [...(main?.querySelectorAll("span") || [])]
    .find((element) => element.textContent.includes("Registry Status:"));
  if (registryStatus) registryStatus.textContent = "Live Archive Listing";
  const saleBadge = [...(main?.querySelectorAll("span") || [])]
    .find((element) => element.textContent.trim() === "Sale Acquisition");
  if (saleBadge) saleBadge.textContent = "Archive Listing";

  const staticSections = main?.querySelectorAll("section") || [];
  staticSections[2]?.setAttribute("hidden", "");
  staticSections[3]?.setAttribute("hidden", "");

  const detailPanel = document.createElement("div");
  detailPanel.className = "dynamic-product-summary mt-space-md p-space-md bg-surface-container-low border border-outline-variant/30";
  detailPanel.append(createDetail("Description", product.description));
  detailPanel.append(createDetail("Collection / era", product.era));
  detailPanel.append(createDetail("Condition", product.condition));
  detailPanel.append(createDetail("Category", product.category));
  detailPanel.append(createDetail("Lot reference", product.lotNumber));
  const existingPanel = main?.querySelector(".dynamic-product-summary");
  if (existingPanel) existingPanel.replaceWith(detailPanel);
  else title?.parentElement?.append(detailPanel);

  const notice = document.getElementById("live-product-notice");
  notice?.remove();
}

function createDetail(label, value) {
  const row = document.createElement("div");
  row.className = "flex items-baseline justify-between gap-space-md py-2 border-b border-outline-variant/30 last:border-b-0";
  const heading = document.createElement("span");
  heading.className = "font-label-sm text-label-sm uppercase tracking-wider text-on-surface-variant";
  heading.textContent = label;
  const content = document.createElement("span");
  content.className = "font-body-sm text-body-sm text-on-surface text-right";
  content.textContent = value || "Not specified";
  row.append(heading, content);
  return row;
}
