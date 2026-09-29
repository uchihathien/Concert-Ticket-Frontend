'use client';

import {
  ApiError,
  floorPlanRect,
  floorPlanViewBox,
  outlinePath,
  useConfigureVenueZones,
  useFloorPlanPreview,
  type AdminVenue,
  type ConfigureZonesRequest,
  type FloorPlan,
  type LayoutShape,
  type StageShape,
  type ZoneInput,
} from '@nexaticket/ts-sdk';
import { Button, ErrorState, Input, Select, Skeleton, cx, useDebouncedValue, useToast } from '@nexaticket/ui';
import { useCallback, useMemo, useRef, useState } from 'react';
import styles from './floor-plan-editor.module.css';

export interface FloorPlanEditorProps {
  organizationId: string;
  venue: AdminVenue;
  onSaved: () => void;
}

const STAGE_SHAPES: Array<{ value: StageShape; label: string }> = [
  { value: 'RECTANGLE', label: 'Hộp chữ nhật' },
  { value: 'CIRCLE', label: 'Tròn giữa khán phòng' },
  { value: 'THRUST', label: 'Nhô ra (chữ U)' },
];

const LAYOUT_SHAPES: Array<{ value: LayoutShape; label: string }> = [
  { value: 'GRID', label: 'Khối chữ nhật' },
  { value: 'ARC', label: 'Cung tròn' },
];

/**
 * Trình sửa sơ đồ khán phòng.
 *
 * <h3>Frontend không tính một toạ độ nào</h3>
 *
 * Mọi thứ vẽ ra đây đều đến từ `…/floor-plan/preview` của backend — cùng phép tính sẽ chạy lúc
 * publish. Chép công thức trong `ZoneLayout` sang TypeScript sẽ nhanh hơn một lời gọi mạng, nhưng
 * nó tạo bản cài đặt thứ hai của cùng phép tính, và bản lệch là bản ban tổ chức nhìn thấy lúc
 * quyết định mua 5.000 chỗ ngồi.
 *
 * <h3>Kéo cho vị trí, số cho góc</h3>
 *
 * Vị trí là thứ khổ sở khi nhập bằng số và dễ khi kéo. Góc quét và bán kính thì ngược lại: kéo ra
 * một cung 137° là tai nạn, gõ 140 thì không. Nên mỗi thứ dùng cách nhập hợp với nó.
 *
 * <h3>Khu chưa đặt vị trí</h3>
 *
 * Bản nháp gửi lên có thể thiếu `layout` — bố cục tự động xếp khu ấy xuống dưới sân khấu. Nhưng
 * bản **xem trước trả về** luôn có `layout` đã giải, nên lần kéo đầu tiên ghim khu tại đúng chỗ nó
 * đang đứng thay vì làm nó nhảy về gốc toạ độ.
 */
