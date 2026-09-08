'use client';

import { Button, type ButtonProps } from '@nexaticket/ui';
import { useFormStatus } from 'react-dom';

/**
 * Nút submit biết form đang gửi.
 *
 * Chuyển hướng sang Keycloak mất một nhịp mạng. Không khoá nút trong nhịp đó thì người dùng bấm
 * thêm vài lần, và mỗi lần bấm mở một luồng OIDC mới với `state` mới — lần quay về sẽ mang state
 * không khớp và hỏng ở bước cuối.
 */
export function SubmitButton({ children, ...rest }: ButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button {...rest} type="submit" loading={pending}>
      {children}
    </Button>
  );
}
