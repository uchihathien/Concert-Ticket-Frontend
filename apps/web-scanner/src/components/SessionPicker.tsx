'use client';

import {
  ApiError,
  acceptMyInvitation,
  getMyOrganizations,
  getMyPendingInvitations,
  getMyPermissions,
  listCheckinSessions,
  type CheckinSession,
} from '@nexaticket/ts-sdk';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { matchesSession } from '@/lib/session-search';
import styles from './session-picker.module.css';

interface SelectableSession extends CheckinSession {
  organizationId: string;
  organizationName: string;
}

type Invitations = Awaited<ReturnType<typeof getMyPendingInvitations>>;

/**
 * Chọn suất để soát — bản web của apps/mobile-scanner/components/SessionPicker.tsx.
 *
 * Cùng nguồn dữ liệu (tổ chức có quyền CHECKIN_SCAN → suất đang/sắp diễn), cùng ô tìm kiếm không
 * dấu, cùng phần lời mời đang chờ. Thay cho ô gõ tay mã suất dạng UUID của bản web cũ: nhân viên
 * không có cách nào biết mã đó, và gõ sai một ký tự là soát nhầm suất.
 */
export function SessionPicker() {
  const [sessions, setSessions] = useState<SelectableSession[]>([]);
  const [invitations, setInvitations] = useState<Invitations>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [invitationNotice, setInvitationNotice] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [hasCheckinPermission, setHasCheckinPermission] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState('');

  const visibleSessions = useMemo(
    () => sessions.filter((session) => matchesSession(session, query)),
    [sessions, query],
  );
  const searching = query.trim().length > 0;

  useEffect(() => {
    let active = true;

    Promise.all([getMyOrganizations(apiClient), getMyPermissions(apiClient), getMyPendingInvitations(apiClient)])
      .then(async ([organizations, permissions, myInvitations]) => {
        const permitted = organizations.filter(
          (organization) =>
            organization.status === 'ACTIVE' &&
            permissions.organizations[organization.id]?.includes('CHECKIN_SCAN'),
        );
        const lists = await Promise.all(
          permitted.map(async (organization) =>
            (await listCheckinSessions(apiClient, organization.id)).map((session) => ({
              ...session,
              organizationId: organization.id,
              organizationName: organization.name,
            })),
          ),
        );
        if (!active) return;
        setInvitations(myInvitations);
        setHasCheckinPermission(permitted.length > 0);
        setSessions(lists.flat().sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(
          cause instanceof ApiError && cause.status === 401
            ? 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tải danh sách suất.'
            : 'Không tải được danh sách suất diễn. Kiểm tra kết nối rồi thử lại.',
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  function retry() {
    setError(null);
    setInvitationError(null);
    setInvitationNotice(null);
    setLoading(true);
    setReload((value) => value + 1);
  }

  async function acceptInvitation(invitationId: string) {
    setAcceptingId(invitationId);
    setInvitationError(null);
    setInvitationNotice(null);
    setLoading(true);
    try {
      await acceptMyInvitation(apiClient, invitationId);
      setInvitationNotice('Đã chấp nhận lời mời. Danh sách suất đang được cập nhật.');
      setReload((value) => value + 1);
    } catch (cause) {
      setLoading(false);
      setInvitationError(
        cause instanceof ApiError && cause.code === 'EMAIL_MISMATCH'
          ? 'Lời mời được gửi tới email khác. Hãy đăng nhập bằng đúng tài khoản được mời.'
          : cause instanceof ApiError && cause.code === 'INVITATION_EXPIRED'
            ? 'Lời mời đã hết hạn. Hãy nhờ chủ tổ chức gửi lời mời mới.'
            : 'Không thể chấp nhận lời mời lúc này. Hãy thử lại.',
      );
    } finally {
      setAcceptingId(null);
    }
  }

  if (loading) {
    return (
      <div className={styles.loading} role="status">
        <span className={styles.spinner} aria-hidden="true" />
        Đang tải danh sách suất...
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.state}>
        <p className={styles.error} role="alert">
          {error}
        </p>
        <button type="button" className={styles.link} onClick={retry}>
          TẢI LẠI
        </button>
      </div>
    );
  }

  const noSessionCard = (
    <div className={styles.state}>
      <p className={styles.title}>
        {hasCheckinPermission ? 'Chưa có suất đang diễn ra hoặc sắp diễn ra' : 'Chưa được cấp quyền soát vé'}
      </p>
      <p className={styles.muted}>
        {hasCheckinPermission
          ? 'Liên hệ ban tổ chức nếu bạn cần trực một suất cụ thể.'
          : 'Quản trị viên tổ chức cần cấp quyền CHECKIN_SCAN cho tài khoản của bạn.'}
      </p>
      <button type="button" className={styles.link} onClick={retry}>
        LÀM MỚI
      </button>
    </div>
  );

  return (
    <div className={styles.content}>
      {invitationNotice ? <p className={styles.notice}>{invitationNotice}</p> : null}

      {invitations.length > 0 ? (
        <section className={styles.group}>
          <h2 className={styles.sectionTitle}>LỜI MỜI ĐANG CHỜ</h2>
          {invitations.map((invitation) => (
            <div key={invitation.id} className={styles.invitation}>
              <p className={styles.organization}>{invitation.organizationName}</p>
              <p className={styles.invitationRole}>Vai trò: {roleLabel(invitation.role)}</p>
              <p className={styles.muted}>
                {invitation.expired ? 'Đã hết hạn' : `Hết hạn ${formatSessionDate(invitation.expiresAt)}`}
              </p>
              <button
                type="button"
                className={styles.accept}
                disabled={invitation.expired || acceptingId !== null}
                onClick={() => void acceptInvitation(invitation.id)}
              >
                {acceptingId === invitation.id ? 'ĐANG CHẤP NHẬN...' : 'CHẤP NHẬN LỜI MỜI'}
              </button>
            </div>
          ))}
          {invitationError ? (
            <p className={styles.error} role="alert">
              {invitationError}
            </p>
          ) : null}
        </section>
      ) : null}

      {sessions.length === 0 ? (
        noSessionCard
      ) : (
        <section className={styles.group}>
          <h2 className={styles.sectionTitle}>SUẤT ĐƯỢC PHÉP SOÁT</h2>

          <label className={styles.searchBox}>
            <span className={styles.searchIcon} aria-hidden="true">
              ⌕
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên sự kiện, địa điểm, ngày (vd 15/10)…"
              aria-label="Tìm suất diễn"
              autoComplete="off"
              spellCheck={false}
              className={styles.searchInput}
            />
            {searching ? (
              <button type="button" className={styles.clear} aria-label="Xoá từ khoá tìm kiếm" onClick={() => setQuery('')}>
                ×
              </button>
            ) : null}
          </label>
          {searching ? (
            <p className={styles.resultCount} aria-live="polite">
              {visibleSessions.length} / {sessions.length} suất khớp · {groupByEvent(visibleSessions).length} sự kiện
            </p>
          ) : null}

          {visibleSessions.length === 0 ? (
            <div className={styles.state}>
              <p className={styles.title}>Không có suất nào khớp “{query.trim()}”</p>
              <p className={styles.muted}>Thử tên ngắn hơn, tên địa điểm hoặc ngày diễn (vd 15/10).</p>
              <button type="button" className={styles.link} onClick={() => setQuery('')}>
                XOÁ TÌM KIẾM
              </button>
            </div>
          ) : null}

          <div className={styles.grid}>
            {groupByEvent(visibleSessions).map((group) => (
              <article key={group.key} className={styles.eventCard}>
                <p className={styles.organization}>{group.organizationName}</p>
                <h3 className={styles.event}>{group.eventTitle}</h3>
                <p className={styles.muted}>{group.venueName}</p>
                <p className={styles.sessionCount}>
                  {group.sessions.length > 1 ? `${group.sessions.length} suất — chọn suất bạn trực` : '1 suất'}
                </p>
                <div className={styles.sessionList}>
                  {group.sessions.map((session) => {
                    const params = new URLSearchParams({
                      session: session.eventSessionId,
                      org: session.organizationId,
                      title: session.eventTitle,
                      venue: session.venueName,
                      startsAt: session.startsAt,
                    });
                    return (
                      <Link
                        key={session.eventSessionId}
                        href={`/scan?${params.toString()}`}
                        className={styles.sessionButton}
                        aria-label={`Soát vé ${session.eventTitle}, suất ${formatSessionDate(session.startsAt)}`}
                      >
                        <span className={styles.sessionTime}>{formatTime(session.startsAt)}</span>
                        <span className={styles.sessionDay}>{formatDay(session.startsAt)}</span>
                        <span className={styles.arrow} aria-hidden="true">
                          →
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/**
 * Gộp suất theo sự kiện: mỗi sự kiện một thẻ, các suất là nút bên trong.
 *
 * Trước đây mỗi suất là một thẻ riêng, nên sự kiện có hai suất (07/10 và 08/10) hiện thành hai thẻ
 * cùng tên chỉ khác dòng giờ nhỏ — nhìn như dữ liệu trùng và dễ bấm nhầm suất. Giữ thứ tự theo suất
 * sớm nhất của mỗi sự kiện (danh sách vào đã sắp theo giờ).
 */
function groupByEvent(sessions: SelectableSession[]) {
  const groups = new Map<string, { key: string; organizationName: string; eventTitle: string; venueName: string; sessions: SelectableSession[] }>();
  for (const session of sessions) {
    const key = `${session.organizationId}:${session.eventId}`;
    const group = groups.get(key) ?? {
      key,
      organizationName: session.organizationName,
      eventTitle: session.eventTitle,
      venueName: session.venueName,
      sessions: [],
    };
    group.sessions.push(session);
    groups.set(key, group);
  }
  return [...groups.values()];
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value));
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    ORG_OWNER: 'Chủ tổ chức',
    ORG_ADMIN: 'Quản trị tổ chức',
    EVENT_MANAGER: 'Quản lý sự kiện',
    CHECKIN_STAFF: 'Nhân viên soát vé',
  };
  return labels[role] ?? role;
}

export function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
