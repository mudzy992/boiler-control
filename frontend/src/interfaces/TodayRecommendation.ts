export interface TodayRecommendation {
  id: number;
  userId: number;
  date: string;
  source: string;
  recommendedFlowTemp: number;
  expectedHeatTimeMin?: number;
  confidenceScore: number;
  createdAt?: string;
}
