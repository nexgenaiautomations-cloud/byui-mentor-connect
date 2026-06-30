// Global test setup — no DOM mocks needed since lib/ tests are node-only.
// NODE_ENV is typed as a readonly literal union in newer @types/node, so assign
// through a cast instead of triggering a build-blocking type error.
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";

// Stub the `server-only` package that ships with Next.js. It's only resolvable
// inside Next's build, so unit tests that import modules guarded by it need a
// no-op stand-in. Setting via vi.mock here applies to every test file.
import { vi } from "vitest";
vi.mock("server-only", () => ({}));
