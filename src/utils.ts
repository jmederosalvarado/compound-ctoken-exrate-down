export const COMPTROLLER_ADDRESS = "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b";

export const COMPTROLLER_ABI = [
  "function getAllMarkets() public view returns (address[])",
];

export const CTOKEN_ABI = [
  "function name() public view returns (string)",
  "function exchangeRateStored() public view returns (uint)",
  "function exchangeRateCurrent() public returns (uint)",
];
