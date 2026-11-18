-- Série da DPS para emissão por aplicativo próprio: 00001 a 49999 (Anexo VI v1.04.01, campo serie:
-- 50000-69999 Emissor Móvel, 70000-79999 Emissor Web, 80000-89999 transcrição manual).
-- Rollback: recriar as duas constraints com BETWEEN 1 AND 99999.
ALTER TABLE "Establishment" DROP CONSTRAINT "Establishment_dpsSeries_check",
ADD CONSTRAINT "Establishment_dpsSeries_check" CHECK ("dpsSeries" BETWEEN 1 AND 49999);
ALTER TABLE "DpsNumber" DROP CONSTRAINT "DpsNumber_series_check",
ADD CONSTRAINT "DpsNumber_series_check" CHECK ("series" BETWEEN 1 AND 49999);