export function FloorPlanEditor({ organizationId, venue, onSaved }: FloorPlanEditorProps) {
  const toast = useToast();
  const save = useConfigureVenueZones(organizationId, venue.id);

  const [draft, setDraft] = useState<ConfigureZonesRequest>(() => initialDraft(venue));
  const [selected, setSelected] = useState<string | null>(venue.zones[0]?.zoneCode ?? null);

  // Xem trước chậm lại một nhịp: kéo một khu bắn ra hàng chục lần cập nhật, và mỗi lần là một lời
  // gọi mạng nếu không có bước này.
  const settled = useDebouncedValue(draft, 250);
  const preview = useFloorPlanPreview(organizationId, venue.id, settled);

  const zone = draft.zones.find((item) => item.zoneCode === selected) ?? null;

  const patchZone = useCallback(
    (zoneCode: string, patch: Partial<ZoneInput>) => {
      setDraft((current) => ({
        ...current,
        zones: current.zones.map((item) =>
          item.zoneCode === zoneCode ? { ...item, ...patch } : item,
        ),
      }));
    },
    [],
  );

  async function commit() {
    try {
      await save.mutateAsync(draft);
      toast.show({ tone: 'success', message: 'Đã lưu sơ đồ' });
      onSaved();
    } catch (error) {
      toast.showError(error instanceof ApiError ? error : null);
    }
  }

  return (
    <div className={styles.layout}>
      <div className={styles.canvasColumn}>
        {preview.isPending ? (
          <Skeleton height={360} />
        ) : preview.isError ? (
          // 422 ở đây gần như luôn là bản nháp chưa hợp lệ — cung thiếu bán kính, góc quét ngược.
          // Thông báo của backend nói đúng chỗ sai, nên hiện nguyên văn thay vì diễn giải lại.
          <ErrorState
            error={preview.error instanceof ApiError ? preview.error : null}
            onRetry={() => void preview.refetch()}
          />
        ) : (
          <PlanCanvas
            plan={preview.data}
            selected={selected}
            onSelect={setSelected}
            onMove={(zoneCode, originX, originY) => {
              const current = preview.data.zones.find((item) => item.zoneCode === zoneCode);
              if (!current) return;
              // Ghim bằng bố cục ĐÃ GIẢI: khu đang ở chế độ tự xếp sẽ giữ nguyên hình dạng và góc
              // của nó, chỉ đổi chỗ đứng.
              patchZone(zoneCode, {
                layout: {
                  shape: current.layout.shape,
                  originX,
                  originY,
                  rotationDeg: current.layout.rotationDeg ?? undefined,
                  innerRadius: current.layout.innerRadius ?? undefined,
                  startAngleDeg: current.layout.startAngleDeg ?? undefined,
                  endAngleDeg: current.layout.endAngleDeg ?? undefined,
                },
              });
            }}
          />
        )}
        <p className={styles.hint}>
          Kéo một khu để đổi chỗ. Góc quét và bán kính nhập ở cột bên phải.
        </p>
      </div>

      <div className={styles.controls}>
        <StageControls
          stage={draft.stage}
          onChange={(stage) => setDraft((current) => ({ ...current, stage }))}
        />

        <section className={styles.group}>
          <h3 className={styles.groupTitle}>Khu vực</h3>
          <div className={styles.zoneTabs}>
            {draft.zones.map((item) => (
              <button
                key={item.zoneCode}
                type="button"
                className={cx(styles.zoneTab, item.zoneCode === selected && styles.zoneTabOn)}
                onClick={() => setSelected(item.zoneCode)}
              >
                {item.zoneCode}
              </button>
            ))}
          </div>

          {zone ? (
            <ZoneControls zone={zone} onChange={(patch) => patchZone(zone.zoneCode, patch)} />
          ) : null}
        </section>

        <div className={styles.actions}>
          <Button loading={save.isPending} onClick={() => void commit()}>
            Lưu sơ đồ
          </Button>
          <Button variant="secondary" onClick={() => setDraft(initialDraft(venue))}>
            Về như cũ
          </Button>
        </div>

        {/*
          Nói trước hậu quả, không để người dùng phát hiện sau khi bấm. Hai cửa chặn này nằm ở
          `ConfigureVenueZonesHandler`, và lỗi nó trả về đọc rất khó hiểu nếu không biết luật.
        */}
        <p className={styles.warning}>
          Lưu sơ đồ sẽ bị từ chối nếu địa điểm này đã có sự kiện từng lên bán — tồn kho bên
          Inventory đã dựng theo đúng những mã khu hiện tại. Rút sự kiện xuống trước.
        </p>
      </div>
    </div>
  );
}

// --- khung vẽ ---------------------------------------------------------------

