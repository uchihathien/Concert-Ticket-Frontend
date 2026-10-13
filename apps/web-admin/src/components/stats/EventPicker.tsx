'use client';

import { foldText, matchesText } from '@nexaticket/ui';
import { Check, ChevronDown, Search } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

export interface EventOption {
  id: string;
  title: string;
  hint?: string;
}

/**
 * Chọn một hoặc nhiều sự kiện — thay cho cặp ô "Tìm sự kiện" + "Sự kiện" trước đây.
 *
 * Hai ô cũ làm cùng một việc theo hai cách và có thể mâu thuẫn nhau (gõ tên sự kiện A trong khi ô
 * chọn đang ở sự kiện B thì bảng trống, không có gì nói vì sao). Ở đây ô tìm kiếm nằm TRONG danh
 * sách: nó chỉ thu hẹp cái đang nhìn, còn bộ lọc luôn là tập đã đánh dấu.
 *
 * Không chọn gì nghĩa là mọi sự kiện.
 */
export function EventPicker({
  options,
  selected,
  onChange,
  loading,
}: {
  options: EventOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  const chosen = useMemo(() => new Set(selected), [selected]);
  const visible = useMemo(() => {
    const needle = foldText(query.trim());
    return options.filter((option) => matchesText(needle, [option.title, option.hint]));
  }, [options, query]);

  const summary =
    selected.length === 0
      ? 'Tất cả sự kiện'
      : selected.length === 1
        ? (options.find((option) => option.id === selected[0])?.title ?? '1 sự kiện')
        : `${selected.length} sự kiện`;

  function toggle(id: string) {
    onChange(chosen.has(id) ? selected.filter((item) => item !== id) : [...selected, id]);
  }

  return (
    <div ref={root} className="relative grid min-w-0 gap-1.5">
      <span id={labelId} className="text-[13px] font-semibold text-ink">
        Sự kiện
      </span>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={labelId}
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-nt border border-border bg-surface px-3 text-left text-[14px] text-ink hover:bg-hover"
      >
        <span className="truncate">{loading ? 'Đang tải…' : summary}</span>
        <ChevronDown size={16} aria-hidden="true" className="flex-none text-muted" />
      </button>

      {open ? (
        <div
          id={panelId}
          className="absolute top-full left-0 z-30 mt-1 grid w-[min(22rem,calc(100vw-2rem))] gap-2 rounded-nt border border-border bg-elevated p-2 shadow-nt-card"
        >
          <label className="flex items-center gap-2 rounded-nt border border-border bg-surface px-2">
            <Search size={15} aria-hidden="true" className="flex-none text-muted" />
            <span className="sr-only">Tìm sự kiện</span>
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tìm theo tên sự kiện hoặc địa điểm"
              className="h-9 w-full min-w-0 border-0 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
            />
          </label>

          <ul role="group" aria-labelledby={labelId} className="m-0 grid max-h-64 list-none gap-0.5 overflow-y-auto p-0">
            {visible.length === 0 ? (
              <li className="px-2 py-3 text-[13px] text-muted">Không có sự kiện nào khớp.</li>
            ) : (
              visible.map((option) => {
                const checked = chosen.has(option.id);
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggle(option.id)}
                      className="flex w-full items-center gap-2 rounded-nt border-0 bg-transparent px-2 py-1.5 text-left text-[14px] text-ink hover:bg-hover"
                    >
                      <span
                        aria-hidden="true"
                        className={`grid size-4 flex-none place-items-center rounded-[4px] border ${
                          checked ? 'border-primary bg-primary text-primary-ink' : 'border-border'
                        }`}
                      >
                        {checked ? <Check size={12} strokeWidth={3} /> : null}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{option.title}</span>
                        {option.hint ? <span className="block truncate text-[12px] text-muted">{option.hint}</span> : null}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="flex items-center justify-between border-t border-border pt-2 text-[13px]">
            <span className="text-muted">
              {selected.length === 0 ? 'Đang xem mọi sự kiện' : `Đã chọn ${selected.length}`}
            </span>
            <button
              type="button"
              disabled={selected.length === 0}
              onClick={() => onChange([])}
              className="rounded-nt border-0 bg-transparent px-2 py-1 font-semibold text-primary-text hover:bg-hover disabled:text-muted disabled:hover:bg-transparent"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
