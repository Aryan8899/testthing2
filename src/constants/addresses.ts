export const CONSTANTS = {
  PACKAGE_ID:
    "0x9a70342f05644b8aeea27f75886c3caeb7f9fe1dacb4d0e2f1c9e7af347163fe",
  ROUTER_ID:
    "0x6895300523ed376e62b042430e38d9d4c14aa6515d015aa6c671db482c979528",
  FACTORY_ID:
    "0xefdd3f484680ca41099904dbd410fc02057129d676925fd6a4b427169f4c2996",
  ADMIN_CAP_ID:
    "0x67d41e30206d75b48d0834ffb5f7d4b795fabc447a36b3bfaafd8f24cdd1f8a5",
  UPGRADE_CAP_ID:
    "0xfc0f81848a4e0d80fcc1f6e90bf9eeeb5d1f85656233f336d581731037577af2",
  MODULES: {
    FACTORY: "factory",
    PAIR: "pair",
    ROUTER: "router",
    LIBRARY: "library",
    FIXED_POINT_MATH: "fixed_point_math",
  },
  getPairID: (token0: string, token1: string) => `${token0}_${token1}_pair`,
};
