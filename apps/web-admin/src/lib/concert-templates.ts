'use client';

import {
  queryKeys,
  staleTime,
  useApiClient,
  type AdminEventDetail,
  type AdminStage,
  type AdminZoneLayout,
} from '@nexaticket/ts-sdk';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Khung sự kiện của nền tảng, nhìn từ phía tổ chức — catalog-service, `OrganizationSeatingController`.
 *
 * - `GET  /v1/organizations/{org}/concert-templates`              → `TemplateRow[]` (chỉ khung ACTIVE)
 * - `GET  /v1/organizations/{org}/concert-templates/{templateId}` → `TemplateDetail`
 * - `POST /v1/organizations/{org}/events/from-template`           → `AdminEventDetail` (nháp)
 *
 * Dựng từ khung tạo luôn địa điểm + khu + sự kiện + một suất diễn + hạng vé trong một transaction.
 * Cần `CATALOG_MANAGE`. Khu không có trong `zonePrices` thì lấy giá gợi ý của khung; khu không có
 * cả hai thì backend trả `ZONE_PRICE_REQUIRED`.
 *
 * Đặt ở app vì `@nexaticket/ts-sdk` chưa bọc các endpoint này; vẫn đi qua `ApiClient` chuẩn.
 */

export interface TemplateRow {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  status: string;
  zoneCount: number;
  capacity: number;
}

export interface TemplateZone {
  id: string;
  zoneCode: string;
  name: string;
  kind: string;
  rowCount: number | null;
  seatsPerRow: number | null;
  capacity: number | null;
  seatCount: number;
  sortOrder: number;
  suggestedPriceVnd: number | null;
  layout: AdminZoneLayout | null;
}

export interface TemplateDetail {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  status: string;
  capacity: number;
  stage: AdminStage | null;
  zones: TemplateZone[];
}

export interface CreateFromTemplateRequest {
  templateId: string;
  title: string;
  slug?: string;
  summary?: string;
  description?: string;
  category?: string;
  posterUrl?: string;
  venueName: string;
  city: string;
  address?: string;
  startsAt: string;
  endsAt?: string;
  salesOpenAt: string;
  salesCloseAt: string;
  maxSeatedPerHold?: number;
  maxStandingPerHold?: number;
  maxUnitsPerHold?: number;
  maxTicketsPerCustomer?: number;
  /** Giá theo mã khu (đồng). */
  zonePrices?: Record<string, number>;
}

const base = (organizationId: string) => `/v1/organizations/${organizationId}`;
const keys = {
  list: (organizationId: string) =>
    ['catalog', 'organizations', organizationId, 'concert-templates'] as const,
  detail: (organizationId: string, templateId: string) =>
    ['catalog', 'organizations', organizationId, 'concert-templates', templateId] as const,
};

export function useUsableTemplates(organizationId: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: keys.list(organizationId ?? ''),
    queryFn: async () =>
      (await client.get<TemplateRow[]>(`${base(organizationId as string)}/concert-templates`)).data,
    enabled: Boolean(organizationId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useUsableTemplate(organizationId: string, templateId: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: keys.detail(organizationId, templateId ?? ''),
    queryFn: async () =>
      (
        await client.get<TemplateDetail>(
          `${base(organizationId)}/concert-templates/${templateId as string}`,
        )
      ).data,
    enabled: Boolean(templateId),
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function useCreateEventFromTemplate(organizationId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateFromTemplateRequest) =>
      (await client.post<AdminEventDetail>(`${base(organizationId)}/events/from-template`, body))
        .data,
    onSuccess: (event) => {
      queryClient.setQueryData(queryKeys.catalog.event(organizationId, event.id), event);
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.events(organizationId) });
      // Dựng từ khung tạo luôn một địa điểm mới.
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.venues(organizationId) });
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog.dashboard(organizationId) });
    },
  });
}
