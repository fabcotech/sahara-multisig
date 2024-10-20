import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
require('dotenv').config();
import 'hardhat-gas-reporter';

const privateKey1 = process.env.PK_1!;

function isPrivateKeyValid(pk: string) {
  return /^(0x)?[0-9a-fA-F]{64}$/.test(pk);
}

const privateKeys = [privateKey1];

let isPKValid = true;

privateKeys.forEach((pk, index) => {
  if (!isPrivateKeyValid(pk)) {
    isPKValid = false;
  } else isPKValid = true;
});

const config: HardhatUserConfig = {
  gasReporter: {
    currency: 'USD',
    gasPrice: 27,
  },
  defaultNetwork: 'hardhat',
  networks: {
    hardhat: { chainId: 1337 },
    sepolia: {
      url: 'https://eth-sepolia.g.alchemy.com/v2/FfmH35zf4fifvH3eFrKPTSRi8IUW4aRV',
      accounts: [privateKey1],
    },
  },
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  etherscan: {
    apiKey: {},
  },
};

export default config;
