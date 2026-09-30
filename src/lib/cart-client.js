const KEY = 'cart_v1';

export function getCart() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

function save(cart) {
  localStorage.setItem(KEY, JSON.stringify(cart));
  updateCartBadge();
}

export function addToCart(item, qty = 1) {
  const cart = getCart();
  const existing = cart.find((c) => String(c.product_id) === String(item.product_id));
  if (existing) existing.qty += qty;
  else cart.push({ ...item, qty });
  save(cart);
}

export function setQty(product_id, qty) {
  const cart = getCart().map((c) => (String(c.product_id) === String(product_id) ? { ...c, qty: Math.max(1, qty) } : c));
  save(cart);
}

export function removeFromCart(product_id) {
  save(getCart().filter((c) => String(c.product_id) !== String(product_id)));
}

export function clearCart() {
  save([]);
}

export function cartCount() {
  return getCart().reduce((s, c) => s + c.qty, 0);
}

export function cartSubtotal() {
  return getCart().reduce((s, c) => s + c.qty * Number(c.price), 0);
}

export function updateCartBadge() {
  const count = String(cartCount());
  document.querySelectorAll('[data-cart-count]').forEach((el) => (el.textContent = count));
}
