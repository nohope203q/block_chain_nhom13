import { getReadContract, resolveBatchId } from "./contract.js";
import { formatTimestamp, shortenAddress, showError } from "./ui.js";

const states = ["Đã tạo", "Đã thu hoạch", "Đã chế biến", "Đang vận chuyển", "Đã nhận hàng", "Đang bán", "Đã thu hồi"];
const roles = ["Quản trị viên", "Nông dân", "Nhà máy", "Nhà phân phối", "Nhà bán lẻ", "Người tiêu dùng"];
const vndFormatter = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" });

export const formatState = (state) => states[Number(state)] || "Không xác định";
export const formatRole = (role) => roles[Number(role)] || "Consumer";

export async function getProduct(productId) {
  return (await getReadContract()).getProduct(productId);
}

export async function getProductHistory(productId) {
  return (await getReadContract()).getProductHistory(productId);
}

export async function getShippingRecords(productId) {
  return (await getReadContract()).getShippingRecords(productId);
}

export async function searchProduct(batchCode) {
  try {
    const contract = await getReadContract();
    const productId = await resolveBatchId(batchCode, contract);
    const product = await contract.getProduct(productId);
    const [history, shippingRecords, outputIds, recallRequest] = await Promise.all([
      contract.getProductHistory(productId),
      contract.getShippingRecords(productId),
      contract.getProcessedProductIds(productId),
      contract.getRecallRequest(productId),
    ]);
    let traceHistory = history;
    if (product.parentProductId > 0n) {
      const sourceHistory = await contract.getProductHistory(product.parentProductId);
      traceHistory = [...sourceHistory, ...history];
    }
    renderProduct(product, shippingRecords, outputIds, recallRequest);
    renderTimeline(traceHistory);
    document.querySelector("#product-results")?.classList.remove("d-none");
    return product;
  } catch (error) {
    showError(error);
    return null;
  }
}

export function renderProduct(product, shippingRecords = [], outputIds = [], recallRequest = null) {
  const target = document.querySelector("#product-detail");
  if (!target) return;
  const participants = [
    ["Nông dân", product.farmer], ["Nhà máy", product.manufacturer],
    ...product.distributors.map((address, index) => [`Nhà phân phối ${index + 1}`, address]),
    ["Bán lẻ", product.retailer],
  ].filter(([, address]) => address !== ethers.ZeroAddress);

  const now = Math.floor(Date.now() / 1000);
  const isRecalled = Number(product.state) === 6;
  const isExpired = now >= Number(product.expiryDate);
  const daysRemaining = Math.ceil((Number(product.expiryDate) - now) / 86400);
  const expiryLabel = isExpired ? "Đã hết hạn" : daysRemaining <= 7 ? `Sắp hết hạn (${daysRemaining} ngày)` : formatDate(product.expiryDate);
  const recallStatus = Number(recallRequest?.status || 0);

  target.innerHTML = `
    ${isRecalled ? `<div class="trace-alert trace-alert-danger"><strong>LÔ HÀNG ĐÃ BỊ THU HỒI</strong><span>${escapeHtml(product.recallReason)}</span></div>` : ""}
    ${!isRecalled && recallStatus === 1 ? `<div class="trace-alert trace-alert-warning"><strong>ĐANG CHỜ XÉT DUYỆT THU HỒI</strong><span>${escapeHtml(recallRequest.reason)}. Người dùng nên thận trọng trong thời gian Admin xác minh.</span></div>` : ""}
    ${!isRecalled && recallStatus === 3 ? `<div class="trace-alert trace-alert-info"><strong>Yêu cầu thu hồi đã bị từ chối</strong><span>${escapeHtml(recallRequest.adminNote)}</span></div>` : ""}
    ${!isRecalled && isExpired ? `<div class="trace-alert trace-alert-danger"><strong>LÔ HÀNG ĐÃ HẾT HẠN</strong><span>Không nên lưu thông hoặc sử dụng sản phẩm này.</span></div>` : ""}
    ${!isRecalled && !isExpired && daysRemaining <= 7 ? `<div class="trace-alert trace-alert-warning"><strong>Lô hàng sắp hết hạn</strong><span>Còn khoảng ${daysRemaining} ngày sử dụng.</span></div>` : ""}
    <div class="product-heading"><div><span class="eyebrow">LÔ ${escapeHtml(product.batchCode)} · ID #${product.id}</span><h2>${escapeHtml(product.name)}</h2><p>${escapeHtml(product.description)}</p></div><span class="state-pill state-${product.state}">${formatState(product.state)}</span></div>
    <div class="product-grid">
      <div><span>Nguồn gốc</span><strong>${escapeHtml(product.origin)}</strong></div>
      <div><span>Ngày tạo</span><strong>${formatTimestamp(product.createdAt)}</strong></div>
      <div><span>Giá bán</span><strong>${product.price > 0n ? vndFormatter.format(product.price) : "Chưa niêm yết"}</strong></div>
      <div><span>Nhà phân phối</span><strong>${product.distributors.length} đơn vị</strong></div>
      <div><span>Số lượng lô</span><strong>${product.quantity} ${escapeHtml(product.unit)}</strong></div>
      <div><span>Ngày thu hoạch</span><strong>${formatDate(product.harvestDate)}</strong></div>
      <div><span>Hạn sử dụng</span><strong class="${isExpired ? "text-danger" : daysRemaining <= 7 ? "text-warning" : ""}">${expiryLabel}</strong></div>
      ${product.parentProductId > 0n ? `<div><span>Lô nguyên liệu</span><strong>ID #${product.parentProductId}</strong></div>` : ""}
      ${outputIds.length ? `<div><span>Sản phẩm chế biến đầu ra</span><strong>${outputIds.map((id) => `#${id}`).join(", ")}</strong></div>` : ""}
    </div>
    <div class="participant-list">${participants.map(([label, address]) => `<span><b>${label}</b> ${shortenAddress(address)}</span>`).join("")}</div>
    ${shippingRecords.length ? `
      <div class="mt-4"><h3>Thông tin vận chuyển đã xác thực</h3>
        <div class="participant-list">${shippingRecords.map((item, index) => `
          <span><b>Chặng ${index + 1}: ${escapeHtml(item.vehicleCode)}</b><br>
          ${Number(item.temperatureX10) / 10}°C · ${escapeHtml(item.destination)}<br>
          ${shortenAddress(item.distributor)} → ${shortenAddress(item.recipient)}</span>
        `).join("")}</div>
      </div>` : ""}`;
}

export function renderTimeline(history) {
  const target = document.querySelector("#timeline");
  if (!target) return;
  target.innerHTML = history.map((item, index) => `
    <article class="timeline-item ${index === history.length - 1 ? "current" : ""}">
      <div class="timeline-marker">${index + 1}</div>
      <div class="timeline-content"><div class="timeline-meta"><span>${formatState(item.state)}</span><time>${formatTimestamp(item.timestamp)}</time></div><h3>${escapeHtml(item.action)}</h3><p>${escapeHtml(item.note || "Không có ghi chú")}</p><small>Thực hiện bởi ${shortenAddress(item.actor)}</small></div>
    </article>`).join("");
}

function escapeHtml(value = "") {
  const node = document.createElement("div");
  node.textContent = value;
  return node.innerHTML;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("vi-VN").format(new Date(Number(timestamp) * 1000));
}
