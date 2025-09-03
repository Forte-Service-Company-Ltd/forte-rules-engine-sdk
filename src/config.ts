import { createConfig, Config, connect } from "@wagmi/core";
import { mock } from "@wagmi/connectors";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "@wagmi/core/chains";
import {
  http,
  walletActions,
  publicActions,
  createTestClient,
  PrivateKeyAccount,
} from "viem";

/**
 * The following address and private key are defaults from anvil and are only meant to be used in a test environment.
 */
//-------------------------------------------------------------------------------------------------------------
const foundryPrivateKey: `0x${string}` =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
export const initialAccount: PrivateKeyAccount =
  privateKeyToAccount(foundryPrivateKey);
export const foundryAccountAddress: `0x${string}` =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

const secondaryFoundryPrivateKey: `0x${string}` =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
export const secondaryAccount: PrivateKeyAccount = privateKeyToAccount(
  secondaryFoundryPrivateKey,
);
const secondaryFoundAccountAddress: `0x${string}` =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";

export const DiamondAddress: `0x${string}` = `0x8A791620dd6260079BF849Dc5567aDC3F2FdC318`;
//-------------------------------------------------------------------------------------------------------------

export type Init = {
  connect?: boolean;
  connectorIndex?: number;
  config: Config;
};

export const initializeRulesSdk = async ({
  connect,
  connectorIndex,
  config,
}: Init) => {
  setupConfig(config);
  if (connect && connectorIndex !== undefined) {
    await connectConfig(config, connectorIndex);
  }
};
var _config: Config;

/**
 * Test config only for use in internal SDK repo testing.
 * For actual SDK use a config should be passed in with the setupConfig function.
 */
export const createTestConfig = async (
  primary: boolean = true,
): Promise<Config> => {
  _config = createConfig({
    chains: [foundry],
    client({ chain }) {
      return createTestClient({
        chain,
        transport: http("http://127.0.0.1:8545"),
        mode: "anvil",
        account: primary ? initialAccount : secondaryAccount,
      })
        .extend(walletActions)
        .extend(publicActions);
    },
    connectors: [
      mock({
        accounts: [
          primary ? foundryAccountAddress : secondaryFoundAccountAddress,
        ],
      }),
    ],
  });
  return _config;
};

export const setupConfig = (config: Config) => {
  _config = config;
};

export const getConfig = (): Config => {
  return _config;
};

export const connectConfig = async (config: Config, connectorIndex: number) => {
  try {
    const result = await connect(config, {
      connector: config.connectors[connectorIndex],
    });
    console.log(result);
  } catch (error) {
    console.error(error);
  }
};
