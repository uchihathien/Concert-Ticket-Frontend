'use client';

import { staleTime, useApiClient, type AdminStage, type AdminZoneLayout } from '@nexaticket/ts-sdk';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

/**
 * Khung sự kiện của nền tảng — catalog-service, `PlatformTemplateController`
 * (`/v1/platform/concert-templates`). Mọi lệnh đều cần superadmin (`PlatformAccess`).
 *
 * - `GET    /`                     ?status=DRAFT|ACTIVE|ARCHIVED → `TemplateRow[]`
 * - `GET    /{id}`                                                → `TemplateDetail`
 * - `POST   /`                     `{ code, name, category, description }` → `TemplateDetail`
 * - `PATCH  /{id}`                 `{ name?, category?, description? }`    → `TemplateDetail`
 * - `PUT    /{id}/zones`           `{ stage, zones[] }` (thay cả tập)       → `TemplateDetail`
 * - `POST   /{id}/activate|archive|draft`                         → `TemplateDetail`
 * - `DELETE /{id}`                 chỉ khi chưa tổ chức nào dùng  → 204
 *
 * Đặt ở app vì `@nexaticket/ts-sdk` chưa bọc các endpoint này; vẫn đi qua `ApiClient` chuẩn.
 */

export type TemplateStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export interface TemplateRow {
  id: string;
  code: string;
  name: string;
  category: string;
  description: string | null;
  status: TemplateStatus;
  zoneCount: number;
  capacity: number;
}

export interface TemplateZone {
  id: string;
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
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
  status: TemplateStatus;
  capacity: number;
  stage: AdminStage | null;
  zones: TemplateZone[];
}

export interface TemplateZoneInput {
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  rowCount?: number | null;
  seatsPerRow?: number | null;
  capacity?: number | null;
  sortOrder?: number | null;
  suggestedPriceVnd?: number | null;
  layoutShape?: string | null;
  originX?: number | null;
  originY?: number | null;
  rotationDeg?: number | null;
  innerRadius?: number | null;
  startAngleDeg?: number | null;
  endAngleDeg?: number | null;
}

export interface TemplateStageInput {
  shape: string;
  x: number;
  y: number;
  width: number;
  height?: number | null;
}

const BASE = '/v1/platform/concert-templates';
const keys = {
  all: ['catalog', 'platform', 'concert-templates'] as const,
  list: (status: string) => ['catalog', 'platform', 'concert-templates', 'list', status] as const,
  detail: (id: string) => ['catalog', 'platform', 'concert-templates', 'detail', id] as const,
};

export function usePlatformTemplates(status: TemplateStatus | '' = '') {
  const client = useApiClient();
  return useQuery({
    queryKey: keys.list(status),
    queryFn: async () =>
      (await client.get<TemplateRow[]>(status ? `${BASE}?status=${status}` : BASE)).data,
    staleTime: staleTime.ADMIN_TABLE,
  });
}

export function usePlatformTemplate(templateId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: keys.detail(templateId),
    queryFn: async () => (await client.get<TemplateDetail>(`${BASE}/${templateId}`)).data,
    staleTime: staleTime.ADMIN_TABLE,
  });
}

/** Mọi lệnh ghi trả về chi tiết sau khi đổi: ghi thẳng vào cache, danh sách thì hỏi lại. */
function useTemplateWrite<TInput>(
  run: (client: ReturnType<typeof useApiClient>, input: TInput) => Promise<TemplateDetail>,
) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TInput) => run(client, input),
    onSuccess: (template) => {
      queryClient.setQueryData(keys.detail(template.id), template);
      void queryClient.invalidateQueries({ queryKey: [...keys.all, 'list'] });
    },
  });
}

export function useCreateTemplate() {
  return useTemplateWrite(
    async (
      client,
      body: { code: string; name: string; category: string; description?: string | null },
    ) => (await client.post<TemplateDetail>(BASE, body)).data,
  );
}

export function useUpdateTemplate(templateId: string) {
  return useTemplateWrite(
    async (client, body: { name?: string; category?: string; description?: string | null }) =>
      (await client.patch<TemplateDetail>(`${BASE}/${templateId}`, body)).data,
  );
}

export function useReplaceTemplateZones(templateId: string) {
  return useTemplateWrite(
    async (client, body: { stage: TemplateStageInput | null; zones: TemplateZoneInput[] }) =>
      (await client.put<TemplateDetail>(`${BASE}/${templateId}/zones`, body)).data,
  );
}

export function useTemplateStatus(templateId: string) {
  return useTemplateWrite(
    async (client, action: 'activate' | 'archive' | 'draft') =>
      (await client.post<TemplateDetail>(`${BASE}/${templateId}/${action}`)).data,
  );
}

export function useDeleteTemplate(templateId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await client.delete<null>(`${BASE}/${templateId}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [...keys.all, 'list'] });
    },
  });
}

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  DRAFT: 'Nháp',
  ACTIVE: 'Đang mở',
  ARCHIVED: 'Đã lưu trữ',
};

export function templateStatusTone(status: TemplateStatus): 'neutral' | 'success' | 'warn' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'ARCHIVED') return 'warn';
  return 'neutral';
}
