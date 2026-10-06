import {
  ApiError,
  acceptMyInvitation,
  getMyOrganizations,
  getMyPendingInvitations,
  getMyPermissions,
  listCheckinSessions,
  type CheckinSession,
} from '@nexaticket/ts-sdk';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/lib/api';

interface SelectableSession extends CheckinSession {
  organizationId: string;
  organizationName: string;
}

export function SessionPicker() {
  const [sessions, setSessions] = useState<SelectableSession[]>([]);
  const [invitations, setInvitations] = useState<Awaited<ReturnType<typeof getMyPendingInvitations>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitationError, setInvitationError] = useState<string | null>(null);
  const [invitationNotice, setInvitationNotice] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [hasCheckinPermission, setHasCheckinPermission] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;

    Promise.all([getMyOrganizations(api), getMyPermissions(api), getMyPendingInvitations(api)])
      .then(async ([organizations, permissions, myInvitations]) => {
        const permittedOrganizations = organizations.filter(
          (organization) =>
            organization.status === 'ACTIVE' &&
            permissions.organizations[organization.id]?.includes('CHECKIN_SCAN'),
        );
        const sessionLists = await Promise.all(
          permittedOrganizations.map(async (organization) => {
            const organizationSessions = await listCheckinSessions(api, organization.id);
            return organizationSessions.map((session) => ({
              ...session,
              organizationId: organization.id,
              organizationName: organization.name,
            }));
          }),
        );

        if (active) {
          setInvitations(myInvitations);
          setHasCheckinPermission(permittedOrganizations.length > 0);
          setSessions(sessionLists.flat().sort((first, second) => first.startsAt.localeCompare(second.startsAt)));
        }
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
      await acceptMyInvitation(api, invitationId);
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
      <View style={styles.loading}>
        <ActivityIndicator color="#D5FF66" />
        <Text style={styles.muted}>Đang tải danh sách suất...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.state}>
        <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
          <Text style={styles.retryText}>TẢI LẠI</Text>
        </Pressable>
      </View>
    );
  }

  if (sessions.length === 0 && invitations.length === 0) {
    return (
      <View style={styles.state}>
        <Text style={styles.title}>{hasCheckinPermission ? 'Chưa có suất đang diễn ra hoặc sắp diễn ra' : 'Chưa được cấp quyền soát vé'}</Text>
        <Text style={styles.muted}>
          {hasCheckinPermission
            ? 'Liên hệ ban tổ chức nếu bạn cần trực một suất cụ thể.'
            : 'Quản trị viên tổ chức cần cấp quyền CHECKIN_SCAN cho tài khoản của bạn.'}
        </Text>
        <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
          <Text style={styles.retryText}>LÀM MỚI</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.content}>
      {invitationNotice ? <Text style={styles.notice}>{invitationNotice}</Text> : null}
      {invitations.length > 0 ? (
        <View style={styles.invitations}>
          <Text style={styles.sectionTitle}>LỜI MỜI ĐANG CHỜ</Text>
          {invitations.map((invitation) => (
            <View key={invitation.id} style={styles.invitationCard}>
              <Text style={styles.organization}>{invitation.organizationName}</Text>
              <Text style={styles.invitationRole}>Vai trò: {roleLabel(invitation.role)}</Text>
              <Text style={styles.muted}>
                {invitation.expired
                  ? 'Đã hết hạn'
                  : `Hết hạn ${formatSessionDate(invitation.expiresAt)}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={invitation.expired || acceptingId !== null}
                onPress={() => void acceptInvitation(invitation.id)}
                style={({ pressed }) => [
                  styles.acceptButton,
                  pressed && styles.pressed,
                  (invitation.expired || acceptingId !== null) && styles.disabled,
                ]}
              >
                <Text style={styles.acceptText}>
                  {acceptingId === invitation.id ? 'ĐANG CHẤP NHẬN...' : 'CHẤP NHẬN LỜI MỜI'}
                </Text>
              </Pressable>
            </View>
          ))}
          {invitationError ? <Text accessibilityRole="alert" style={styles.error}>{invitationError}</Text> : null}
        </View>
      ) : null}

      {sessions.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.title}>{hasCheckinPermission ? 'Chưa có suất đang diễn ra hoặc sắp diễn ra' : 'Chưa được cấp quyền soát vé'}</Text>
          <Text style={styles.muted}>
            {hasCheckinPermission
              ? 'Liên hệ ban tổ chức nếu bạn cần trực một suất cụ thể.'
              : 'Quản trị viên tổ chức cần cấp quyền CHECKIN_SCAN cho tài khoản của bạn.'}
          </Text>
          <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
            <Text style={styles.retryText}>LÀM MỚI</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          <Text style={styles.sectionTitle}>SUẤT ĐƯỢC PHÉP SOÁT</Text>
          {sessions.map((session) => (
        <Pressable
          key={`${session.organizationId}:${session.eventSessionId}`}
          accessibilityRole="button"
          accessibilityLabel={`Soát vé ${session.eventTitle}, ${formatSessionDate(session.startsAt)}`}
          onPress={() =>
            router.push({
              pathname: '/scan',
              params: {
                eventSessionId: session.eventSessionId,
                organizationId: session.organizationId,
                eventTitle: session.eventTitle,
                venueName: session.venueName,
                startsAt: session.startsAt,
              },
            })
          }
          style={({ pressed }) => [styles.session, pressed && styles.pressed]}
        >
          <View style={styles.sessionInfo}>
            <Text style={styles.organization}>{session.organizationName}</Text>
            <Text style={styles.event}>{session.eventTitle}</Text>
            <Text style={styles.muted}>{session.venueName} · {formatSessionDate(session.startsAt)}</Text>
          </View>
          <Text style={styles.arrow}>→</Text>
        </Pressable>
          ))}
        </View>
      )}
    </View>
  );
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

function formatSessionDate(value: string) {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

const styles = StyleSheet.create({
  loading: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 10 },
  content: { gap: 18 },
  list: { gap: 9 },
  sectionTitle: { color: '#A6B1A8', fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 2 },
  invitations: { gap: 9 },
  invitationCard: { padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#536245', backgroundColor: '#20291C' },
  invitationRole: { color: '#F1F5F1', fontSize: 12, fontWeight: '700', marginTop: 6 },
  acceptButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 12, paddingHorizontal: 14, borderRadius: 7, backgroundColor: '#D5FF66' },
  acceptText: { color: '#17210D', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  disabled: { opacity: 0.5 },
  notice: { color: '#D5FF66', fontSize: 12, lineHeight: 18 },
  session: { minHeight: 86, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 8, borderWidth: 1, borderColor: '#344238', backgroundColor: '#19221B' },
  sessionInfo: { flex: 1, minWidth: 0 },
  organization: { color: '#D5FF66', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  event: { color: '#F1F5F1', fontSize: 14, fontWeight: '800', marginTop: 5 },
  arrow: { color: '#D5FF66', fontSize: 22, fontWeight: '700' },
  state: { padding: 16, borderRadius: 8, backgroundColor: '#19221B', borderWidth: 1, borderColor: '#344238' },
  title: { color: '#F1F5F1', fontSize: 14, fontWeight: '800' },
  muted: { color: '#A6B1A8', fontSize: 11, lineHeight: 17, marginTop: 5 },
  error: { color: '#FF8C79', fontSize: 12, lineHeight: 18 },
  retry: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 8 },
  retryText: { color: '#D5FF66', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  pressed: { opacity: 0.8 },
});