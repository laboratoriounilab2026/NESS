import type { DocStatus } from "@/components/status-badge";

// ponytail: dados fictícios só para a Fase 0 (visual). Saem quando o painel ler o banco na Fase 3.
export const SAMPLE_ORDERS: {
  ref: string;
  customer: string;
  pkg: string;
  dest: string;
  value: string;
  nfse: DocStatus;
  nfe: DocStatus;
}[] = [
  { ref: "PED-2418", customer: "Marina Costa", pkg: "Ensaio gestante + álbum 30×30", dest: "Campinas/SP", value: "R$ 2.480,00", nfse: "ok", nfe: "ok" },
  { ref: "PED-2417", customer: "Studio Lume Eventos", pkg: "Casamento + álbum duplo", dest: "Belo Horizonte/MG", value: "R$ 6.900,00", nfse: "ok", nfe: "wait" },
  { ref: "PED-2416", customer: "Rafael Nogueira", pkg: "Book 15 anos + álbum 20×30", dest: "Santos/SP", value: "R$ 1.750,00", nfse: "ok", nfe: "err" },
  { ref: "PED-2415", customer: "Clínica Sorriso Pleno", pkg: "Fotos institucionais + fotolivro", dest: "Curitiba/PR", value: "R$ 3.200,00", nfse: "block", nfe: "block" },
  { ref: "PED-2414", customer: "Ana e Pedro Lima", pkg: "Newborn + caixa de fotos", dest: "São Paulo/SP", value: "R$ 1.380,00", nfse: "draft", nfe: "draft" },
];
