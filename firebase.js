import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  addDoc,
  collection,
  doc,
  getFirestore,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD3wi5P4EgdOatYWlZI4O8bTZ5kkwDPhGo",
  authDomain: "openx-35ddc.firebaseapp.com",
  projectId: "openx-35ddc",
  storageBucket: "openx-35ddc.firebasestorage.app",
  messagingSenderId: "777990588206",
  appId: "1:777990588206:web:0a8c372197274dc61fdcbf",
  measurementId: "G-84KM422DL4"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const productsCollection = collection(db, "products");
export { addDoc, doc, onAuthStateChanged, onSnapshot, serverTimestamp, signInWithEmailAndPassword, signOut };

export function watchProducts(onProducts, onError) {
  return onSnapshot(
    productsCollection,
    (snapshot) => {
      const products = snapshot.docs.map((productDoc) => ({
        id: productDoc.id,
        ...productDoc.data()
      }));

      products.sort((left, right) => {
        const leftTime = left.createdAt?.toMillis?.() ?? 0;
        const rightTime = right.createdAt?.toMillis?.() ?? 0;
        return rightTime - leftTime;
      });

      onProducts(products);
    },
    onError
  );
}

export function formatPrice(price, currency = "USD") {
  const amount = Number(price);
  if (!Number.isFinite(amount)) return "Price on request";

  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency
    }).format(amount);
  } catch (error) {
    console.error("Could not format the product price:", error);
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function whatsappUrl(product) {
  const message = `Hello The Queens, I am interested in acquiring ${product.name} by ${product.designer} (${formatPrice(product.price, product.currency)}).`;
  return `https://wa.me/2348160031775?text=${encodeURIComponent(message)}`;
}
