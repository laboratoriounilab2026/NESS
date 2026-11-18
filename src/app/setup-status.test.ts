import { describe, expect, it } from "vitest";
import { setupPendencies, type SetupFacts } from "./setup-status";

const ready: SetupFacts = { establishments: 1, nfeNumbering: true, nfseRule: true, nfeRule: true, nfseEmitter: true, nfeEmitter: true };

describe("pendências de configuração", () => {
  it("tudo pronto: nenhuma pendência", () => expect(setupPendencies(ready)).toEqual([]));

  it("sem empresa: só pede a empresa (o resto depende dela)", () => {
    expect(setupPendencies({ ...ready, establishments: 0 })).toEqual([expect.objectContaining({ who: "Administrador" })]);
  });

  it("lista cada pendência com o responsável", () => {
    const p = setupPendencies({ ...ready, nfeRule: false, nfeNumbering: false, nfseEmitter: false, nfeEmitter: false });
    expect(p.map((x) => x.who)).toEqual(["Responsável fiscal", "Administrador", "Equipe técnica"]);
    expect(p[2].text).toContain("NFS-e e NF-e");
  });
});
