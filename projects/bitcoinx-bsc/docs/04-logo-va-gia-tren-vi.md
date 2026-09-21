# 04 — DEX Screener trước, ví sau

> Bản này đã đổi ưu tiên theo quyết định bỏ qua CoinGecko và CoinMarketCap.
> Hệ quả của quyết định đó được nói thẳng ở mục 2 — đọc trước khi tiêu tiền.

---

## 1. DEX Screener hoạt động thế nào

Hai thứ hoàn toàn tách biệt, rất hay bị gộp làm một:

| | Cách có được | Chi phí | Thời gian |
|---|---|---|---|
| **Giá + biểu đồ + cặp giao dịch** | Tự động, khi pool có thanh khoản **và ít nhất một giao dịch** | Miễn phí | Vài phút |
| **Logo + website + social** | Token list được hỗ trợ (CoinGecko…) **hoặc** Enhanced Token Info trả phí | $0 hoặc ~$299 | Hàng tuần, hoặc dưới 15 phút |

Không có phí niêm yết, không có đơn xin duyệt, **không có ngưỡng thanh khoản tối
thiểu** cho phần index tự động. Đây là điểm khác biệt lớn so với CoinGecko, và là
lý do hướng DEX Screener hợp với ngân sách nhỏ.

Điều kiện "ít nhất một giao dịch" là thứ hay bị bỏ sót: pool vừa tạo xong chưa có
giao dịch nào thì cặp không xuất hiện. Đó là việc của `npm run bootstrap:mainnet`.

---

## 2. Bỏ CoinGecko thì logo chỉ còn một đường: Enhanced Token Info

DEX Screener lấy logo từ các token list được hỗ trợ — CoinGecko là nguồn chính.
Gói **Enhanced Token Info** tồn tại đúng để đi vòng qua điều đó: nó cho hiển thị
logo, banner, website và social "bất kể tình trạng niêm yết trên dịch vụ bên thứ
ba".

**Đã chốt: ngân sách $500, mua gói này.** Nó là khoản chi duy nhất trong toàn bộ
kế hoạch mua được một kết quả hiển thị chắc chắn, không qua hàng đợi xét duyệt.

| | |
|---|---|
| Giá | Từ **$299**, có các gói tới $499 — chọn gói $299 để vừa ngân sách |
| Thanh toán | Crypto phổ biến, hoặc thẻ tín dụng/ghi nợ |
| Xử lý | Thường vài phút, có thể tới 12 giờ |
| Hỗ trợ | support@dexscreener.com |

Giá và điều khoản đổi theo thời gian — mở đúng trang marketplace kiểm tra ngay
trước khi trả tiền, và **đừng mua gói $499**: nó vượt ngân sách $500 sau khi đã
trừ gas và thanh khoản.

Hệ quả thứ hai của việc bỏ CoinGecko, với mục tiêu ban đầu là logo + giá trong ví:

| Ví | Còn khả thi khi bỏ CoinGecko? |
|---|---|
| **Rabby** | Có — dữ liệu từ DeBank, nộp trực tiếp được, miễn phí |
| **OKX Wallet** | Một phần — có kênh ticket trực tiếp, nhưng đường chính của họ là đồng bộ từ CoinGecko/CMC |
| **Trust Wallet** | Không — vẫn đòi 10.000 holder + 15.000 giao dịch + audit |
| **MetaMask** | Chỉ qua token list tự host, người dùng phải tự import |

Enhanced Token Info **không** đưa logo sang các ví đó — nó chỉ tác dụng trên DEX
Screener. Đừng nhầm hai việc.

---

## 3. Thứ tự làm

### Bước 1 — Có giá trên DEX Screener (miễn phí, cùng ngày)

```bash
npm run pool:mainnet                            # tạo pool + nạp thanh khoản
BOOTSTRAP_EXECUTE=1 npm run bootstrap:mainnet   # một giao dịch để kích hoạt index
npm run ds:mainnet                              # kiểm tra đã được index chưa
```

