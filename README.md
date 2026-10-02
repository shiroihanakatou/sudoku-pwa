# Sudoku PWA

> Một trò chơi Sudoku hiện đại, không quảng cáo và có thể chơi offline.

Sudoku PWA mang đến trải nghiệm giải Sudoku gọn gàng trên máy tính và thiết bị di động. Ứng dụng hỗ trợ nhiều mức độ khó, bàn cờ 9x9 và 16x16, cùng các công cụ nhập số giúp việc giải đố thuận tiện hơn.

## Tính năng

- Không quảng cáo.
- Năm mức độ khó: **Easy**, **Medium**, **Hard**, **Expert** và **Extreme**.
- Bàn cờ Sudoku **9x9** và **16x16**.
- Chế độ phóng to bàn cờ 16x16 để thao tác dễ dàng hơn.
- Chế độ bút chì để ghi chú các ứng viên trong ô.
- **Fast Pencil** giúp điền nhanh các ghi chú phù hợp.
- Theo dõi thời gian giải và số lần mắc lỗi.
- Tự động lưu ván chơi để có thể tiếp tục sau khi rời ứng dụng.
- Sao chép bàn cờ sau khi hoàn thành để chia sẻ thử thách.
- Hỗ trợ cài đặt như một **Progressive Web App (PWA)**.
- Có thể chơi offline sau lần tải đầu tiên; ứng dụng vẫn nhận được các bản cập nhật khi có kết nối mạng.

## Bắt đầu sử dụng

### Chơi trực tuyến

Truy cập phiên bản đang được triển khai tại [shiroihanakatou.github.io/sudoku-pwa](https://shiroihanakatou.github.io/sudoku-pwa).

Ứng dụng có thể chơi trực tiếp trên trình duyệt mà không cần cài đặt. Sau lần tải đầu tiên, bạn vẫn có thể tiếp tục chơi khi không có kết nối mạng.

### Cài đặt như ứng dụng

Trên các trình duyệt hỗ trợ PWA, chọn **Install** hoặc **Add to Home Screen** trong menu của trình duyệt để sử dụng Sudoku PWA như một ứng dụng độc lập.

## Cách chơi

1. Chọn **New Game** và mức độ khó mong muốn.
2. Chọn một ô trên bàn cờ, sau đó nhập số từ bàn phím hiển thị.
3. Bật **Pencil** để thêm ghi chú thay vì điền đáp án.
4. Sử dụng **Fast Pencil** khi muốn nhanh chóng cập nhật các ghi chú khả thi.
5. Hoàn thành bàn cờ để xem thời gian, số lỗi và sao chép bàn cờ để chia sẻ.

## Cấu trúc dự án

| Tệp | Mô tả |
| --- | --- |
| `index.html` | Cấu trúc giao diện ứng dụng |
| `style.css` | Kiểu dáng và bố cục responsive |
| `app.js` | Luồng ứng dụng, giao diện và tương tác người dùng |
| `sudoku-engine.js` | Logic tạo và kiểm tra bàn Sudoku |
| `manifest.json` | Cấu hình PWA |
| `sw.js` | Service Worker cho bộ nhớ đệm và chế độ offline |

## Công nghệ

- HTML, CSS và JavaScript thuần.
- Progressive Web App (PWA).
- Service Worker và Cache API cho trải nghiệm offline.