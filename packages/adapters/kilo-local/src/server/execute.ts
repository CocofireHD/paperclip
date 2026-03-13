import os from "node:os";
import path from "node:path";
import type { AdapterExecutionContext, AdapterExecutionResult } from "@paperclipai/adapter-utils";
import {
  asBoolean,
  asNumber,
  asString,
  asStringArray,
  buildPaperclipEnv,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePaperclipSkillSymlink,
  joinPromptSections,
  ensurePathInEnv,
  listPaperclipSkillEntries,
  removeMaintainerOnlySkillSymlinks,
  parseObject,
  redactEnvForLogs,
  renderTemplate,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_KILO_LOCAL_MODEL } from "../index.js";

function hasNonEmptyEnvValue(env: Record<string, string>, key: string): boolean {
  const raw = env[key];
  return typeof raw === "string" && raw.trim().length > 0;
}

function renderPaperclipEnvNote(env: Record<string, string>): string {
  const paperclipKeys = Object.keys(env)
    .filter((key) => key.startsWith("PAPERCLIP_"))
    .sort();
  if (paperclipKeys.length === 0) return "";
  return [
    "Paperclip runtime note:",
    `The following PAPERCLIP_* environment variables are available in this run: ${paperclipKeys.join(", ")}`,
    "Do not assume these variables are missing without checking your shell environment.",
    "",
    "",
  ].join("\n");
}

function renderApiAccessNote(env: Record<string, string>): string {
  if (!hasNonEmptyEnvValue(env, "PAPERCLIP_API_URL") || !hasNonEmptyEnvValue(env, "PAPERCLIP_API_KEY")) return "";
  return [
    "Paperclip API access note:",
    "Use run_shell_command with curl to make Paperclip API requests.",
    "GET example:",
    `  run_shell_command({ command: "curl -s -H \\"Authorization: Bearer $PAPERCLIP_API_KEY\\" \\"$PAPERCLIP_API_URL/api/agents/me\\"" })`,
    "POST/PATCH example:",
    `  run_shell_command({ command: "curl -s -X POST -H \\"Authorization: Bearer $PAPERCLIP_API_KEY\\" -H 'Content-Type: application/json' -H \\"X-Paperclip-Run-Id: $PAPERCLIP_RUN_ID\\" -d '{...}' \\"$PAPERCLIP_API_URL/api/issues/{id}/checkout\\"" })`,
    "",
    "",
  ].join("\n");
}

function kiloSkillsHome(): string {
  return path.join(os.homedir(), ".kilo", "skills");
}

export interface KiloAdapterConfig {
  cwd?: string;
  instructionsFilePath?: string;
  promptTemplate?: string;
  model?: string;
  command?: string;
  extraArgs?: string[];
  env?: Record<string, string>;
  timeoutSec?: number;
  graceSec?: number;
}

async function ensureKiloSkillsLink(agentId: string, context: AdapterExecutionContext): Promise<void> {
  await ensurePaperclipSkillSymlink(agentId, context, kiloSkillsHome());
}

export async function execute(
  prompt: string,
  config: KiloAdapterConfig,
  context: AdapterExecutionContext,
): Promise<AdapterExecutionResult> {
  const {
    cwd = context.defaultCwd ?? os.homedir(),
    instructionsFilePath,
    promptTemplate,
    model = DEFAULT_KILO_LOCAL_MODEL,
    command = "kilo",
    extraArgs = [],
    env: configEnv = {},
    timeoutSec = 3600,
    graceSec = 30,
  } = config;

  await ensureAbsoluteDirectory(cwd);
  await ensureCommandResolvable(command);
  await ensureKiloSkillsLink("kilo", context);

  const paperclipEnv = await buildPaperclipEnv(context);
  const env = {
    ...process.env,
    ...paperclipEnv,
    ...configEnv,
  };

  // Remove maintainer-only skills for non-maintainer runs
  if (!context.isMaintainer) {
    await removeMaintainerOnlySkillSymlinks(kiloSkillsHome());
  }

  const args = ["chat", "--model", model];

  // Add extra args if provided
  if (extraArgs.length > 0) {
    args.push(...extraArgs);
  }

  // Build the prompt with instructions
  let fullPrompt = promptTemplate ?? "";

  // Add instructions file content if provided
  if (instructionsFilePath) {
    try {
      const fs = await import("node:fs/promises");
      const instructions = await fs.readFile(instructionsFilePath, "utf-8");
      fullPrompt = `${instructions}\n\n${fullPrompt}`;
    } catch (e) {
      context.logger?.warn(`Could not read instructions file: ${instructionsFilePath}`);
    }
  }

  // Add Paperclip runtime notes
  fullPrompt = joinPromptSections([
    fullPrompt,
    renderPaperclipEnvNote(env),
    renderApiAccessNote(env),
  ]);

  // Add the actual prompt
  fullPrompt = `${fullPrompt}\n\n${prompt}`;

  context.logger?.info(`Executing Kilo with model: ${model}`);
  context.logger?.debug(`Command: ${command} ${args.join(" ")}`);
  context.logger?.debug(`Env: ${redactEnvForLogs(env)}`);

  const result = await runChildProcess({
    command,
    args,
    cwd,
    env,
    timeoutSec,
    graceSec,
    stdin: fullPrompt,
    logger: context.logger,
  });

  return {
    result: result.stdout,
    error: result.stderr || undefined,
    exitCode: result.exitCode,
  };
}

export const sessionCodec = {
  encode: (session: any) => JSON.stringify(session),
  decode: (data: string) => JSON.parse(data),
};
