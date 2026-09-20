# 04 — Làm sao logo và giá hiện lên trong ví

## Ví lấy dữ liệu từ đâu (đây là điều quyết định mọi thứ)

Không ví nào đọc hợp đồng của bạn để lấy logo hay giá. Chúng hỏi backend của
chính chúng:

| Ví | Nguồn logo | Nguồn giá |
|---|---|---|
| **OKX Wallet** | Cơ sở dữ liệu token của OKX; phần lớn đồng bộ từ CoinGecko/CMC | Bộ index DEX của OKX + CoinGecko/CMC |
| **Rabby** | DeBank | DeBank |
| **Trust Wallet** | Repo `trustwallet/assets` | CoinMarketCap / CoinGecko |
| **MetaMask** | Token list + CoinGecko | CoinGecko |
| **PancakeSwap** | `pancakeswap/token-list` | Chính pool on-chain |
| **DexScreener** | Gói trả phí Enhanced Token Info | Tự index từ pool, miễn phí |

**Kết luận thực tế: CoinGecko là đường găng.** Ba trong bốn ví bạn kể lấy logo
hoặc giá từ CoinGecko, trực tiếp hoặc gián tiếp. Nếu chỉ làm được một việc, làm
việc đó.

---

## Thứ tự nộp hồ sơ (theo tỉ lệ hiệu quả trên công sức)

### 1. DexScreener — tự động, miễn phí, có ngay

Không cần nộp gì. DexScreener index pool PancakeSwap V3 trong vài phút sau giao
dịch đầu tiên. Ngay sau bước `npm run pool:mainnet` và một lệnh swap nhỏ, bạn đã
có **giá + biểu đồ công khai** tại `dexscreener.com/bsc/<pool>`.

Logo/website/social trên trang cặp thuộc gói **Enhanced Token Info (~$299)** —
ngoài ngân sách $200. Giá và điều khoản có thể đổi; kiểm tra marketplace trước
khi trả tiền.

### 2. BscScan — cập nhật thông tin token, miễn phí

Vào trang token → "Update Token Info". Cần ký xác thực từ ví deployer. Nộp logo
(`brand/btcx-256.png`), website, mô tả, social.

Vì sao đáng làm sớm: nhiều bộ index và người soát hồ sơ coi trang BscScan đã
điền đủ là tín hiệu dự án nghiêm túc. Đây cũng là nơi người dùng vào kiểm tra đầu
tiên.

### 3. CoinGecko — miễn phí, 2–6 tuần, quan trọng nhất

Nộp qua form "Request Form" chính thức. Chuẩn bị sẵn từ `tokenlist/submission.json`:

- [ ] Địa chỉ hợp đồng dạng checksum + mã nguồn **đã verify**
- [ ] Logo PNG 200×200 (`brand/btcx-200.png`)
- [ ] Website sống, có tài liệu (xem checklist ở `03-ke-hoach-72-gio.md`)
- [ ] Link cặp giao dịch trên PancakeSwap + DexScreener
- [ ] Mô tả nêu rõ: bảo chứng 1:1 bởi BTCB, **không phải Bitcoin**, redeem được tại vault
- [ ] Nguồn cung lưu hành và cách tính (ở đây: bằng đúng lượng BTCB đang khoá)

**Nói trước:** CoinGecko đòi thanh khoản thật và dữ liệu thị trường kiểm chứng
được. Với pool $175, khả năng bị từ chối là cao. Cứ nộp — hồ sơ bị từ chối vẫn
cho bạn biết chính xác thiếu gì, và nộp lại được sau khi tăng thanh khoản.

### 4. CoinMarketCap — miễn phí, chậm hơn

Cùng bộ hồ sơ. Trust Wallet lấy giá từ CMC nên đây là bước bắc cầu.

### 5. OKX Wallet

Không có form một bước. Hai đường:

- **Đường chính (gián tiếp):** được CoinGecko/CMC index → OKX đồng bộ về.
- **Đường trực tiếp:** mở ticket hỗ trợ với đội OKX Web3 Wallet, gửi địa chỉ hợp
  đồng, file logo (PNG 256×256 nền trong suốt), link explorer, link cặp giao dịch.

