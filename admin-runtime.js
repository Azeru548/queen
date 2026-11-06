import {
  addDoc,
  auth,
  deleteDoc,
  deleteField,
  doc,
  formatPrice,
  onAuthStateChanged,
  productsCollection,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut,
  updateDoc,
  watchProducts
} from "./firebase.js";
import { cloudinaryCloudName, cloudinaryUploadPreset } from "./cloudinary-config.js";

const signInPanel = document.getElementById("sign-in-panel");
const signInForm = document.getElementById("sign-in-form");
const signInStatus = document.getElementById("sign-in-status");
const signInButton = document.getElementById("sign-in-submit");
const adminPanel = document.getElementById("admin-panel");
const adminEmail = document.getElementById("admin-email");
const adminUid = document.getElementById("admin-uid");
const signOutButton = document.getElementById("sign-out");

const listingsList = document.getElementById("listings-list");
const listingsEmpty = document.getElementById("listings-empty");
const listingsCount = document.getElementById("listings-count");
const listingsStatus = document.getElementById("listings-status");

const form = document.getElementById("product-form");
const formTitle = document.getElementById("form-title");
const formModeNote = document.getElementById("form-mode-note");
const formStatus = document.getElementById("form-status");
const submitButton = document.getElementById("submit-listing");
const cancelEditButton = document.getElementById("cancel-edit");
const imageInput = document.getElementById("product-image");
const imageLabel = document.getElementById("product-image-label");
const imageHint = document.getElementById("product-image-hint");
const imagePreview = document.getElementById("image-preview");
const currentImageWrap = document.getElementById("current-image-wrap");
const currentImage = document.getElementById("current-image");

const maximumImageSize = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
let previewUrl;
let listings = [];
let editingId = null;

/* The Firestore rules only permit writes from a signed-in admin, so the
   dashboard stays out of reach until a session exists. */
onAuthStateChanged(auth, (user) => {
  if (!signInPanel || !adminPanel) return;
  signInPanel.hidden = Boolean(user);
  adminPanel.hidden = !user;
  if (user) {
    if (adminEmail) adminEmail.textContent = user.email || "signed-in account";
    if (adminUid) adminUid.textContent = user.uid;
  } else {
    resetForm();
    listings = [];
  }
});

signInForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("sign-in-email").value.trim();
  const password = document.getElementById("sign-in-password").value;
  setSignInButtonBusy(true);
  setSignInStatus("Signing in…");
  try {
    await signInWithEmailAndPassword(auth, email, password);
    setSignInStatus("");
    signInForm.reset();
  } catch (error) {
    console.error("Could not sign in:", error);
    setSignInStatus(signInMessage(error), true);
  } finally {
    setSignInButtonBusy(false);
  }
});

signOutButton?.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Could not sign out:", error);
  }
});

function signInMessage(error) {
  switch (error?.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "That email and password combination was not accepted.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is switched off. Enable it in Firebase Console → Authentication → Sign-in method.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment, then try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised for sign-in. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
    default:
      return error?.message || "Sign-in failed.";
  }
}

function setSignInStatus(message, isError = false) {
  if (!signInStatus) return;
  signInStatus.textContent = message;
  signInStatus.classList.toggle("text-error", isError);
  signInStatus.classList.toggle("text-secondary", !isError);
}

function setSignInButtonBusy(busy) {
  if (!signInButton) return;
  signInButton.disabled = busy;
  signInButton.textContent = busy ? "Signing in…" : "Sign in";
}

/* ---------- Live listing manager ---------- */

watchProducts(
  (products) => {
    listings = products;
    renderListings();
    if (editingId && !products.some((product) => product.id === editingId)) {
      resetForm();
      setStatus("That listing no longer exists, so the editor was cleared.", true);
    }
  },
  (error) => {
    console.error("Could not load listings for the dashboard:", error);
    if (listingsEmpty) {
      listingsEmpty.hidden = false;
      listingsEmpty.textContent = "The archive could not be loaded right now.";
    }
  }
);

function renderListings() {
  if (!listingsList) return;

  listingsList.querySelectorAll(".listing-row").forEach((row) => row.remove());

  if (listingsCount) {
    listingsCount.textContent = `${listings.length} listing${listings.length === 1 ? "" : "s"}`;
  }
  if (listingsEmpty) {
    listingsEmpty.hidden = listings.length > 0;
    if (listings.length === 0) listingsEmpty.textContent = "No listings are published in the archive yet. Add one below.";
  }

  listings.forEach((product) => listingsList.append(makeListingRow(product)));
}

