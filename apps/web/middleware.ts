import { NextRequest, NextResponse } from "next/server";
import { webEnv } from "./lib/env";

const BASIC_USER = webEnv.BASIC_AUTH_USER ?? "";
const BASIC_PASS = webEnv.BASIC_AUTH_PASS ?? "";

const isAuthConfigured = BASIC_USER.length > 0 && BASIC_PASS.length > 0;

function unauthorized() {
  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="FreeSpace", charset="UTF-8"',
    },
  });
}

export function middleware(request: NextRequest) {
  const rawHost =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const apexHost = rawHost.split(",")[0]?.trim().toLowerCase().split(":")[0] ?? "";

  if (apexHost === "freespace.ie") {
    const url = request.nextUrl.clone();
    url.protocol = "https";
    url.host = "www.freespace.ie";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  if (!isAuthConfigured) return NextResponse.next();

  const { pathname } = request.nextUrl;
  if (pathname === "/health") {
    return NextResponse.next();
  }

  const auth = request.headers.get("authorization");
  if (!auth || !auth.startsWith("Basic ")) {
    return unauthorized();
  }

  try {
    const decoded = atob(auth.slice(6));
    const [user, pass] = decoded.split(":");
    if (user === BASIC_USER && pass === BASIC_PASS) {
      return NextResponse.next();
    }
  } catch {
    // fall through to unauthorized
  }

  return unauthorized();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
