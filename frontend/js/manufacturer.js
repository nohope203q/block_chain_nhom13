import { getWriteContract, resolveBatchId } from "./contract.js";
import { runTransaction } from "./ui.js";

export async function createProcessedProduct(sourceBatchCode, outputBatchCode, name, description, materialQuantity, quantity, unit, expiryDate, note) {
  const expiryTimestamp = Math.floor(new Date(`${expiryDate}T00:00:00`).getTime() / 1000);
  if (!Number.isFinite(expiryTimestamp)) throw new Error("Hạn sử dụng không hợp lệ");
  const contract = await getWriteContract();
  const sourceProductId = await resolveBatchId(sourceBatchCode, contract);
  return runTransaction(
    () => contract.createProcessedProduct(sourceProductId, {
      batchCode: outputBatchCode.trim().toUpperCase(),
      name: name.trim(),
      description: description.trim(),
      materialQuantity: BigInt(materialQuantity),
      outputQuantity: BigInt(quantity),
      unit: unit.trim(),
      expiryDate: expiryTimestamp,
      note: note.trim(),
    }),
    "Đã tạo lô thành phẩm từ nguyên liệu"
  );
}
