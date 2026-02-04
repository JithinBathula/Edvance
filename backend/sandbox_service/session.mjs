import { CodeSandbox } from "@codesandbox/sdk";
import dotenv from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const normalizeSessionId = (value) => {
  if (!value) return "anonymous";
  const raw = String(value);
  if (raw.length <= 20) return raw;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 20);
};

const readStdin = async () => {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
};

const main = async () => {
  const apiTokenRaw = process.env.CODESANDBOX_API_TOKEN || process.env.CSB_API_KEY;
  if (!apiTokenRaw) {
    throw new Error("CODESANDBOX_API_TOKEN is not set");
  }
  if (typeof apiTokenRaw !== "string") {
    throw new Error("CODESANDBOX_API_TOKEN must be a string");
  }
  const apiToken = apiTokenRaw.trim();

  const inputRaw = await readStdin();
  const input = inputRaw ? JSON.parse(inputRaw) : {};

  const sandboxId = input.sandboxId || null;
  const templateId = input.templateId;
  const userId = normalizeSessionId(input.userId);

  if (!templateId && !sandboxId) {
    throw new Error("templateId is required when no sandboxId is provided");
  }

  const sdk = new CodeSandbox(apiToken);

  let sandbox;
  if (sandboxId) {
    sandbox = await sdk.sandboxes.resume(sandboxId);
  } else {
    sandbox = await sdk.sandboxes.create({ id: templateId, privacy: "private" });
  }

  const session = await sandbox.createBrowserSession({ id: userId });

  process.stdout.write(JSON.stringify({ sandboxId: sandbox.id, session }));
};

main().catch((error) => {
  process.stderr.write(error?.message || String(error));
  process.exit(1);
});
