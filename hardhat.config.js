require("@nomicfoundation/hardhat-toolbox");

const networks = {
  localhost: {
    url: "http://127.0.0.1:8545",
    chainId: 31337,
  },
};

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      // Ưu tiên giảm kích thước bytecode để hợp đồng nằm dưới giới hạn EVM 24 KB.
      optimizer: { enabled: true, runs: 1 },
    },
  },
  networks,
};
