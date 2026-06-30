import "./bootstrap-env.js";
import { config as loadEnv } from "dotenv";
import path from "node:path";
import {
  scValToNative,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";
import { runScript } from "./tx-helpers.js";

const __dirname = path.dirname(path.resolve(process.argv[1] ?? "."));
const projectRoot = path.resolve(__dirname, "../..");

loadEnv({ path: path.join(projectRoot, ".env") });
loadEnv({ path: path.join(projectRoot, "sdk", ".env"), override: false });

const {
  RPC_URL = "https://soroban-testnet.stellar.org",
  ENCRYPTED_TOKEN_CONTRACT_ID,
  EVENT_LEDGER_WINDOW = "5000",
  EVENT_LIMIT = "50",
} = process.env;

type TopicFilter = "all" | "register" | "xfer" | "mint" | "vk";

async function main(): Promise<void> {
  if (!ENCRYPTED_TOKEN_CONTRACT_ID) {
    throw new Error("Missing ENCRYPTED_TOKEN_CONTRACT_ID env var");
  }

  const args = parseArgs(process.argv.slice(2));
  const topic = (args.topic ?? args._[0] ?? "all") as TopicFilter;
  const positionalTxHash = args._[1] && isTxHash(args._[1]) ? args._[1] : undefined;
  const txHash = args.tx ?? positionalTxHash;
  const server = new rpc.Server(RPC_URL);
  const latest = await server.getLatestLedger();
  const positionalLedgerWindow = args._[1] && !isTxHash(args._[1]) ? args._[1] : undefined;
  const window = Number(args.ledgerWindow ?? positionalLedgerWindow ?? EVENT_LEDGER_WINDOW);
  const startLedger = args.startLedger
    ? Number(args.startLedger)
    : Math.max(1, latest.sequence - window);
  const endLedger = args.endLedger ? Number(args.endLedger) : latest.sequence;

  const response = await server.getEvents({
    startLedger,
    endLedger,
    filters: [
      {
        type: "contract",
        contractIds: [ENCRYPTED_TOKEN_CONTRACT_ID],
      },
    ],
    limit: Number(args.limit ?? EVENT_LIMIT),
  });

  const events = response.events
    .map((event) => ({ event, decoded: decodeEvent(event) }))
    .filter(({ decoded }) => topic === "all" || decoded.kind === topic)
    .filter(({ event }) => !txHash || event.txHash === txHash);

  console.log(
    `Events for ${ENCRYPTED_TOKEN_CONTRACT_ID} ledgers ${startLedger}..${endLedger}${txHash ? ` tx ${txHash}` : ""}: ${events.length}`,
  );

  for (const { event, decoded } of events) {
    console.log(JSON.stringify({
      id: event.id,
      ledger: event.ledger,
      txHash: event.txHash,
      kind: decoded.kind,
      topics: normalize(decoded.topics),
      value: normalize(decoded.value),
    }, null, 2));
  }
}

function decodeEvent(event: rpc.Api.EventResponse): {
  kind: string;
  topics: unknown[];
  value: unknown;
} {
  const topics = event.topic.map(decodeScVal);
  return {
    kind: String(topics[1] ?? topics[0] ?? "unknown"),
    topics,
    value: decodeScVal(event.value),
  };
}

function decodeScVal(value: xdr.ScVal): unknown {
  try {
    return scValToNative(value);
  } catch {
    return value.toXDR("base64");
  }
}

function parseArgs(args: string[]): Record<string, string> & { _: string[] } {
  const parsed: Record<string, string> & { _: string[] } = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      parsed[key] = args[i + 1] && !args[i + 1].startsWith("--")
        ? args[++i]
        : "true";
    } else {
      parsed._.push(arg);
    }
  }
  return parsed;
}

function isTxHash(value: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(value);
}

function normalize(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value.toString();
  }
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return `0x${Buffer.from(value).toString("hex")}`;
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, normalize(entry)]),
    );
  }
  return value;
}

runScript(main);
