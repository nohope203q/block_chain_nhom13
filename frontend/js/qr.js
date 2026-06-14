import { searchProduct } from "./product.js";
import { loadFeedbacks } from "./feedback.js";
import { showError, showToast } from "./ui.js";
import { PUBLIC_APP_URL } from "./config.js";
import { getReadContract, resolveBatchId } from "./contract.js";
import { getCurrentAccount } from "./wallet.js";

let scanner;
let scanLocked = false;

function updateScannerStatus(message, type = "info") {
  const status = document.querySelector("#qr-scan-status");
  if (!status) return;
  status.textContent = message;
  status.className = `qr-scan-status status-${type}`;
}

function setScannerVisualState(state) {
  const shell = document.querySelector("#qr-scanner-shell");
  if (!shell) return;
  shell.classList.remove("is-scanning", "is-detected", "is-error");
  if (state) shell.classList.add(`is-${state}`);
}

function extractBatchCode(decodedText) {
  const rawValue = String(decodedText || "").trim();
  if (rawValue && !rawValue.includes("://")) {
    return rawValue.replace(/^FT-/i, "");
  }

  try {
    const decodedUrl = new URL(rawValue, window.location.href);
    const batchCode = decodedUrl.searchParams.get("batch");
    if (batchCode) return batchCode;
  } catch {
    // Giá trị không phải URL sẽ được báo không hợp lệ ở bên dưới.
  }

  throw new Error("Mã QR không chứa mã lô hợp lệ");
}

async function handleDecodedQr(decodedText) {
  if (scanLocked) return;
  scanLocked = true;

  try {
    const batchCode = extractBatchCode(decodedText);
    setScannerVisualState("detected");
    updateScannerStatus(`Đã nhận lô ${batchCode}. Đang tải dữ liệu...`, "success");
    if (navigator.vibrate) navigator.vibrate([90, 40, 120]);
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    await stopScanner(false);
    await loadProductFromQr(batchCode);
    showToast(`Đã quét lô ${batchCode}`);
    updateScannerStatus(`Đã tải thành công lô ${batchCode}.`, "success");
  } catch (error) {
    setScannerVisualState("error");
    updateScannerStatus(error?.message || "Không thể xử lý mã QR", "error");
    showError(error);
  } finally {
    window.setTimeout(() => { scanLocked = false; }, 1200);
  }
}

function getConsumerUrl(batchCode) {
  const baseUrl = PUBLIC_APP_URL || window.location.href;
  const url = new URL("consumer.html", baseUrl);
  url.searchParams.set("batch", batchCode);
  return url.toString();
}

function normalizeBatchCode(batchCode) {
  const normalized = String(batchCode || "").trim().toUpperCase();
  if (!normalized) throw new Error("Mã lô không hợp lệ");
  return normalized;
}

async function verifyBatchExists(batchCode) {
  const normalized = normalizeBatchCode(batchCode);
  const contract = await getReadContract();
  await resolveBatchId(normalized, contract);
  return normalized;
}

function setBatchInputs(batchCode) {
  document.querySelectorAll('[name="batchCode"]').forEach((input) => {
    input.value = batchCode;
  });
}

export async function loadProductFromQr(batchCode) {
  if (!String(batchCode || "").trim()) throw new Error("Mã lô không hợp lệ");
  setBatchInputs(batchCode);
  const product = await searchProduct(batchCode);
  if (!product) throw new Error(`Không tải được lô ${batchCode}. Hãy kiểm tra Hardhat node và contract đã deploy.`);

  await loadFeedbacks(product.id);
  document.querySelector("#product-results")?.scrollIntoView({ behavior: "smooth" });
}

function renderProductQr(batchCode) {
  const target = document.querySelector("#qr-code");
  const preview = document.querySelector("#qr-preview");
  const link = document.querySelector("#qr-product-link");

  if (!target || !preview || !link) return;
  batchCode = normalizeBatchCode(batchCode);
  if (!window.QRCode) throw new Error("Thư viện tạo mã QR chưa tải xong");

  const productUrl = getConsumerUrl(batchCode);
  target.innerHTML = "";
  new QRCode(target, {
    text: productUrl,
    width: 220,
    height: 220,
    colorDark: "#10231a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H,
  });

  link.href = productUrl;
  link.textContent = productUrl;
  const downloadButton = document.querySelector("#download-qr");
  if (downloadButton) downloadButton.dataset.batchCode = String(batchCode);
  preview.classList.remove("d-none");
  showToast(`Đã tạo mã QR cho lô ${batchCode}`);
}

export async function generateProductQr(batchCode, verifiedByTransaction = false) {
  const normalized = verifiedByTransaction
    ? normalizeBatchCode(batchCode)
    : await verifyBatchExists(batchCode);
  renderProductQr(normalized);
}

export function downloadProductQr(batchCode) {
  const canvas = document.querySelector("#qr-code canvas");
  const image = document.querySelector("#qr-code img");
  const source = canvas?.toDataURL("image/png") || image?.src;
  if (!source) throw new Error("Hãy tạo mã QR trước khi tải xuống");

  const anchor = document.createElement("a");
  anchor.href = source;
  anchor.download = `food-traceability-batch-${batchCode}.png`;
  anchor.click();
}

