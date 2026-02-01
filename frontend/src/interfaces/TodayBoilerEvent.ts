export interface TodayBoilerEvent {
  id: number;
  userId: number;
  externalTemp: number;
  suggestedFlowTemp: number;
  actualFlowTemp: number | null;
  heatingStart: string | null;
  heatingEnd: string | null;
  createdAt: string;
}
