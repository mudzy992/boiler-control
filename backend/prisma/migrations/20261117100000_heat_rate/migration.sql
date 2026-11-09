-- Brzina dogrijavanja (`29`): neto nagib uspona po ciklusu grijanja, uz
-- polaznu i sobnu temperaturu pri kojima je izmjeren.
--
-- Aditivna migracija. Bez ovih kolona nema tvrdog `T_max` ograničenja: vrijeme
-- do cilja se ne može izračunati iz nagiba `s` (on opisuje gubitke, ne brzinu).

ALTER TABLE "DailyRecord"
  ADD COLUMN "heatRateCPerHour" DOUBLE PRECISION,
  ADD COLUMN "heatRateFlowC" DOUBLE PRECISION,
  ADD COLUMN "heatRateRoomC" DOUBLE PRECISION;
