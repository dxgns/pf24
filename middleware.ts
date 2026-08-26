import { NextRequest, NextResponse } from "next/server";

// OpenNext/Cloudflare requires Edge Middleware rather than Node.js Middleware.
// With Next.js 15, the supported runtime identifier is `experimental-edge`.
export const runtime = "experimental-edge";

// Maintenance is OFF by default. It is enabled only when the environment
// variable is explicitly set to "true".
const MAINTENANCE_ENABLED = process.env.MAINTENANCE_MODE === "true";

const PUBLIC_DURING_MAINTENANCE = [
  "/maintenance",
  "/scope",
  "/login",
  "/access-denied",
  "/api/auth",
  "/api/pf24/roblox",
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
