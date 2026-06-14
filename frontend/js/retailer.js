import { getWriteContract, resolveBatchId } from "./contract.js";
import { runTransaction } from "./ui.js";

export async function receiveProduct(batchCode, note) {
  const contract = await getWriteContract();
  const productId = await resolveBatchId(batchCode, contract);
  return runTransaction(
    () => contract.receiveProduct(productId, note.trim()),
    "Đã xác nhận nhận hàng"
  );
}

export async function setForSale(batchCode, price, note) {
  const contract = await getWriteContract();
  const productId = await resolveBatchId(batchCode, contract);
  const priceVnd = BigInt(price);
  return runTransaction(
    () => contract.setForSale(productId, priceVnd, note.trim()),
    "Đã niêm yết sản phẩm"
  );
}
