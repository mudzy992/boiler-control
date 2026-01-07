export interface TodayRecommendation {
  id: number;
  userId: number;
  date: string;
  recommendedFlowTemp: number;
  expectedHeatTimeMin?: number;
  confidenceScore: number;
  createdAt?: string;
}
