import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";
const COOKIE_NAME = "cinescope_token";

/**
 * Proxy all /api/backend/* requests to the Express server.
 * - Extracts JWT from httpOnly cookie and forwards as Bearer token
 * - On auth responses (login/register), sets the JWT as httpOnly cookie
 * - On logout, clears the cookie
 */
async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  const backendPath = path.join("/");
  const url = `${BACKEND_URL}/${backendPath}`;

  // Build headers — forward Content-Type, extract JWT from cookie
  const headers: Record<string, string> = {
    "Content-Type": req.headers.get("content-type") || "application/json",
  };

  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Forward the request to Express
  const fetchOptions: RequestInit = {
    method: req.method,
    headers,
  };

  // Forward body for non-GET requests
  if (req.method !== "GET" && req.method !== "HEAD") {
    try {
      const body = await req.text();
      if (body) {
        fetchOptions.body = body;
      }
    } catch {
      // No body — that's fine
    }
  }

  try {
    const backendRes = await fetch(url, fetchOptions);
    const data = await backendRes.json();

    const response = NextResponse.json(data, { status: backendRes.status });

    // On 401 from backend: clear stale cookie so client knows session is gone
    if (backendRes.status === 401 && token) {
      response.cookies.delete(COOKIE_NAME);
    }

    // Handle auth responses — set/clear cookie
    if (backendPath === "auth/login" || backendPath === "auth/register") {
      if (backendRes.ok && data.token) {
        response.cookies.set(COOKIE_NAME, data.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 7, // 7 days
        });
      }
    }

    if (backendPath === "auth/logout") {
      response.cookies.delete(COOKIE_NAME);
    }

    return response;
  } catch (err) {
    console.error(`[proxy] Error forwarding to ${url}:`, err);
    return NextResponse.json(
      { error: "Backend nicht erreichbar." },
      { status: 502 }
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
export const PATCH = proxyRequest;