function makeListingRow(product) {
  const row = document.createElement("div");
  row.className = "listing-row flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap";
  if (product.id === editingId) row.classList.add("bg-[#fff8f4]");

  const image = document.createElement("img");
  image.className = "listing-media h-20 w-16 shrink-0 border border-[#cdc5bc]";
  image.src = product.imageUrl;
  image.alt = `${product.designer}: ${product.name}`;
  image.loading = "lazy";

  const details = document.createElement("div");
  details.className = "min-w-0 flex-1";
  details.append(makeText("p", "truncate font-medium", product.name));
  details.append(makeText("p", "text-xs uppercase tracking-[.14em] text-[#755a1f]", product.designer));
  const meta = [product.category, product.era, product.lotNumber ? `Lot ${product.lotNumber}` : ""]
    .filter(Boolean)
    .join(" · ");
  if (meta) details.append(makeText("p", "mt-1 text-xs text-[#4b463f]", meta));

  const price = makeText("p", "shrink-0 text-sm font-semibold", formatPrice(product.price, product.currency));

  const actions = document.createElement("div");
  actions.className = "flex shrink-0 gap-2";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "border border-[#cdc5bc] px-4 py-2 text-xs uppercase tracking-widest hover:border-[#755a1f] hover:text-[#755a1f]";
  editButton.textContent = "Edit";
  editButton.addEventListener("click", () => startEditing(product));

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "border border-[#ba1a1a] px-4 py-2 text-xs uppercase tracking-widest text-[#ba1a1a] hover:bg-[#ba1a1a] hover:text-white disabled:opacity-60";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", () => deleteListing(product, deleteButton));

  actions.append(editButton, deleteButton);
  row.append(image, details, price, actions);
  return row;
}

function makeText(tagName, className, text) {
  const element = document.createElement(tagName);
  element.className = className;
  element.textContent = text;
  return element;
}

async function deleteListing(product, button) {
  const confirmed = window.confirm(
    `Delete “${product.name}” by ${product.designer}? It will disappear from the catalog immediately and cannot be restored.`
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Deleting…";
  setListingsStatus("");
  try {
    await deleteDoc(doc(productsCollection, product.id));
    setListingsStatus(`Deleted “${product.name}”.`);
    if (editingId === product.id) resetForm();
  } catch (error) {
    console.error("Could not delete the listing:", error);
    button.disabled = false;
    button.textContent = "Delete";
    if (error?.code === "permission-denied") {
      setListingsStatus(permissionMessage(), true);
      return;
    }
    setListingsStatus(error.message || "The listing could not be deleted.", true);
  }
}

/* ---------- Add / edit form ---------- */

function startEditing(product) {
  editingId = product.id;

  form.elements.name.value = product.name || "";
  form.elements.designer.value = product.designer || "";
  form.elements.price.value = product.price ?? "";
  form.elements.currency.value = product.currency || "USD";
  form.elements.compareAtPrice.value = product.compareAtPrice ?? "";
  form.elements.category.value = product.category || "";
  form.elements.era.value = product.era || "";
  form.elements.condition.value = product.condition || "";
  form.elements.lotNumber.value = product.lotNumber || "";
  form.elements.description.value = product.description || "";

  clearImagePreview();
  imageInput.value = "";
  imageInput.required = false;
  if (imageLabel) imageLabel.textContent = "Replace image (optional)";
  if (imageHint) imageHint.textContent = "Leave empty to keep the current image. JPG, PNG, WebP, or AVIF; maximum 10 MB.";

  if (currentImage && currentImageWrap) {
    currentImage.src = product.imageUrl;
    currentImage.alt = `Current image for ${product.name}`;
    currentImageWrap.hidden = false;
  }

  if (formTitle) formTitle.textContent = `Edit “${product.name}”`;
  if (formModeNote) formModeNote.hidden = false;
  if (cancelEditButton) cancelEditButton.hidden = false;
  if (submitButton) submitButton.textContent = "Save changes";

  setStatus("");
  setListingsStatus("");
  renderListings();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.name.focus({ preventScroll: true });
}

function resetForm() {
  editingId = null;
  form?.reset();
  clearImagePreview();
  if (imageInput) {
    imageInput.required = true;
    imageInput.value = "";
  }
  if (imageLabel) imageLabel.textContent = "Product image *";
  if (imageHint) imageHint.textContent = "JPG, PNG, WebP, or AVIF; maximum 10 MB.";
  if (currentImageWrap) currentImageWrap.hidden = true;
  if (currentImage) currentImage.removeAttribute("src");
  if (formTitle) formTitle.textContent = "Add a new listing";
  if (formModeNote) formModeNote.hidden = true;
  if (cancelEditButton) cancelEditButton.hidden = true;
  if (submitButton) submitButton.textContent = "Publish listing";
  setStatus("");
  renderListings();
}

function clearImagePreview() {
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  if (!imagePreview) return;
  imagePreview.hidden = true;
  imagePreview.removeAttribute("src");
}

cancelEditButton?.addEventListener("click", () => resetForm());

imageInput?.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  clearImagePreview();
  if (!file || !imagePreview) return;
  previewUrl = URL.createObjectURL(file);
  imagePreview.src = previewUrl;
  imagePreview.hidden = false;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  if (!auth.currentUser) {
    setStatus("Sign in before managing listings.", true);
    return;
  }

  if (needsCloudinaryConfig()) {
    setStatus("Add your Cloudinary cloud name and unsigned upload preset in cloudinary-config.js before uploading.", true);
    return;
  }

  const fields = new FormData(form);
  const image = imageInput?.files?.[0];
  if (image && (!allowedImageTypes.has(image.type) || image.size > maximumImageSize)) {
    setStatus("Choose a JPG, PNG, WebP, or AVIF image smaller than 10 MB.", true);
    return;
  }
  if (!image && !editingId) {
    setStatus("Choose a product image to continue.", true);
    return;
  }

  const price = Number(fields.get("price"));
  const compareAtPrice = fields.get("compareAtPrice") ? Number(fields.get("compareAtPrice")) : null;
  if (!Number.isFinite(price) || price <= 0 ||
      (compareAtPrice !== null && (!Number.isFinite(compareAtPrice) || compareAtPrice < price))) {
    setStatus("Enter a valid price. The comparison price must be greater than or equal to it.", true);
    return;
  }

  const name = String(fields.get("name")).trim();
  const designer = String(fields.get("designer")).trim();
  const description = String(fields.get("description")).trim();
  if (!name || !designer || !description) {
    setStatus("Product name, designer, and description cannot be blank.", true);
    return;
  }

  const target = editingId;
  const existing = listings.find((product) => product.id === target);
  setBusy(true);
  try {
    let imageUrl = existing?.imageUrl;
    let imagePublicId = existing?.imagePublicId;

    if (image) {
      setStatus("Uploading image to Cloudinary…");
      const uploadedImage = await uploadImage(image);
      imageUrl = uploadedImage.secure_url;
      imagePublicId = uploadedImage.public_id;
    }

    if (!imageUrl || !imagePublicId) {
      throw new Error("This listing has no image on record. Choose a product image to continue.");
    }

    setStatus(target ? "Saving changes to the live archive…" : "Saving listing to the live archive…");
    const listing = {
      name,
      designer,
      price,
      currency: String(fields.get("currency")),
      description,
      imageUrl,
      imagePublicId,
      category: String(fields.get("category") || "").trim(),
      era: String(fields.get("era") || "").trim(),
      condition: String(fields.get("condition") || "").trim(),
      lotNumber: String(fields.get("lotNumber") || "").trim()
    };

    if (target) {
      listing.compareAtPrice = compareAtPrice !== null ? compareAtPrice : deleteField();
      await updateDoc(doc(productsCollection, target), listing);
      resetForm();
      setListingsStatus(`Saved changes to “${name}”.`);
    } else {
      if (compareAtPrice !== null) listing.compareAtPrice = compareAtPrice;
      listing.createdAt = serverTimestamp();
      const saved = await addDoc(productsCollection, listing);
      resetForm();
      setListingsStatus(`Published “${name}”. View it at description.html?id=${encodeURIComponent(saved.id)}.`);
    }
  } catch (error) {
    console.error("Could not save the listing:", error);
    if (error?.code === "permission-denied") {
      setStatus(permissionMessage(), true);
      return;
    }
    const furthest = target ? "The changes were not saved." : "The listing was not published.";
    setStatus(error.message ? `${furthest} ${error.message}` : `${furthest} Check Cloudinary and Firestore configuration, then try again.`, true);
  } finally {
    setBusy(false);
  }
});

