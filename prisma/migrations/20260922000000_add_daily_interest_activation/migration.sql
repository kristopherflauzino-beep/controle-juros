-- Migração somente aditiva: nenhum valor financeiro existente é recalculado.
-- Acordos anteriores permanecem inativos, salvo os que já possuíam uma data
-- de início e, portanto, já tinham sido ativados pela regra legada.
ALTER TABLE "Agreement"
  ADD COLUMN "dailyInterestActive" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "dailyInterestBaseAmount" DECIMAL(14,2);