`bootstrap` chạy **đúng một lần** và tự từ chối nếu pool đã từng có giao dịch
(kiểm tra `feeGrowthGlobal` on-chain, chỉ tăng khi có swap). Muốn chạy lần hai để
"tạo vol" thì đó là wash trading — xem `06-bot-giu-neo.md`.

`npm run ds:mainnet` đọc API công khai của DEX Screener và báo: đã index chưa,
giá bao nhiêu, thanh khoản bao nhiêu, logo/website/social đã hiện chưa, và trạng
thái đơn Enhanced Token Info nếu đã mua.

### Bước 2 — Mua Enhanced Token Info (~$299)

https://marketplace.dexscreener.com/product/token-info

**Điều kiện tiên quyết:** cặp phải đã được index. Gói này gắn thông tin vào một
trang cặp đang tồn tại, nên phải làm xong Bước 1 trước. Chạy `npm run ds:mainnet`
và thấy `DA DUOC INDEX` rồi mới mở ví ra trả tiền.

Toàn bộ nội dung cần điền đã được sinh sẵn — chạy `npm run assets:mainnet` rồi mở
[`tokenlist/dexscreener-submission.md`](../tokenlist/) và copy từng ô.

| Ô | Dùng file / nội dung |
|---|---|
| Chain | BNB Smart Chain |
| Địa chỉ token | `btcx` trong `tokenlist/submission.json` (đã checksum) |
| Icon / logo | `brand/btcx-256.png` |
| Header / banner | `brand/btcx-banner-600x200.png` — **tỉ lệ 3:1, tối thiểu 600px rộng** |
| Website | URL trang trong `web/` |
| Mô tả | Đoạn dựng sẵn trong `dexscreener-submission.md` |
| Social | Ít nhất một kênh có người trả lời |

Bắt buộc trong ô mô tả: **BTCx không phải Bitcoin**, được bảo chứng 1:1 bởi BTCB,
redeem được tại vault. Đây vừa là điều đúng đắn với người dùng, vừa là thứ giúp
hồ sơ không bị đọc thành mạo danh — xem ghi chú về nhận diện ở cuối trang.

Sau khi trả tiền, theo dõi bằng:

```bash
npm run ds:mainnet     # in ra trang thai don: processing / approved / rejected
```

### Bước 3 — Những nơi miễn phí còn lại

| # | Nơi | Chi phí | Được gì |
|---|---|---|---|
| 1 | BscScan — Update Token Info | miễn phí | Logo + mô tả trên trang token; ký xác thực từ ví deployer |
| 2 | DeBank | miễn phí | **Dữ liệu token cho Rabby** |
| 3 | OKX Web3 Wallet — ticket hỗ trợ | miễn phí | Kèm PNG 256×256, link explorer, link cặp giao dịch |
| 4 | Token list tự host | miễn phí | Logo hiện **ngay** với người dùng chịu import |
| 5 | PR vào `pancakeswap/token-list` | miễn phí | Có tiêu chí thanh khoản/tuổi dự án, nhiều khả năng chưa đạt |

Token list tự host: đặt `LOGO_BASE_URL` trỏ tới GitHub Pages, chạy lại
`npm run assets:mainnet`, rồi hướng dẫn người dùng thêm URL vào phần
"Import token list" của ví.

---

## 4. Boosts — không dùng ở giai đoạn này

DEX Screener bán **Boosts** ($100–$1.500 tuỳ gói) để nhân điểm trending. Ba lý do
không nên mua lúc này:

1. Boosts nhân điểm trending hiện có; token có nền tảng yếu không vì thế mà lên #1.
2. Nó mua **lượt xem**, không mua logo. Trang được nhiều người xem hơn mà vẫn
   không có logo và không có mô tả thì phản tác dụng.
3. Với pool $175, lưu lượng đổ vào sẽ gặp một sổ lệnh mà một lệnh vài trăm đô đã
   quét sạch. Đó là cách nhanh nhất để mất uy tín.

