# A5-K68 website

## Cấu trúc thư mục

- `features/`: mã nguồn theo từng màn hình/chức năng.
  - `admin/`, `notifications/`, `dashboard/`, `profile/`, `auth/`, `seatmap/`, `home/`
- `shared/`: theme, stylesheet dashboard và Firebase dùng chung.
- `assets/images/`: toàn bộ ảnh của website.
- `workers/`: Cloudflare Worker cho push notification.
- `data/`: dữ liệu tĩnh/phục vụ phát triển.

`index.html` và `firebase-messaging-sw.js` được giữ tại root để trang chủ và Firebase Messaging có thể hoạt động ở scope `/`.
