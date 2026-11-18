import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: sem cookie de sessão → login. A validação real é requireUser() no servidor.
export function proxy(request: NextRequest) {
  if (request.cookies.has("ness_session")) return NextResponse.next();
  const url = new URL("/login", request.url);
  const back = request.nextUrl.pathname + request.nextUrl.search;
  if (back !== "/") url.searchParams.set("next", back); // volta para o link aberto depois do login
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo menos login, arquivos estáticos e ícones.
  matcher: ["/((?!login|api/health|_next/static|_next/image|brand/|favicon\\.svg|icon\\.svg).*)"],
};
