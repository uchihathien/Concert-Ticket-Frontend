'use client';

import Link from 'next/link';
import {
  ApiError,
  placeOrder,
  seatPositionsFitFloorPlan,
  useApiClient,
  useIdempotencyKey,
  usePlaceHold,
  usePublicFloorPlan,
  useSeatMap,
  type FloorPlan,
  type SeatMap,
  type StandingLine,
} from '@nexaticket/ts-sdk';
import {
  Button,
  MoneyText,
  SeatMapCanvas,
  Skeleton,
  errorMessage,
  formatNumber,
  formatVnd,
  groupZonesByPrice,
} from '@nexaticket/ui';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { ApiErrorState } from './ApiErrorState';
import styles from './booking.module.css';

export interface SeatPickerProps {
  eventSessionId: string;
  /** Khoá của mặt bằng khán phòng. Hình học thuộc địa điểm, mà địa điểm tra theo sự kiện. */
  eventSlug: string;
  eventTitle: string;
  /** Sơ đồ do ban tổ chức tải lên, backend đã giải sẵn ưu tiên sự kiện → địa điểm. */
  seatMapImageUrl?: string | null;
}

/**
 * Chọn vé theo KHU, giữ chỗ, rồi đặt đơn.
 *
 * <h3>Vì sao không còn bấm từng ghế</h3>
 *
 * Bản trước bắt khách bấm đúng ô ghế trên sơ đồ. Điều đó đòi một thứ mà dữ liệu không luôn có:
 * toạ độ ghế phải nằm đúng chỗ trên mặt bằng. Toạ độ ấy được chốt lúc suất diễn publish, và những
 * suất publish trước khi catalog biết tính hình học đã chốt **chỉ số hàng/cột** thay vì toạ độ mét
 * — 52 trên 63 suất trong dữ liệu hiện có. Sơ đồ của chúng vẽ ra ghế của mọi khu chồng lên nhau ở
 * một góc, và những ghế rơi khỏi khung nhìn thì biến mất không báo gì.
 *
 * Nay khách nói "khu A, 2 vé" và inventory chọn hai chỗ trống gần sân khấu nhất
 * (`allocateSeatedInZone`). Đường mua không còn phụ thuộc vào việc vẽ được sơ đồ hay không, và nó
 * giống hệt đường vé đứng vốn đã chạy — một luồng thay vì hai.
 *
 * <h3>Sơ đồ vẫn hiện, nhưng chỉ để XEM</h3>
 *
 * Ba mức, theo thứ tự tin cậy: ảnh ban tổ chức tải lên (đúng thứ họ vẽ để bán vé, có lối vào, có
 * giá in kèm) → sơ đồ hệ thống tự vẽ, **nếu** toạ độ khớp mặt bằng → không có gì, chỉ danh sách
 * khu. Không bao giờ vẽ một sơ đồ mà mình biết là sai.
 *
 * <h3>Hai khoá idempotency, không phải một</h3>
 *
 * Mỗi lời gọi có khoá riêng, cùng gắn với LỰA CHỌN hiện tại. Dùng chung một khoá cho cả hai là
 * sai: chúng đi tới hai service khác nhau với hai bảng idempotency khác nhau, và nếu bước hai hỏng
 * phải thử lại thì bước một không được coi là "đã làm rồi" theo khoá của bước hai.
 *
 * Khoá đổi khi lựa chọn đổi — đó là lý do `useIdempotencyKey` nhận danh sách phụ thuộc. Giữ nguyên
 * khoá qua các lựa chọn khác nhau thì lần bấm thứ hai sẽ nhận lại kết quả của lần thứ nhất, tức là
 * khách trả tiền cho những vé mình đã bỏ chọn.
 */
