import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "NESS", template: "%s · NESS" },
  description: "Emissão encadeada de NFS-e e NF-e a partir de um único pedido.",
};

// Aplica o tema salvo antes da pintura para evitar flash. ponytail: localStorage é preferência por navegador; vira preferência do usuário quando houver login (Fase 7).
const themeScript = `try{var t=localStorage.getItem("ness-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${spaceGrotesk.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