function needsCloudinaryConfig() {
  return !cloudinaryCloudName || cloudinaryCloudName.startsWith("YOUR_") ||
    !cloudinaryUploadPreset || cloudinaryUploadPreset.startsWith("YOUR_");
}

async function uploadImage(file) {
  const endpoint = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudinaryCloudName)}/image/upload`;
  const payload = new FormData();
  payload.append("file", file);
  payload.append("upload_preset", cloudinaryUploadPreset);
  payload.append("folder", "the-queens/products");

  const response = await fetch(endpoint, { method: "POST", body: payload });
  const result = await response.json();
  if (!response.ok || !result.secure_url || !result.public_id) {
    throw new Error(result.error?.message || `Cloudinary upload failed (${response.status}).`);
  }
  return result;
}

function permissionMessage() {
  const uid = auth.currentUser?.uid;
  return uid
    ? `Firestore refused the write. Add UID ${uid} to the admin list in firestore.rules, then publish the rules.`
    : "Firestore refused the write because no one is signed in.";
}

function setStatus(message, isError = false) {
  if (!formStatus) return;
  formStatus.textContent = message;
  formStatus.classList.toggle("text-error", isError);
  formStatus.classList.toggle("text-secondary", !isError);
}

function setListingsStatus(message, isError = false) {
  if (!listingsStatus) return;
  listingsStatus.textContent = message;
  listingsStatus.classList.toggle("text-error", isError);
  listingsStatus.classList.toggle("text-secondary", !isError);
}

function setBusy(busy) {
  if (!submitButton) return;
  submitButton.disabled = busy;
  if (busy) submitButton.textContent = editingId ? "Saving…" : "Publishing…";
  else submitButton.textContent = editingId ? "Save changes" : "Publish listing";
  submitButton.classList.toggle("opacity-60", busy);
  submitButton.classList.toggle("cursor-not-allowed", busy);
}
