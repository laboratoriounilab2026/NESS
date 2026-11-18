-- Índices das listas e contadores (aditivo). Rollback: DROP INDEX de cada um abaixo.
-- CreateIndex
CREATE INDEX "EmissionAttempt_startedAt_idx" ON "EmissionAttempt"("startedAt");

-- CreateIndex
CREATE INDEX "EmissionDocument_state_idx" ON "EmissionDocument"("state");

-- CreateIndex
CREATE INDEX "EmissionOrder_state_createdAt_idx" ON "EmissionOrder"("state", "createdAt");

-- CreateIndex
CREATE INDEX "EmissionOrder_createdAt_idx" ON "EmissionOrder"("createdAt");

