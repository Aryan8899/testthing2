export const CONSTANTS = {
  PACKAGE_ID:
    "0xf882b67867ad5675b77f9fda790f417c330ae58915f0f664b70bc70669445cbf",
  ROUTER_ID:
    "0xba8682b84022f543bcf82b9d66ee60491854092297196b883f7ad7979caec767",
  FACTORY_ID:
    "0x1391ce4492050b5c59fabddad964b5cda28729023fdfa5b461dab8ceaaa8816e",
  FARM_ID: "0x7402d190651222ed521aa01dde56113e34ef5fc4ce017d2e8b07d99018dc7833",
  FARM_CONFIG_ID:
    "0x52b42a084509ebd8ef91aa9a4a295bdd9839f4db6a93d1986edd907df689ea85",
  ADMIN_CAP_ID:
    "0x460b4cb0ef27f986f81db8f15e522d5387217df975b31ad2ad6c6f6df5b4071c",
  PAIR_ADMIN_CAP_ID:
    "0x83f69f8dcb9d7909674b43a5f281f53ee3b418275bab04bb852449840da1402d",
  UPGRADE_CAP_ID:
    "0x57d89902457bd75874a7acf490b4eeaa4c744a04d3c6823a12c03fa82137491d",
  VICTORY_TOKEN: {
    TYPE: "0xf882b67867ad5675b77f9fda790f417c330ae58915f0f664b70bc70669445cbf::victory_token::VICTORY_TOKEN",
    TREASURY_CAP_WRAPPER_ID:
      "0xb6f29fe44b483d609e5e8a584464f678898aa3ae367381574bdea817f857a6c1",
    MINTER_CAP_ID:
      "0x7e1eb55423a1d5df4396acc59537d4fa2a7b1f75e246bb3a24123766544e0109",
    METADATA_ID:
      "0x30215ecad16425335bf9d9734303b2538feaa9e3ccd3170a3d56eb4dfb086e28",
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
