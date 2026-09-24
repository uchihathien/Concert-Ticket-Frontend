/**
 * `packages/ui` — component dùng chung cho 4 app.
 *
 * Export theo tên, không có barrel side-effect: `web-scanner` có ngân sách 150KB JS và chỉ được
 * kéo về đúng thứ nó dùng (plan/frontend.md §11).
 */
export { EVENT_CATEGORIES, EVENT_CATEGORY_FILTERS, eventCategoryLabel } from './categories';
export type { EventCategory } from './categories';

export {
  PRICE_FILTERS,
  TIME_FILTERS,
  priceRange,
  quickFilterParams,
  timeRange,
  vnDayRange,
} from './quick-filters';
export type { QuickFilterOption } from './quick-filters';

export {
  AUDIT_ACTION_LABELS,
  auditActionFilters,
  auditActionLabel,
  auditActionTone,
} from './audit';

export { ROLE_LABELS, roleLabel, roleTone } from './roles';

export { foldText, matchesText } from './search';

export { coverGradient } from './cover';
export { cx } from './cx';

export { errorCopy, errorMessage, isKnownErrorCode, publishBlockerLabel } from './errors';
export type { ApiErrorLike, ErrorCopy, ErrorDisplay } from './errors';

export {
  formatDate,
  formatDateLong,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatTime,
  formatVnd,
  isoToVnLocal,
  vnLocalToIso,
} from './format';

export { SeatMapCanvas } from './components/SeatMapCanvas';
export type { SeatMapCanvasProps, SeatMark } from './components/SeatMapCanvas';

export { AccountScreen, AccountSection } from './components/AccountScreen';
export type { AccountScreenProps, AccountSectionProps } from './components/AccountScreen';

export { AppShell, BrandSuffix, PageHeader, Panel } from './components/AppShell';
export type { AppNavItem, AppShellProps, PageHeaderProps } from './components/AppShell';

export { AuditChange } from './components/AuditChange';
export type { AuditChangeProps } from './components/AuditChange';

export { AuthOptions } from './components/AuthOptions';
export type { AuthOptionsProps } from './components/AuthOptions';

export { BarChart } from './components/BarChart';
export type { BarChartProps, BarChartRow } from './components/BarChart';

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

export {
  FilterBar,
  Pagination,
  RowActions,
  Section,
  StatCard,
  StatGrid,
} from './components/Dashboard';
export type {
  FilterBarProps,
  PaginationProps,
  SectionProps,
  StatCardProps,
} from './components/Dashboard';

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
export { EventCardSkeleton } from './components/EventCardSkeleton';
export type { EventCardSkeletonProps } from './components/EventCardSkeleton';

export { ErrorState } from './components/ErrorState';
export type { ErrorStateProps } from './components/ErrorState';

export { DetailRows, IdentityCard } from './components/IdentityCard';
export type { DetailRow, DetailRowsProps, IdentityCardProps } from './components/IdentityCard';

export { Input } from './components/Input';
export type { InputProps } from './components/Input';

export { MoneyText } from './components/MoneyText';
export type { MoneyTextProps } from './components/MoneyText';

export { PageSkeleton } from './components/PageSkeleton';
export type { PageSkeletonProps } from './components/PageSkeleton';

export { PosterImage } from './components/PosterImage';
export type { PosterImageProps } from './components/PosterImage';

export { QrCode } from './components/QrCode';
export { QrPanel } from './components/QrPanel';
export type { QrPanelProps } from './components/QrPanel';
export type { QrCodeProps } from './components/QrCode';

export { Select } from './components/Select';
export type { SelectOption, SelectProps } from './components/Select';

export { SignInHighlights, SignInScreen } from './components/SignInScreen';
export type { SignInHighlightsProps, SignInScreenProps } from './components/SignInScreen';
export { GoogleButton } from './components/GoogleButton';
export type { GoogleButtonProps } from './components/GoogleButton';

export { SignOutForm } from './components/SignOutForm';
export type { SignOutFormProps } from './components/SignOutForm';

export { Skeleton } from './components/Skeleton';
export type { SkeletonProps } from './components/Skeleton';

export { TicketPoster, downloadPoster } from './components/TicketPoster';
export type { TicketPosterProps } from './components/TicketPoster';

export { Table } from './components/Table';
export type { TableColumn, TableProps, TableSort } from './components/Table';

export { ToastProvider, useToast } from './components/Toast';
export type { ToastInput, ToastTone } from './components/Toast';

export { useDebouncedValue } from './hooks/useDebouncedValue';
export { useCountdown } from './hooks/useCountdown';
export type { CountdownOptions, CountdownState } from './hooks/useCountdown';
