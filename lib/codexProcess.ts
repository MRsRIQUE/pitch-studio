import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

export function codexBinary(): string {
  if (process.env.PITCH_CODEX_BIN) return process.env.PITCH_CODEX_BIN;
  if (process.platform === "win32" && process.env.LOCALAPPDATA) {
    const installed = join(process.env.LOCALAPPDATA, "Programs", "OpenAI", "Codex", "bin", "codex.exe");
    if (existsSync(installed)) return installed;
  }
  return "codex";
}

export type CodexChatStatus = { installed: boolean; ready: boolean; authType: "chatgpt" | "apiKey" | null; error?: string };

/** Use the CLI's reported login method, without reading its credential files. */
export function codexChatStatus(): Promise<CodexChatStatus> {
  return new Promise(resolve => {
    const child = spawn(/* turbopackIgnore: true */ codexBinary(), ["login", "status"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    const collect = (data: Buffer) => { output = (output + data.toString()).slice(-8000); };
    child.stdout.on("data", collect);
    child.stderr.on("data", collect);
    const timer = setTimeout(() => { child.kill(); resolve({ installed: true, ready: false, authType: null, error: "O Codex demorou para responder. Tente novamente." }); }, 10000);
    child.on("error", () => { clearTimeout(timer); resolve({ installed: false, ready: false, authType: null, error: "Instale o Codex CLI neste computador para conectar sua conta." }); });
    child.on("close", code => {
      clearTimeout(timer);
      const logged = code === 0 && /^logged in/im.test(output.trim());
      const authType = logged ? (/chatgpt/i.test(output) ? "chatgpt" : "apiKey") : null;
      resolve({ installed: true, ready: logged, authType });
    });
  });
}
