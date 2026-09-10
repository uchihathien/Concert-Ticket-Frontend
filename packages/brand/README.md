# @nexaticket/brand

Tài sản thương hiệu dùng chung cho cả 4 app. **Một nguồn duy nhất** — đừng chép file vào
`public/` của từng app, vì bốn bản sao sẽ lệch nhau ngay lần đổi logo đầu tiên.

| File | Kích thước | Dùng ở đâu |
| --- | --- | --- |
| `logo-dark.png` | 408×128 | Lockup chữ sáng — **mặc định**, vì cả bốn app chạy nền tối |
| `logo.png` | 408×128 | Cùng bố cục, chữ màu gốc — cho nền sáng (in ấn, email) |
| `logo-full.png` | 816×256 | Có cả dòng "CONCERT & EVENT TICKETS", chỉ dùng khi hiện lớn |
| `logo-mark.png` | 361×256 | Chỉ biểu tượng — cho nền tối và chỗ hẹp |
| `icon.png` | 512×512 | Nguồn của favicon từng app (`src/app/icon.png`) |

Dùng qua `<BrandLogo />` của `@nexaticket/ui`, đừng import ảnh trực tiếp ở app.

## Ba điều đã xử lý khi cắt từ file gốc

**Nền trong suốt.** Bản gốc là logo trên nền trắng. Độ đục của mỗi điểm ảnh lấy theo mức nó tối
hơn màu trắng, nên viền khử răng cưa vẫn mượt trên cả nền sáng lẫn nền tối thay vì thành rìa
răng cưa. Nền trắng của bản gốc có nhiễu (giá trị 251–255) nên mọi điểm có độ đục ≤ 16 bị ép về 0
— để lại thì `getbbox()` luôn trả về cả khung ảnh và mọi phép cắt đều vô hiệu.

**`logo-mark.png` không phải bản cắt dọc.** Mũi tên của biểu tượng vươn qua *phía trên* chữ `N`
của NEXATICKET, nên cắt thẳng một đường dọc sẽ mất mũi tên. Thay vào đó vùng chữ phía dưới bị
xoá, phần mũi tên phía trên được giữ.

**Tagline bị bỏ ở bản mặc định.** Ở chiều cao 32–40px trong header, dòng "CONCERT & EVENT
TICKETS" chỉ cao 3–4px: không đọc được, chỉ làm logo trông bẩn.

## Nền tối

Từ v3 cả bốn app đều chạy nền tối `#171211`. Chữ NEXATICKET màu navy `#00376F` gần như biến mất
ở đó, nên `logo-dark.png` đổi phần chữ sang sáng — **giữ nguyên biểu tượng gradient**, và giữ cả
hai sắc độ NEXA/TICKET của bản gốc.

Một cái bẫy khi tạo lại file này: mũi tên của biểu tượng vươn qua `x=540` nhưng nằm **phía trên**
`y=350`. Chỉ cắt theo cột là đổi màu luôn cả mũi tên. Phải giới hạn theo **cả hai chiều**.
