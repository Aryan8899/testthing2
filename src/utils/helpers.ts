export const getShortAddress = (address?: string): string => {
  if (!address) return "";
  return `${address.slice(0, 5)}...${address.slice(-4)}`;
};

export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
};

export const graphData = {
  volume: [
    { date: "18", value: 310 },
    { date: "19", value: 280 },
    // ... rest of volume data
  ],
  liquidity: [
    { date: "18", value: 450 },
    // ... rest of liquidity data
  ],
  // ... other datasets
};