function renderProductBarcode(batchCode) {
  const target = document.querySelector("#barcode-code");
  const preview = document.querySelector("#barcode-preview");
  if (!target || !preview) return;
  batchCode = normalizeBatchCode(batchCode);
  if (!window.JsBarcode) throw new Error("Thư viện tạo barcode chưa tải xong");

  JsBarcode(target, `FT-${batchCode}`, {
    format: "CODE128",
    width: 2,
    height: 82,
    margin: 14,
    displayValue: true,
    font: "Manrope",
    fontSize: 17,
    lineColor: "#10231a",
    background: "#ffffff",
  });
  const downloadButton = document.querySelector("#download-barcode");
  if (downloadButton) downloadButton.dataset.batchCode = String(batchCode);
  preview.classList.remove("d-none");
  showToast(`Đã tạo barcode cho lô ${batchCode}`);
}

export async function generateProductBarcode(batchCode, verifiedByTransaction = false) {
  const normalized = verifiedByTransaction
    ? normalizeBatchCode(batchCode)
    : await verifyBatchExists(batchCode);
  renderProductBarcode(normalized);
}

export function downloadProductBarcode(batchCode) {
  const svg = document.querySelector("#barcode-code");
  if (!svg?.children.length) throw new Error("Hãy tạo barcode trước khi tải xuống");

  const source = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const anchor = document.createElement("a");
  anchor.href = URL.createObjectURL(blob);
  anchor.download = `food-traceability-barcode-${batchCode}.svg`;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

async function startScanner() {
  if (!window.Html5Qrcode) throw new Error("Thư viện quét QR chưa tải xong");

  const region = document.querySelector("#qr-reader");
  const shell = document.querySelector("#qr-scanner-shell");
  if (!region) return;
  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    throw new Error("Trình duyệt chỉ cho phép mở camera trên HTTPS hoặc localhost. Hãy dùng chức năng chọn ảnh QR bên dưới.");
  }

  updateScannerStatus("Đang mở camera...", "info");
  shell?.classList.remove("d-none");
  setScannerVisualState("scanning");
  scanner = scanner || new Html5Qrcode("qr-reader");

  await scanner.start(
    { facingMode: "environment" },
    {
      fps: 15,
      qrbox: (viewfinderWidth, viewfinderHeight) => ({
        width: Math.floor(Math.min(viewfinderWidth * 0.82, 340)),
        height: Math.floor(Math.min(viewfinderHeight * 0.58, 230)),
      }),
      aspectRatio: 1,
      formatsToSupport: [
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
      ],
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    },
    (decodedText) => { void handleDecodedQr(decodedText); },
    () => {}
  );
  updateScannerStatus("Camera đã sẵn sàng. Đưa mã QR vào giữa khung hình.", "scanning");
}

async function stopScanner(hideStatus = true) {
  if (scanner?.isScanning) await scanner.stop();
  document.querySelector("#qr-scanner-shell")?.classList.add("d-none");
  setScannerVisualState(null);
  if (hideStatus) updateScannerStatus("Camera đã dừng.", "info");
}

async function scanQrImage(file) {
  if (!file) return;
  if (!window.Html5Qrcode) throw new Error("Thư viện quét QR chưa tải xong");

  await stopScanner(false);
  updateScannerStatus("Đang đọc mã QR từ ảnh...", "info");
  scanner = scanner || new Html5Qrcode("qr-reader");
  const decodedText = await scanner.scanFile(file, true);
  await handleDecodedQr(decodedText);
}

export function initQrFeatures() {
  const farmerLabelForm = document.querySelector("#farmer-label-generate-form");
  farmerLabelForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      const batchCode = new FormData(farmerLabelForm).get("batchCode");
      const normalized = await verifyBatchExists(batchCode);
      const contract = await getReadContract();
      const productId = await resolveBatchId(normalized, contract);
      const product = await contract.getProduct(productId);
      const account = String(getCurrentAccount() || "").toLowerCase();
      if (!account) throw new Error("Hãy kết nối ví Farmer trước khi tạo lại tem");
      if (String(product.farmer).toLowerCase() !== account) {
        throw new Error("Bạn chỉ có thể tạo lại tem cho lô do chính ví Farmer này đăng ký");
      }

      renderProductQr(normalized);
      renderProductBarcode(normalized);

      const productLabel = document.querySelector("#generated-product-id");
      if (productLabel) productLabel.textContent = `${normalized} · ID #${productId}`;
      document.querySelector("#farmer-qr-result")?.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      showError(error);
    }
  });

  const generateForm = document.querySelector("#qr-generate-form");
  generateForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await generateProductQr(new FormData(generateForm).get("batchCode"));
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#download-qr")?.addEventListener("click", () => {
    try {
      const button = document.querySelector("#download-qr");
      const batchCode = button?.dataset.batchCode || (generateForm ? new FormData(generateForm).get("batchCode") : "");
      downloadProductQr(batchCode);
    } catch (error) {
      showError(error);
    }
  });

  const barcodeForm = document.querySelector("#barcode-generate-form");
  barcodeForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await generateProductBarcode(new FormData(barcodeForm).get("batchCode"));
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#download-barcode")?.addEventListener("click", () => {
    try {
      const button = document.querySelector("#download-barcode");
      const batchCode = button?.dataset.batchCode || (barcodeForm ? new FormData(barcodeForm).get("batchCode") : "");
      downloadProductBarcode(batchCode);
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#start-qr-scanner")?.addEventListener("click", async () => {
    try {
      await startScanner();
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#stop-qr-scanner")?.addEventListener("click", () => stopScanner());

  document.querySelector("#qr-image-input")?.addEventListener("change", async (event) => {
    try {
      await scanQrImage(event.target.files?.[0]);
    } catch (error) {
      updateScannerStatus(error?.message || "Không đọc được mã QR trong ảnh", "error");
      showError(error);
    } finally {
      event.target.value = "";
    }
  });

  const batchCode = new URLSearchParams(window.location.search).get("batch");
  if (batchCode) loadProductFromQr(batchCode).catch(showError);
}
