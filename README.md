# Sổ chi tiêu: hướng dẫn deploy và bảo trì

Ứng dụng web quản lý chi tiêu cá nhân, chạy trên Cloudflare Workers với cơ sở dữ liệu D1 (SQLite). Dùng được trên máy tính và điện thoại, chạy hoàn toàn trên gói miễn phí.

- Địa chỉ đang chạy: https://so-chi-tieu.vu-xuan-du-ke-hoach-chi-tieu.workers.dev
- Hướng dẫn sử dụng: mở file `public/huong-dan.html`, hoặc vào `/huong-dan.html` trên web.

---

## Mục lục

1. [Cấu trúc thư mục](#1-cấu-trúc-thư-mục)
2. [Deploy lần đầu](#2-deploy-lần-đầu)
3. [Cập nhật code](#3-cập-nhật-code)
4. [Chạy thử trên máy](#4-chạy-thử-trên-máy)
5. [Sao lưu và khôi phục dữ liệu](#5-sao-lưu-và-khôi-phục-dữ-liệu)
6. [Quay lại bản trước khi lỗi](#6-quay-lại-bản-trước-khi-lỗi)
7. [Việc bảo trì định kỳ](#7-việc-bảo-trì-định-kỳ)
8. [Xử lý lỗi thường gặp](#8-xử-lý-lỗi-thường-gặp)
9. [Tham khảo kỹ thuật](#9-tham-khảo-kỹ-thuật)

---

## 1. Cấu trúc thư mục

```
so-chi-tieu/
├── public/                  Giao diện (Cloudflare phục vụ trực tiếp)
│   ├── index.html           Toàn bộ ứng dụng: giao diện, biểu đồ, logic
│   ├── huong-dan.html       Hướng dẫn sử dụng
│   ├── manifest.webmanifest Cho phép cài lên màn hình điện thoại
│   └── icon-*.png           Biểu tượng app
├── src/
│   └── index.js             API: đọc/ghi D1, kiểm tra mật khẩu
├── schema.sql               Cấu trúc bảng dữ liệu
├── wrangler.toml            Cấu hình Worker và liên kết D1
├── package.json             Các lệnh tắt (npm run ...)
├── .dev.vars.example        Mật khẩu mẫu khi chạy thử trên máy
└── .gitignore
```

Hầu hết các thay đổi về giao diện chỉ nằm trong `public/index.html`.

---

## 2. Deploy lần đầu

Phần này ghi lại để dùng khi cài lại trên máy mới hoặc tài khoản Cloudflare khác. Nếu web đang chạy bình thường, bỏ qua và xem [mục 3](#3-cập-nhật-code).

### Chuẩn bị

| Cần có | Ghi chú |
|---|---|
| Node.js bản LTS | Tải tại https://nodejs.org. Kiểm tra bằng `node -v` |
| Tài khoản Cloudflare | Đăng ký **miễn phí** tại https://dash.cloudflare.com/sign-up. Không cần thẻ |

> **Lưu ý trước khi bắt đầu**
> - Dùng **Command Prompt (cmd)**, không dùng PowerShell. PowerShell hay chặn lệnh `npx`.
> - **Tắt bộ gõ tiếng Việt** (Unikey/EVKey chuyển sang **E**). Kiểu gõ Telex biến `x`, `s`, `f`, `r`, `j`, `w`, `dd`… thành dấu, làm sai tên miền và mật khẩu mà không nhìn thấy.
> - Không dùng ô "Drop a folder, or a zip" trên trang Cloudflare. Ô đó chỉ đưa giao diện lên, không có cơ sở dữ liệu.
> - Trang có chữ **Cloudflare Connect** và yêu cầu thanh toán là trang bán vé hội nghị, không liên quan.

### Các bước

**Bước 1. Mở cmd trong thư mục dự án**

Mở thư mục `so-chi-tieu` (thư mục có file `package.json`), bấm vào thanh địa chỉ của File Explorer, gõ `cmd` rồi Enter.

**Bước 2. Cài công cụ**

```
npm install
```

**Bước 3. Đăng nhập Cloudflare**

```
npx wrangler login
```

Trình duyệt mở ra, bấm **Allow**.

**Bước 4. Tạo cơ sở dữ liệu**

```
npx wrangler d1 create so-chi-tieu
```

Nếu được hỏi có muốn tự thêm vào file cấu hình, chọn **N**. Copy giá trị `database_id` trong kết quả, mở `wrangler.toml` bằng `notepad wrangler.toml` và dán vào dòng `database_id = "..."`.

**Bước 5. Tạo bảng**

```
npm run db:init
```

Khi được hỏi "Ok to proceed?", chọn **yes**.

**Bước 6. Đặt mật khẩu đăng nhập**

```
npx wrangler secret put APP_PASSWORD
```

Gõ mật khẩu rồi Enter (ký tự không hiện khi gõ). Nếu được hỏi có tạo Worker mới không, chọn **yes**.

**Bước 7. Đưa lên mạng**

```
npm run deploy
```

Lần đầu Cloudflare yêu cầu đặt tên miền phụ `workers.dev`. Chỉ gõ **phần tên**, ví dụ `vu-xuan-du-ke-hoach-chi-tieu`, không gõ `https://` hay `.workers.dev`. Chỉ dùng chữ thường không dấu, số và dấu `-`.

Kết quả in ra địa chỉ dạng `https://so-chi-tieu.<tên>.workers.dev`.

> Trong 15 phút đến vài giờ đầu, trình duyệt có thể báo `ERR_SSL_VERSION_OR_CIPHER_MISMATCH`. Đó là lúc Cloudflare đang cấp chứng chỉ HTTPS cho tên miền mới. Chỉ cần đợi rồi thử lại bằng cửa sổ ẩn danh.

**Bước 8. Cài lên điện thoại**

- iPhone (Safari): nút Chia sẻ → **Thêm vào MH chính**
- Android (Chrome): menu ⋮ → **Thêm vào màn hình chính**

---

## 3. Cập nhật code

Mỗi khi có bản sửa mới, làm theo thứ tự:

**1. Sao lưu trước**

```
npm run backup
```

Đổi tên file `backup.sql` vừa tạo kèm ngày (ví dụ `backup-2026-10-07.sql`) và cất vào chỗ an toàn.

**2. Chép đè file mới** vào thư mục dự án. Thường chỉ là `public/index.html`, đôi khi thêm `src/index.js`.

> **Cẩn thận với `wrangler.toml`.** Chỉ chép đè khi file mới có đúng `database_id` của bạn. Database hiện tại có id `a0bb77c7-2a24-457c-b358-90ca552a3dd1`.

**3. Chạy thử trên máy** nếu thay đổi lớn (xem [mục 4](#4-chạy-thử-trên-máy)).

**4. Đưa lên mạng**

```
npm run deploy
```

Dữ liệu trong D1 không bị ảnh hưởng khi deploy lại.

---

## 4. Chạy thử trên máy

Bản chạy thử dùng cơ sở dữ liệu riêng trên máy, không đụng tới dữ liệu thật.

Lần đầu:

```
copy .dev.vars.example .dev.vars
npm run db:init:local
```

Mỗi lần chạy thử:

```
npm run dev
```

Mở http://localhost:8787, đăng nhập bằng mật khẩu `matkhau-thu-nghiem` (đổi được trong `.dev.vars`). Bấm `Ctrl + C` trong cmd để tắt.

---

## 5. Sao lưu và khôi phục dữ liệu

### Sao lưu

| Cách | Lệnh / thao tác | Kết quả |
|---|---|---|
| Từ app | Trang **Ngân sách** → **Xuất Excel** | File `.xlsx` gồm tổng hợp năm, tháng, kế hoạch, giao dịch, mục tiêu |
| Từ máy chủ | `npm run backup` | File `backup.sql`, khôi phục được toàn bộ |

Muốn mở file sao lưu bằng phần mềm SQLite (ví dụ DB Browser for SQLite):

```
sqlite3 so-chi-tieu.db < backup.sql
```

Nên sao lưu **mỗi tháng một lần** và **trước mỗi lần cập nhật code**.

### Khôi phục về một thời điểm gần đây (Time Travel)

D1 tự lưu lịch sử thay đổi trong vài ngày gần nhất. Dùng khi lỡ xóa nhầm dữ liệu.

```
npx wrangler d1 time-travel info so-chi-tieu
npx wrangler d1 time-travel restore so-chi-tieu --timestamp=2026-10-07T10:00:00+07:00
```

Thay thời gian bằng một thời điểm **trước khi** xảy ra sự cố. Lệnh sẽ hỏi xác nhận.

### Khôi phục từ file sao lưu

> Thao tác này **xóa toàn bộ dữ liệu hiện tại** rồi nạp lại từ file. Chỉ làm khi thật cần.

```
npx wrangler d1 execute so-chi-tieu --remote --command "DROP TABLE IF EXISTS transactions; DROP TABLE IF EXISTS budgets; DROP TABLE IF EXISTS months; DROP TABLE IF EXISTS goals;"
npx wrangler d1 execute so-chi-tieu --remote --file=backup-2026-10-07.sql
```

---

## 6. Quay lại bản trước khi lỗi

Nếu bản vừa deploy bị lỗi giao diện:

```
npx wrangler rollback
```

Web quay về phiên bản trước ngay lập tức. Dữ liệu không bị ảnh hưởng.

Muốn xem lỗi trực tiếp từ máy chủ trong lúc thao tác trên web:

```
npx wrangler tail
```

---

## 7. Việc bảo trì định kỳ

| Việc | Khi nào | Cách làm |
|---|---|---|
| Sao lưu | Mỗi tháng, trước khi cập nhật | `npm run backup` hoặc Xuất Excel |
| Đổi mật khẩu | Khi cần | `npx wrangler secret put APP_PASSWORD`. Có hiệu lực ngay, không cần deploy |
| Cập nhật Wrangler | Vài tháng một lần | `npm install wrangler@latest` |
| Lưu lịch sử code | Sau mỗi thay đổi | Đẩy lên một repo **private** trên GitHub. `.gitignore` đã loại sẵn `.dev.vars` và file sao lưu |

### Thêm hoặc đổi danh mục

Phải sửa ở **cả hai nơi** cho khớp nhau, nếu không máy chủ sẽ từ chối giao dịch thuộc danh mục mới:

1. Mảng `ALL` trong `public/index.html`, mỗi dòng dạng:
   ```js
   {id:'thucpham',name:'Thực phẩm',group:'need',w:.25,c:'#22A55B',ic:'🥬'},
   ```
   `group` là `need` (thiết yếu), `want` (mong muốn) hoặc `save` (tiết kiệm). `w` là tỷ trọng mặc định trong nhóm, tổng `w` của một nhóm nên bằng 1.
2. Tập `CATS` trong `src/index.js`: thêm mã `id` mới.

Không xóa mã cũ khỏi `src/index.js` nếu đã có giao dịch dùng mã đó.

### Giới hạn gói miễn phí

100.000 lượt gọi mỗi ngày và 5 GB dữ liệu. Một người dùng chỉ dùng chưa tới 1% con số này.

---

## 8. Xử lý lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| `'npx' is not recognized` | Node.js chưa cài hoặc chưa nhận | Đóng cmd mở lại, hoặc khởi động lại máy |
| `running scripts is disabled` | Đang dùng PowerShell | Chuyển sang cmd |
| Tên miền phụ báo `invalid` | Gõ cả `https://…` hoặc bộ gõ Telex đang bật | Chỉ gõ phần tên, tắt Unikey |
| `ERR_SSL_VERSION_OR_CIPHER_MISMATCH` | Chứng chỉ HTTPS của tên miền mới chưa cấp xong | Đợi 15 phút đến vài giờ, thử cửa sổ ẩn danh hoặc 4G |
| Đăng nhập báo sai mật khẩu dù gõ đúng | Mật khẩu bị Telex làm sai khi đặt | Tắt Unikey, đặt lại bằng `npx wrangler secret put APP_PASSWORD` |
| Web báo "Chưa đặt APP_PASSWORD" | Chưa chạy bước đặt mật khẩu | Chạy `npx wrangler secret put APP_PASSWORD` |
| Lỗi có chữ `database_id` | `wrangler.toml` sai id | Mở `wrangler.toml`, kiểm tra lại id |
| Cuối trang báo "Còn N thay đổi chưa lưu" | Đang mất mạng | Đợi có mạng, app tự gửi lên |

---

## 9. Tham khảo kỹ thuật

### API

Mọi đường dẫn `/api/*` cần header `Authorization: Bearer <APP_PASSWORD>`.

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/api/all` | Toàn bộ dữ liệu: các tháng, giao dịch, mục tiêu |
| PUT | `/api/months/:ym` | Lưu thu nhập, % tiết kiệm, hạn mức của tháng `YYYY-MM` |
| POST | `/api/tx` | Thêm giao dịch `{id, d, amt, cat, note}` |
| DELETE | `/api/tx/:id` | Xóa giao dịch |
| PUT | `/api/goals/:id` | Thêm hoặc sửa mục tiêu |
| DELETE | `/api/goals/:id` | Xóa mục tiêu |

### Bảng dữ liệu

| Bảng | Nội dung |
|---|---|
| `months` | `ym`, `income`, `save_pct` |
| `budgets` | `ym`, `cat`, `amount`: hạn mức từng danh mục mỗi tháng |
| `transactions` | `id`, `d` (ngày), `ym`, `amt`, `cat`, `note` |
| `goals` | `id`, `name`, `target`, `saved`, `deadline` |

### Danh mục

| Mã | Tên | Nhóm |
|---|---|---|
| nha | Tiền nhà | Thiết yếu |
| diennuoc | Điện nước | Thiết yếu |
| guixe | Gửi xe | Thiết yếu |
| thucpham | Thực phẩm | Thiết yếu |
| dilai | Đi lại | Thiết yếu |
| dodung | Đồ dùng cá nhân | Thiết yếu |
| cattoc | Cắt tóc & chăm sóc | Thiết yếu |
| suckhoe | Sức khỏe | Thiết yếu |
| hoctap | Học tập | Thiết yếu |
| giadinh | Gửi gia đình | Thiết yếu |
| tragop | Trả góp / trả nợ | Thiết yếu |
| anngoai | Ăn ngoài | Mong muốn |
| uongngoai | Uống ngoài | Mong muốn |
| muado | Mua đồ | Mong muốn |
| thethao | Thể thao | Mong muốn |
| giaitri | Giải trí & du lịch | Mong muốn |
| hieuhy | Hiếu hỷ & quà tặng | Mong muốn |
| phatsinh | Chi phát sinh | Mong muốn |
| vang | Tiết kiệm vàng | Tiết kiệm |
| tien | Tiết kiệm tiền | Tiết kiệm |

Khoản thuộc nhóm Tiết kiệm không tính vào tổng chi tiêu.

### Truy vấn trực tiếp

Tổng chi theo danh mục tháng 10/2026:

```
npx wrangler d1 execute so-chi-tieu --remote --command "SELECT cat, SUM(amt) FROM transactions WHERE ym='2026-10' AND cat NOT IN ('vang','tien') GROUP BY cat"
```

Tổng để dành theo năm:

```
npx wrangler d1 execute so-chi-tieu --remote --command "SELECT substr(ym,1,4) AS nam, cat, SUM(amt) FROM transactions WHERE cat IN ('vang','tien') GROUP BY nam, cat"
```
