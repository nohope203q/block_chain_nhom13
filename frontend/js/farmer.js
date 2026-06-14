import { getWriteContract, resolveBatchId } from "./contract.js";
import { runTransaction } from "./ui.js";
import { generateProductBarcode, generateProductQr } from "./qr.js";

export async function createProduct(batchCode, name, origin, description, quantity, unit, harvestDate, expiryDate) {
  const harvestTimestamp = Math.floor(new Date(`${harvestDate}T00:00:00`).getTime() / 1000);
  const expiryTimestamp = Math.floor(new Date(`${expiryDate}T00:00:00`).getTime() / 1000);
  if (!Number.isFinite(harvestTimestamp) || !Number.isFinite(expiryTimestamp)) {
    throw new Error("Ngày thu hoạch hoặc hạn sử dụng không hợp lệ");
  }
  if (expiryTimestamp <= harvestTimestamp) throw new Error("Hạn sử dụng phải sau ngày thu hoạch");
  const contract = await getWriteContract();
  const receipt = await runTransaction(
    () => contract.createProduct(batchCode.trim().toUpperCase(), name.trim(), origin.trim(), description.trim(), BigInt(quantity), unit.trim(), harvestTimestamp, expiryTimestamp),
    "Đã tạo sản phẩm mới"
  );
  if (!receipt) return false;

  const createdEvent = receipt.logs
    .map((log) => {
      try { return contract.interface.parseLog(log); } catch { return null; }
    })
    .find((event) => event?.name === "ProductCreated");
  if (!createdEvent) throw new Error("Đã tạo lô hàng nhưng không đọc được thông tin từ giao dịch");

  const productId = createdEvent.args.productId.toString();
  const createdBatchCode = createdEvent.args.batchCode;
  await generateProductQr(createdBatchCode, true);
  await generateProductBarcode(createdBatchCode, true);
  const harvestInput = document.querySelector('#harvest-form [name="batchCode"]');
  if (harvestInput) harvestInput.value = createdBatchCode;
  const productLabel = document.querySelector("#generated-product-id");
  if (productLabel) productLabel.textContent = `${createdBatchCode} · ID #${productId}`;
  document.querySelector("#farmer-qr-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
  return receipt;
}

export async function harvestProduct(batchCode, manufacturer, note) {
  if (!ethers.isAddress(manufacturer)) throw new Error("Vui lòng chọn nhà máy tiếp nhận hợp lệ");
  const contract = await getWriteContract();
  const productId = await resolveBatchId(batchCode, contract);
  return runTransaction(
    () => contract.harvestProduct(productId, manufacturer, note.trim()),
    "Đã thu hoạch và chỉ định nhà máy tiếp nhận"
  );
}
