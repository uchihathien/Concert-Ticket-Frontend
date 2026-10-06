'use client';

import { ApiError, useAcceptInvitation } from '@nexaticket/ts-sdk';
import { Button, ErrorState, Input, PageHeader, Panel } from '@nexaticket/ui';
import { Check, LogIn } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';

const PENDING_INVITATION_KEY = 'nexaticket.pending-invitation';

interface AcceptInvitationFormProps {
  authenticated: boolean;
  email: string | null;
}

export default function AcceptInvitationForm({
  authenticated,
  email,
}: AcceptInvitationFormProps) {
  const router = useRouter();
  const acceptInvitation = useAcceptInvitation();
  const [token, setToken] = useState('');
  const [failure, setFailure] = useState<unknown>(null);

  useEffect(() => {
    if (!authenticated) return;
    try {
      setToken(window.sessionStorage.getItem(PENDING_INVITATION_KEY) ?? '');
    } catch {
      setFailure(new Error('Không thể đọc mã mời đã lưu trong phiên trình duyệt.'));
    }
  }, [authenticated]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const invitationToken = token.trim();
    if (!invitationToken) return;
    setFailure(null);

    if (!authenticated) {
      try {
        window.sessionStorage.setItem(PENDING_INVITATION_KEY, invitationToken);
        window.location.assign(
          `/login?returnUrl=${encodeURIComponent('/invitations/accept')}`,
        );
      } catch {
        setFailure(new Error('Không thể lưu mã mời. Hãy thử lại trong cửa sổ trình duyệt bình thường.'));
      }
      return;
    }

    acceptInvitation.mutate(invitationToken, {
      onSuccess: (organization) => {
        try {
          window.sessionStorage.removeItem(PENDING_INVITATION_KEY);
        } catch {
          // Việc chấp nhận đã thành công; không giữ người dùng lại nếu không dọn được cache tab.
        }
        router.replace(`/?org=${encodeURIComponent(organization.id)}`);
      },
      onError: setFailure,
    });
  };

  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10 sm:py-16">
      <PageHeader
        title="Chấp nhận lời mời"
        description={
          authenticated
            ? 'Nhập mã bạn nhận được để tham gia tổ chức.'
            : 'Nhập mã lời mời. Bạn sẽ đăng nhập trước khi tham gia tổ chức.'
        }
      />

      <Panel>
        <form onSubmit={submit} className="grid gap-4">
          {authenticated && email ? (
            <p className="m-0 text-[13px] text-muted">
              Đang đăng nhập bằng <strong>{email}</strong>. Email này phải trùng với email nhận lời mời.
            </p>
          ) : null}
          <Input
            label="Mã lời mời"
            name="token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            autoComplete="off"
            required
            disabled={acceptInvitation.isPending}
          />
          {failure instanceof ApiError ? (
            <ErrorState
              error={failure}
              correlationId={failure.correlationId}
            />
          ) : failure instanceof Error ? (
            <p role="alert" className="m-0 text-sm text-danger">
              {failure.message}
            </p>
          ) : null}
          <Button type="submit" loading={acceptInvitation.isPending}>
            {authenticated ? (
              <>
                <Check size={18} aria-hidden="true" />
                Chấp nhận lời mời
              </>
            ) : (
              <>
                <LogIn size={18} aria-hidden="true" />
                Đăng nhập để tiếp tục
              </>
            )}
          </Button>
        </form>
      </Panel>
    </main>
  );
}