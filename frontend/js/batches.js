import { getReadContract } from "./contract.js";
import { getCurrentAccount } from "./wallet.js";

const roleForms = [
  { selector: "#harvest-form", states: [0], owner: "farmer" },
  { selector: "#create-processed-product-form", name: "sourceBatchCode", states: [1], requiresBalance: true },
  { selector: "#ship-form", states: [2, 3], custom: canDistribute },
  { selector: "#receive-form", states: [3], owner: "pendingRecipient" },
  { selector: "#sale-form", states: [4], owner: "retailer" },
  { selector: "#qr-generate-form", states: [5], owner: "retailer" },
  { selector: "#barcode-generate-form", states: [5], owner: "retailer" },
  { selector: "#farmer-label-generate-form", states: [0, 1, 2, 3, 4, 5, 6], owner: "farmer" },
  { selector: "#request-recall-form", states: [0, 1, 2, 3, 4, 5], custom: isParticipant },
];

const normalize = (value) => String(value || "").toLowerCase();

function canDistribute(product, account) {
  return Number(product.state) === 2 || normalize(product.pendingRecipient) === account;
}

function isParticipant(product, account) {
  return normalize(product.farmer) === account
    || normalize(product.manufacturer) === account
    || normalize(product.retailer) === account
    || product.distributors.some((address) => normalize(address) === account);
}

function replaceWithSelect(form, fieldName) {
  const field = form.querySelector(`[name="${fieldName}"]`);
  if (!field || field.tagName === "SELECT") return field;
  const select = document.createElement("select");
  select.className = field.className.replace("form-control", "form-select");
  select.name = field.name;
  select.required = field.required;
  field.replaceWith(select);
  return select;
}

export async function loadBatchOptions() {
  const activeConfigs = roleForms.filter(({ selector }) => document.querySelector(selector));
  if (!activeConfigs.length) return;

  const contract = await getReadContract();
  const ids = await contract.getAllProductIds();
  const products = await Promise.all(ids.map((id) => contract.getProduct(id)));
  const recalls = await Promise.all(ids.map((id) => contract.getRecallRequest(id)));
  const recallById = new Map(ids.map((id, index) => [id.toString(), Number(recalls[index].status)]));
  const balances = new Map();
  await Promise.all(products.filter((product) => Number(product.state) === 1).map(async (product) => {
    const balance = await contract.getMaterialBalance(product.id);
    balances.set(product.id.toString(), Number(balance.remaining));
  }));
  const account = normalize(getCurrentAccount());

  for (const config of activeConfigs) {
    const form = document.querySelector(config.selector);
    const select = replaceWithSelect(form, config.name || "batchCode");
    if (!select) continue;

    const currentValue = select.value;
    const matches = products.filter((product) => {
      if (!config.states.includes(Number(product.state))) return false;
      if (recallById.get(product.id.toString()) === 1) return false;
      if (product.parentProductId > 0n && recallById.get(product.parentProductId.toString()) === 1) return false;
      if (config.requiresBalance && balances.get(product.id.toString()) <= 0) return false;
      if (!account) return false;
      if (config.custom) return config.custom(product, account);
      return !config.owner || normalize(product[config.owner]) === account;
    });

    select.innerHTML = '<option value="">Chọn lô hàng phù hợp</option>';
    for (const product of matches) {
      const option = document.createElement("option");
      option.value = product.batchCode;
      option.textContent = `${product.batchCode} - ${product.name}`;
      select.appendChild(option);
    }
    if (matches.some((product) => product.batchCode === currentValue)) select.value = currentValue;
    if (!matches.length) select.innerHTML = '<option value="">Không có lô hàng phù hợp</option>';
  }
}

function codePrefix(name) {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .trim();
  const words = normalized.split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words.slice(0, 4).map((word) => word[0]).join("") : words[0]?.slice(0, 5)) || "LOT";
}

function generatedCode(name) {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const suffix = String(Date.now()).slice(-4);
  return `${codePrefix(name)}-${date}-${suffix}`;
}

export function initAutomaticBatchCodes() {
  const configs = [
    { form: "#create-product-form", name: "name", code: "batchCode" },
    { form: "#create-processed-product-form", name: "name", code: "outputBatchCode" },
  ];
  for (const config of configs) {
    const form = document.querySelector(config.form);
    const nameInput = form?.querySelector(`[name="${config.name}"]`);
    const codeInput = form?.querySelector(`[name="${config.code}"]`);
    if (!nameInput || !codeInput) continue;
    codeInput.readOnly = true;
    codeInput.placeholder = "Mã lô sẽ được tạo tự động";
    const update = () => { codeInput.value = nameInput.value.trim() ? generatedCode(nameInput.value) : ""; };
    nameInput.addEventListener("input", update);
    form.addEventListener("reset", () => setTimeout(update));
  }
}