Thứ tự đúng: **có giá → có logo và mô tả → có thanh khoản thật → rồi mới nghĩ đến
lượt xem.**

---

## 5. Kiểm tra liên tục

```bash
npm run ds:mainnet     # thoát mã 2 nếu cặp chưa được index
```

Đặt cron mỗi giờ trong 72 giờ đầu. Script báo chính xác còn thiếu gì: logo, social,
thanh khoản quá mỏng, hay không có giao dịch nào trong 24h.

> Ghi chú về kiểm chứng: API DEX Screener bị chặn trong môi trường phát triển của
> repo này nên script `08_dexscreener_check.ts` **chưa được chạy đối chiếu với dữ
> liệu thật**. Nó xử lý được mọi trường hợp thiếu trường, và in nguyên lỗi khi
> API trả về khác dự kiến. Lần chạy đầu trên máy bạn, đối chiếu với trang web
> DEX Screener một lượt.

---

## 6. Bộ nhận diện trong `brand/`

Sinh lại bất cứ lúc nào: `npm run logo`.

| File | Dùng ở đâu |
|---|---|
| `btcx-32.png` | Token list, icon nhỏ trong ví |
| `btcx-128.png` | OKX (một số nơi yêu cầu 128×128) |
| `btcx-200.png` | Kích thước phổ biến cho biểu mẫu |
| `btcx-256.png` / `logo.png` | **Icon cho Enhanced Token Info**; Trust Wallet cần đúng tên `logo.png`, dưới 100KB |
| `btcx-banner-600x200.png` | **Token Header của DEX Screener** — tỉ lệ 3:1, tối thiểu 600px rộng |
| `btcx-banner-1200x400.png` · `-1800x600.png` | Bản độ phân giải cao của banner |
| `btcx-512.png`, `btcx-1024.png` | Website, ảnh mạng xã hội |
| `btcx-logo.svg` | Vector cho website và tài liệu |

**Ghi chú về nhận diện.** Logo dùng đĩa cam ký hiệu ₿ trắng, cùng họ với Bitcoin
— hợp lệ cho một wrapper thật sự bảo chứng 1:1, đúng như WBTC, BTCB, cbBTC. Khác
biệt là các token đó đều mang dấu phân biệt riêng (BTCB gắn huy hiệu Binance,
cbBTC dùng xanh Coinbase), còn bản này thì không.

Vì vậy **toàn bộ việc phân biệt dồn vào phần chữ**: câu "BTCx không phải Bitcoin,
được bảo chứng 1:1 bởi BTCB, redeem được tại vault" phải có trong mọi hồ sơ — kể
cả ô mô tả của Enhanced Token Info. Bỏ câu đó ra là tự chuốc rủi ro bị gắn cờ mạo
danh ở đúng nơi vừa trả $299.

Bản có chữ `x` làm dấu phân biệt luôn sẵn sàng:

```bash
BTCX_THEME=orange npm run logo   # đĩa cam + chữ x navy
BTCX_THEME=navy   npm run logo   # nhận diện riêng hoàn toàn
BTCX_THEME=bitcoin npm run logo  # bản hiện tại (mặc định)
```

---

## Nguồn tham khảo

- [DEX Screener — Token Listing docs](https://docs.dexscreener.com/token-listing)
- [DEX Screener Marketplace — Enhanced Token Info](https://marketplace.dexscreener.com/product/token-info)
- [DEX Screener — Boosting docs](https://docs.dexscreener.com/boosting)
- [DEX Screener — cập nhật thông tin token (help)](https://help.dexscreener.com/en/articles/1147201)
- [Trust Wallet — điều kiện niêm yết](https://developer.trustwallet.com/developer/listing-new-assets/requirements)
- [OKX — Token Listing Application](https://www.okx.com/en-us/token-listing-apply)

Chính sách và mức phí của các bên này thay đổi thường xuyên. Mở đúng trang gốc
kiểm tra lại ngay trước khi nộp hoặc trả tiền.
