export const CONSTANTS = {
  PACKAGE_ID:
    "0xf9bccc3fdd6e9ff0be0f17b580c2eee3b28ac8e612f988eae975ef56dfb66ec2",
  ROUTER_ID:
    "0xf1cd6b0d5b03a789da90e561918e7d93002509432b64dd47f86301334b34cba9",
  FACTORY_ID:
    "0x3e28203cdb55212a26cbf0b04f05e8b8af6e89d693e749f14b8d866e2a4a2554",
  FARM_ID: "0x78550768d08bdb9794d60539fabbf8ec2d3d5c62bb2a1e447d0af0ab40742105",
  FARM_CONFIG_ID:
    "0x7a5c448489fb4e3de17968bdccb1cd5004d8f9cf7f5bccdc06c5f86305048d09",
  ADMIN_CAP_ID:
    "0xcab124c3fb03e7c2fabec1999bddc86641987fe743036996f719c5c118a570ed",
  PAIR_ADMIN_CAP_ID:
    "0xef5e39c4bef8e197ef6d22dda516808b68a8a78f5186252e9511ec1c53e64408",
  UPGRADE_CAP_ID:
    "0x4d89fb3b2d509513b6a36e2fe8f2164605063f89235918a6814fca236b6ad2eb",
  TOKEN_LOCKER_ID:
    "0x5c304530e6417a13c8e60628bcb30fa9c6df2be4cc813a106c90eeb422128a3b",
  TOKEN_LOCKER_ADMIN_CAP_ID:
    "0xf15cff7d963cc613f0fc263eaf5c9a251944638643728b41740d24070f196cb2",
  VICTORY_TOKEN: {
    TYPE: "0xf9bccc3fdd6e9ff0be0f17b580c2eee3b28ac8e612f988eae975ef56dfb66ec2::victory_token::VICTORY_TOKEN",
    TREASURY_CAP_WRAPPER_ID:
      "0xff15a889e76b61a06e44853e5654a142ab04d6c04a863f73990a25bb950039ce",
    MINTER_CAP_ID:
      "0xfe6a49110683b26f29f75da07256134bfc3264846b9a844d124439384c5c4854",
    METADATA_ID:
      "0xaf40d779ed50db2048a8761ec98c7d2101e38648c0d99f6257ed1c6211a9c61a",
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
