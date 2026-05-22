# BuyKeyBot

Bot for **CodenameSYBIL** on **Monad** (chain ID `143`). It watches the round `timer()` and calls `buyKeys(team, referralRoute)` when **≤ 2 minutes** remain and **our wallet is not `lastBuyer`** (configurable).

## How it works

1. Connects to Monad via JSON-RPC.
2. Reads `timer()` (unix timestamp when the round ends) and computes **seconds remaining**.
3. Reads on-chain key price: `baseKeyPrice + keysSold * priceIncreasePerKey`.
4. When remaining time is **≤ `TRIGGER_SECONDS`** (default `120`) and **`lastBuyer()` ≠ our wallet**, sends **`buyKeys`**.
5. If we are already `lastBuyer`, skips (already winning). If someone snipes us, can buy again (`ALLOW_REPEAT_BUY=true` by default).
6. Health endpoint on `PORT` for Railway.

**Contract:** `0x1BCBC2f2Ea5262a8E410B8B03bB2b994b43A76bb` (not your wallet address).

Your wallet (e.g. `0x5f6a0B0Ea6942CA4E057c6f0Ee41157E0DD7CBE1`) is only used via `PRIVATE_KEY` to sign transactions.

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your contract, ABI, and private key
```

ABI: `abi/ABI.json` (Hardhat artifact format is supported).

```bash
npm run dev    # local
npm run build && npm start
```

## Environment variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | yes | — | Wallet private key (funds gas + payable buy) |
| `PRIVATE_KEY` | yes | — | Wallet that signs `buyKeys` |
| `CONTRACT_ADDRESS` | no | SYBIL mainnet | Game contract |
| `MONAD_RPC_URL` | no | public Monad RPC | Full RPC URL (e.g. dRPC) |
| `DRPC_API_KEY` | no | — | Alternative: only the dRPC key segment |
| `CONTRACT_ABI_PATH` | no | `abi/ABI.json` | ABI file |
| `READ_FUNCTION` | no | `timer` | View function |
| `READ_MODE` | no | `timer_expiry` | `timer_expiry` = seconds until `timer` |
| `BUY_FUNCTION` | no | `buyKeys` | Write function |
| `BUY_TEAM` | no | `0` | `SybilState.Team` enum (uint8) |
| `REFERRAL_ROUTE` | no | `optimum` | Referral string passed to `buyKeys` |
| `TRIGGER_SECONDS` | no | `120` | Buy when remaining ≤ this many seconds |
| `POLL_INTERVAL_MS` | no | `5000` | Poll interval |
| `BUY_VALUE_MON` | no | `auto` | MON to send, or `auto` for on-chain price |
| `PRICE_BUFFER_BPS` | no | `200` | Extra buffer when `auto` (200 = 2%) |
| `ALLOW_REPEAT_BUY` | no | `true` | Buy again if sniped after our purchase |
| `PORT` | no | `3000` | Health check port |

## Deploy to Railway

1. Push this repo to GitHub.
2. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub** → select this repo.
3. **Variables** → add everything from `.env.example` (use Railway secrets for `PRIVATE_KEY`).
4. Railway runs `npm ci && npm run build` then `npm start` (see `railway.toml`).
5. Optional: add a **health check** path `/` on the service port.

For production, use a dedicated RPC (e.g. [dRPC Monad mainnet](https://drpc.org)) and set `MONAD_RPC_URL` or `DRPC_API_KEY` in Railway variables — never commit keys to git.

## Teams

`BUY_TEAM` is the `SybilState.Team` uint8 passed to `buyKeys`. Your past txs used team `0`; change if you play on another team.

## Security

- Never commit `.env` or private keys.
- Use a dedicated hot wallet with only the MON you need for gas and buys.
- Test on a small amount first; failed txs still cost gas.
