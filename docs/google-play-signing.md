# Ký và đưa HTM GLOBAL lên Google Play

## 1. Tạo khóa ký một lần

Tạo khóa trên máy riêng, lưu bản sao ngoại tuyến và tuyệt đối không commit file `.jks` vào Git:

```bash
keytool -genkeypair -v \
  -keystore htm-upload-key.jks \
  -alias htm-upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Google Play yêu cầu ứng dụng Android mới phát hành dưới dạng **Android App Bundle (`.aab`)**. File APK phù hợp cho cài đặt thử nghiệm trực tiếp.

## 2. Thiết lập Google Play Console

Tạo ứng dụng mới trong Google Play Console với tên **HTM GLOBAL**, chọn loại ứng dụng và email liên hệ. Package name của ứng dụng là `vn.htmglobal.retailflow`; package name này phải giữ cố định sau lần phát hành đầu tiên.

Bật **Play App Signing**, tải khóa upload lên theo hướng dẫn của Console, sau đó tạo file `.aab` đã ký bằng khóa upload. Google sẽ giữ khóa ký ứng dụng ở phía máy chủ.

## 3. Secrets cho workflow build

Trong GitHub repository, vào **Settings → Secrets and variables → Actions** và thêm:

| Secret | Giá trị |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | Nội dung base64 của file `htm-upload-key.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | Mật khẩu keystore |
| `ANDROID_KEY_ALIAS` | `htm-upload` |
| `ANDROID_KEY_PASSWORD` | Mật khẩu key |

Tạo chuỗi base64 bằng:

```bash
base64 -w 0 htm-upload-key.jks > htm-upload-key.base64
```

Không ghi các giá trị này vào `capacitor.config.ts`, `.env`, log build hoặc mã nguồn.

## 4. Phát hành

Workflow hiện tại tạo APK release trên runner Android. Trước khi phát hành Google Play, đổi task Gradle thành `bundleRelease` để tạo `.aab`, ký bằng upload key và tải file `.aab` lên **Testing → Internal testing**. Sau khi kiểm thử đăng nhập, tạo đơn hàng, tồn kho và thanh toán trên nhiều thiết bị, mới chuyển sang Production.

## 5. Thông tin cần chuẩn bị

Cần chuẩn bị tên ứng dụng, mô tả ngắn/dài, icon 512×512, ảnh chụp màn hình điện thoại, chính sách quyền riêng tư, email hỗ trợ và khai báo dữ liệu. Nếu dùng tài khoản cá nhân Google Play mới, Google có thể yêu cầu giai đoạn kiểm thử kín trước khi cho phát hành công khai.