export function SeatPicker({
  eventSessionId,
  eventSlug,
  eventTitle,
  seatMapImageUrl,
}: SeatPickerProps) {
  const router = useRouter();
  const client = useApiClient();
  const { data, isPending, isError, error, refetch } = useSeatMap(eventSessionId);
  // Mặt bằng hỏng KHÔNG chặn việc mua vé: nó chỉ quyết định có vẽ được sơ đồ hay không. Nên không
  // có `isError` nào ở đây — thiếu mặt bằng thì phần sơ đồ biến mất, danh sách khu vẫn nguyên.
  const { data: floorPlan } = usePublicFloorPlan(eventSlug);
  const placeHold = usePlaceHold(eventSessionId);

  /** Số vé theo mã khu. Khu nào không có trong đây là chưa chọn. */
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  // Mặc định KHÔNG tick sẵn: một ô đã tick sẵn không phải là sự đồng ý của ai cả.
  const [agreed, setAgreed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const holdKey = useIdempotencyKey([quantities]);
  const orderKey = useIdempotencyKey([quantities]);

  const map = data?.data ?? null;

  const offers = useMemo(() => buildOffers(map, floorPlan ?? null), [map, floorPlan]);

  const picked = useMemo(
    () =>
      offers
        .map((offer) => ({ offer, quantity: quantities[offer.zoneCode] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [offers, quantities],
  );

  /**
   * Toạ độ ghế lấy từ sơ đồ tồn kho, không từ mặt bằng.
   *
   * Mặt bằng công khai cố ý không mang ghế — chúng đã nằm ở đây kèm trạng thái còn/hết, và trả
   * lần thứ hai là gửi 5.000 dòng mà không thêm thông tin gì.
   */
  const seatPositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    for (const seat of map?.seats ?? []) {
      if (seat.posX !== null && seat.posY !== null) {
        positions.set(seat.seatCode, { x: seat.posX, y: seat.posY });
      }
    }
    return positions;
  }, [map]);

  const groups = useMemo(() => groupZonesByPrice(offers), [offers]);

  const availableByZone = useMemo(
    () => new Map(offers.map((offer) => [offer.zoneCode, offer.available])),
    [offers],
  );

  /**
   * Vẽ được sơ đồ hệ thống không.
   *
   * `seatPositionsFitFloorPlan` là phần mới và là phần quan trọng: thiếu nó thì một suất mang toạ
   * độ cũ vẫn "vẽ được" — ra một khán phòng sai mà không ai biết. Xem ghi chú của hàm đó.
   */
  const canDrawMap = Boolean(
    floorPlan && seatPositions.size > 0 && seatPositionsFitFloorPlan(floorPlan, seatPositions),
  );

  const unitCount = picked.reduce((sum, line) => sum + line.quantity, 0);
  const total = picked.reduce((sum, line) => sum + line.offer.priceVnd * line.quantity, 0);

  // Trần mua do backend tính và trả về, không phải hằng số ở đây: nó là kết quả của chuỗi kế thừa
  // suất diễn → tổ chức → nền tảng, và còn trừ đi số vé người này đã mua ở những lần trước.
  const allowance = map?.purchaseAllowance ?? null;
  const overAllowance = allowance !== null && unitCount > allowance.remaining;

  function setQuantity(zoneCode: string, quantity: number) {
    setFailure(null);
    setQuantities((current) => ({ ...current, [zoneCode]: Math.max(0, quantity) }));
  }

  function clearAll() {
    setFailure(null);
    setQuantities({});
  }

  async function submit() {
    // `agreed` được kiểm cả ở đây chứ không chỉ ở thuộc tính `disabled` của nút: `disabled` là
    // chuyện của giao diện và bỏ qua được bằng công cụ phát triển, còn hàm này là đường duy nhất
    // thật sự tạo ra đơn hàng.
    if (unitCount === 0 || submitting || !agreed) return;
    setSubmitting(true);
    setFailure(null);

    const seatedZones: StandingLine[] = picked
      .filter((line) => line.offer.kind === 'SEATED')
      .map((line) => ({ zoneCode: line.offer.zoneCode, quantity: line.quantity }));
    const standing: StandingLine[] = picked
      .filter((line) => line.offer.kind === 'STANDING')
      .map((line) => ({ zoneCode: line.offer.zoneCode, quantity: line.quantity }));

    try {
      const hold = await placeHold.mutateAsync({
        seatedZones: seatedZones.length > 0 ? seatedZones : undefined,
        standing: standing.length > 0 ? standing : undefined,
        idempotencyKey: holdKey.getKey(),
      });

      const order = await placeOrder(client, { holdId: hold.holdId }, orderKey.getKey());

      // `replace` chứ không `push`: quay lại trang chọn chỗ sau khi đã có đơn là quay về một bảng
      // số chỗ mà những vé vừa lấy đã bị trừ đi.
      router.replace(`/orders/${order.orderId}/pay`);
    } catch (error) {
      // Giữ chỗ hỏng gần như luôn vì người khác vừa lấy mất chỗ, hoặc vì chạm trần mua. Cả hai đều
      // cần số liệu mới: giữ nguyên màn hình cũ thì khách bấm lại đúng con số vừa bị từ chối.
      setFailure(messageOf(error));
      setQuantities({});
      void refetch();
      setSubmitting(false);
    }
  }

  if (isPending) {
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton height={44} />
        <Skeleton height={320} />
        <Skeleton height={220} />
      </div>
    );
  }

  if (isError || !map) {
    return <ApiErrorState error={error} onRetry={() => void refetch()} />;
  }

  const soldOut = offers.length > 0 && offers.every((offer) => offer.available === 0);

  return (
    <div className={styles.layout}>
      <div className={styles.map}>
        {soldOut ? <p className={styles.soldOut}>Suất này đã bán hết.</p> : null}

        {seatMapImageUrl ? (
          <figure className={styles.planFigure}>
            {/*
              `<img>` chứ không `next/image`: ảnh đến từ kho vật thể, tên miền do cấu hình quyết
              định nên không khai trước được trong `images.remotePatterns`.
            */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className={styles.planImage}
              src={seatMapImageUrl}
              alt={`Sơ đồ chỗ ${eventTitle}`}
            />
            <figcaption className={styles.planCaption}>
              Sơ đồ do ban tổ chức cung cấp. Chọn khu ở danh sách bên dưới.
            </figcaption>
          </figure>
        ) : canDrawMap && floorPlan ? (
          <figure className={styles.planFigure}>
            <SeatMapCanvas
              floorPlan={floorPlan}
              seatPositions={seatPositions}
              availableByZone={availableByZone}
              label={`Sơ đồ khán phòng ${floorPlan.venueName}`}
            />
            <figcaption className={styles.planCaption}>
              Sơ đồ chỉ để xem vị trí các khu. Chọn khu ở danh sách bên dưới.
            </figcaption>
          </figure>
        ) : null}

        <section className={styles.standingBlock} aria-label="Hạng vé">
          <h2 className={styles.blockTitle}>Chọn khu</h2>
          <p className={styles.blockNote}>
            Chọn khu và số lượng vé. Với khu có ghế, hệ thống xếp cho bạn những chỗ trống gần sân
            khấu nhất — số ghế in trên vé.
            {offers.length > FLAT_LIMIT ? ' Các khu cùng giá được gom thành một hạng vé.' : ''}
          </p>

          {offers.length > FLAT_LIMIT ? (
            <div className={styles.zoneGroups}>
              {groups.map((group, index) => (
                <details
                  key={group.priceVnd}
                  className={styles.zoneGroup}
                  // Mở sẵn nhóm đầu — nhóm đắt nhất, cũng là nhóm ít khu nhất. Mở hết thì màn hình
                  // lại dài đúng như trước khi gom; đóng hết thì khách không thấy gì để bấm.
                  open={index === 0}
                >
                  <summary className={styles.zoneGroupHead}>
                    <span className={styles.zoneGroupTitle}>{group.label}</span>
                    <span className={styles.zoneGroupMeta}>
                      {group.zones.length} khu · còn {formatNumber(group.available)} chỗ
                    </span>
                    <span className={styles.zonePrice}>{formatVnd(group.priceVnd)}</span>
                  </summary>

                  <div className={styles.zoneScroll}>
                    <div className={styles.zoneGrid}>
                      {group.zones.map((offer) => (
                        <ZoneRow
                          key={offer.zoneCode}
                          offer={offer}
                          quantity={quantities[offer.zoneCode] ?? 0}
                          onChange={(next) => setQuantity(offer.zoneCode, next)}
                        />
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </div>
          ) : (
            <div className={styles.zoneList}>
              {offers.map((offer) => (
                <ZoneRow
                  key={offer.zoneCode}
                  offer={offer}
                  quantity={quantities[offer.zoneCode] ?? 0}
                  onChange={(next) => setQuantity(offer.zoneCode, next)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className={styles.summary} aria-label="Vé đã chọn">
        <div className={styles.summaryHead}>
          <h2 className={styles.summaryTitle}>{eventTitle}</h2>
          {unitCount > 0 ? (
            <button type="button" className={styles.clear} onClick={clearAll}>
              Bỏ hết
            </button>
          ) : null}
        </div>

        {/* Dòng đếm gọn thay cho cả danh sách khi màn hẹp — xem `.pickedCount` trong CSS. */}
        {unitCount > 0 ? <p className={styles.pickedCount}>{unitCount} vé đã chọn</p> : null}

        {unitCount === 0 ? (
          <p className={styles.summaryEmpty}>Chọn khu và số lượng vé để tiếp tục.</p>
        ) : (
          <ul className={styles.picked}>
            {picked.map(({ offer, quantity }) => (
              <li key={offer.zoneCode} className={styles.pickedItem}>
                <span className={styles.pickedName}>
                  {offer.name} · {quantity} vé
                </span>
                <MoneyText amountVnd={offer.priceVnd * quantity} />
                <button
                  type="button"
                  className={styles.remove}
                  onClick={() => setQuantity(offer.zoneCode, 0)}
                  aria-label={`Bỏ vé ${offer.name}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className={styles.total}>
          <span>
            Tạm tính
            {unitCount > 0 ? <span className={styles.totalCount}> · {unitCount} vé</span> : null}
          </span>
          <MoneyText amountVnd={total} strong />
        </div>

        {allowance !== null ? (
          <p className={styles.allowance}>
            Bạn còn mua được {allowance.remaining} vé cho suất này
            {allowance.used > 0 ? ` (đã mua ${allowance.used})` : ''}.
          </p>
        ) : null}

        {overAllowance ? (
          <p className={styles.failure} role="alert">
            Vượt quá số vé được mua cho suất này.
          </p>
        ) : null}

        {failure ? (
          <p className={styles.failure} role="alert">
            {failure}
          </p>
        ) : null}

        <div className={styles.action}>
          <label className={styles.consent}>
            <input
              className={styles.consentBox}
              type="checkbox"
              checked={agreed}
              onChange={(event) => setAgreed(event.target.checked)}
            />
            <span>
              Tôi đã đọc và đồng ý với{' '}
              <Link href="/terms" target="_blank" rel="noreferrer">
                Điều khoản sử dụng
              </Link>{' '}
              và{' '}
              <Link href="/privacy" target="_blank" rel="noreferrer">
                Chính sách bảo mật
              </Link>
              , bao gồm quy định về hoàn và đổi vé.
            </span>
          </label>

          <Button
            block
            size="lg"
            onClick={() => void submit()}
            disabled={unitCount === 0 || overAllowance || submitting || !agreed}
            loading={submitting}
          >
            {submitting ? 'Đang giữ chỗ…' : 'Giữ chỗ và thanh toán'}
          </Button>
        </div>

        <p className={styles.note}>
          Chỗ được giữ trong ít phút để bạn hoàn tất thanh toán. Hết thời gian, chỗ sẽ mở lại cho
          người khác.
        </p>
      </aside>
    </div>
  );
}

/**
 * Một khu đang bán, đã gộp từ hai nguồn về cùng một hình dạng.
 *
 * Vé ngồi và vé đứng đến từ hai phần khác nhau của sơ đồ tồn kho — một bên là danh sách ghế, bên
 * kia là số lượng theo khu — nhưng với khách chúng là cùng một thứ: một khu, một giá, còn ngần này
 * chỗ. Gộp ở đây thì phần giao diện chỉ còn một đường, và `kind` chỉ được dùng lại đúng một lần:
 * lúc quyết định gửi vào `seatedZones` hay `standing`.
 */
interface ZoneOffer {
  zoneCode: string;
  name: string;
  kind: 'SEATED' | 'STANDING';
  priceVnd: number;
  available: number;
}

/**
 * Số khu tối đa còn hiển thị thành một danh sách phẳng.
 *
 * Dưới ngưỡng này, gom nhóm chỉ tổ làm rối: một nhà hát ba khu mà phải bấm mở ba nhóm, mỗi nhóm
 * một dòng. Trên ngưỡng thì ngược lại — nhà thi đấu 91 khu trải phẳng là một bức tường dài hơn ba
 * màn hình, và phần tóm tắt bên phải trôi mất khỏi tầm nhìn.
 */
const FLAT_LIMIT = 8;

function buildOffers(map: SeatMap | null, floorPlan: FloorPlan | null): ZoneOffer[] {
  if (!map) return [];

  const zoneNames = new Map((floorPlan?.zones ?? []).map((zone) => [zone.zoneCode, zone.name]));
  const offers: ZoneOffer[] = [];

  const seatedByZone = new Map<
    string,
    { available: number; priceVnd: number; label: string | null }
  >();
  for (const seat of map.seats) {
    const current = seatedByZone.get(seat.zoneCode) ?? {
      available: 0,
      priceVnd: seat.priceVnd,
      label: seat.sectionLabel ?? seat.ticketTypeName,
    };
    if (seat.status === 'AVAILABLE') current.available += 1;
    seatedByZone.set(seat.zoneCode, current);
  }
  for (const [zoneCode, zone] of seatedByZone) {
    offers.push({
      zoneCode,
      name: zoneNames.get(zoneCode) ?? zone.label ?? zoneCode,
      kind: 'SEATED',
      priceVnd: zone.priceVnd,
      available: zone.available,
    });
  }

  for (const zone of map.standingZones) {
    offers.push({
      zoneCode: zone.zoneCode,
      name: zoneNames.get(zone.zoneCode) ?? zone.ticketTypeName ?? zone.zoneCode,
      kind: 'STANDING',
      priceVnd: zone.priceVnd,
      available: zone.available,
    });
  }

  // Đắt nhất lên đầu. Giá là thứ xếp hạng chỗ ngồi sát thực tế nhất mà dữ liệu này có: khu sát sân
  // khấu thường đắt hơn khán đài, và khách đọc bảng giá từ trên xuống.
  return offers.sort(
    (a, b) => b.priceVnd - a.priceVnd || a.zoneCode.localeCompare(b.zoneCode, 'vi'),
  );
}

/** Một khu: tên, giá, số chỗ còn, và bộ đếm số lượng. */
function ZoneRow({
  offer,
  quantity,
  onChange,
}: {
  offer: ZoneOffer;
  quantity: number;
  onChange: (next: number) => void;
}) {
  const unit = offer.kind === 'SEATED' ? 'ghế' : 'chỗ';

  return (
    <section className={styles.zone} data-picked={quantity > 0 ? 'true' : undefined}>
      <header className={styles.zoneHead}>
        <div>
          <h3 className={styles.zoneName}>{offer.name}</h3>
          <p className={styles.zoneMeta}>
            {offer.available > 0 ? `Còn ${formatNumber(offer.available)} ${unit}` : `Hết ${unit}`}
            {offer.kind === 'STANDING' ? ' · khu đứng, không đánh số' : ''}
          </p>
        </div>
        <span className={styles.zonePrice}>{formatVnd(offer.priceVnd)}</span>
      </header>

      <div className={styles.quantity}>
        <button
          type="button"
          className={styles.quantityButton}
          onClick={() => onChange(quantity - 1)}
          disabled={quantity === 0}
          aria-label={`Bớt một vé ${offer.name}`}
        >
          −
        </button>
        <span className={styles.quantityValue} aria-live="polite">
          {quantity}
        </span>
        <button
          type="button"
          className={styles.quantityButton}
          onClick={() => onChange(quantity + 1)}
          // Chặn theo số còn lại: gửi lên một con số chắc chắn bị từ chối chỉ để nhận lỗi.
          disabled={quantity >= offer.available}
          aria-label={`Thêm một vé ${offer.name}`}
        >
          +
        </button>
        {quantity > 0 ? (
          <span className={styles.quantitySubtotal}>= {formatVnd(offer.priceVnd * quantity)}</span>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Câu cho người dùng lấy từ TỪ ĐIỂN LỖI, không lấy từ `ApiError.detail`.
 *
 * Bản trước đọc thẳng `detail` với giả định "backend đã trả tiếng Việt sẵn". Giả định đó ngược với
 * quy ước của chính hệ thống — `ui/errors.ts` mở đầu bằng: *backend trả `detail` bằng tiếng Anh để
 * ghi log; câu chữ cho người dùng nằm ở đây*. Hậu quả nhìn thấy trên màn hình thật: một khách Việt
 * bấm giữ chỗ và nhận về **"Sales window is closed"**.
 *
 * `errorMessage` còn chèn được số liệu từ `meta` — "còn được mua 2 vé" thay vì một câu chung chung.
 */
function messageOf(error: unknown): string {
  if (error instanceof ApiError) {
    return errorMessage(error);
  }
  return 'Không giữ được chỗ vừa chọn. Số chỗ còn trống đã được làm mới, mời bạn chọn lại.';
}
