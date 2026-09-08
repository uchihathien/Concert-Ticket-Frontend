import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../components/Button';
import { ErrorState } from '../components/ErrorState';
import { Table } from '../components/Table';

describe('Button', () => {
  it('khoá nút khi đang gửi — bấm hai lần không tạo hai request', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Giữ chỗ
      </Button>,
    );

    const button = screen.getByRole('button', { name: /giữ chỗ/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');

    await userEvent.click(button, { pointerEventsCheck: 0 });
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('ErrorState', () => {
  it('hiện câu tiếng Việt, mã ở dòng phụ, và mã tra cứu', () => {
    render(
      <ErrorState
        error={{ code: 'SEAT_UNAVAILABLE' }}
        correlationId="c-123"
        onRetry={() => undefined}
      />,
    );

    expect(screen.getByText('Ghế vừa được người khác giữ')).toBeInTheDocument();
    expect(screen.getByText('SEAT_UNAVAILABLE')).toBeInTheDocument();
    expect(screen.getByText(/c-123/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
  });

  it('lỗi không thử lại được thì không mời người dùng bấm lại', () => {
    render(<ErrorState error={{ code: 'CUSTOMER_LIMIT_EXCEEDED' }} onRetry={() => undefined} />);
    expect(screen.queryByRole('button', { name: 'Thử lại' })).not.toBeInTheDocument();
  });
});

describe('Table', () => {
  interface Row {
    id: string;
    name: string;
  }

  const columns = [{ key: 'name', header: 'Tên', cell: (row: Row) => row.name }];

  it('bảng rỗng hiện trạng thái rỗng thay vì thân bảng trắng', () => {
    render(
      <Table<Row>
        caption="Tổ chức"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        emptyTitle="Chưa có tổ chức nào"
      />,
    );

    expect(screen.getByText('Chưa có tổ chức nào')).toBeInTheDocument();
  });

  it('đang tải thì đánh dấu aria-busy và không hiện trạng thái rỗng', () => {
    render(
      <Table<Row>
        caption="Tổ chức"
        columns={columns}
        rows={[]}
        rowKey={(row) => row.id}
        loading
        emptyTitle="Chưa có tổ chức nào"
      />,
    );

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.queryByText('Chưa có tổ chức nào')).not.toBeInTheDocument();
  });
});