function PlanCanvas({
  plan,
  selected,
  onSelect,
  onMove,
}: {
  plan: FloorPlan;
  selected: string | null;
  onSelect: (zoneCode: string) => void;
  onMove: (zoneCode: string, originX: number, originY: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ zoneCode: string; x: number; y: number; originX: number; originY: number } | null>(
    null,
  );

  const rect = useMemo(() => floorPlanRect(plan.bounds), [plan.bounds]);

  return (
    <svg
      ref={svgRef}
      className={styles.canvas}
      viewBox={floorPlanViewBox(rect)}
      role="group"
      aria-label={`Sơ đồ ${plan.venueName}`}
      onPointerMove={(event) => {
        const drag = dragRef.current;
        const svg = svgRef.current;
        if (!drag || !svg) return;

        // Đổi khoảng dịch của con trỏ (pixel) sang đơn vị mặt bằng. Không có phép quy đổi này thì
        // cùng một cú kéo dịch khác nhau tuỳ kích thước cửa sổ.
        const box = svg.getBoundingClientRect();
        const dx = ((event.clientX - drag.x) / box.width) * rect.width;
        const dy = ((event.clientY - drag.y) / box.height) * rect.height;

        // Làm tròn 0,5 đơn vị: toạ độ lưu ở NUMERIC(8,2), và một khu đặt ở 12,3847 không chính xác
        // hơn một khu đặt ở 12,5 — chỉ khó đọc hơn khi cần chỉnh tay.
        onMove(drag.zoneCode, round(drag.originX + dx), round(drag.originY + dy));
      }}
      onPointerUp={() => {
        dragRef.current = null;
      }}
      onPointerCancel={() => {
        dragRef.current = null;
      }}
    >
      <Stage plan={plan} />

      {plan.zones.map((zone) => (
        <g key={zone.zoneCode} className={styles.zoneGroup}>
          <path
            d={outlinePath(zone.outline)}
            className={cx(
              styles.zoneShape,
              zone.kind === 'STANDING' && styles.zoneStanding,
              zone.zoneCode === selected && styles.zoneSelected,
            )}
            onPointerDown={(event) => {
              onSelect(zone.zoneCode);
              event.currentTarget.setPointerCapture?.(event.pointerId);
              dragRef.current = {
                zoneCode: zone.zoneCode,
                x: event.clientX,
                y: event.clientY,
                originX: zone.layout.originX,
                originY: zone.layout.originY,
              };
            }}
          >
            <title>{`${zone.name} — ${zone.seatCount} chỗ`}</title>
          </path>

          <text
            x={centreX(zone.outline)}
            y={centreY(zone.outline)}
            className={styles.zoneLabel}
            pointerEvents="none"
          >
            {zone.zoneCode}
          </text>
        </g>
      ))}
    </svg>
  );
}

function Stage({ plan }: { plan: FloorPlan }) {
  const { stage } = plan;

  return (
    <g className={styles.stage}>
      {stage.shape === 'CIRCLE' ? (
        <circle cx={stage.x} cy={stage.y} r={stage.width / 2} />
      ) : (
        <rect
          x={stage.x - stage.width / 2}
          y={stage.y - stage.height / 2}
          width={stage.width}
          height={stage.height}
          rx={stage.shape === 'THRUST' ? Math.min(stage.width, stage.height) / 2 : 0.6}
        />
      )}
      <text x={stage.x} y={stage.y} className={styles.stageLabel}>
        SÂN KHẤU
      </text>
    </g>
  );
}

// --- bảng điều khiển ---------------------------------------------------------

function StageControls({
  stage,
  onChange,
}: {
  stage: ConfigureZonesRequest['stage'];
  onChange: (stage: ConfigureZonesRequest['stage']) => void;
}) {
  const current = stage ?? { shape: 'RECTANGLE' as StageShape, x: 0, y: -7, width: 24, height: 4 };
  const circle = current.shape === 'CIRCLE';

  return (
    <section className={styles.group}>
      <h3 className={styles.groupTitle}>Sân khấu</h3>

      <Select
        label="Hình dạng"
        value={current.shape}
        options={STAGE_SHAPES}
        onChange={(event) => onChange({ ...current, shape: event.target.value as StageShape })}
      />
      <div className={styles.pair}>
        <NumberField label="Ngang (x)" value={current.x} onChange={(x) => onChange({ ...current, x })} />
        <NumberField label="Dọc (y)" value={current.y} onChange={(y) => onChange({ ...current, y })} />
      </div>
      <div className={styles.pair}>
        <NumberField
          label={circle ? 'Đường kính' : 'Bề ngang'}
          value={current.width}
          min={1}
          onChange={(width) => onChange({ ...current, width })}
        />
        {/* Sân khấu tròn lấy `width` làm đường kính, nên ô chiều sâu không có nghĩa gì. */}
        {circle ? null : (
          <NumberField
            label="Chiều sâu"
            value={current.height ?? 4}
            min={1}
            onChange={(height) => onChange({ ...current, height })}
          />
        )}
      </div>
    </section>
  );
}

function ZoneControls({
  zone,
  onChange,
}: {
  zone: ZoneInput;
  onChange: (patch: Partial<ZoneInput>) => void;
}) {
  const layout = zone.layout;
  const arc = layout?.shape === 'ARC';

  return (
    <div className={styles.zoneForm}>
      <p className={styles.zoneMeta}>
        {zone.name} ·{' '}
        {zone.kind === 'SEATED'
          ? `${zone.rowCount} hàng × ${zone.seatsPerRow} ghế`
          : `${zone.capacity} chỗ đứng`}
      </p>

      <Select
        label="Cách xếp"
        value={layout?.shape ?? 'GRID'}
        options={LAYOUT_SHAPES}
        onChange={(event) => {
          const shape = event.target.value as LayoutShape;
          onChange({
            layout: {
              shape,
              originX: layout?.originX ?? 0,
              originY: layout?.originY ?? 0,
              // Cung cần ba con số mà khối chữ nhật không có. Thiếu chúng thì backend trả 422, nên
              // điền mặc định dùng được ngay thay vì để người dùng đối mặt một lỗi đỏ.
              ...(shape === 'ARC'
                ? { innerRadius: layout?.innerRadius ?? 12, startAngleDeg: 20, endAngleDeg: 160 }
                : { rotationDeg: layout?.rotationDeg ?? 0 }),
            },
          });
        }}
      />

      {layout ? (
        <>
          <div className={styles.pair}>
            <NumberField
              label="Ngang (x)"
              value={layout.originX}
              onChange={(originX) => onChange({ layout: { ...layout, originX } })}
            />
            <NumberField
              label="Dọc (y)"
              value={layout.originY}
              onChange={(originY) => onChange({ layout: { ...layout, originY } })}
            />
          </div>

          {arc ? (
            <>
              <NumberField
                label="Bán kính hàng đầu"
                value={layout.innerRadius ?? 12}
                min={1}
                onChange={(innerRadius) => onChange({ layout: { ...layout, innerRadius } })}
              />
              <div className={styles.pair}>
                <NumberField
                  label="Góc bắt đầu (°)"
                  value={layout.startAngleDeg ?? 20}
                  onChange={(startAngleDeg) => onChange({ layout: { ...layout, startAngleDeg } })}
                />
                <NumberField
                  label="Góc kết thúc (°)"
                  value={layout.endAngleDeg ?? 160}
                  onChange={(endAngleDeg) => onChange({ layout: { ...layout, endAngleDeg } })}
                />
              </div>
              <p className={styles.fieldHint}>
                0° là hướng sang phải, góc tăng theo chiều kim đồng hồ. Khán đài trước sân khấu
                thường nằm trong khoảng 20°–160°.
              </p>
            </>
          ) : (
            <NumberField
              label="Xoay (°)"
              value={layout.rotationDeg ?? 0}
              onChange={(rotationDeg) => onChange({ layout: { ...layout, rotationDeg } })}
            />
          )}

          <Button variant="secondary" onClick={() => onChange({ layout: undefined })}>
            Để hệ thống tự xếp
          </Button>
        </>
      ) : (
        <p className={styles.fieldHint}>
          Khu này đang được hệ thống tự xếp xuống dưới sân khấu. Kéo nó trên sơ đồ để đặt chỗ cố
          định.
        </p>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  onChange: (value: number) => void;
}) {
  return (
    <Input
      label={label}
      type="number"
      step="0.5"
      min={min}
      value={String(value)}
      onChange={(event) => {
        const next = Number(event.target.value);
        // Ô trống cho ra NaN. Bỏ qua thay vì ghi NaN vào bản nháp: NaN đi vào JSON thành `null` và
        // backend từ chối cả bản nháp vì một ô người dùng đang xoá để gõ lại.
        if (!Number.isNaN(next)) onChange(next);
      }}
    />
  );
}

// --- dựng bản nháp ------------------------------------------------------------

/**
 * Bản nháp ban đầu = đúng những gì đã lưu.
 *
 * `layout` và `stage` giữ nguyên `null` khi địa điểm chưa khai — nếu điền sẵn giá trị mặc định thì
 * lần lưu đầu tiên sẽ ghim mọi khu lại, và chúng thôi tự dịch xuống khi ban tổ chức chèn thêm khu
 * phía trên.
 */
function initialDraft(venue: AdminVenue): ConfigureZonesRequest {
  return {
    stage: venue.stage
      ? {
          shape: venue.stage.shape as StageShape,
          x: venue.stage.x,
          y: venue.stage.y,
          width: venue.stage.width,
          height: venue.stage.height,
        }
      : undefined,
    zones: venue.zones.map((zone, index) => ({
      zoneCode: zone.zoneCode,
      name: zone.name,
      kind: zone.kind as 'SEATED' | 'STANDING',
      rowCount: zone.rowCount ?? undefined,
      seatsPerRow: zone.seatsPerRow ?? undefined,
      capacity: zone.capacity ?? undefined,
      sortOrder: index,
      layout: zone.layout
        ? {
            shape: zone.layout.shape as LayoutShape,
            originX: zone.layout.originX,
            originY: zone.layout.originY,
            rotationDeg: zone.layout.rotationDeg ?? undefined,
            innerRadius: zone.layout.innerRadius ?? undefined,
            startAngleDeg: zone.layout.startAngleDeg ?? undefined,
            endAngleDeg: zone.layout.endAngleDeg ?? undefined,
          }
        : undefined,
    })),
  };
}

const round = (value: number) => Math.round(value * 2) / 2;

const centreX = (outline: Array<{ x: number }>) =>
  (Math.min(...outline.map((p) => p.x)) + Math.max(...outline.map((p) => p.x))) / 2;

const centreY = (outline: Array<{ y: number }>) =>
  (Math.min(...outline.map((p) => p.y)) + Math.max(...outline.map((p) => p.y))) / 2;
