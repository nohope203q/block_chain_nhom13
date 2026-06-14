import { searchProduct } from "./product.js";
import { loadFeedbacks } from "./feedback.js";
import { showError, showToast } from "./ui.js";
import { PUBLIC_APP_URL } from "./config.js";
import { getReadContract, resolveBatchId } from "./contract.js";
import { getCurrentAccount } from "./wallet.js";

let scanner;
let scanLocked = false;
let scannerTransition = false;

function supportedFormats() {
  return [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
  ];
}

function getScanner() {
  if (!scanner) {
    scanner = new Html5Qrcode("qr-reader", {
      formatsToSupport: supportedFormats(),
      verbose: false,
    });
  }
  return scanner;
}

function cameraErrorMessage(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || error || "");
  if (name === "NotAllowedError" || /permission|denied|notallowed/i.test(message)) {
    return "Trình duyệt đang chặn camera. Hãy cho phép quyền Camera trong biểu tượng ổ khóa cạnh thanh địa chỉ rồi tải lại trang.";
  }
  if (name === "NotFoundError" || /not found|no camera|no cameras/i.test(message)) {
    return "Không tìm thấy camera trên thiết bị này.";
  }
  if (name === "NotReadableError" || /could not start|not readable|track start/i.test(message)) {
    return "Camera đang được ứng dụng khác sử dụng. Hãy đóng Camera, Zoom hoặc ứng dụng gọi video rồi thử lại.";
  }
  if (name === "OverconstrainedError" || /constraint|overconstrained/i.test(message)) {
    return "Camera không hỗ trợ cấu hình hình ảnh được yêu cầu. Hãy tải lại trang và thử lại.";
  }
  return `Không thể mở camera: ${message || "lỗi không xác định"}`;
}

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

function setScannerControls(disabled) {
  ["#start-qr-scanner", "#start-barcode-scanner", "#stop-qr-scanner"].forEach((selector) => {
    const button = document.querySelector(selector);
    if (button) button.disabled = disabled;
  });
}

async function switchScanner(mode) {
  if (scannerTransition) return;
  scannerTransition = true;
  setScannerControls(true);
  try {
    await stopScanner(false);
    await startScanner(mode);
  } finally {
    scannerTransition = false;
    setScannerControls(false);
  }
}

async function stopScannerFromUi() {
  if (scannerTransition) return;
  scannerTransition = true;
  setScannerControls(true);
  try {
    await stopScanner();
  } finally {
    scannerTransition = false;
    setScannerControls(false);
  }
}

function extractBatchCode(decodedText) {
  const rawValue = String(decodedText || "").trim();
  if (rawValue && !rawValue.includes("://")) {
    return normalizeBatchCode(rawValue.replace(/^FT-/i, ""));
  }

  try {
    const decodedUrl = new URL(rawValue, window.location.href);
    const batchCode = decodedUrl.searchParams.get("batch");
    if (batchCode) return normalizeBatchCode(batchCode);
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
    updateScannerStatus(error?.message || "Không thể xử lý mã đã quét", "error");
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
  const qrPayload = PUBLIC_APP_URL ? productUrl : `FT-${batchCode}`;
  target.innerHTML = "";
  new QRCode(target, {
    text: qrPayload,
    width: 280,
    height: 280,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
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

  JsBarcode(target, batchCode, {
    format: "CODE128",
    width: 3,
    height: 110,
    margin: 24,
    displayValue: true,
    font: "Manrope",
    fontSize: 20,
    lineColor: "#000000",
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

export function clearGeneratedAssets() {
  const qrTarget = document.querySelector("#qr-code");
  const barcodeTarget = document.querySelector("#barcode-code");
  if (qrTarget) qrTarget.innerHTML = "";
  if (barcodeTarget) barcodeTarget.innerHTML = "";
  document.querySelector("#qr-preview")?.classList.add("d-none");
  document.querySelector("#barcode-preview")?.classList.add("d-none");
  const productLabel = document.querySelector("#generated-product-id");
  if (productLabel) productLabel.textContent = "Chưa tạo";
}

async function startScanner(mode = "qr") {
  if (!window.Html5Qrcode) throw new Error("Thư viện quét QR chưa tải xong");

  const region = document.querySelector("#qr-reader");
  const shell = document.querySelector("#qr-scanner-shell");
  if (!region) return;
  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    throw new Error("Trình duyệt chỉ cho phép mở camera trên HTTPS hoặc localhost. Hãy dùng chức năng chọn ảnh mã bên dưới.");
  }

  updateScannerStatus("Đang mở camera...", "info");
  shell?.classList.remove("d-none");
  shell?.classList.toggle("barcode-mode", mode === "barcode");
  setScannerVisualState("scanning");
  scanner = getScanner();

  try {
    const cameras = await Html5Qrcode.getCameras();
    if (!cameras.length) throw new Error("Không tìm thấy camera");
    const preferredCamera = cameras.find((camera) => /back|rear|environment|sau/i.test(camera.label)) || cameras[0];

    const scanRegion = mode === "barcode"
      ? (viewfinderWidth, viewfinderHeight) => ({
          width: Math.floor(Math.min(viewfinderWidth * 0.94, 580)),
          height: Math.floor(Math.min(viewfinderHeight * 0.36, 150)),
        })
      : (viewfinderWidth, viewfinderHeight) => {
          const size = Math.floor(Math.min(viewfinderWidth * 0.72, viewfinderHeight * 0.72, 320));
          return { width: size, height: size };
        };

    await scanner.start(
      preferredCamera.id,
      {
        fps: mode === "barcode" ? 20 : 15,
        qrbox: scanRegion,
        disableFlip: false,
        experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      },
      (decodedText) => { void handleDecodedQr(decodedText); },
      () => {}
    );
    const instruction = mode === "barcode"
      ? "Giữ barcode nằm ngang, nhìn thấy đầy đủ hai đầu và đưa camera cách mã khoảng 15-25 cm."
      : "Đưa toàn bộ QR vào giữa khung vuông.";
    updateScannerStatus(`Camera đã sẵn sàng${preferredCamera.label ? `: ${preferredCamera.label}` : ""}. ${instruction}`, "scanning");
  } catch (error) {
    document.querySelector("#qr-scanner-shell")?.classList.add("d-none");
    setScannerVisualState("error");
    const friendlyError = new Error(cameraErrorMessage(error));
    updateScannerStatus(friendlyError.message, "error");
    throw friendlyError;
  }
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
  updateScannerStatus("Đang đọc QR hoặc barcode từ ảnh...", "info");
  scanner = getScanner();
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
      await switchScanner("qr");
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#start-barcode-scanner")?.addEventListener("click", async () => {
    try {
      await switchScanner("barcode");
    } catch (error) {
      showError(error);
    }
  });

  document.querySelector("#stop-qr-scanner")?.addEventListener("click", () => {
    stopScannerFromUi().catch(showError);
  });

  document.querySelector("#qr-image-input")?.addEventListener("change", async (event) => {
    try {
      await scanQrImage(event.target.files?.[0]);
    } catch (error) {
      updateScannerStatus(error?.message || "Không đọc được QR hoặc barcode trong ảnh", "error");
      showError(error);
    } finally {
      event.target.value = "";
    }
  });

  const batchCode = new URLSearchParams(window.location.search).get("batch");
  if (batchCode) loadProductFromQr(batchCode).catch(showError);

  window.addEventListener("pagehide", () => {
    if (scanner?.isScanning) scanner.stop().catch(() => {});
  }, { once: true });
}
