import { getReadContract, getWriteContract, resolveBatchId } from "./contract.js";
import { getCurrentAccount } from "./wallet.js";
import { runTransaction, shortenAddress } from "./ui.js";

const partnerRoles = {
  3: "Nhà phân phối",
  4: "Nhà bán lẻ",
};

export async function loadDeliveryPartners() {
  const select = document.querySelector("#recipient-partner");
  if (!select) return;

  select.innerHTML = '<option value="">Đang tải danh sách đối tác...</option>';
  try {
    const contract = await getReadContract();
    const events = await contract.queryFilter(contract.filters.ParticipantAdded());
    const accounts = [...new Set(events.map((event) => event.args.account.toLowerCase()))];
    const currentAccount = getCurrentAccount().toLowerCase();
    const participants = await Promise.all(
      accounts.map((account) => contract.getParticipant(account))
    );
    const partners = participants.filter((participant) => {
      const role = Number(participant.role);
      return participant.isActive
        && (role === 3 || role === 4)
        && participant.account.toLowerCase() !== currentAccount;
    });

    select.innerHTML = '<option value="">Chọn đối tác nhận hàng</option>';
    for (const participant of partners) {
      const option = document.createElement("option");
      option.value = participant.account;
      option.textContent = `${participant.name} - ${partnerRoles[Number(participant.role)]} (${shortenAddress(participant.account)})`;
      select.appendChild(option);
    }

    if (!partners.length) {
      select.innerHTML = '<option value="">Chưa có đối tác phù hợp đang hoạt động</option>';
    }
  } catch (error) {
    select.innerHTML = '<option value="">Không thể tải danh sách đối tác</option>';
    throw error;
  }
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
