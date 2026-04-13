import { defineConfig, configVariable } from 'hardhat/config';
import hardhatToolboxViem from '@nomicfoundation/hardhat-toolbox-viem';

export default defineConfig({
  plugins: [hardhatToolboxViem],
  solidity: {
    version: '0.8.20',
  },
  networks: {
    optimismSepolia: {
      type: 'http',
      chainType: 'op',
      url: configVariable('OP_SEPOLIA_RPC_URL'),
      accounts: [configVariable('DEPLOYER_PRIVATE_KEY')],
    },
    sepolia: {
      type: 'http',
      chainType: 'l1',
      url: configVariable('SEPOLIA_RPC_URL'),
      accounts: [configVariable('DEPLOYER_PRIVATE_KEY')],
    },
  },
});
