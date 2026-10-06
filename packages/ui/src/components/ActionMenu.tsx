'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { cx } from '../cx';
import styles from './action-menu.module.css';

export interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /** `danger` cho thao tác phá huỷ; luôn đặt cuối và được tách bằng vạch ngăn. */
  tone?: 'default' | 'danger';
  disabled?: boolean;
}

export interface ActionMenuProps {
  items: ActionMenuItem[];
  /** Nhãn cho trình đọc màn hình, ví dụ "Thao tác với Nguyễn Văn A". */
  label: string;
}

/**
 * Menu "⋯" cho thao tác phụ của một dòng bảng.
 *
 * Bốn nút chữ cạnh nhau ở mỗi dòng làm bảng thành một rừng chữ và đẩy cột dữ liệu sang hẹp. Gom
 * vào một menu giữ dòng gọn, và thao tác phá huỷ không còn nằm sát cạnh thao tác thường — bấm nhầm
 * "Gỡ" thay vì "Đổi vai trò" là chuyện có thật khi hai nút chỉ cách nhau vài pixel.
 *
 * Định vị bằng `position: fixed` theo toạ độ nút: bảng nằm trong khung `overflow-x: auto`, và
 * `absolute` sẽ bị chính khung đó cắt mất ở mấy dòng cuối.
 */
export function ActionMenu({ items, label }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const menuHeight = menuRef.current?.offsetHeight ?? 0;
    // Không đủ chỗ phía dưới thì mở lên trên.
    const below = rect.bottom + 4;
    const top = below + menuHeight > window.innerHeight - 8 ? rect.top - menuHeight - 4 : below;
    setPosition({ top, right: window.innerWidth - rect.right });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onScroll = () => setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    menuRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  if (items.length === 0) return null;

  const regular = items.filter((item) => item.tone !== 'danger');
  const danger = items.filter((item) => item.tone === 'danger');

  const renderItem = (item: ActionMenuItem) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      className={cx(styles.item, item.tone === 'danger' && styles.itemDanger)}
      onClick={() => {
        setOpen(false);
        item.onSelect();
      }}
    >
      {item.icon ? (
        <span className={styles.itemIcon} aria-hidden="true">
          {item.icon}
        </span>
      ) : null}
      {item.label}
    </button>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cx(styles.trigger, open && styles.triggerOpen)}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          className={styles.menu}
          style={position ? { top: position.top, right: position.right } : { visibility: 'hidden' }}
        >
          {regular.map(renderItem)}
          {regular.length > 0 && danger.length > 0 ? <div className={styles.separator} role="separator" /> : null}
          {danger.map(renderItem)}
        </div>
      ) : null}
    </>
  );
}
