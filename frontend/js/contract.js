import { CONTRACT_ABI } from "./abi.js";
import { getDeploymentConfig, RPC_URL } from "./config.js";
import { getSigner } from "./wallet.js";

export async function getReadContract() {
  const { address } = await getDeploymentConfig();
  if (!address) throw new Error("Chưa cấu hình địa chỉ hợp đồng. Hãy chạy script deploy.");
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  return new ethers.Contract(address, CONTRACT_ABI, provider);
}

export async function getWriteContract() {
  const { address } = await getDeploymentConfig();
  if (!address) throw new Error("Chưa cấu hình địa chỉ hợp đồng. Hãy chạy script deploy.");
  return new ethers.Contract(address, CONTRACT_ABI, getSigner());
}

export async function resolveBatchId(batchCode, contractInstance) {
  const batch = String(batchCode || "").trim().toUpperCase();
  if (!batch) throw new Error("Vui lòng nhập mã lô hàng");
  const contract = contractInstance || await getReadContract();
  try {
    return await contract.getProductIdByBatchCode(batch);
  } catch (error) {
    if (String(error?.shortMessage || error?.message || "").includes("Batch does not exist")) {
      throw new Error(`Không tìm thấy lô "${batch}". Các mã mẫu: XCHL-2026-0612, ST25-HC-2606, ARA-DL-1206.`);
    }
    throw error;
  }
}
