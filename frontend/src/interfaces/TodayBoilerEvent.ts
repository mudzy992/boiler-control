export interface TodayBoilerEvent {
  id: number;
  userId: number;
  externalTemp: number;
  suggestedTemp: number;
  actualTemp: number | null;
  heatingStart: string | null;
  heatingEnd: string | null;
  createdAt: string;
}
