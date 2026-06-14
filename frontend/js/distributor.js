import { getReadContract, getWriteContract, resolveBatchId } from "./contract.js";
import { getCurrentAccount } from "./wallet.js";
import { runTransaction, shortenAddress } from "./ui.js";

const partnerRoles = {
  2: "Nhà máy",
  3: "Nhà phân phối",
  4: "Nhà bán lẻ",
};

const partnerSelects = [
  { selector: "#harvest-manufacturer", roles: [2], placeholder: "Chọn nhà máy tiếp nhận" },
  { selector: "#initial-distributor", roles: [3], placeholder: "Chọn nhà phân phối đầu tiên" },
  { selector: "#recipient-partner", roles: [3, 4], placeholder: "Chọn đối tác nhận hàng", excludeCurrent: true },
];

export async function loadDeliveryPartners() {
  const targets = partnerSelects
    .map((config) => ({ ...config, select: document.querySelector(config.selector) }))
    .filter(({ select }) => select);
  if (!targets.length) return;

  const requestedAccount = getCurrentAccount().toLowerCase();
  if (!requestedAccount) {
    clearDeliveryPartners();
    return;
  }
  targets.forEach(({ select }) => {
    select.innerHTML = '<option value="">Đang tải danh sách đối tác...</option>';
  });
  try {
    const contract = await getReadContract();
    const events = await contract.queryFilter(contract.filters.ParticipantAdded());
    const accounts = [...new Set(events.map((event) => event.args.account.toLowerCase()))];
    const participants = await Promise.all(
      accounts.map((account) => contract.getParticipant(account))
    );

    if (getCurrentAccount().toLowerCase() !== requestedAccount) return;

    targets.forEach(({ select, roles, placeholder, excludeCurrent }) => {
      const partners = participants.filter((participant) => participant.isActive
        && roles.includes(Number(participant.role))
        && (!excludeCurrent || participant.account.toLowerCase() !== requestedAccount));
      select.innerHTML = `<option value="">${placeholder}</option>`;
      partners.forEach((participant) => {
        const option = document.createElement("option");
        option.value = participant.account;
        option.textContent = `${participant.name} - ${partnerRoles[Number(participant.role)]} (${shortenAddress(participant.account)})`;
        select.appendChild(option);
      });
      if (!partners.length) select.innerHTML = '<option value="">Chưa có đối tác phù hợp đang hoạt động</option>';
    });
  } catch (error) {
    if (getCurrentAccount().toLowerCase() !== requestedAccount) return;
    targets.forEach(({ select }) => {
      select.innerHTML = '<option value="">Không thể tải danh sách đối tác</option>';
    });
    throw error;
  }
}

export function clearDeliveryPartners(message = "Hãy kết nối đúng ví để chọn đối tác") {
  partnerSelects.forEach(({ selector }) => {
    const select = document.querySelector(selector);
    if (!select) return;
    select.innerHTML = "";
    const option = document.createElement("option");
    option.value = "";
    option.textContent = message;
    select.appendChild(option);
  });
}

export async function shipProduct(batchCode, recipient, vehicleCode, temperature, destination, note) {
  if (!ethers.isAddress(recipient)) throw new Error("Vui lòng chọn đối tác nhận hàng hợp lệ");
  const temperatureX10 = Math.round(Number(temperature) * 10);
  if (!Number.isInteger(temperatureX10) || temperatureX10 < -500 || temperatureX10 > 600) {
    throw new Error("Nhiệt độ phải nằm trong khoảng -50°C đến 60°C");
  }
  const contract = await getWriteContract();
  const productId = await resolveBatchId(batchCode, contract);
  return runTransaction(
    () => contract.shipProduct(productId, recipient, vehicleCode.trim(), temperatureX10, destination.trim(), note.trim()),
    "Đã ghi nhận và chỉ định bên nhận tiếp theo"
  );
}
