# Paws Racing

Online voxel arcade racer with SNES-era feel. Monorepo: client (React Three Fiber, deploys to GitHub Pages) + server (Colyseus on Fly.io) + shared schemas.

## Quickstart

```bash
pnpm install
pnpm dev
```

- Client: <http://localhost:5173>
- Server: <ws://localhost:2567>

## Layout

```
apps/
  client/   Vite + React Three Fiber + Rapier
  server/   Colyseus + Rapier (headless)
packages/
  shared/   Colyseus schemas + game constants shared by both
tools/      Asset & helper scripts (.vox -> .glb, etc.)
```

See `/Users/exponentiadev/.claude/plans/jiggly-spinning-axolotl.md` for the full architecture plan.
