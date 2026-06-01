// Global test setup — no DOM mocks needed since lib/ tests are node-only.
// NODE_ENV is typed as a readonly literal union in newer @types/node, so assign
// through a cast instead of triggering a build-blocking type error.
(process.env as { NODE_ENV?: string }).NODE_ENV = "test";
