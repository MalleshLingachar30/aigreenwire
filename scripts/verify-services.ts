import { loadEnvConfig } from "@next/env";

type ModelLike = { id?: string };

type DbModule = typeof import("../lib/db");
type ResendModule = typeof import("../lib/resend");
type ClaudeModule = typeof import("../lib/claude");

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function extractText(blocks: Array<{ type: string; text?: string }>): string {
  return blocks
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("\n")
    .trim();
}

async function verifyDatabase(dbModule: DbModule) {
  const ok = await dbModule.checkDbConnection();
  if (!ok) {
    throw new Error("Database ping failed via lib/db.ts");
  }

  const result = (await dbModule.sql`
    SELECT NOW()::text AS now_utc
  `) as Array<{ now_utc?: string }>;
  const nowUtc = result[0]?.now_utc ?? "unknown";
  console.log(`DB: OK (Neon reachable, server time ${nowUtc})`);
}

async function verifyResend(resendModule: ResendModule) {
  const editorEmail = requireEnv("EDITOR_EMAIL");
  const fromEmail = requireEnv("RESEND_FROM_EMAIL");

  const messageId = await resendModule.sendEmail({
    to: editorEmail,
    subject: `[Verify Services] Resend wrapper check ${new Date().toISOString()}`,
    html: [
      "<p>This is a controlled verification email from AI Greenwire.</p>",
      "<p>If you received this, <code>lib/resend.ts</code> is wired correctly.</p>",
    ].join(""),
    tags: [
      { name: "purpose", value: "service-verification" },
      { name: "service", value: "resend" },
    ],
  });

  console.log(
    `Resend: OK (sent to ${editorEmail} from ${fromEmail}; message id ${messageId})`
  );
  console.log(`Resend wrapper from address in use: ${resendModule.FROM_ADDRESS}`);
}

async function listAnthropicModels(): Promise<ModelLike[]> {
  const apiKey = requireEnv("ANTHROPIC_API_KEY");
  const response = await fetch("https://api.anthropic.com/v1/models", {
    method: "GET",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic model list failed (${response.status}): ${body}`);
  }

  const payload = (await response.json()) as { data?: ModelLike[] };
  return payload.data ?? [];
}

async function resolveClaudeModelId(): Promise<string> {
  const configured = process.env.ANTHROPIC_MODEL?.trim();
  if (configured) {
    return configured;
  }

  const models = await listAnthropicModels();

  const firstNonDeprecated = models.find((model) => {
    const id = model.id ?? "";
    return !id.toLowerCase().includes("deprecated");
  });

  const fallback = firstNonDeprecated?.id ?? models[0]?.id;
  if (!fallback) {
    throw new Error(
      "Anthropic returned no available models. Set ANTHROPIC_MODEL and retry."
    );
  }
  return fallback;
}

async function verifyClaude(claudeModule: ClaudeModule) {
  const model = await resolveClaudeModelId();

  const response = await claudeModule.anthropic.messages.create({
    model,
    max_tokens: 64,
    messages: [
      {
        role: "user",
        content: "Reply with exactly: hello from claude",
      },
    ],
  });

  const text = extractText(
    response.content as unknown as Array<{ type: string; text?: string }>
  );

  console.log(`Claude: OK (model ${model})`);
  console.log(`Claude reply: ${text || "[no text returned]"}`);
}

async function main() {
  loadEnvConfig(process.cwd());

  requireEnv("DATABASE_URL");
  requireEnv("RESEND_API_KEY");
  requireEnv("RESEND_FROM_EMAIL");
  requireEnv("EDITOR_EMAIL");
  requireEnv("ANTHROPIC_API_KEY");

  const [dbModule, resendModule, claudeModule] = await Promise.all([
    import("../lib/db"),
    import("../lib/resend"),
    import("../lib/claude"),
  ] as const);
  await import("../lib/supabase");

  console.log("Starting backend wrapper verification...");

  await verifyDatabase(dbModule);
  await verifyResend(resendModule);
  await verifyClaude(claudeModule);

  console.log("All service wrapper checks passed.");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Verification failed: ${message}`);
  process.exit(1);
});
