import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options: CookieOptions };

/**
 * Refreshes the Supabase auth session on every request and guards
 * the /dashboard routes. Unauthenticated users hitting a protected
 * route are redirected to /login.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT: Do not run code between createServerClient and
  // getUser(). A simple mistake here makes session refresh unreliable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = request.nextUrl.pathname.startsWith("/dashboard");

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("redirectedFrom", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
