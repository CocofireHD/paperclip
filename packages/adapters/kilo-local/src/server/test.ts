import path from "node:path";
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "@paperclipai/adapter-utils";
import {
  asBoolean,
  asString,
  asStringArray,
  ensureAbsoluteDirectory,
  ensureCommandResolvable,
  ensurePathInEnv,
  parseObject,
  runChildProcess,
} from "@paperclipai/adapter-utils/server-utils";
import { DEFAULT_KILO_LOCAL_MODEL } from "../index.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

function isNonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function commandLooksLike(command: string, expected: string): boolean {
  const base = path.basename(command).toLowerCase();
  return base === expected || base === `${expected}.cmd` || base === `${expected}.exe`;
}

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const command = asString(config.command, "kilo");
  const cwd = asString(config.cwd, process.cwd());

  // Check command exists
  const commandCheck = await ensureCommandResolvable(command);
  if (commandCheck) {
    checks.push({
      level: "error",
      label: "Kilo CLI",
      detail: commandCheck,
    });
  } else {
    checks.push({
      level: "info",
      label: "Kilo CLI",
      detail: `Found: ${command}`,
    });
  }

  // Check working directory
  const cwdCheck = await ensureAbsoluteDirectory(cwd);
  if (cwdCheck) {
    checks.push({
      level: "error",
      label: "Working directory",
      detail: cwdCheck,
    });
  } else {
    checks.push({
      level: "info",
      label: "Working directory",
      detail: `Using: ${cwd}`,
    });
  }

  // Check API key or auth
  const env = { ...process.env, ...config.env };
  const hasApiKey = isNonEmpty(env.KILO_API_KEY);
  
  if (!hasApiKey) {
    checks.push({
      level: "warn",
      label: "Kilo API Key",
      detail: "No KILO_API_KEY found. Run 'kilo auth login' or set KILO_API_KEY environment variable.",
    });
  } else {
    checks.push({
      level: "info",
      label: "Kilo API Key",
      detail: "API key configured",
    });
  }

  // Try a simple version check
  if (!commandCheck) {
    try {
      const result = await runChildProcess({
        command,
        args: ["--version"],
        cwd,
        env,
        timeoutSec: 10,
        graceSec: 5,
      });

      if (result.exitCode === 0) {
        checks.push({
          level: "info",
          label: "Kilo version",
          detail: result.stdout.trim() || "installed",
        });
      } else {
        checks.push({
          level: "warn",
          label: "Kilo version",
          detail: result.stderr?.trim() || "could not get version",
        });
      }
    } catch (e: any) {
      checks.push({
        level: "warn",
        label: "Kilo version",
        detail: e.message || "could not run kilo --version",
      });
    }
  }

  return {
    status: summarizeStatus(checks),
    checks,
  };
}
