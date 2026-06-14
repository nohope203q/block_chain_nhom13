import { getReadContract, getWriteContract, resolveBatchId } from "./contract.js";
import { formatTimestamp, runTransaction, shortenAddress, showError } from "./ui.js";

export async function addFeedback(batchCode, rating, comment) {
  const contract = await getWriteContract();
  const productId = await resolveBatchId(batchCode, contract);
  return runTransaction(() => contract.addFeedback(productId, Number(rating), comment), "Cảm ơn bạn đã gửi đánh giá");
}

export async function loadFeedbacks(productId) {
  try {
    const contract = await getReadContract();
    const items = await contract.getFeedbacks(productId);
    const average = items.length
      ? items.reduce((total, item) => total + Number(item.rating), 0) / items.length
      : 0;
    renderFeedbacks(items);
    renderAverageRating(average, items.length);
  } catch (error) {
    showError(error);
  }
}

export function renderFeedbacks(items) {
  const target = document.querySelector("#feedback-list");
  if (!target) return;
  target.innerHTML = items.length ? items.map((item) => `
    <article class="feedback-card"><div class="stars">${"★".repeat(Number(item.rating))}${"☆".repeat(5 - Number(item.rating))}</div><p>${escapeHtml(item.comment || "Không có bình luận")}</p><small>${shortenAddress(item.reviewer)} · ${formatTimestamp(item.timestamp)}</small></article>
  `).join("") : '<p class="empty-state">Chưa có đánh giá cho sản phẩm này.</p>';
}

export function renderAverageRating(average, count) {
  const target = document.querySelector("#average-rating");
  if (target) target.innerHTML = `<strong>${Number(average).toFixed(1)}</strong><span>★ / 5 · ${count} đánh giá</span>`;
}

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}
