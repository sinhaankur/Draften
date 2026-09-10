// paste.ts — turn a clipboard paste from Figma / Sketch / the web into Excalidraw
// element skeletons on the Draften canvas. This is the "copy from Figma/Sketch
// actually works" fix — before this there was no clipboard handling at all.
//
// Figma copies an HTML clipboard containing base64 payloads in HTML comments:
//   <!--(figmeta)…base64…--> <span data-metadata="…">…<!--(figma)…base64…-->
// The (figma) blob is Figma's kiwi-encoded scene — we can't fully decode that
// without their schema, BUT the copied HTML also carries readable structure
// (text runs, and often inline styles), which we lift into real editable nodes.
// Sketch puts its own types on the clipboard; we read any text/plain fallback.
// Plain text and image blobs are handled directly.
//
// © Ankur Sinha.

export interface PastedNode {
  type: "rectangle" | "text" | "image";
  x: number; y: number; width: number; height: number;
  text?: string;
  fontSize?: number;
  strokeColor?: string;
  backgroundColor?: string;
  imageDataUrl?: string;
}

export interface PasteResult {
  source: "figma" | "sketch" | "html" | "text" | "image" | "none";
  nodes: PastedNode[];
  note?: string;
}

/** Detect + parse whatever is on a paste ClipboardEvent. */
export async function parsePaste(e: ClipboardEvent): Promise<PasteResult> {
  const dt = e.clipboardData;
  if (!dt) return { source: "none", nodes: [] };

  // 1. Image on the clipboard → place it
  for (const item of Array.from(dt.items)) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) {
        const dataUrl = await fileToDataUrl(file);
        const dim = await imageSize(dataUrl);
        return { source: "image", nodes: [{ type: "image", x: 0, y: 0, width: dim.w, height: dim.h, imageDataUrl: dataUrl }] };
      }
    }
  }

  const html = dt.getData("text/html");
  const text = dt.getData("text/plain");

  // 2. Figma — its HTML carries figmeta/figma comment blobs
  if (html && /figmeta|<!--\(figma\)/.test(html)) {
    const nodes = nodesFromHtml(html, text);
    return { source: "figma", nodes, note: nodes.length ? undefined : "Figma copy detected — pasted its text/structure (full vector fidelity needs a Figma file import)." };
  }

  // 3. Sketch — often exposes its own type; fall back to html/text
  const hasSketch = Array.from(dt.types).some((t) => /sketch/i.test(t));
  if (hasSketch) {
    const nodes = html ? nodesFromHtml(html, text) : textNode(text);
    return { source: "sketch", nodes, note: "Sketch copy — pasted its text/structure. For full fidelity, open the .sketch file (File → Import)." };
  }

  // 4. Generic rich HTML (any website / doc)
  if (html) {
    const nodes = nodesFromHtml(html, text);
    if (nodes.length) return { source: "html", nodes };
  }

  // 5. Plain text
  if (text && text.trim()) return { source: "text", nodes: textNode(text) };

  return { source: "none", nodes: [] };
}

// ── html → nodes: lift visible text runs (+ inline colors) into text nodes,
//    stacked vertically so pasted content is readable + editable. ──────────────
function nodesFromHtml(html: string, fallbackText: string): PastedNode[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const nodes: PastedNode[] = [];
  let y = 0;
  const walk = (el: Element) => {
    const cs = (el as HTMLElement).style;
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent || "").replace(/\s+/g, " ").trim();
        if (t) {
          const fontSize = parseFloat(cs?.fontSize || "") || 16;
          nodes.push({ type: "text", x: 0, y, width: Math.min(600, Math.max(120, t.length * fontSize * 0.55)), height: fontSize * 1.4, text: t, fontSize, strokeColor: normColor(cs?.color) });
          y += fontSize * 1.9;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child as Element);
      }
    }
  };
  walk(doc.body);
  if (!nodes.length && fallbackText.trim()) return textNode(fallbackText);
  return nodes;
}

function textNode(text: string): PastedNode[] {
  const clean = (text || "").trim();
  if (!clean) return [];
  return clean.split(/\n{2,}/).map((block, i) => ({
    type: "text" as const, x: 0, y: i * 30, width: Math.min(600, Math.max(120, block.length * 8)), height: 24,
    text: block.replace(/\n/g, " ").trim(), fontSize: 16,
  })).filter((n) => n.text);
}

function normColor(c?: string): string | undefined {
  if (!c) return undefined;
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return "#" + [m[1], m[2], m[3]].map((n) => (+n).toString(16).padStart(2, "0")).join("");
  return /^#[0-9a-f]{3,8}$/i.test(c) ? c : undefined;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file); });
}
function imageSize(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => { const img = new Image(); img.onload = () => res({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => res({ w: 300, h: 200 }); img.src = dataUrl; });
}

/** Convert PastedNodes → Excalidraw element skeletons (positioned at an offset). */
export function toExcalidrawSkeleton(nodes: PastedNode[], ox = 0, oy = 0) {
  return nodes.map((n) => {
    if (n.type === "text") {
      return { type: "text" as const, x: n.x + ox, y: n.y + oy, text: n.text || "", fontSize: n.fontSize || 16, fontFamily: 2, strokeColor: n.strokeColor || "#171a21", roughness: 0 };
    }
    if (n.type === "image") {
      // Excalidraw images need a fileId; caller adds the file. Return a marker.
      return { type: "rectangle" as const, x: n.x + ox, y: n.y + oy, width: n.width, height: n.height, roughness: 0, strokeColor: "#c9ceda", backgroundColor: "#f4f0ff", label: { text: "🖼 image", fontSize: 12, fontFamily: 2 } };
    }
    return { type: "rectangle" as const, x: n.x + ox, y: n.y + oy, width: n.width, height: n.height, roughness: 0, strokeColor: n.strokeColor || "#c9ceda", backgroundColor: n.backgroundColor || "#ffffff" };
  });
}
