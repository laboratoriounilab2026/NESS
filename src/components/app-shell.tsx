"use client";

import Link from "next/link";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import {
  Files,
  History,
  LayoutDashboard,
  LogOut,
  Scale,
  Send,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/login/actions";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

type NavItem = { label: string; Icon: LucideIcon; href?: string };

// Itens sem href ainda não existem: aparecem desativados com "em breve" em vez de levar a um 404.
const NAV: NavItem[] = [
  { label: "Visão geral", Icon: LayoutDashboard, href: "/" },
  { label: "Pedidos", Icon: ShoppingBag, href: "/pedidos" },
  { label: "Emissões", Icon: Send, href: "/emissoes" },
  { label: "Documentos", Icon: Files, href: "/documentos" },
  { label: "Rastreio", Icon: Truck, href: "/rastreio" },
  { label: "Configuração fiscal", Icon: Scale, href: "/configuracao-fiscal" },
  { label: "Auditoria", Icon: History, href: "/auditoria" },
];

// Só os componentes que leem a rota ficam em <Suspense>: rotas com parâmetro dinâmico
// (ex.: /pedidos/[id]) não sabem o caminho no prerender, e o conteúdo não pode esperar por isso.
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh lg:flex">
      <Suspense fallback={null}>
        <Sidebar />
      </Suspense>
      <div className="min-w-0 flex-1">
        <Suspense fallback={null}>
          <MobileNav />
        </Suspense>
        <main className="px-4 py-5 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

function Sidebar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <aside className="hidden w-[220px] shrink-0 flex-col gap-5 px-3 py-5 lg:flex">
      <Link
        href="/"
        className="flex items-center gap-2.5 px-2 font-display text-[19px] font-bold tracking-[0.06em]"
      >
        <Logo size={26} />
        NESS
      </Link>
      <nav aria-label="Principal" className="grid gap-0.5">
        {NAV.map(({ label, Icon, href }) => {
          const base =
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors";
          if (!href) {
            return (
              <span
                key={label}
                className={`${base} cursor-not-allowed text-muted/70`}
                aria-disabled="true"
              >
                <Icon size={18} aria-hidden="true" />
                {label}
                <span className="ml-auto text-[10.5px] uppercase tracking-wide">
                  em breve
                </span>
              </span>
            );
          }
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`${base} ${active ? "bg-fg/10 font-semibold text-fg" : "text-muted hover:bg-fg/5 hover:text-fg"}`}
            >
              <Icon size={18} aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto grid gap-1">
        <ThemeToggle />
        <form action={logout}>
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-fg/5 hover:text-fg"
          >
            <LogOut size={18} aria-hidden="true" /> Sair
          </button>
        </form>
      </div>
    </aside>
  );
}

/** Navegação compacta em telas pequenas. */
function MobileNav() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <header className="flex items-center gap-3 overflow-x-auto border-b border-line px-4 py-3 lg:hidden">
      <Link
        href="/"
        className="flex shrink-0 items-center gap-2 font-display font-bold tracking-[0.06em]"
      >
        <Logo size={22} />
        NESS
      </Link>
      {NAV.filter((n) => n.href).map(({ label, href }) => (
        <Link
          key={label}
          href={href!}
          aria-current={pathname === href ? "page" : undefined}
          className="shrink-0 rounded-md px-2 py-1 text-sm text-muted aria-[current=page]:bg-fg/10 aria-[current=page]:text-fg"
        >
          {label}
        </Link>
      ))}
    </header>
  );
}
