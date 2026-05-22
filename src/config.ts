import "dotenv/config";
import type { InterfaceAbi } from "ethers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return n;
}

function loadAbi(): InterfaceAbi {
  const path =
    process.env.CONTRACT_ABI_PATH?.trim() ?? "abi/ABI.json";
  const fullPath = resolve(process.cwd(), path);
  const parsed: unknown = JSON.parse(readFileSync(fullPath, "utf8"));
  const abi = Array.isArray(parsed)
    ? parsed
    : typeof parsed === "object" &&
        parsed !== null &&
        "abi" in parsed &&
        Array.isArray((parsed as { abi: unknown }).abi)
      ? (parsed as { abi: unknown[] }).abi
      : null;
  if (!abi) {
    throw new Error(
      `ABI file must be a JSON array or Hardhat artifact with .abi: ${fullPath}`,
    );
  }
  return abi as InterfaceAbi;
}

function resolveRpcUrl(): string {
  const explicit = process.env.MONAD_RPC_URL?.trim();
  if (explicit) return explicit;

  const drpcKey = process.env.DRPC_API_KEY?.trim();
  if (drpcKey) {
    return `https://lb.drpc.live/monad-mainnet/${drpcKey}`;
  }

  return "https://rpc.monad.xyz";
}

function optionalTeam(): number {
  const raw = process.env.BUY_TEAM?.trim() ?? "0";
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0 || n > 255) {
    throw new Error("BUY_TEAM must be an integer from 0 to 255");
  }
  return n;
}

export const config = {
  rpcUrl: resolveRpcUrl(),
  privateKey: requireEnv("PRIVATE_KEY"),
  /** CodenameSYBIL game contract (not your wallet address). */
  contractAddress:
    process.env.CONTRACT_ADDRESS?.trim() ??
    "0x1BCBC2f2Ea5262a8E410B8B03bB2b994b43A76bb",
  abi: loadAbi(),
  /** `timer()` returns round end unix timestamp; use timer_expiry to derive seconds left. */
  readFunction: process.env.READ_FUNCTION?.trim() ?? "timer",
  readMode: process.env.READ_MODE?.trim() ?? "timer_expiry",
  buyFunction: process.env.BUY_FUNCTION?.trim() ?? "buyKeys",
  buyTeam: optionalTeam(),
  referralRoute: process.env.REFERRAL_ROUTE?.trim() ?? "optimum",
  /** Fire buy when remaining time is at or below this many seconds (default: 120 = 2 min). */
  triggerSeconds: optionalInt("TRIGGER_SECONDS", 120),
  pollIntervalMs: optionalInt("POLL_INTERVAL_MS", 5_000),
  /** MON to send with buyKeys, or `auto` to use on-chain key price + buffer. */
  buyValueMon: process.env.BUY_VALUE_MON?.trim() ?? "auto",
  /** Extra MON buffer when BUY_VALUE_MON=auto (basis points, 200 = 2%). */
  priceBufferBps: optionalInt("PRICE_BUFFER_BPS", 200),
  /** Allow buying again after being sniped (recommended: true for lastBuyer logic). */
  allowRepeatBuy: process.env.ALLOW_REPEAT_BUY !== "false",
  port: optionalInt("PORT", 3000),
};
