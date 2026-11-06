import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../services/api';
import { queryKeys } from '../../../lib/queryKeys';

export interface AppGasReading {
  id: number;
  counterValue: number;
  readingDate: string;
  createdAt: string;
  isInvoiceReference?: boolean;
  hasMeterImage?: boolean;
  hasInvoicePdf?: boolean;
  invoiceUploadedAt?: string | null;
}

/** FE2-3: one cache entry for both gas readings and gas analytics pages. */
export function useGasReadingsQuery() {
  return useQuery<AppGasReading[]>({
    queryKey: queryKeys.gasReadings,
    queryFn: async () => {
      const response = await apiClient.getGasReadings();
      return Array.isArray(response) ? (response as AppGasReading[]) : [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useGasAnalysisQuery(options: {
  useDefaultReferenceRange: boolean;
  from: string;
  to: string;
}) {
  const { useDefaultReferenceRange, from, to } = options;
  const rangeKey = useDefaultReferenceRange ? 'default-range' : `${from}-${to}`;

  return useQuery({
    queryKey: queryKeys.gasAnalysis(rangeKey),
    queryFn: async () => {
      try {
        return useDefaultReferenceRange
          ? await apiClient.getGasAnalysis()
          : await apiClient.getGasAnalysis(from, to);
      } catch (err) {
        console.error('Error fetching gas analysis:', err);
        return {};
      }
    },
    staleTime: 1000 * 60 * 5,
  });
}
