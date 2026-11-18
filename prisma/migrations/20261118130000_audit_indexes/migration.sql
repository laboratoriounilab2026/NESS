-- Índices da auditoria (aditivo). Rollback: DROP INDEX "AuditEvent_at_idx"; DROP INDEX "AuditEvent_action_entityId_at_idx";
-- CreateIndex
CREATE INDEX "AuditEvent_at_idx" ON "AuditEvent"("at");

-- CreateIndex
CREATE INDEX "AuditEvent_action_entityId_at_idx" ON "AuditEvent"("action", "entityId", "at");

