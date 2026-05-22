import { Contract, JsonRpcProvider, ethers } from "ethers";
import type { config } from "./config.js";

export async function readSecondsRemaining(
  contract: Contract,
  provider: JsonRpcProvider,
  readFunction: string,
  readMode: string,
): Promise<number> {
  const fn = contract.getFunction(readFunction);
  const raw = await fn.staticCall();

  if (readMode === "timer_expiry") {
    const expiry = typeof raw === "bigint" ? raw : BigInt(String(raw));
    const block = await provider.getBlock("latest");
    if (!block) throw new Error("Could not fetch latest block");
    const remaining = Number(expiry) - block.timestamp;
    return Math.max(0, remaining);
  }

  if (typeof raw === "bigint") return Number(raw);
  if (typeof raw === "number") return raw;
  throw new Error(`Unsupported read result for mode ${readMode}`);
}

export async function estimateKeyPriceWei(contract: Contract): Promise<bigint> {
  const [baseKeyPrice, keysSold, priceIncreasePerKey] = await Promise.all([
    contract.baseKeyPrice.staticCall() as Promise<bigint>,
    contract.keysSold.staticCall() as Promise<bigint>,
    contract.priceIncreasePerKey.staticCall() as Promise<bigint>,
  ]);
  return baseKeyPrice + keysSold * priceIncreasePerKey;
}

export function resolveBuyValueWei(
  cfg: typeof config,
  estimatedPrice: bigint,
): bigint {
  if (cfg.buyValueMon.toLowerCase() === "auto") {
    const buffered =
      (estimatedPrice * BigInt(10_000 + cfg.priceBufferBps)) / 10_000n;
    return buffered;
  }
  return ethers.parseEther(cfg.buyValueMon);
}
