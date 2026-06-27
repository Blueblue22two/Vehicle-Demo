# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NeoCabin 3D 智舱车控 Demo — a desktop web demo of intelligent cockpit vehicle window control via a 3D car model. Users control four windows through three input modes: clicking the 3D model, Chinese voice commands (Web Speech API), and text input. All inputs converge into a single `VehicleCommand` protocol dispatched through a unified Zustand state machine.

**Tech stack:** React 19 + TypeScript 6 + Vite 8, Three.js via React Three Fiber + Drei, Zustand for state, Vitest + Testing Library + Playwright for testing.

## Essential Commands

```bash
npm ci                    # Install exact locked dependencies
npm run dev               # Start Vite dev server
npm run build             # Type-check then production build
npm run preview           # Preview production build locally
npm run typecheck         # TypeScript check only (no emit)
npm run lint              # ESLint
npm run format:check      # Prettier check
npm run test              # Run Vitest unit/component tests
npm run test:e2e          # Run Playwright browser tests
npm run validate:model    # Validate vehicle model (nodes, bounds, license)
npm run check             # Full quality gate: typecheck + lint + format + test + build
```

**Running a single test file:**

```bash
npm run test -- src/domain/vehicle/vehicleStore.test.ts
npm run test -- src/features/command/commandParser.test.ts
npm run test:e2e -- --grep "camera|drag"
```

## Architecture & Data Flow

```
Pointer click ─┐
Voice result  ─┼─> parseVehicleCommand() ─> VehicleCommand ─> executeCommand()
Text input   ─┘                                                    │
                                                                    v
                                                            VehicleState (Zustand)
                                                              │           │
                                                              v           v
                                                           3D animation   UI/feedback
```

**Directory boundaries (`src/`):**

| Directory           | Responsibility                                                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/`              | Entry point (`main.tsx`), page shell (`App`), global styles                                                                                            |
| `domain/vehicle/`   | Types (`types.ts`), state machine + command executor (`vehicleStore.ts`). **Single source of truth** — all state changes go through `executeCommand()` |
| `features/command/` | Chinese text normalization and `parseVehicleCommand()` — a pure function, no DOM/store access                                                          |
| `features/voice/`   | `SpeechRecognition` adapter (planned, not yet implemented)                                                                                             |
| `scene/`            | React Three Fiber Canvas, 3D model loading, lights, camera, window animations                                                                          |
| `components/`       | Status panel, text input, feedback UI                                                                                                                  |
| `test/`             | Test setup (jsdom + jest-dom matchers)                                                                                                                 |
| `types/`            | Browser API type augmentations                                                                                                                         |

**Core types** (from `src/domain/vehicle/types.ts`):

- `WindowId`: `'frontLeft' | 'frontRight' | 'rearLeft' | 'rearRight'`
- `WindowState`: `'open' | 'closed' | 'transitioning'`
- `VehicleCommand`: `{ source, target, action }` — the **only protocol** for changing vehicle state
- `CommandExecutionResult`: `{ command, status, started, skipped, alreadySatisfied }`

**State machine rules** (from `vehicleStore.ts`):

- All windows start `closed`
- A window in `transitioning` rejects new commands for itself (returns `blocked`)
- `allWindows` commands skip `transitioning` windows and return `partial` when some are skipped
- Already-satisfied commands return `noop` (no duplicate animation)
- Failed animations roll back via `failWindowTransition()` to the previous stable state
- The store never holds Three.js objects — only domain state

## Task Workflow (for implementing NC-\* tasks)

The project has a defined stage workflow in `memory_bank/stage_workflow.md`. Key points:

1. **Read context first:** `AGENTS.md`, PRD (`docs/3d-vehicle-control-demo-prd.md`), `memory_bank/technology-stack.md`, `memory_bank/task-list.md`, stage workflow, and report template.
2. **Work one task at a time**, in order, respecting dependencies. P0 tasks must all be `DONE` before starting P1.
3. **Delegate to Sub-agents** for well-scoped code work. Main agent reviews all Sub-agent output, runs verification, and handles integration.
4. **Save a report** to `memory_bank/reports/<TASK-ID>.md` using the template in `memory_bank/report_template.md`.
5. **Update status** in both the task list overview AND the task detail sections in `memory_bank/task-list.md`.

## Coding Conventions

- **TypeScript strict mode** with `noUnusedLocals` and `noUnusedParameters`
- **Prettier**: single quotes, semicolons, 2-space indent, trailing commas (`all`)
- Components: `PascalCase`; hooks: `useCamelCase`; functions/utilities: `camelCase`
- PRD identifiers (`frontLeft`, `frontRight`, `rearLeft`, `rearRight`) must remain unchanged in code
- 3D model nodes use snake_case: `window_front_left`, `window_front_right`, `window_rear_left`, `window_rear_right`
- All pointer, voice, and text actions must produce a `VehicleCommand` — never mutate 3D or UI state directly from input components
- Commits use Conventional Commits format: `feat(scene): add window raycasting`

## Testing

- Unit/component tests: `*.test.ts(x)` under `src/`, run with Vitest + jsdom
- E2E tests: `*.spec.ts` under `tests/e2e/`, run with Playwright (Chromium)
- Test setup at `src/test/setup.ts` adds `@testing-library/jest-dom` matchers
- Mock speech in automation; real microphone testing is manual in Chrome
- Changes must remain traceable to PRD acceptance criteria `AC-01` through `AC-16`

## Key Constraints

- **Desktop Chrome only** for voice features; other browsers use click/text fallback
- **`localhost` or HTTPS** required for Web Speech API
- **Node >=22 <25**, npm >=10
- All static assets must be **locally packaged** — no CDN dependencies at runtime
- Model assets must have documented **source, author, and license**; unlicensed assets are forbidden
- Vehicle model at `public/models/vehicle.glb` must pass `npm run validate:model`
- Never commit credentials, cloud speech keys, or unlicensed assets
- Microphone access only starts after explicit user action (button click)
