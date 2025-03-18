export const CONSTANTS = {
  PACKAGE_ID:
    "0x979a800e3d7679644976f928b617a7451a79f6be576af118ebbce5d60e5cf351",
  ROUTER_ID:
    "0x2f21229a2fe52eb816e3869b153a13c7677672aca865ff3c0a214d7bdfbf310d",
  FACTORY_ID:
    "0xc18b04035f616d3dd93dfddb422144e4656ca26fbc2b8d01bf2da2f922db9e66",
  FARM_ID: "0xb7b5117435c1efb8faeab194d53864c7c1cd72379ccad5072c19b0fc468811b0",
  FARM_CONFIG_ID:
    "0x1a3009c32e47eb5dc551c2299123f7c4e8c181014ef0610caef1cd365f296300",
  ADMIN_CAP_ID:
    "0xecb76812f887447f9b207dc349cfbfe2396a96d39a94ab3e86ed14dc44ff73d9",
  PAIR_ADMIN_CAP_ID:
    "0xa3206aef6caf487a467be82a272b29490cd206660db63dd008126a21b8fbd242",
  UPGRADE_CAP_ID:
    "0x685215cff7279b3b3804b712b5dff2b3899f38fe042ff2fe96e2ed6a6824ae9c",
  VICTORY_TOKEN: {
    TYPE: "0x979a800e3d7679644976f928b617a7451a79f6be576af118ebbce5d60e5cf351::victory_token::VICTORY_TOKEN",
    TREASURY_CAP_WRAPPER_ID:
      "0xbb6632579699105d5b1a953f4e361420fdc52da47203cea1e8bff50acee43f95",
    MINTER_CAP_ID:
      "0xf571b66fab146451820f4f2d6e4d67660acf6695b2a5b2f2d04d3e5a5d2ef8df",
    METADATA_ID:
      "0xe2d45105ba22daffac053e2046dbd113e76c517c27bdf7dc16eedba6a9fcef13",
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
  },
  getPairID: (token0: string, token1: string) => `${token0}_${token1}_pair`,
};
