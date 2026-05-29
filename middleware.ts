// Auth checks live in the (app) route group layout. We don't run middleware
// because the database adapter is Node-only and middleware is Edge-only.
export const config = { matcher: [] };
export default function middleware() {
  return;
}
