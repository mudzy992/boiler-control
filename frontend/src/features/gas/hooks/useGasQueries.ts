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

/**
 * FE2-3: jedan cache zapis za obje stranice (lista i analitika).
 *
 * `limit` postoji jer backend sada straniči (`33`): 500 je gornja granica koju
 * server dozvoljava za jedan zahtjev, i dovoljna je za sva dosadašnja očitanja
 * (132). `total` iz zaglavlja kaže koliko ih je stvarno — ako je veći, ekran to
 * mora reći, a ne tvrditi da je prikazano sve.
 */
export function useGasReadingsQuery(limit = 500) {
  return useQuery<{ rows: AppGasReading[]; total: number }>({
    queryKey: queryKeys.gasReadings,
    queryFn: async () => {
      const response = await apiClient.getGasReadings({ limit });
      return {
        rows: Array.isArray(response.rows) ? (response.rows as AppGasReading[]) : [],
        total: response.total,
      };
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
