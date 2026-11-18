import data from "@/data/municipios-ibge.json";

// Tabela pública do IBGE (5.571 municípios), embarcada: nada de consulta externa com dado de cliente.
// Gerada de servicodados.ibge.gov.br/api/v1/localidades/municipios?view=nivelado em 18/11/2026,
// validada (código de 7 dígitos com prefixo da UF, sem duplicados). Atualizar se surgir município novo.

type Table = Record<string, [number, string][]>;
const TABLE = data as unknown as Table; // JSON validado na geração (ver comentário acima)

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
const index = new Map<string, Map<string, [number, string]>>();
for (const [uf, list] of Object.entries(TABLE)) index.set(uf, new Map(list.map((m) => [norm(m[1]), m])));

/** Município pelo nome na UF, sem diferenciar acento/caixa/pontuação. Devolve o nome oficial e o código IBGE. */
export function findMunicipio(uf: string, name: string): { code: string; name: string } | null {
  const m = index.get(uf)?.get(norm(name));
  return m ? { code: String(m[0]), name: m[1] } : null;
}

/** Nomes oficiais dos municípios da UF, em ordem (para a lista de sugestões do campo Cidade). */
export function municipiosOf(uf: string): string[] {
  return (TABLE[uf] ?? []).map((m) => m[1]);
}
