import { handlers } from "@/lib/auth";

// Auth.js v5 route handler. Exposes the GET/POST endpoints under
// /api/auth/* that the framework uses for the credentials sign-in flow,
// session, and CSRF. The middleware matcher excludes /api, so this runs
// in the Node runtime where Prisma + bcrypt are available.
export const { GET, POST } = handlers;
