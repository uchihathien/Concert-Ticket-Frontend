'use client';

import {
  ApiError,
  useAddKnowledgeChunk,
  useDeleteKnowledgeChunk,
  useKnowledgeChunks,
  useKnowledgePreview,
  type RetrievedChunk,
} from '@nexaticket/ts-sdk';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Panel,
  Skeleton,
  useDebouncedValue,
  useToast,
} from '@nexaticket/ui';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';
import styles from './knowledge.module.css';

/**
 * P-KNOWLEDGE — soạn kho tri thức mà trợ lý AI đọc.
 *
 * <h3>Vì sao màn hình này tồn tại</h3>
 *
 * Trợ lý bị prompt hệ thống buộc "chỉ nói những gì có trong ngữ cảnh tham khảo hoặc kết quả tool".
 * Kho tri thức rỗng không gây lỗi nào — nó chỉ làm trợ lý trả lời "mình chưa tra được" cho mọi câu
 * hỏi chính sách, trong khi vẫn tra được đơn hàng bình thường. Nói cách khác: thiếu màn hình này
 * thì tính năng chạy đúng và vô dụng, theo một cách không có log nào chỉ ra.
 *
 * <h3>Hộp thử câu hỏi không phải tiện ích gỡ lỗi</h3>
 *
 * Nó là <b>đường phản hồi duy nhất</b> của người soạn. pgvector luôn trả đủ top-k kể cả khi không
 * đoạn nào liên quan, nên một kho "trông đầy" mà mọi đoạn đều nằm trên ngưỡng khoảng cách thì trợ
 * lý không đọc đoạn nào — và cách phát hiện khác duy nhất là đọc câu trả lời tệ của nó với khách
 * thật. Cột "Dùng" trả lời đúng câu hỏi đó.
 */
