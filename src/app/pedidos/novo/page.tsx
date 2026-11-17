import type { Metadata } from "next";
import { OrderWizard } from "./order-wizard";

export const metadata: Metadata = { title: "Novo pedido" };

export default function NovoPedido() {
  return (
    <div className="grid gap-3.5">
      <header className="reveal">
        <h1 className="font-display text-[clamp(26px,3vw,36px)] font-bold tracking-[-0.02em]">Novo pedido</h1>
        <p className="text-muted">Um pedido gera a NFS-e do serviço e a NF-e do álbum. Os dados fiscais vêm das regras aprovadas.</p>
      </header>
      <OrderWizard />
    </div>
  );
}
