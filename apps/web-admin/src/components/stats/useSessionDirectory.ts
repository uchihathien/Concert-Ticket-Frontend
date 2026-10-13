'use client';

import { useStatsSessions } from '@nexaticket/ts-sdk';
import { useMemo } from 'react';

export interface SessionInfo {
  eventId: string;
  eventTitle: string;
  startsAt: string;
  endsAt: string | null;
}

/**
 * Tra tên sự kiện và giờ diễn của từng suất.
 *
 * Số liệu thống kê chỉ mang mã suất; danh bạ này (một request cho cả tổ chức, gồm cả suất đã diễn
 * xong) là nơi đổi mã thành thứ người đọc hiểu được.
 */
export function useSessionDirectory(organizationId: string) {
  const query = useStatsSessions(organizationId);

  const sessions = useMemo(() => {
    const map = new Map<string, SessionInfo>();
    for (const session of query.data ?? []) {
      map.set(session.eventSessionId, {
        eventId: session.eventId,
        eventTitle: session.eventTitle,
        startsAt: session.startsAt,
        endsAt: session.endsAt,
      });
    }
    return map;
  }, [query.data]);

  return { sessions, loading: query.isPending };
}
