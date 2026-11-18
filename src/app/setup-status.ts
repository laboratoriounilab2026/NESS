// O que falta para o NESS conseguir emitir. Puro: a página busca os fatos, aqui só decide o que mostrar.

export type SetupFacts = {
  establishments: number;
  nfeNumbering: boolean; // série e próximo número da NF-e configurados
  dpsNumbering: boolean; // idem DPS (NFS-e)
  certificate: boolean; // A1 encontrado, válido e do CNPJ do estabelecimento
  companyData: boolean; // endereço e IE do estabelecimento preenchidos
  nfseRule: boolean; // regra NFS-e aprovada e vigente (qualquer UF)
  nfeRule: boolean; // idem NF-e
  nfseEmitter: boolean; // adaptador registrado
  nfeEmitter: boolean;
};

export type Pendency = { text: string; who: "Administrador" | "Responsável fiscal" | "Equipe técnica"; href?: string };

export function setupPendencies(f: SetupFacts): Pendency[] {
  const cfg = "/configuracao-fiscal";
  if (f.establishments === 0) return [{ text: "Cadastrar a empresa emissora", who: "Administrador", href: cfg }];
  const out: Pendency[] = [];
  if (f.establishments > 1) out.push({ text: "Há mais de uma empresa cadastrada; a escolha por pedido ainda não existe", who: "Equipe técnica" });
  if (!f.companyData) out.push({ text: "Completar endereço e inscrição estadual da empresa", who: "Administrador", href: cfg });
  if (!f.nfseRule) out.push({ text: "Aprovar regra fiscal vigente da NFS-e (serviço)", who: "Responsável fiscal", href: cfg });
  if (!f.nfeRule) out.push({ text: "Aprovar regra fiscal vigente da NF-e (álbum)", who: "Responsável fiscal", href: cfg });
  if (!f.nfeNumbering) out.push({ text: "Configurar série e próximo número da NF-e", who: "Administrador", href: cfg });
  if (!f.dpsNumbering) out.push({ text: "Configurar série e próximo número da DPS (NFS-e)", who: "Administrador", href: cfg });
  if (!f.certificate) out.push({ text: "Configurar certificado A1 válido do CNPJ da empresa", who: "Administrador", href: cfg });
  if (!f.nfseEmitter || !f.nfeEmitter) {
    const which = [!f.nfseEmitter && "NFS-e", !f.nfeEmitter && "NF-e"].filter(Boolean).join(" e ");
    out.push({ text: `Ligar a transmissão ao governo (${which}): certificado A1 e homologação`, who: "Equipe técnica" });
  }
  return out;
}
