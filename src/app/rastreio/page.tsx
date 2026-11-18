import type { Metadata } from "next";
import { Lock, Plug } from "lucide-react";

export const metadata: Metadata = { title: "Rastreio" };

// Recurso opcional por empresa: só ativa com contrato Correios configurado (docs/PLANO_NESS.md › Rastreio).
// ponytail: nesta fase nenhuma empresa tem integração, então a tela mostra sempre o estado desativado.
// O mapa + linha do tempo (protótipo 22) entra quando existir a integração e a tabela de envios.
export default function Rastreio() {
  return (
    <div className="grid gap-3.5">
      <section className="reveal relative overflow-hidden rounded-tile bg-ink p-6 text-ink-fg sm:p-8">
        <h1 className="font-display text-[clamp(26px,3vw,38px)] font-bold leading-tight tracking-[-0.02em]">
          Rastreio de <span className="text-accent">entregas</span>
        </h1>
        <p className="mt-1.5 text-ink-muted">Do estúdio até o destinatário, com o status vindo dos Correios.</p>
      </section>

      <section className="reveal grid justify-items-start gap-3.5 rounded-tile border border-line bg-surface p-6 sm:p-8" style={{ ["--i" as string]: 1 }}>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-draft/25 bg-draft/12 py-0.5 pl-2 pr-2.5 text-[12.5px] font-semibold text-draft">
          <Lock size={14} aria-hidden="true" /> Rastreio desativado
        </span>
        <h2 className="font-display text-2xl font-bold text-balance">Ative o rastreio com o seu contrato dos Correios</h2>
        <p className="max-w-[60ch] text-muted">
          A API de rastreio dos Correios só funciona para empresas com contrato comercial, e só mostra pacotes postados nesse
          contrato. Sem contrato, este recurso fica desligado. A emissão das notas funciona normalmente.
        </p>
        <ol className="grid list-decimal gap-1 pl-5 text-muted">
          <li>Um administrador gera o código de acesso no portal Correios Web Services (CWS).</li>
          <li>Informa o contrato e o cartão de postagem ao NESS (a tela de integrações ainda será criada).</li>
          <li>O NESS testa a conexão no ambiente de homologação antes de ativar.</li>
        </ol>
        <button type="button" disabled aria-describedby="rastreio-indisponivel" className="inline-flex cursor-not-allowed items-center gap-2 rounded-xl bg-fg px-4 py-2.5 font-semibold text-bg opacity-80">
          <Plug size={18} aria-hidden="true" /> Configurar integração com os Correios
        </button>
        <small id="rastreio-indisponivel" className="text-muted">Em breve: a integração ainda não foi implementada. Quando existir, somente administradores poderão configurá-la.</small>
      </section>
    </div>
  );
}
