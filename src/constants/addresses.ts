export const CONSTANTS = {
  PACKAGE_ID:
    "0x594ac1bc574441936cc2c8bfe8ee98a8a1cc3cc2565934a35e4fbaa8ef9df9a9",
  ROUTER_ID:
    "0xee2b2f05cfa97b63fa750245e1dfa06889ad04aec7e87e52682a9760774b609d",
  FACTORY_ID:
    "0x9106aad90c3c7a3ee46af55b7f547658fab57f561fe327e57e4f9f5a9c9098c2",
  FARM_ID: "0xaf51d093dbc419696687409c217f646992e0287fbe160a30ccdaafe2426513c0",
  FARM_CONFIG_ID:
    "0x48c35a602439701f72323b2201ffe078c0271202e338e862ee13ac9e9ebb8ca7",
  ADMIN_CAP_ID:
    "0xba47ef6a5fe043b3fadf13445830388c1abed7b5f7213e3d83728a61fdaa2aaf",
  PAIR_ADMIN_CAP_ID:
    "0x53a427f81aa492a22dba385b0da2ee8adb77a20976f49b3e8c1058dabf0cf26f",
  UPGRADE_CAP_ID:
    "0xc9b832df1d3c8c05de1445671ab4d11dbf1840ac8f9339ecd733ca39bc451a98",
  TOKEN_LOCKER_ID:
    "0xfb226947613d2bfa235c1c8a66e56a3ae114ff577222816c1d657ca0f79feaa2",
  TOKEN_LOCKER_ADMIN_CAP_ID:
    "0xc6cf4d7027f3a63ee611959cacb3e8b86c1f556f7493b33eaa5f9c3586bbfc71",
  VICTORY_TOKEN: {
    TYPE: "0x594ac1bc574441936cc2c8bfe8ee98a8a1cc3cc2565934a35e4fbaa8ef9df9a9::victory_token::VICTORY_TOKEN",
    TREASURY_CAP_WRAPPER_ID:
      "0x7f64813edde05e0b3dc9bd4e0369b34db43044660c0d8b812a131aad7d475e98",
    MINTER_CAP_ID:
      "0x37f98ba0556ef254d8ae2f0570e747f50e1ff7d3158db81e8750f3db42d0943f",
    METADATA_ID:
      "0xb0275309584ec9f693fe5a1b084187ddd0260d66d9caa9cf0d4bf1c0a8812515",
  },
  MODULES: {
    FACTORY: "factory",
    PAIR: "pair",
    ROUTER: "router",
    LIBRARY: "library",
    FIXED_POINT_MATH: "fixed_point_math",
    FARM: "farm",
    FARM_CONFIG: "farm_config",
    VICTORY_TOKEN: "victory_token",
    TOKEN_LOCKER: "token_locker",
  },
  getPairID: (token0: string, token1: string) => `${token0}_${token1}_pair`,
};
