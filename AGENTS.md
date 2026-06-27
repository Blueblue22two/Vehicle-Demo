# Repository Guidelines

## Project Structure & Module Organization

This repository is currently documentation-first. Product requirements live in `docs/`; architecture decisions and the implementation backlog live in `memory_bank/`. Treat the PRD as the product contract and `memory_bank/technology-stack.md` as the technical baseline.

Planned application structure:

- `src/app/` and `src/components/`: page shell and UI.
- `src/domain/vehicle/`: types, state machine, and command executor.
- `src/features/` and `src/scene/`: input features and the 3D scene.
- `public/models/` and `tests/e2e/`: licensed models and browser scenarios.

## Build, Test, and Development Commands

The application has not been scaffolded yet; these commands become required when task `NC-001` is implemented:

- `npm ci`: install the exact locked dependencies.
- `npm run dev`: start the Vite development server.
- `npm run build`: type-check and build for production.
- `npm run test`: run Vitest unit and component tests.
- `npm run test:e2e`: run Playwright browser tests.
- `npm run validate:model`: verify the model and four window nodes.
- `npm run check`: run all quality gates.

## Coding Style & Naming Conventions

Use strict TypeScript, two-space indentation, semicolons, and single quotes. Let Prettier and ESLint settle formatting. Components use `PascalCase`, hooks use `useCamelCase`, and functions use `camelCase`. Keep PRD identifiers (`frontLeft`, `frontRight`, `rearLeft`, `rearRight`) unchanged. Model nodes use snake case, for example `window_front_left`.

All pointer, voice, and text actions must produce a `VehicleCommand`; do not mutate 3D or UI state directly from input components.

## Testing Guidelines

Name unit/component tests `*.test.ts(x)` and browser scenarios `*.spec.ts`. Cover parsing, idempotency, animation locks, recovery, and all-window partial execution. Mock speech in automation; test a real microphone manually in Chrome. Changes must remain traceable to PRD criteria `AC-01`–`AC-16`.

## Commit & Pull Request Guidelines

There is no Git history yet. Use Conventional Commits, such as `feat(scene): add window raycasting`. Keep commits focused; exclude unlicensed assets and build output.

Pull requests must include a summary, task IDs, validation results, and linked acceptance criteria. Add screenshots or recordings for visual changes and license details for asset changes.

## Security & Asset Compliance

Never commit credentials or cloud speech keys. Start microphone access only after explicit user action. Package runtime assets locally and record the author, source, and license for every model, texture, font, and icon.

## Task Execution Workflow

Every `memory_bank/task-list.md` implementation must follow `memory_bank/stage_workflow.md`. Delegate code and fixes to Sub-agents as specified, review their work, run checks, synchronize task statuses, and save the report with `memory_bank/report_template.md`.
