import { NextRequest, NextResponse } from "next/server";

// OpenNext/Cloudflare does not currently support Node.js Middleware.
// Keep this legacy middleware explicitly on the Edge runtime.
export const runtime = "edge";

const MAINTENANCE_ENABLED = process.env.MAINTENANCE_MODE !== "false";

const PUBLIC_DURING_MAINTENANCE = [
  "/maintenance",
  "/scope",
  "/login",
  "/access-denied",
  "/api/auth",
  "/api/scope",
];

function isAllowedDuringMaintenance(pathname: string) {
  return PUBLIC_DURING_MAINTENANCE.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export function middleware(request: NextRequest) {
  if (!MAINTENANCE_ENABLED) return NextResponse.next();

  const { pathname } = request.nextUrl;

  if (isAllowedDuringMaintenance(pathname)) {
    return NextResponse.next();
  }

  const maintenanceUrl = request.nextUrl.clone();
  maintenanceUrl.pathname = "/maintenance";
  maintenanceUrl.search = "";

  return NextResponse.rewrite(maintenanceUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
