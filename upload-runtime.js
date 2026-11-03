import {
  addDoc,
  auth,
  onAuthStateChanged,
  productsCollection,
  serverTimestamp,
  signInWithEmailAndPassword,
  signOut
} from "./firebase.js";
import { cloudinaryCloudName, cloudinaryUploadPreset } from "./cloudinary-config.js";

const form = document.getElementById("product-upload-form");
const status = document.getElementById("upload-status");
const submitButton = document.getElementById("submit-listing");
const imageInput = document.getElementById("product-image");
const imagePreview = document.getElementById("image-preview");
const signInPanel = document.getElementById("sign-in-panel");
const signInForm = document.getElementById("sign-in-form");
const signInStatus = document.getElementById("sign-in-status");
const signInButton = document.getElementById("sign-in-submit");
const adminPanel = document.getElementById("admin-panel");
const adminEmail = document.getElementById("admin-email");
const adminUid = document.getElementById("admin-uid");
const signOutButton = document.getElementById("sign-out");
const maximumImageSize = 10 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
let previewUrl;

/* The Firestore rules only permit writes from a signed-in admin, so the form
   stays out of reach until a session exists. */
onAuthStateChanged(auth, (user) => {
  if (!signInPanel || !adminPanel) return;
  signInPanel.hidden = Boolean(user);
  adminPanel.hidden = !user;
  if (user) {
    if (adminEmail) adminEmail.textContent = user.email || "signed-in account";
    if (adminUid) adminUid.textContent = user.uid;
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
    setStatus("");
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

  if (!auth.currentUser) {
    setStatus("Sign in before publishing a listing.", true);
    return;
  }

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
    if (error?.code === "permission-denied") {
      const uid = auth.currentUser?.uid;
      setStatus(
        uid
          ? `Firestore refused the write. Add UID ${uid} to the admin list in firestore.rules, then publish the rules.`
          : "Firestore refused the write because no one is signed in.",
        true
      );
      return;
    }
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
