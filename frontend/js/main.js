import { handleConnect, onWalletChanged } from "./wallet.js";
import { addParticipant, deactivateParticipant } from "./admin.js";
import { createProduct, harvestProduct } from "./farmer.js";
import { createProcessedProduct } from "./manufacturer.js";
import { clearDeliveryPartners, loadDeliveryPartners, shipProduct } from "./distributor.js";
import { receiveProduct, setForSale } from "./retailer.js";
import { searchProduct } from "./product.js";
import { addFeedback, loadFeedbacks } from "./feedback.js";
import { loadDashboard } from "./dashboard.js";
import { showError } from "./ui.js";
import { clearGeneratedAssets, initQrFeatures } from "./qr.js";
import { loadPendingRecallRequests, requestRecall, reviewRecall } from "./recall.js";
import { clearBatchOptions, initAutomaticBatchCodes, loadBatchOptions } from "./batches.js";

const formHandlers = {
  "add-participant-form": (data) => addParticipant(data.get("account"), data.get("name"), data.get("role")),
  "deactivate-form": (data) => deactivateParticipant(data.get("account")),
  "request-recall-form": (data) => requestRecall(data.get("batchCode"), data.get("reason")),
  "approve-recall-form": (data) => reviewRecall(data.get("batchCode"), true, data.get("note")),
  "reject-recall-form": (data) => reviewRecall(data.get("batchCode"), false, data.get("note")),
  "create-product-form": (data) => createProduct(data.get("batchCode"), data.get("name"), data.get("origin"), data.get("description"), data.get("quantity"), data.get("unit"), data.get("harvestDate"), data.get("expiryDate")),
  "harvest-form": (data) => harvestProduct(data.get("batchCode"), data.get("manufacturer"), data.get("note")),
  "create-processed-product-form": (data) => createProcessedProduct(data.get("sourceBatchCode"), data.get("outputBatchCode"), data.get("name"), data.get("description"), data.get("distributor"), data.get("materialQuantity"), data.get("quantity"), data.get("unit"), data.get("expiryDate"), data.get("note")),
  "ship-form": (data) => shipProduct(data.get("batchCode"), data.get("recipient"), data.get("vehicleCode"), data.get("temperature"), data.get("destination"), data.get("note")),
  "receive-form": (data) => receiveProduct(data.get("batchCode"), data.get("note")),
  "sale-form": (data) => setForSale(data.get("batchCode"), data.get("price"), data.get("note")),
};

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-connect-wallet]").forEach((button) => button.addEventListener("click", handleConnect));

  Object.entries(formHandlers).forEach(([id, handler]) => {
    const form = document.querySelector(`#${id}`);
    form?.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (form.dataset.submitting === "true") return;
      form.dataset.submitting = "true";
      try {
        const success = await handler(new FormData(form));
        if (success) {
          form.reset();
          await Promise.all([
            loadDashboard(),
            loadPendingRecallRequests(),
            loadBatchOptions(),
            loadDeliveryPartners().catch(showError),
          ]);
        }
      } catch (error) { showError(error); }
      finally { delete form.dataset.submitting; }
    });
  });

  document.querySelector("#search-product-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const batchCode = new FormData(event.currentTarget).get("batchCode");
    const product = await searchProduct(batchCode);
    if (product) await loadFeedbacks(product.id);
  });

  document.querySelector("#feedback-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.submitting === "true") return;
    form.dataset.submitting = "true";
    const data = new FormData(form);
    try {
      const batchCode = data.get("batchCode");
      const success = await addFeedback(batchCode, data.get("rating"), data.get("comment"));
      if (success) {
        form.reset();
        const product = await searchProduct(batchCode);
        if (product) await loadFeedbacks(product.id);
      }
    } catch (error) { showError(error); }
    finally { delete form.dataset.submitting; }
  });

  const loadProtectedData = async () => {
    const authorized = await loadDashboard();
    if (authorized === null) return;
    if (!authorized) {
      clearBatchOptions();
      clearDeliveryPartners();
      return;
    }
    await Promise.all([
      loadDeliveryPartners().catch(showError),
      loadBatchOptions().catch(showError),
      loadPendingRecallRequests(),
    ]);
  };

  onWalletChanged(async () => {
    clearGeneratedAssets();
    await loadProtectedData();
  });
  initAutomaticBatchCodes();
  initQrFeatures();
  loadProtectedData();
});
