import { createServer } from "node:http";
import { Contract, JsonRpcProvider, Wallet, ethers } from "ethers";
import { config } from "./config.js";
import {
  estimateKeyPriceWei,
  readSecondsRemaining,
  resolveBuyValueWei,
} from "./sybil.js";

const provider = new JsonRpcProvider(config.rpcUrl, 143);
const wallet = new Wallet(config.privateKey, provider);
const contract = new Contract(config.contractAddress, config.abi, wallet);

let polling = false;
let lastBuyHash: string | null = null;

function formatRemaining(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }
  return `${seconds}s`;
}

async function buyKeys(): Promise<string> {
  const estimated = await estimateKeyPriceWei(contract);
  const value = resolveBuyValueWei(config, estimated);
  const fn = contract.getFunction(config.buyFunction);
  const tx = await fn(config.buyTeam, config.referralRoute, { value });
  console.log(
    `Submitted ${config.buyFunction}(team=${config.buyTeam}, referral="${config.referralRoute}") value=${ethers.formatEther(value)} MON: ${tx.hash}`,
  );
  const receipt = await tx.wait();
  if (!receipt || receipt.status !== 1) {
    throw new Error(`Transaction failed: ${tx.hash}`);
  }
  console.log(`Confirmed ${config.buyFunction}: ${tx.hash}`);
  return tx.hash;
}

async function pollOnce(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const remaining = await readSecondsRemaining(
      contract,
      provider,
      config.readFunction,
      config.readMode,
    );
    const [priceWei, lastBuyer] = await Promise.all([
      estimateKeyPriceWei(contract),
      contract.lastBuyer.staticCall() as Promise<string>,
    ]);
    const weAreLastBuyer =
      ethers.getAddress(lastBuyer) === ethers.getAddress(wallet.address);

    console.log(
      `[${new Date().toISOString()}] ${formatRemaining(remaining)} left | lastBuyer=${lastBuyer}${weAreLastBuyer ? " (us)" : ""} | key ≈ ${ethers.formatEther(priceWei)} MON`,
    );

    if (remaining > config.triggerSeconds) {
      return;
    }

    if (weAreLastBuyer) {
      console.log("Under 2m but we are lastBuyer — skipping buy.");
      return;
    }

    if (!config.allowRepeatBuy && lastBuyHash) {
      console.log("Trigger met but buy already sent (ALLOW_REPEAT_BUY=false).");
      return;
    }

    console.log(
      `Trigger: ${remaining}s <= ${config.triggerSeconds}s and not lastBuyer — calling ${config.buyFunction}...`,
    );
    lastBuyHash = await buyKeys();
  } catch (err) {
    console.error("Poll error:", err instanceof Error ? err.message : err);
  } finally {
    polling = false;
  }
}

function startHealthServer(): void {
  createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        lastBuyHash,
        contract: config.contractAddress,
        wallet: wallet.address,
        buyTeam: config.buyTeam,
      }),
    );
  }).listen(config.port, () => {
    console.log(`Health check listening on :${config.port}`);
  });
}

async function main(): Promise<void> {
  const network = await provider.getNetwork();
  const balance = await provider.getBalance(wallet.address);
  const code = await provider.getCode(config.contractAddress);

  console.log("BuyKeyBot — CodenameSYBIL");
  console.log(`RPC: ${config.rpcUrl}`);
  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Wallet: ${wallet.address}`);
  console.log(`Balance: ${ethers.formatEther(balance)} MON`);
  console.log(`Game contract: ${config.contractAddress}`);
  if (code === "0x") {
    console.warn("WARNING: No bytecode at game contract — check CONTRACT_ADDRESS");
  }
  console.log(
    `Read: ${config.readFunction} (${config.readMode}) | Buy: ${config.buyFunction}(team=${config.buyTeam}, referral="${config.referralRoute}")`,
  );
  console.log(
    `Trigger: <= ${config.triggerSeconds}s, skip if lastBuyer=us | Poll: ${config.pollIntervalMs}ms`,
  );

  startHealthServer();
  await pollOnce();
  setInterval(() => {
    void pollOnce();
  }, config.pollIntervalMs);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
