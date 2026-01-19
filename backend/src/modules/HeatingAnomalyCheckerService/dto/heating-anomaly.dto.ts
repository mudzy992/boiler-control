// dto/heating-anomaly.dto.ts
export class UpdateHeatingAnomalyDto {
  proposedEndTime?: Date; // korisnik može promijeniti predloženi završetak
  confirm?: boolean; // ako je true, korisnik potvrđuje trenutni predlog
}
