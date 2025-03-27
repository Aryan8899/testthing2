export const CONSTANTS = {
  PACKAGE_ID:
    "0xdf026c0faf8930c852e5efc6c15edc15c632abdc22de4c2d766d22c42a32eda9",
  ROUTER_ID:
    "0xf2ee76e82b739e0d5b04fa9e40bcff7cd3246acbb2c4217776c481059f71b6ae",
  FACTORY_ID:
    "0x81404cd9555c6631e7d5b16824f7aa254e6665486ba29e2ca1866d6ec27a3426",
  FARM_ID: "0x8178826b58b6e29364f40a18b18ed1ab9cb9df7793e831eec4c208a25ea384ec",
  FARM_CONFIG_ID:
    "0xae5cf03f661d92b35eaeafb1241b886a6eda8da30dcdb105f2aee0b171735614",
  ADMIN_CAP_ID:
    "0x70d1ff76a118ac66fd4b0426aef1fafbc531370325df4625a7bb3caa133a4522",
  PAIR_ADMIN_CAP_ID:
    "0xbfe5d0ac2952cdbfb91756a2bfe0c425a122276a2d6ba6dfc923fef20fe340e2",
  UPGRADE_CAP_ID:
    "0x9ed83aa0e32d7fe8227b4b4d969531ad54988d918b4e6d27debbdb64db0f8b13",
  VICTORY_TOKEN: {
    TYPE: "0xdf026c0faf8930c852e5efc6c15edc15c632abdc22de4c2d766d22c42a32eda9::victory_token::VICTORY_TOKEN",
    TREASURY_CAP_WRAPPER_ID:
      "0x1dea3522d6cc07b9d05420f5e5456b6673fc101df54708110eaed406c2d3f291",
    MINTER_CAP_ID:
      "0x32f34af10742b8c1d667bb3f1568e0d5bbbe12994d40fa0c35842bc59ed9cef7",
    METADATA_ID:
      "0xdc7ed18409b54817129c612252dfd613bd952773203258d34f6ef2d917a3e8fa",
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
