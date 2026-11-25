# Kho ý tưởng đồ án

Web nhỏ để cả nhóm thêm ý tưởng, vote và chốt đề tài. Chạy trên GitHub Pages; dữ liệu dùng chung lưu trên Firebase Firestore (gói miễn phí).

## Tính năng
- Thêm ý tưởng: tên, người đề xuất, mô tả, công nghệ, độ khó 1–5
- Vote (mỗi trình duyệt 1 vote cho mỗi ý tưởng, bấm lại để bỏ vote)
- Trạng thái: Mới / Đang cân nhắc / Đã chốt / Loại
- Tìm kiếm, lọc theo trạng thái, sắp xếp
- Copy bảng để dán vào Google Sheets / Excel
- Cập nhật realtime: ai thêm hay vote thì mọi người thấy ngay

## Bước 1 – Tạo Firebase (khoảng 5 phút)
1. Vào https://console.firebase.google.com → **Add project** → đặt tên → tạo (có thể tắt Google Analytics).
2. Menu trái **Build → Firestore Database** → **Create database** → chọn vùng (vd `asia-southeast1`) → **Start in production mode**.
3. Tab **Rules** → xoá hết, dán nội dung file [`firestore.rules`](firestore.rules) → **Publish**.
4. Bấm ⚙️ **Project settings** → kéo xuống **Your apps** → bấm biểu tượng **`</>`** (Web) → đặt tên → **Register app**.
5. Copy các giá trị trong `firebaseConfig` rồi dán vào file [`firebase-config.js`](firebase-config.js).

> `apiKey` của Firebase Web không phải mật khẩu, đưa lên GitHub công khai được. Quyền truy cập do file `firestore.rules` quyết định.

## Bước 2 – Đưa lên GitHub Pages
```bash
git init
git add .
git commit -m "Kho ý tưởng đồ án"
git branch -M main
git remote add origin https://github.com/<tên-bạn>/<tên-repo>.git
git push -u origin main
```
Trên GitHub vào repo → **Settings → Pages** → Source: **Deploy from a branch**, Branch: `main` / `(root)` → **Save**.
Sau khoảng 1 phút web chạy tại `https://<tên-bạn>.github.io/<tên-repo>/`. Gửi link này cho nhóm là xong.

## Chạy thử trên máy
Vì dùng ES module nên không mở trực tiếp file `index.html` được, cần chạy một server nhỏ:
```bash
npx serve .
# hoặc
python -m http.server 8000
```
Nếu chưa điền `firebase-config.js`, web chạy ở **chế độ thử** (chỉ lưu trên máy bạn).

## Lưu ý
- Ai có link đều thêm, vote, xoá được. Đủ dùng cho nhóm; đừng đăng link công khai.
- Vote tính theo trình duyệt, nên một người dùng nhiều trình duyệt hoặc tab ẩn danh có thể vote nhiều lần. Trong nhóm tin nhau thì không sao.
