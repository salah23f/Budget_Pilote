import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const SkyvoyReceiptModule = buildModule('SkyvoyReceiptModule', (m) => {
  const receipt = m.contract('SkyvoyReceipt');
  return { receipt };
});

export default SkyvoyReceiptModule;
