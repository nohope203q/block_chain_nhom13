import { CHAIN_ID, NETWORK_NAME, RPC_URL } from "./config.js";
import { shortenAddress, showError, showToast } from "./ui.js";

let provider;
let signer;
let currentAccount = "";
const listeners = new Set();

export async function connectWallet() {
  if (!window.ethereum) throw new Error("Vui lòng cài MetaMask để sử dụng DApp");
  await ensureLocalNetwork();
  provider = new ethers.BrowserProvider(window.ethereum);
  await provider.send("eth_requestAccounts", []);
  signer = await provider.getSigner();
  currentAccount = await signer.getAddress();
  updateWalletUI();
  listeners.forEach((listener) => listener(currentAccount));
  return currentAccount;
}

async function ensureLocalNetwork() {
  const chainId = `0x${CHAIN_ID.toString(16)}`;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId }] });
  } catch (error) {
    if (error.code !== 4902) throw error;
    await window.ethereum.request({
      method: "wallet_addEthereumChain",
      params: [{ chainId, chainName: NETWORK_NAME, rpcUrls: [RPC_URL], nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 } }],
    });
  }
}

export function getProvider() {
  return provider;
}

export function getSigner() {
  if (!signer) throw new Error("Hãy kết nối ví MetaMask trước");
  return signer;
}

export function getCurrentAccount() {
  return currentAccount;
}

export function onWalletChanged(listener) {
  listeners.add(listener);
}

function updateWalletUI() {
  document.querySelectorAll("[data-wallet-address]").forEach((el) => { el.textContent = shortenAddress(currentAccount); });
  document.querySelectorAll("[data-connect-wallet]").forEach((el) => { el.textContent = currentAccount ? shortenAddress(currentAccount) : "Kết nối ví"; });
}

if (window.ethereum) {
  window.ethereum.on("accountsChanged", async (accounts) => {
    try {
      currentAccount = accounts[0] || "";
      signer = null;
      provider = null;

      if (currentAccount) {
        provider = new ethers.BrowserProvider(window.ethereum);
        signer = await provider.getSigner(currentAccount);
      }

      updateWalletUI();
      listeners.forEach((listener) => listener(currentAccount));
    } catch (error) {
      currentAccount = "";
      signer = null;
      provider = null;
      updateWalletUI();
      showError(error);
    }
  });
  window.ethereum.on("chainChanged", () => window.location.reload());
}

export async function handleConnect() {
  try {
    await connectWallet();
    showToast("Kết nối MetaMask thành công");
  } catch (error) {
    showError(error);
  }
}
