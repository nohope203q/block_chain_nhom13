export const CONTRACT_ADDRESS = "";
export const CHAIN_ID = 31337n;
export const NETWORK_NAME = "Hardhat Localhost";
// MetaMask runs on Windows and reaches the WSL Hardhat node through portproxy.
export const RPC_URL = "http://127.0.0.1:8545";
// Điền URL frontend mà điện thoại có thể truy cập, ví dụ http://192.168.1.10:5500/frontend/
// Để trống khi chỉ quét và mở QR trên cùng máy tính.
export const PUBLIC_APP_URL = "";

export async function getDeploymentConfig() {
  try {
    const deployment = await import("./deployment.js");
    return {
      address: deployment.DEPLOYED_ADDRESS || CONTRACT_ADDRESS,
      chainId: deployment.DEPLOYED_CHAIN_ID || CHAIN_ID,
    };
  } catch {
    return { address: CONTRACT_ADDRESS, chainId: CHAIN_ID };
  }
}
