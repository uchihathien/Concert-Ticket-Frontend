/**
 * `packages/ui` — component dùng chung cho 4 app.
 *
 * Export theo tên, không có barrel side-effect: `web-scanner` có ngân sách 150KB JS và chỉ được
 * kéo về đúng thứ nó dùng (plan/frontend.md §11).
 */
export { coverGradient } from './cover';
export { cx } from './cx';

export { errorCopy, errorMessage, isKnownErrorCode } from './errors';
export type { ApiErrorLike, ErrorCopy, ErrorDisplay } from './errors';

export {
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTime,
  formatVnd,
} from './format';

export { Badge } from './components/Badge';
export type { BadgeProps, BadgeTone } from './components/Badge';

export { BrandLogo } from './components/BrandLogo';
export type { BrandLogoProps, BrandLogoVariant } from './components/BrandLogo';

export { Button } from './components/Button';
export type { ButtonProps, ButtonVariant } from './components/Button';

export { CarouselRow } from './components/CarouselRow';
export type { CarouselRowProps } from './components/CarouselRow';

export { CategoryChips } from './components/CategoryChips';
export type { CategoryChipItem, CategoryChipsProps } from './components/CategoryChips';

export { Countdown } from './components/Countdown';
export type { CountdownProps } from './components/Countdown';

export { CopyField } from './components/CopyField';
export type { CopyFieldProps } from './components/CopyField';

export { Drawer, Modal } from './components/Dialog';
export type { DrawerProps, ModalProps } from './components/Dialog';

export { EmptyState } from './components/EmptyState';
export type { EmptyStateProps } from './components/EmptyState';

export { EventCard } from './components/EventCard';
export type { EventCardProps } from './components/EventCard';

export { ErrorState } from './components/ErrorState';
export type { ErrorStateProps } from './components/ErrorState';

export { Input } from './components/Input';
export type { InputProps } from './components/Input';

export { MoneyText } from './components/MoneyText';
export type { MoneyTextProps } from './components/MoneyText';

export { Select } from './components/Select';
export type { SelectOption, SelectProps } from './components/Select';

export { SignInHighlights, SignInScreen } from './components/SignInScreen';
export type { SignInHighlightsProps, SignInScreenProps } from './components/SignInScreen';
export { GoogleButton } from './components/GoogleButton';
export type { GoogleButtonProps } from './components/GoogleButton';

export { Skeleton } from './components/Skeleton';
export type { SkeletonProps } from './components/Skeleton';

export { Table } from './components/Table';
export type { TableColumn, TableProps } from './components/Table';

export { ToastProvider, useToast } from './components/Toast';
export type { ToastInput, ToastTone } from './components/Toast';

export { useCountdown } from './hooks/useCountdown';
export type { CountdownOptions, CountdownState } from './hooks/useCountdown';
