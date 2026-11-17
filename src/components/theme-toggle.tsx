"use client";

import { SunMoon } from "lucide-react";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const isDark = root.dataset.theme
      ? root.dataset.theme === "dark"
      : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = isDark ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("ness-theme", next);
    } catch {
      // Armazenamento bloqueado: o tema vale só nesta visita.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-fg/5 hover:text-fg"
    >
      <SunMoon size={18} aria-hidden="true" />
      Alternar tema
    </button>
  );
}
