# Draften — market comparison & goals

> **Positioning:** a *design-centered, dev-oriented* application with an *AI companion*.
> **Mission:** close the gap Figma / Sketch / OmniGraffle / Penpot leave open — a
> genuinely good design + collaborate tool that is **free, cross-platform, git-backed,
> open-format, and AI-assisted on-device**.

## How Draften compares

| Capability | **Draften** | Figma | Sketch | Penpot | Excalidraw | Claude Design / v0 |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Free** | ✅ | ⚠️ limited | ❌ paid | ✅ | ✅ | ⚠️ limited |
| **Open source** | ✅ MIT | ❌ | ❌ | ✅ | ✅ | ❌ |
| **Cross-platform** (Mac·Win·Linux) | ✅ | ✅ (web) | ❌ Mac-only | ✅ (web) | ✅ (web) | ✅ (web) |
| **Desktop app** (native) | ✅ | ⚠️ wrapper | ✅ | ❌ | ⚠️ | ❌ |
| **Works offline / local-first** | ✅ | ❌ | ⚠️ | ❌ server | ✅ | ❌ |
| **Git-backed** (designs in your repo) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Open file format** | ✅ `.draften.json`/`.excalidraw` | ❌ closed | ❌ closed | ✅ | ✅ | ❌ |
| **Opens others' files** (Figma/Sketch/PDF) | ✅ | ❌ | ⚠️ | ⚠️ | ❌ | ❌ |
| **Design → runnable app (code export)** | ✅ | ⚠️ plugins | ⚠️ | ⚠️ | ❌ | ✅ |
| **On-device AI** (keyless, no bills) | ✅ | ❌ cloud | ❌ | ❌ | ❌ | ❌ cloud |
| **AI design automation** (TOC, flowcharts…) | ✅ | ❌ | ❌ (scripts) | ❌ | ❌ | ⚠️ |
| **MCP server** (external AI can drive it) | ✅ | ❌ | ❌ | ⚠️ | ❌ | ❌ |
| **Real-time collaboration** | 🔜 | ✅ | ⚠️ | ✅ | ✅ | n/a |
| **No account required** | ✅ | ❌ | ❌ | ⚠️ | ✅ | ❌ |
| **Cost to the user** | **$0** | $0–15+/mo | ~$10/mo | $0 (self-host) | $0 | $0–20+/mo |

Legend: ✅ yes · ⚠️ partial / caveat · ❌ no · 🔜 planned

## The one-line read
**No single competitor combines all of Draften's green checks.** Penpot is the nearest
open-source rival but is **server-based** (not local-first, not git-backed, no on-device
AI). Draften's defensible moat = **git-backed + on-device-AI + opens-their-files + MCP**,
delivered **free** on **every platform and chip**.

## Goals

### Why (the gap we close)
A good, **free** app to *design and collaborate* — for students, indie designers, people
between jobs, anyone who can't pay the subscription. And uniquely: where your designs
**live in git like code**, and the **AI runs on your machine**.

### North-star checklist
| Goal | Status |
|---|:---:|
| Free & open source, all platforms + chips | ✅ |
| Real design tool (canvas · artboards · layers · Figma-grade inspector · styles · align) | ✅ |
| Git-backed (sign in · clone · pull · commit · PR · open designs from a repo) | ✅ |
| Opens their files (Sketch · PDF · Word · paste-from-Figma) + edit like a document | ✅ |
| Open-format save + export a runnable app | ✅ |
| On-device AI companion + keyless design automations | ✅ |
| MCP — "Draften as an MCP server" | ✅ (tools + config; stdio transport next) |
| Sketch-style pages, drag-drop open, reset view | ✅ |
| **Real-time collaboration** (live session · invite) | 🔜 |
| **Prototype interactions** (trigger → navigate, animation) | 🔜 (links shown; wiring next) |
| **Component instances** (create / update / detach) | 🔜 |
| **Expand git hosts** (GitLab · Bitbucket · any git) — GitHub = the testing ground | 🔜 |
| **PDF layout fidelity** ("keep the format") | 🔜 |

### Principles
- **Free because of how it's built** — local files, git as the backend, on-device AI. No
  servers we run, no per-use bills. Not free-until-you-need-the-good-part.
- **Your work is yours** — open formats, local-first, no lock-in, no account required.
- **Honest** — every control does something real; no hollow shells.
