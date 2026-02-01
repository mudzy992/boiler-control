export interface GasReading {
  id: number;
  userId: number;
  readingDate: string;
  counterValue: number;
  consumption: number | null;
  createdAt: string;
}

export interface CreateGasReadingDto {
  counterValue: number;
  readingDate: string;
}

export interface GasEfficiencyAnalysis {
  period: {
    from: string;
    to: string;
  };
  totalGas: number;
  totalHeatingHours: number;
  avgFlowTemp: number;
  efficiency: {
    m3PerHour: number;
    label: string;
  };
}