export default function KnowledgePage() {
  const chunks = useKnowledgeChunks();
  const addChunk = useAddKnowledgeChunk();
  const deleteChunk = useDeleteKnowledgeChunk();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [question, setQuestion] = useState('');

  // Mỗi lần thử là một lần gọi mô hình nhúng — có giá, và với nhà cung cấp trả phí thì là tiền
  // thật. Chờ người soạn gõ xong thay vì bắn một request mỗi ký tự.
  const debouncedQuestion = useDebouncedValue(question, 800);
  const preview = useKnowledgePreview(debouncedQuestion);

  async function submit() {
    if (!title.trim() || !content.trim() || addChunk.isPending) return;
    try {
      await addChunk.mutateAsync({ title: title.trim(), content: content.trim() });
      setTitle('');
      setContent('');
      toast.show({ tone: 'success', message: 'Đã thêm đoạn tri thức' });
    } catch (error) {
      toast.showError(error instanceof ApiError ? error : null);
    }
  }

  async function remove(id: string, chunkTitle: string) {
    try {
      await deleteChunk.mutateAsync(id);
      toast.show({ tone: 'success', message: `Đã xoá "${chunkTitle}"` });
    } catch (error) {
      toast.showError(error instanceof ApiError ? error : null);
    }
  }

  return (
    <>
      <PageHeader
        title="Kho tri thức của trợ lý"
        description="Những gì trợ lý AI được phép nói với khách. Ngoài phần này, nó chỉ tra được đơn hàng."
      />

      <div className={styles.layout}>
        <div className={styles.main}>
          <Panel>
            <h2 className={styles.panelTitle}>Thêm một đoạn</h2>
            <div className={styles.form}>
              <Input
                label="Tiêu đề"
                required
                maxLength={200}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                hint="Nên mang đúng từ khách hay dùng để hỏi — tiêu đề cũng được nhúng cùng nội dung."
              />

              <label className={styles.field}>
                <span className={styles.label}>
                  Nội dung <span aria-hidden="true">*</span>
                </span>
                <textarea
                  className={styles.textarea}
                  rows={6}
                  maxLength={8000}
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                />
                <span className={styles.hint}>
                  Một đoạn, một ý. Đoạn quá dài cho ra một vector trung bình hoá và không còn gần
                  với câu hỏi nào cụ thể — tài liệu dài thì cắt thành nhiều đoạn.
                </span>
              </label>

              <div>
                <Button
                  onClick={() => void submit()}
                  loading={addChunk.isPending}
                  disabled={!title.trim() || !content.trim()}
                >
                  Thêm vào kho
                </Button>
              </div>
            </div>
          </Panel>

          <Panel>
            <h2 className={styles.panelTitle}>
              Đã có trong kho{chunks.data ? ` (${chunks.data.length})` : ''}
            </h2>
            {chunks.isPending ? (
              <Skeleton lines={5} />
            ) : chunks.isError ? (
              <ErrorState error={null} onRetry={() => void chunks.refetch()} />
            ) : chunks.data.length === 0 ? (
              <EmptyState
                title="Kho đang trống"
                description="Trợ lý sẽ trả lời “mình chưa tra được” cho mọi câu hỏi về chính sách cho tới khi có nội dung ở đây."
              />
            ) : (
              <ul className={styles.list}>
                {chunks.data.map((chunk) => (
                  <li key={chunk.id} className={styles.item}>
                    <div className={styles.itemHead}>
                      <h3 className={styles.itemTitle}>{chunk.title}</h3>
                      <Button
                        variant="ghost"
                        aria-label={`Xoá ${chunk.title}`}
                        onClick={() => void remove(chunk.id, chunk.title)}
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                    <p className={styles.itemBody}>{chunk.content}</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <aside className={styles.tester} aria-label="Thử câu hỏi">
          <Panel>
            <h2 className={styles.panelTitle}>Thử một câu hỏi</h2>
            <p className={styles.testerIntro}>
              Đi qua đúng đường trợ lý đi — cùng mô hình nhúng, cùng số đoạn lấy ra, cùng ngưỡng.
            </p>

            <Input
              label="Khách hỏi gì"
              maxLength={2000}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="ví dụ: giữ chỗ được bao lâu"
            />

            {debouncedQuestion.trim().length === 0 ? null : preview.isPending ? (
              <Skeleton lines={3} />
            ) : preview.isError ? (
              <ErrorState error={null} onRetry={() => void preview.refetch()} />
            ) : preview.data.length === 0 ? (
              <EmptyState
                title="Không lấy được đoạn nào"
                description="Kho chưa có nội dung nào để so."
              />
            ) : (
              <ol className={styles.results}>
                {preview.data.map((row) => (
                  <ResultRow key={row.id} row={row} />
                ))}
              </ol>
            )}

            {preview.data?.every((row) => !row.used) && preview.data.length > 0 ? (
              <p className={styles.warning}>
                Không đoạn nào vượt ngưỡng, nên với câu hỏi này trợ lý trả lời <b>không kèm</b> tri
                thức nền. Viết một đoạn dùng đúng từ khách dùng, hoặc cắt đoạn hiện có ngắn lại.
              </p>
            ) : null}
          </Panel>
        </aside>
      </div>
    </>
  );
}

/**
 * Một đoạn lấy ra được.
 *
 * `used` là cột đáng nhìn nhất: khoảng cách nhỏ hơn ngưỡng thì trợ lý đọc đoạn này, ngược lại nó bị
 * loại và chỉ nằm đây để người soạn hiểu tại sao.
 */
function ResultRow({ row }: { row: RetrievedChunk }) {
  return (
    <li className={styles.result}>
      <div className={styles.resultHead}>
        <span className={styles.resultTitle}>{row.title}</span>
        <Badge tone={row.used ? 'success' : 'neutral'}>{row.used ? 'Dùng' : 'Bị loại'}</Badge>
      </div>
      <p className={styles.resultBody}>{row.content}</p>
      <span className={styles.distance}>khoảng cách {row.distance.toFixed(3)}</span>
    </li>
  );
}
