# Edvance frontend

React 18 + TypeScript + Vite single-page app for students, teachers, and the public landing page.

## Setup

```bash
npm install
cp .env.example .env   # VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm run dev            # http://localhost:3000
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run the Vitest unit tests in `src/__tests__/` |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run build` | Production build into `build/` |

## Structure

- `src/components/` - screens and features. `student/`, `teacher/`, and `landing/` hold the role-specific UI; `ui/` holds Radix-based primitives.
- `src/hooks/usePyodide.ts` and `src/workers/pyodide.worker.ts` - run student Python code in a web worker.
- `src/workers/openaimod.ts` - a small `openai`-compatible shim injected into Pyodide so student code can call the backend AI proxy.
- `src/utils/authFetch.ts` - wrapper around `fetch` that attaches the Supabase session token.
- `src/index.css` - Tailwind 4 entry point and global styles.
- `landing.html` - a standalone static version of the landing page.

The UI started from a Figma Make export; see `src/Attributions.md` for third-party credits.
