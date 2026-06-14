import { getWriteContract } from "./contract.js";
import { runTransaction } from "./ui.js";

export async function addParticipant(account, name, role) {
  const contract = await getWriteContract();
  return runTransaction(() => contract.addParticipant(account, name, Number(role)), "Đã cấp quyền cho thành viên");
}

export async function deactivateParticipant(account) {
  const contract = await getWriteContract();
  return runTransaction(() => contract.deactivateParticipant(account), "Đã vô hiệu hóa thành viên");
}
