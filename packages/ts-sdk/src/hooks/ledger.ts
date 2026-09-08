'use client';

import { useQuery } from '@tanstack/react-query';
import { getOrganizationBalance, getTrialBalance } from '../api/ledger';
import { queryKeys, staleTime } from '../query/keys';
import { useApiClient } from '../query/provider';

export function useTrialBalance() {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.ledger.trialBalance(),
    queryFn: () => getTrialBalance(client),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useOrganizationBalance(organizationId: string | null | undefined) {
  const client = useApiClient();
  return useQuery({
    queryKey: queryKeys.ledger.organizationBalance(organizationId ?? ''),
    queryFn: () => getOrganizationBalance(client, organizationId as string),
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}
