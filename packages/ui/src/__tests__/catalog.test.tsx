import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CategoryChips } from '../components/CategoryChips';
import { EventCard } from '../components/EventCard';

// `next/link` cần bộ định tuyến của Next; ở test chỉ cần nó vẽ ra một thẻ <a> thật.
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('EventCard', () => {
  it('hiện đủ bốn dòng theo đúng thứ tự quy định', () => {
    render(
      <EventCard
        href="/events/dem-nhac"
        title="Đêm nhạc Mùa Thu"
        dateLabel="01/11/2026"
        venueLabel="Hà Nội"
        fromPriceVnd={500_000}
      />,
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', '/events/dem-nhac');
    expect(screen.getByRole('heading', { name: 'Đêm nhạc Mùa Thu' })).toBeInTheDocument();
    expect(screen.getByText('01/11/2026 · Hà Nội')).toBeInTheDocument();
    expect(screen.getByText(/^Từ/)).toHaveTextContent('500.000');
  });

  it('chưa có giá thì nói "Chưa mở bán" thay vì hiện 0 ₫', () => {
    render(
      <EventCard
        href="/events/x"
        title="Sự kiện chưa mở bán"
        dateLabel="20/12/2026"
        venueLabel="Hà Nội"
        fromPriceVnd={null}
      />,
    );

    expect(screen.getByText('Chưa mở bán')).toBeInTheDocument();
    expect(screen.queryByText(/0\s*₫/)).not.toBeInTheDocument();
  });
});

describe('CategoryChips', () => {
  const items = [
    { value: 'all', label: 'Tất cả' },
    { value: 'nhac-song', label: 'Nhạc sống' },
  ];

  it('chip là link, giữ được bộ lọc trên URL', () => {
    render(
      <CategoryChips
        items={items}
        activeValue="nhac-song"
        hrefFor={(value) => (value === 'all' ? '/events' : `/events?category=${value}`)}
      />,
    );

    expect(screen.getByRole('link', { name: 'Tất cả' })).toHaveAttribute('href', '/events');
    const active = screen.getByRole('link', { name: 'Nhạc sống' });
    expect(active).toHaveAttribute('href', '/events?category=nhac-song');
    expect(active).toHaveAttribute('aria-current', 'page');
  });
});
