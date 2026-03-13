export const type = "kilo_local";
export const label = "Kilo CLI (local)";
export const DEFAULT_KILO_LOCAL_MODEL = "minimax/minimax-m2.5:free";

export const models = [
  { id: "minimax/minimax-m2.5:free", label: "MiniMax M2.5 (free)" },
  { id: "minimax/minimax-m2.1:free", label: "MiniMax M2.1 (free)" },
  { id: "zhipu/GLM-5:free", label: "GLM-5 (free)" },
  { id: "deepseek/DeepSeek-R1-0528:free", label: "DeepSeek R1 (free)" },
  { id: "minimax/minimax-m2.5", label: "MiniMax M2.5" },
  { id: "minimax/minimax-m2.1", label: "MiniMax M2.1" },
  { id: "qwen/Qwen3-Coder-32B", label: "Qwen3 Coder 32B" },
  { id: "auto", label: "Auto (Kilo selects best model)" },
];

export const agentConfigurationDoc = `# kilo_local agent configuration

Adapter: kilo_local

Use when:
- You want Paperclip to run the Kilo CLI locally on the host machine
- You want free AI models (MiniMax M2.5, GLM-5, DeepSeek R1)
- You want to use Kilo Gateway API with zero markup on provider costs

Don't use when:
- You need webhook-style external invocation (use http or openclaw_gateway)
- You only need a one-shot script without an AI coding agent loop (use process)
- Kilo CLI is not installed on the machine that runs Paperclip

Core fields:
- cwd (string, optional): default absolute working directory fallback for the agent process (created if missing when possible)
- instructionsFilePath (string, optional): absolute path to a markdown instructions file prepended to the run prompt
- promptTemplate (string, optional): run prompt template
- model (string, optional): Kilo model id. Defaults to minimax/minimax-m2.5:free (free tier).
- command (string, optional): defaults to "kilo"
- extraArgs (string[], optional): additional CLI args
- env (object, optional): KEY=VALUE environment variables

Operational fields:
- timeoutSec (number, optional): run timeout in seconds
- graceSec (number, optional): SIGTERM grace period in seconds

Notes:
- Kilo provides free models through their Gateway API
- Uses KILO_API_KEY from environment or run "kilo auth" to login
- Models with ":free" suffix are free tier models
`;
