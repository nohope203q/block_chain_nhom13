import { getReadContract, getWriteContract, resolveBatchId } from "./contract.js";
import { formatTimestamp, runTransaction, shortenAddress } from "./ui.js";

export async function requestRecall(batchCode, reason) {
  const contract = await getWriteContract();
  const productId = await resolveBatchId(batchCode, contract);
  return runTransaction(
    () => contract.requestRecall(productId, reason.trim()),
    "Đã gửi yêu cầu thu hồi đến Admin"
  );
}

export async function reviewRecall(batchCode, approve, note) {
  const contract = await getWriteContract();
  const productId = await resolveBatchId(batchCode, contract);
  return runTransaction(
    () => contract.reviewRecall(productId, approve, note.trim()),
    approve ? "Đã phê duyệt thu hồi lô hàng" : "Đã từ chối yêu cầu thu hồi"
  );
}

function resetSelects(selects, message = "Chọn yêu cầu đang chờ") {
  selects.forEach((select) => {
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    select.appendChild(option);
  });
}

export async function loadPendingRecallRequests() {
  const target = document.querySelector("#pending-recall-list");
  if (!target) return;
  const selects = document.querySelectorAll("[data-recall-batch-select]");

  try {
    const contract = await getReadContract();
    const ids = await contract.getPendingRecallProductIds();
    if (!ids.length) {
      target.innerHTML = '<p class="empty-state mb-0">Không có yêu cầu thu hồi đang chờ.</p>';
      resetSelects(selects, "Không có yêu cầu đang chờ");
      return;
    }

    const items = await Promise.all(ids.map(async (id) => {
      const [product, request] = await Promise.all([
        contract.getProduct(id),
        contract.getRecallRequest(id),
      ]);
      return { product, request };
    }));

    target.innerHTML = items.map(({ product, request }) => `
      <article class="recall-request-card" data-recall-batch="${escapeHtml(product.batchCode)}" role="button" tabindex="0">
        <div><strong>${escapeHtml(product.batchCode)}</strong><span>${escapeHtml(product.name)}</span></div>
        <p>${escapeHtml(request.reason)}</p>
        <small>Yêu cầu bởi ${shortenAddress(request.requester)} · ${formatTimestamp(request.requestedAt)}</small>
      </article>
    `).join("");

    resetSelects(selects);
    selects.forEach((select) => {
      for (const { product } of items) {
        const option = document.createElement("option");
        option.value = product.batchCode;
        option.textContent = `${product.batchCode} - ${product.name}`;
        select.appendChild(option);
      }
    });

    const selectBatch = (batchCode) => {
      selects.forEach((select) => { select.value = batchCode; });
      document.querySelector("#approve-recall-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    target.querySelectorAll("[data-recall-batch]").forEach((card) => {
      card.addEventListener("click", () => selectBatch(card.dataset.recallBatch));
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") selectBatch(card.dataset.recallBatch);
      });
    });
  } catch (error) {
    target.innerHTML = `<p class="text-danger mb-0">Không tải được yêu cầu thu hồi: ${escapeHtml(error?.shortMessage || error?.message || "Lỗi không xác định")}</p>`;
    resetSelects(selects, "Không tải được danh sách");
  }
}

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}
