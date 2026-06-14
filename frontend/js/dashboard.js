import { getReadContract } from "./contract.js";
import { getCurrentAccount } from "./wallet.js";
import { formatRole } from "./product.js";

let dashboardRequestId = 0;

function getAccessGate() {
  let gate = document.querySelector("#role-access-gate");
  if (gate) return gate;
  gate = document.createElement("section");
  gate.id = "role-access-gate";
  gate.className = "role-access-gate section-space";
  gate.innerHTML = `
    <div class="container">
      <div class="role-access-card">
        <span class="role-access-icon">FT</span>
        <div><h2 data-access-title>Yêu cầu kết nối ví</h2><p data-access-message></p></div>
      </div>
    </div>`;
  document.querySelector("main")?.before(gate);
  return gate;
}

function setAccessState(authorized, title, message) {
  document.body.classList.toggle("role-authorized", authorized);
  const gate = getAccessGate();
  gate.classList.toggle("d-none", authorized);
  gate.querySelector("[data-access-title]").textContent = title;
  gate.querySelector("[data-access-message]").textContent = message;
}

export async function loadDashboard() {
  const requestId = ++dashboardRequestId;
  const totalEl = document.querySelector("[data-total-products]");
  if (!totalEl) return true;

  const account = getCurrentAccount();
  const requiredRole = document.body.dataset.requiredRole;
  const requiredRoleName = document.body.dataset.requiredRoleName || "vai trò yêu cầu";
  const roleElements = document.querySelectorAll("[data-current-role]");
  const walletStatusEl = document.querySelector("[data-wallet-status]");

  if (!account) {
    roleElements.forEach((element) => { element.textContent = "Chưa kết nối"; });
    if (walletStatusEl) walletStatusEl.textContent = "Chưa kết nối";
    setAccessState(false, "Hãy kết nối ví", `Trang này chỉ dành cho ${requiredRoleName}. Hãy kết nối ví phù hợp để xem dữ liệu và sử dụng chức năng.`);
    return false;
  }

  try {
    const contract = await getReadContract();
    const participant = await contract.getParticipant(account);
    if (requestId !== dashboardRequestId || getCurrentAccount().toLowerCase() !== account.toLowerCase()) return null;
    const roleNumber = Number(participant.role);
    const role = participant.isActive ? formatRole(roleNumber) : "Chưa được cấp quyền";
    const authorized = participant.isActive && (
      requiredRole === undefined || roleNumber === Number(requiredRole)
    );

    roleElements.forEach((element) => { element.textContent = role; });
    if (walletStatusEl) {
      walletStatusEl.textContent = authorized ? "Đúng vai trò" : `Sai vai trò - cần ${requiredRoleName}`;
      walletStatusEl.classList.toggle("text-danger", !authorized);
      walletStatusEl.classList.toggle("text-success", authorized);
    }

    if (!authorized) {
      setAccessState(false, "Không có quyền truy cập", `Ví hiện tại có vai trò “${role}”. Trang này chỉ dành cho ${requiredRoleName}.`);
      return false;
    }

    setAccessState(true, "", "");
    const ids = await contract.getAllProductIds();
    const products = await Promise.all(ids.map((id) => contract.getProduct(id)));
    if (requestId !== dashboardRequestId || getCurrentAccount().toLowerCase() !== account.toLowerCase()) return null;
    totalEl.textContent = products.filter((item) => item.parentProductId > 0n).length;
    const saleEl = document.querySelector("[data-sale-products]");
    if (saleEl) saleEl.textContent = products.filter((item) => Number(item.state) === 5).length;
    return true;
  } catch (error) {
    if (requestId !== dashboardRequestId || getCurrentAccount().toLowerCase() !== account.toLowerCase()) return null;
    totalEl.textContent = "--";
    if (walletStatusEl) walletStatusEl.textContent = "Không đọc được vai trò";
    setAccessState(false, "Không thể xác minh quyền", "Không đọc được thông tin vai trò từ blockchain. Hãy kiểm tra Hardhat node và thử lại.");
    console.error("Không thể tải dashboard:", error);
    return false;
  }
}
