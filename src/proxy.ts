import { NextResponse, type NextRequest } from "next/server";

// Checagem otimista: sem cookie de sessão → login. A validação real é requireUser() no servidor.
export function proxy(request: NextRequest) {
  if (request.cookies.has("ness_session")) return NextResponse.next();
  const url = new URL("/login", request.url);
  return NextResponse.redirect(url);
}

export const config = {
  // Tudo menos login, arquivos estáticos e ícones.
  matcher: ["/((?!login|_next/static|_next/image|brand/|favicon\\.svg|icon\\.svg).*)"],
};
