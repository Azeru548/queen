import { addDoc, productsCollection, serverTimestamp } from "./firebase.js";
import { cloudinaryCloudName, cloudinaryUploadPreset } from "./cloudinary-config.js";

const form = document.getElementById("product-upload-form");
const status = document.getElementById("upload-status");
const submitButton = document.getElementById("submit-listing");
const imageInput = document.getElementById("product-image");
const imagePreview = document.getElementById("image-preview");
const maximumImageSize = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
let previewUrl;

imageInput?.addEventListener("change", () => {
  const file = imageInput.files?.[0];
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  if (!file) {
    previewUrl = undefined;
    imagePreview.hidden = true;
    imagePreview.removeAttribute("src");
    return;
  }
  previewUrl = URL.createObjectURL(file);
  imagePreview.src = previewUrl;
  imagePreview.hidden = false;
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("");

  if (!cloudinaryCloudName || cloudinaryCloudName.startsWith("YOUR_") ||
      !cloudinaryUploadPreset || cloudinaryUploadPreset.startsWith("YOUR_")) {
    setStatus("Add your Cloudinary cloud name and unsigned upload preset in cloudinary-config.js before uploading.", true);
    return;
  }

  const fields = new FormData(form);
  const image = imageInput?.files?.[0];
  if (!image) {
    setStatus("Choose a product image to continue.", true);
    return;
  }
  if (!allowedImageTypes.has(image.type) || image.size > maximumImageSize) {
    setStatus("Choose a JPG, PNG, WebP, or AVIF image smaller than 10 MB.", true);
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

  setBusy(true);
  try {
    setStatus("Uploading image to Cloudinary…");
    const uploadedImage = await uploadImage(image);

    setStatus("Saving listing to the live archive…");
    const listing = {
      name,
      designer,
      price,
      currency: String(fields.get("currency")),
      description,
      imageUrl: uploadedImage.secure_url,
      imagePublicId: uploadedImage.public_id,
      category: String(fields.get("category") || "").trim(),
      era: String(fields.get("era") || "").trim(),
      condition: String(fields.get("condition") || "").trim(),
      lotNumber: String(fields.get("lotNumber") || "").trim(),
      createdAt: serverTimestamp()
    };
    if (compareAtPrice !== null) listing.compareAtPrice = compareAtPrice;

    const saved = await addDoc(productsCollection, listing);
    form.reset();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = undefined;
    imagePreview.hidden = true;
    imagePreview.removeAttribute("src");
    setStatus(`Listing added. View it in the catalog or open description.html?id=${encodeURIComponent(saved.id)}.`);
  } catch (error) {
    console.error("Could not publish the product listing:", error);
    setStatus(error.message || "The listing could not be published. Check Cloudinary and Firestore configuration, then try again.", true);
  } finally {
    setBusy(false);
  }
});

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

function setStatus(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.classList.toggle("text-error", isError);
  status.classList.toggle("text-secondary", !isError);
}

function setBusy(busy) {
  if (!submitButton) return;
  submitButton.disabled = busy;
  submitButton.textContent = busy ? "Publishing…" : "Publish Listing";
  submitButton.classList.toggle("opacity-60", busy);
  submitButton.classList.toggle("cursor-not-allowed", busy);
}
