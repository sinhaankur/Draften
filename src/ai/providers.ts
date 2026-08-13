/**
 * The AI provider tiers — smallest/cheapest first, biggest/optional last.
 *
 * Draften's whole AI stance: you should NOT need a subscription or a cloud key to
 * generate a design system. Generating tokens + atomic components is a structured
 * task a small model (or no model) handles well. So the stack tiers up only as
 * far as the device allows / the user opts in:
 *
 *   0. Deterministic     — no model at all (ai/design-gen.ts). Always available.
 *   1. Apple Intelligence — on-device OS model (Foundation Models) where present.
 *   2. Tiny WebLLM        — a small in-browser model (WebGPU), no key, offline.
 *   3. Cloud (optional)   — Claude / OpenAI-compatible, if the user adds a key.
 *
 * Every tier implements the same `AiProvider`, so the app is indifferent to which
 * is active; `pickBestAvailable()` chooses the best the device offers.
 */

import { generateSystem, type BrandBrief } from "./design-gen";
import type { AiMessage, AiProvider, AiProviderInfo } from "./provider";

/** Capability probe: what AI can this device actually do, right now? */
export interface DeviceAiCapabilities {
  webgpu: boolean;
  appleIntelligence: boolean;
  reason: string[];
}

export async function probeDeviceAi(): Promise<DeviceAiCapabilities> {
  const reason: string[] = [];
  const webgpu = typeof navigator !== "undefined" && "gpu" in navigator;
  if (!webgpu) reason.push("No WebGPU — the tiny in-browser model can't run; using deterministic + Apple/cloud if available.");

  // Apple Intelligence (Foundation Models) is reachable from the native (Tauri)
  // shell on supported Apple silicon, surfaced to the web layer via a bridge.
  // We detect the bridge rather than sniff the UA (honest capability detection).
  const appleIntelligence =
    typeof window !== "undefined" &&
    // the Tauri shell injects this when the OS model is available
    Boolean((window as unknown as { __draftenAppleIntelligence?: boolean }).__draftenAppleIntelligence);
  if (appleIntelligence) reason.push("Apple Intelligence on-device model available.");

  return { webgpu, appleIntelligence, reason };
}

/**
 * Tier 0 — the deterministic provider. Implements `chat` as a thin shim so the
 * structured actions can call it uniformly, but its real value is that the
 * design-system actions can bypass `chat` entirely and run pure functions.
 */
export class DeterministicProvider implements AiProvider {
  info: AiProviderInfo = {
    id: "deterministic",
    label: "Built-in (no model)",
    models: ["rules-v1"],
    local: true,
  };

  async chat(messages: AiMessage[]): Promise<string> {
    // No language model. For a design brief we return a structured system as JSON
    // so callers that only speak `chat` still get usable output; the typed action
    // path (generateComponentLibrary) is preferred and returns real objects.
    const last = messages[messages.length - 1]?.content ?? "";
    const brief = briefFromPrompt(last);
    return JSON.stringify(generateSystem(brief), null, 2);
  }
}

/**
 * Tier 1 — Apple Intelligence. Talks to the on-device OS model through a Tauri
 * command bridge (`ai_apple_generate`) on supported devices. Stubbed here with
 * the call shape; the native command is added in the Rust shell.
 */
export class AppleIntelligenceProvider implements AiProvider {
  info: AiProviderInfo = {
    id: "apple-intelligence",
    label: "Apple Intelligence (on-device)",
    models: ["system"],
    local: true,
  };

  async chat(messages: AiMessage[], opts?: { onToken?: (t: string) => void }): Promise<string> {
    // Wire-up: invoke the Tauri command that calls Apple's Foundation Models.
    // Kept as a guarded dynamic call so the web-only build still type-checks.
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const text = await invoke<string>("ai_apple_generate", {
        prompt: messages.map((m) => `${m.role}: ${m.content}`).join("\n"),
      });
      opts?.onToken?.(text);
      return text;
    } catch {
      // not on an Apple-Intelligence device / not in the Tauri shell
      throw new Error("Apple Intelligence not available on this device.");
    }
  }
}

/**
 * Tier 2 — a tiny in-browser model via WebLLM (WebGPU). No key, offline once the
 * weights are cached. Loaded lazily so the app never pays the cost unless the
 * user actually invokes on-device AI. (Weights + engine are dynamically imported.)
 */
export class WebLlmProvider implements AiProvider {
  info: AiProviderInfo = {
    id: "webllm",
    label: "On-device (tiny LLM)",
    models: ["Llama-3.2-1B-Instruct", "Qwen2.5-0.5B-Instruct"],
    local: true,
  };

  private enginePromise?: Promise<unknown>;

  async chat(messages: AiMessage[], opts?: { model?: string; onToken?: (t: string) => void }): Promise<string> {
    // Lazy-init WebLLM. Dynamic import keeps the ~MBs of engine out of first load.
    // The specifier is held in a variable so the type-checker doesn't require the
    // optional dependency to be installed for the base app to compile — WebLLM is
    // only needed on devices that actually run the on-device tiny model.
    this.enginePromise ??= (async () => {
      const spec = "@mlc-ai/web-llm";
      const webllm = (await import(/* @vite-ignore */ spec).catch(() => {
        throw new Error("WebLLM not installed. Run: pnpm add @mlc-ai/web-llm");
      })) as { CreateMLCEngine: (model: string) => Promise<unknown> };
      const model = opts?.model ?? this.info.models[0];
      return webllm.CreateMLCEngine(model);
    })();
    const engine = (await this.enginePromise) as {
      chat: { completions: { create: (a: unknown) => Promise<{ choices: Array<{ message: { content: string } }> }> } };
    };
    const res = await engine.chat.completions.create({
      messages,
      temperature: 0.3,
    });
    const text = res.choices[0]?.message.content ?? "";
    opts?.onToken?.(text);
    return text;
  }
}

/** Pick the best provider the device can run, cheapest-capable first. */
export async function pickBestAvailable(): Promise<AiProvider> {
  const caps = await probeDeviceAi();
  if (caps.appleIntelligence) return new AppleIntelligenceProvider();
  if (caps.webgpu) return new WebLlmProvider();
  return new DeterministicProvider();
}

/** Extremely light NL → brief parse so `chat`-only callers still steer the gen. */
function briefFromPrompt(prompt: string): BrandBrief {
  const brand =
    prompt.match(/(?:for|brand|called)\s+["']?([A-Z][\w-]+)/)?.[1] ?? "Brand";
  const style = ["calm", "playful", "brutalist", "editorial", "bold", "minimal"].find((s) =>
    prompt.toLowerCase().includes(s),
  );
  return { brand, style };
}