Làm cả hai. Đường trực tiếp không tốn gì ngoài thời gian.

### 6. Rabby / DeBank

Rabby hiển thị theo dữ liệu token của DeBank. Gửi yêu cầu bổ sung logo/metadata
token qua kênh hỗ trợ của DeBank, kèm đúng bộ thông tin như trên.

### 7. PancakeSwap token list

PR vào `pancakeswap/token-list`. Dùng `tokenlist/bitcoinx.tokenlist.json` đã sinh
sẵn. Họ có tiêu chí về thanh khoản và độ tuổi dự án — nhiều khả năng chưa đạt
ngay, nhưng PR là miễn phí.

### 8. Trust Wallet — chưa đủ điều kiện, đừng mất thời gian lúc này

Yêu cầu hiện hành: **tối thiểu 10.000 holder, 15.000 giao dịch, và một bản audit
bảo mật đầy đủ từ đơn vị uy tín**. Không có đường tắt. `tokenlist/trustwallet-info.json`
và `brand/logo.png` (256×256, dưới 100KB) đã sinh sẵn để dùng khi nào đủ điều kiện.

---

## Đường tắt luôn dùng được: tự host token list

Không cần ai duyệt. Token list theo chuẩn Uniswap được MetaMask, Rabby,
PancakeSwap và nhiều ví khác import thủ công:

1. Host `tokenlist/bitcoinx.tokenlist.json` và thư mục `brand/` trên GitHub Pages.
2. Đặt `LOGO_BASE_URL` trong `.env` trỏ tới đó, chạy lại `npm run assets:mainnet`.
3. Hướng dẫn người dùng thêm URL đó vào phần "Import token list" của ví.

Cách này cho logo hiện lên **ngay lập tức** với người dùng chịu import. Không
thay thế được listing chính thức, nhưng dùng được trong lúc chờ.

---

## Thông số logo — đã sinh đủ trong `brand/`

| File | Dùng ở đâu |
|---|---|
| `btcx-32.png` | Token list, icon nhỏ trong ví |
| `btcx-128.png` | OKX (một số nơi yêu cầu 128×128) |
| `btcx-200.png` | CoinGecko, CoinMarketCap |
| `btcx-256.png` / `logo.png` | Trust Wallet (đúng tên `logo.png`, dưới 100KB), OKX |
| `btcx-512.png`, `btcx-1024.png` | Website, ảnh mạng xã hội |
| `btcx-logo.svg` | Vector cho website và tài liệu |

Sinh lại bất cứ lúc nào: `npm run logo`.

**Đừng sửa logo cho giống Bitcoin hơn.** Nền navy và gradient teal–xanh là cố ý.
Một logo bắt chước tròn cam chữ B nghiêng sẽ bị gắn cờ mạo danh ở đúng những nơi
bạn đang xin duyệt — và đó là kiểu từ chối rất khó gỡ về sau.

---

## Nguồn tham khảo

- [DEX Screener — Token Listing docs](https://docs.dexscreener.com/token-listing)
- [DEX Screener Marketplace — Enhanced Token Info](https://marketplace.dexscreener.com/product/token-info)
- [CoinGecko — How to List a New Cryptocurrency](https://support.coingecko.com/hc/en-us/articles/7291312302617-How-to-List-a-New-Cryptocurrency-on-CoinGecko)
- [Trust Wallet — Listing requirements](https://developer.trustwallet.com/developer/listing-new-assets/requirements)
- [Trust Wallet — Repository details (info.json, logo.png)](https://developer.trustwallet.com/developer/listing-new-assets/repository_details)
- [trustwallet/assets](https://github.com/trustwallet/assets)
- [OKX — Token Listing Application](https://www.okx.com/en-us/token-listing-apply)

Chính sách và mức phí của các bên này thay đổi thường xuyên. Mở đúng trang gốc
kiểm tra lại ngay trước khi nộp hoặc trả tiền.
