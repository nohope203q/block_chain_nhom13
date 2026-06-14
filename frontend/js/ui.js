export function shortenAddress(address = "") {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "Chưa kết nối";
}

export function formatTimestamp(value) {
  return new Date(Number(value) * 1000).toLocaleString("vi-VN");
}

export function showToast(message, type = "success") {
  const container = document.querySelector("#toast-container");
  if (!container) return;
  const element = document.createElement("div");
  element.className = `toast align-items-center text-bg-${type === "error" ? "danger" : type} border-0`;
  element.innerHTML = `<div class="d-flex"><div class="toast-body"></div><button class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button></div>`;
  element.querySelector(".toast-body").textContent = message;
  container.appendChild(element);
  const toast = new bootstrap.Toast(element, { delay: 3500 });
  element.addEventListener("hidden.bs.toast", () => element.remove());
  toast.show();
}

export function showLoading(message = "Đang chờ xác nhận giao dịch...") {
  const overlay = document.querySelector("#loading-overlay");
  if (!overlay) return;
  overlay.querySelector("span").textContent = message;
  overlay.classList.remove("d-none");
}

export function hideLoading() {
  document.querySelector("#loading-overlay")?.classList.add("d-none");
}

export function showError(error) {
  const message = error?.shortMessage || error?.reason || error?.info?.error?.message || error?.message || "Đã có lỗi xảy ra";
  showToast(message.replace("execution reverted: ", ""), "error");
}

export async function runTransaction(action, successMessage) {
  try {
    showLoading();
    const transaction = await action();
    const receipt = await transaction.wait();
    showToast(successMessage);
    return receipt;
  } catch (error) {
    showError(error);
    return false;
  } finally {
    hideLoading();
  }
}
