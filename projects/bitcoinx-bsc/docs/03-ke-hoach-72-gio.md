# 03 — Kế hoạch 72 giờ

Nguyên tắc: **mọi việc phụ thuộc bên thứ ba đều được nộp sớm nhất có thể**, vì
thời gian xét duyệt nằm ngoài tầm kiểm soát. Mọi việc trong tầm kiểm soát phải
xong trước giờ thứ 48 để còn thời gian sửa.

Tiêu chí hoàn thành ở cuối 72 giờ: token sống + verify + neo giá chạy + có giá
trên DexScreener + toàn bộ hồ sơ đã nộp. **Không** bao gồm "logo đã hiện trong
ví OKX" — ngày đó do OKX quyết định, không phải bạn.

---

## Ngày 1 — Xây và diễn tập trên testnet (giờ 0–24)

| Giờ | Việc | Lệnh / kết quả |
|---|---|---|
| 0–1 | Cài đặt, chạy test | `npm ci && npm test` → 30/30 pass |
| 1–2 | Tạo ví deployer **mới hoàn toàn**, lưu private key ngoài máy | Không dùng lại ví cá nhân |
| 2–3 | Lấy BNB testnet từ faucet, điền `.env` | `cp .env.example .env` |
| 3–4 | **Kiểm tra địa chỉ hằng số** | `npm run check:testnet` → tất cả OK |
| 4–5 | Deploy testnet | `npm run deploy:testnet` |
| 5–6 | Verify mã nguồn | `npm run verify:testnet` |
| 6–8 | Diễn tập mint/redeem bằng tay trên BscScan | Nạp, mint, redeem, kiểm tra `backingRatio()` = 1e18 |
| 8–10 | Tạo pool + nạp LP testnet | `npm run pool:testnet` |
| 10–11 | Deploy lens, chạy monitor | `npm run lens:testnet && npm run peg:testnet` |
| 11–13 | Sinh logo + hồ sơ listing | `npm run logo && npm run assets:testnet` |
| 13–16 | Dựng trang web một trang (bắt buộc cho mọi hồ sơ listing) | Xem checklist bên dưới |
| 16–18 | Mua BTCB + BNB trên sàn, **rút một lần** về ví deployer | ~0,002156 BTCB + ~0,0197 BNB |

**Cổng chặn cuối Ngày 1:** nếu chưa redeem thành công trên testnet thì **không
đi tiếp**. Mọi đồng trên mainnet là không hoàn lại được.

---

## Ngày 2 — Lên mainnet (giờ 24–48)

| Giờ | Việc | Lệnh |
|---|---|---|
| 24–25 | Kiểm tra địa chỉ mainnet | `npm run check:mainnet` → **phải** tất cả OK |
| 25–26 | Deploy | `npm run deploy:mainnet` |
| 26–27 | Verify trên BscScan | `npm run verify:mainnet` |
| 27–28 | Mint thử số rất nhỏ rồi redeem lại | Xác nhận đường rút thật sự mở |
| 28–30 | Tạo pool + nạp thanh khoản | `LP_BTCB_TOTAL=0.002156 LP_BAND_BPS=100 npm run pool:mainnet` |
| 30–31 | Deploy lens | `npm run lens:mainnet` |
| 31–32 | Giao dịch swap đầu tiên (số nhỏ) để kích hoạt index | Qua PancakeSwap |
| 32–33 | Kiểm tra DexScreener đã hiện cặp | `dexscreener.com/bsc/<pool>` |
| 33–34 | Sinh lại hồ sơ với địa chỉ mainnet thật | `npm run assets:mainnet` |
| 34–36 | Nộp cập nhật thông tin token trên BscScan | Ký xác thực từ ví deployer |
| 36–40 | Nộp CoinGecko + CoinMarketCap | Xem `04-logo-va-gia-tren-vi.md` |
| 40–44 | Nộp OKX, DeBank/Rabby, PancakeSwap token list | " |
| 44–46 | Bật giám sát neo giá định kỳ | Cron 5 phút, `npm run peg:mainnet` |
| 46–48 | **Bàn giao quyền sở hữu vault** | Xem `05-bao-mat-va-van-hanh.md` |

---

## Ngày 3 — Canh giữ và thu dọn (giờ 48–72)

| Giờ | Việc |
|---|---|
| 48–60 | Theo dõi độ lệch neo mỗi giờ. Tự arbitrage về 1:1 khi lệch > 50 bps — với pool nhỏ, rất có thể bạn là người duy nhất làm việc này. |
| 60–64 | Công bố công khai: địa chỉ hợp đồng, địa chỉ vault, cách redeem, và câu "BTCx không phải Bitcoin". |
| 64–68 | Viết trang bằng chứng dự trữ: `backingRatio()` đọc trực tiếp từ `BTCxPriceLens.snapshot()`. |
| 68–72 | Tổng kết: chốt danh sách hồ sơ đã nộp + ngày nộp, đặt lịch theo dõi phản hồi. |

---

## Checklist trang web một trang (bắt buộc — không có nó thì mọi hồ sơ đều rớt)

Mọi nơi bạn nộp hồ sơ đều yêu cầu một website sống. Tối thiểu phải có:

- [ ] Tên, ký hiệu, logo, địa chỉ hợp đồng (dạng checksum, copy được)
- [ ] Câu nói rõ bản chất: "BTCx được bảo chứng 1:1 bởi BTCB. BTCx không phải Bitcoin."
- [ ] Giải thích cơ chế mint/redeem + link tới vault trên BscScan
- [ ] Bằng chứng dự trữ hiển thị trực tiếp: lượng BTCB khoá / lượng BTCx lưu hành
- [ ] Link tới mã nguồn đã verify
- [ ] Mục rủi ro: rủi ro BTCB, rủi ro hợp đồng, thanh khoản mỏng
- [ ] Ít nhất một kênh liên lạc có người trả lời

Có thể host miễn phí bằng GitHub Pages — đặt luôn thư mục `brand/` ở đó để dùng
làm `LOGO_BASE_URL`.

---

## Những gì KHÔNG hứa trong 72 giờ

Nói trước với mọi người liên quan, tránh hiểu nhầm về sau:

- Logo trong ví OKX / Rabby / Trust Wallet — phụ thuộc xét duyệt bên thứ ba,
  tính bằng tuần, và phần lớn còn kèm điều kiện thanh khoản/holder mà pool $175
  chưa đạt.
- Được CoinGecko / CoinMarketCap chấp nhận — 2–6 tuần và nhiều khả năng bị từ
  chối ở mức thanh khoản này.
- Logo trên DexScreener — cần gói trả phí ~$299, vượt ngân sách.

Cái **chắc chắn có** sau 72 giờ: một token sống, mã nguồn công khai, cơ chế neo
1:1 kiểm chứng được, giá và biểu đồ hiện trên DexScreener, và toàn bộ hồ sơ đã
nằm trong hàng đợi xét duyệt.
