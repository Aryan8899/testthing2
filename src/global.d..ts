declare global {
  interface Window {
    suiWallet?: {
      getAccounts: () => Promise<string[]>;
      // Define other Sui Wallet methods and properties here as needed
    };
  }
}

// To make this file a module and avoid TypeScript errors
export {};
