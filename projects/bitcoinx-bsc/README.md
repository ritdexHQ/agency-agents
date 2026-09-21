# BitcoinX (BTCx) — token BSC được bảo chứng 1:1 bởi BTCB

Bộ triển khai hoàn chỉnh cho một token trên BNB Smart Chain có giá **thực sự**
bám theo Bitcoin, kèm bộ nhận diện và lộ trình đưa logo/giá lên ví.

```
Tên      BitcoinX          Ký hiệu   BTCx          Decimals  18
Mạng     BNB Smart Chain   Bảo chứng BTCB 1:1      Neo giá   redeem 1:1 không cần xin phép
```

---

## Đọc cái này trước

**Không hợp đồng nào đặt giá được cho token.** Ví (OKX, Rabby, Trust, MetaMask)
lấy giá từ backend của chính họ — CoinGecko, DeBank, bộ index DEX — chứ không
gọi hàm nào trong hợp đồng của bạn. Mọi thiết kế kiểu "gắn Chainlink vào token
để token có giá Bitcoin" đều tạo ra một con số không ai đọc.

Cách duy nhất khiến giá BTCx bám giá Bitcoin là **luôn cho phép bất kỳ ai đổi
1 BTCx lấy 1 BTCB**, không cần xin phép, không thể bị chặn. Khi giá trên sàn
lệch, người khác kiếm được tiền bằng cách kéo nó về — và họ sẽ làm. Đó là toàn
bộ cơ chế neo giá, và là lý do repo này xoay quanh `BitcoinXVault` chứ không
xoay quanh oracle.

Với ngân sách **$200 / 72 giờ**, đây là ranh giới trung thực:

| | |
|---|---|
| ✅ Làm được | Token sống, verify mã nguồn, neo 1:1 chạy thật, **giá + biểu đồ trên DEX Screener** (tự động, miễn phí, vài phút), website bằng chứng dự trữ, mọi hồ sơ miễn phí đã nộp |
| ❌ Không làm được với đúng $200 | **Logo trên DEX Screener** — gói Enhanced Token Info ~$299 vượt toàn bộ ngân sách, và sau khi bỏ CoinGecko thì không còn đường miễn phí nào |
| ❌ Không làm được trong 72 giờ | Logo trong ví OKX / Trust Wallet (xét duyệt hàng tuần; Trust Wallet đòi 10.000 holder + 15.000 giao dịch + audit) |

Chi tiết và số liệu: **[`docs/00-su-that-can-biet-truoc.md`](docs/00-su-that-can-biet-truoc.md)** ·
Hướng DEX Screener: **[`docs/04-logo-va-gia-tren-vi.md`](docs/04-logo-va-gia-tren-vi.md)**.

Sẵn sàng triển khai: **[`RUNBOOK.md`](RUNBOOK.md)** — từng lệnh, kết quả mong
đợi, và điều kiện dừng ở mỗi bước.

---

## Kiến trúc

```
         nạp BTCB                         mint BTCx 1:1
  Người dùng ───────────────► BitcoinXVault ───────────────► BitcoinX (BTCx)
         ◄─────────────── rút BTCB          ◄─────────── burn BTCx 1:1
                       (KHÔNG BAO GIỜ pause được)
```

| Hợp đồng | Vai trò | Bytecode | Gas deploy |
|---|---|---:|---:|
| `BitcoinX` | ERC20 + permit. Không owner, không blacklist, không thuế, không ai mint được ngoài vault. | 5.312 B | (cùng tx) |
| `BitcoinXVault` | Khoá BTCB, mint/redeem 1:1. Tự tạo token trong constructor → `vault` là `immutable`. | 6.588 B | 2.789.160 |
| `BTCxPriceLens` | Chỉ đọc: Chainlink BTC/USD + giá pool + độ bảo chứng, cho dashboard. | 3.342 B | 796.715 |

Bốn tính chất được bảo đảm ở mức bytecode, không phải bằng lời hứa:

- `redeem()` **không có** modifier pause — chủ sở hữu không có đường nào chặn bạn rút.
- `sweep()` revert khi đụng vào collateral — phần bảo chứng nằm ngoài tầm với của admin.
- Phí có **trần cứng 0,50%** (`MAX_FEE_BPS`) — không ai vượt được, kể cả owner.
- Không có hàm mint cho owner — nguồn cung chỉ đến từ tài sản thế chấp thật.

Chi tiết: [`docs/01-kien-truc-neo-gia.md`](docs/01-kien-truc-neo-gia.md).

---

## Bắt đầu

```bash
npm ci
npm test                 # 54 test, phủ bất biến hợp đồng + logic bot giữ neo
npm run logo             # sinh bộ logo vào brand/
cp .env.example .env     # điền khoá + RPC + API key
```

### Triển khai

```bash
npm run check:testnet    # BẮT BUỘC — đối chiếu mọi địa chỉ hằng số với on-chain
npm run deploy:testnet
npm run verify:testnet
npm run pool:testnet     # tạo pool V3 + nạp thanh khoản tập trung
npm run lens:testnet
npm run peg:testnet      # xem độ lệch neo

# chỉ chuyển sang mainnet sau khi đã redeem thành công trên testnet
npm run check:mainnet && npm run deploy:mainnet && npm run verify:mainnet
LP_BTCB_TOTAL=0.002156 LP_BAND_BPS=100 npm run pool:mainnet
npm run lens:mainnet
BOOTSTRAP_EXECUTE=1 npm run bootstrap:mainnet   # kích hoạt index DEX Screener
npm run ds:mainnet                              # kiểm tra đã có giá chưa
npm run assets:mainnet                          # sinh hồ sơ listing từ địa chỉ thật
```

| Lệnh | Việc |
|---|---|
| `npm test` | Chạy toàn bộ test |
| `npm run gas` | Báo cáo gas và kích thước bytecode |
| `npm run logo` | Sinh logo 32→1024 px + SVG + `logo.png` cho Trust Wallet |
| `npm run check:*` | Đối chiếu địa chỉ BTCB / Chainlink / PancakeSwap với on-chain |
| `npm run deploy:*` | Deploy vault (tạo luôn token) + kiểm tra sau deploy |
| `npm run verify:*` | Verify mã nguồn trên BscScan |
| `npm run pool:*` | Tạo pool PancakeSwap V3 + nạp thanh khoản |
| `npm run lens:*` | Deploy `BTCxPriceLens` |
| `npm run peg:*` | Giám sát độ lệch neo (thoát mã 2 khi có cảnh báo) |
| `npm run bootstrap:*` | Một giao dịch swap để kích hoạt index DEX Screener. Chạy đúng một lần, tự từ chối lần sau |
| `npm run ds:*` | Báo cáo tình trạng trên DEX Screener: đã index chưa, giá, thanh khoản, logo, đơn đã mua |
| `npm run keeper:*` | Bot giữ neo — arbitrage về 1:1. Mặc định mô phỏng; `KEEPER_EXECUTE=1` mới gửi lệnh thật |
| `npm run assets:*` | Sinh token list + `info.json` Trust Wallet + hồ sơ nộp + `web/config.js` |
| `npm run demo:local` | Dựng bản sao đầy đủ (vault + pool + router giả lập) trên node Hardhat |
| `npm run keeper:local` | Chạy thử bot giữ neo trên chain cục bộ, gồm cả nhánh gửi lệnh thật |

---

## Website

`web/index.html` là trang một-trang song ngữ VI/EN, không cần build, đọc **bằng
chứng dự trữ trực tiếp từ BNB Smart Chain trong trình duyệt** (không qua máy chủ
nào). Mọi hồ sơ listing đều bắt buộc có một website sống — đây là website đó.

```bash
npx hardhat node                 # cửa sổ 1
npm run demo:local               # cửa sổ 2
# mở web/index.html?local=1
```

Xuất bản qua GitHub Pages: copy `deploy/github-pages.yml` vào
`.github/workflows/`, bật Settings → Pages → Source = GitHub Actions. Thư mục
`brand/` được phục vụ cùng site nên dùng luôn làm `LOGO_BASE_URL`.

---

## Ngân sách $200

Giá tham chiếu on-chain ngày 20/09/2026: BTC ≈ $81.178, BNB ≈ $762,43.

| Khoản | Số tiền |
|---|---:|
| BNB cho gas (dư kể cả ở 3 gwei) | $15 |
| Thanh khoản pool BTCx/BTCB (~0,002156 BTC) | $175 |
| Dự phòng | $10 |

Toàn bộ chi phí triển khai on-chain vào khoảng **$0,67 ở 0,1 gwei**, hoặc
**$20 ở 3 gwei**. Gas không phải vấn đề.

Khoản phải quyết định riêng: **DEX Screener Enhanced Token Info ~$299** — đường
duy nhất còn lại để có logo trên DEX Screener sau khi bỏ CoinGecko. Nó lớn hơn
toàn bộ ngân sách $200, nên không cắt chỗ khác bù được. Hoặc chấp nhận có giá mà
không có logo, hoặc nâng ngân sách lên khoảng $500.

Bảng phân bổ đầy đủ, so sánh độ sâu V2 vs V3, và thứ tự ưu tiên khi nâng ngân
sách: [`docs/02-ngan-sach-200-usd.md`](docs/02-ngan-sach-200-usd.md).

---

## Tài liệu

| | |
|---|---|
| [`00-su-that-can-biet-truoc.md`](docs/00-su-that-can-biet-truoc.md) | Ba sự thật quyết định toàn bộ thiết kế — đọc trước khi tiêu đồng nào |
| [`01-kien-truc-neo-gia.md`](docs/01-kien-truc-neo-gia.md) | Cơ chế neo giá và lý do từng quyết định thiết kế |
| [`02-ngan-sach-200-usd.md`](docs/02-ngan-sach-200-usd.md) | Gas đo thật, phân bổ vốn, độ sâu thanh khoản |
| [`03-ke-hoach-72-gio.md`](docs/03-ke-hoach-72-gio.md) | Lịch triển khai theo giờ, có cổng chặn |
| [`04-logo-va-gia-tren-vi.md`](docs/04-logo-va-gia-tren-vi.md) | **DEX Screener trước, ví sau** — index tự động, gói logo $299, và hệ quả của việc bỏ CoinGecko |
| [`05-bao-mat-va-van-hanh.md`](docs/05-bao-mat-va-van-hanh.md) | Checklist bảo mật, xử lý quyền sở hữu, giám sát, giới hạn đã biết |
| [`06-bot-giu-neo.md`](docs/06-bot-giu-neo.md) | Bot giữ neo: cơ chế, kinh tế thực tế, và vì sao bot tạo volume không có ở đây |
| [`RUNBOOK.md`](RUNBOOK.md) | Trình tự triển khai copy-paste, có cổng chặn và bảng xử lý sự cố |

---

## Cảnh báo

**BTCx không phải Bitcoin.** Nó là chứng chỉ bọc BTCB, đổi lại được 1:1 tại
`BitcoinXVault`. Mọi mô tả công khai phải nói rõ điều này — đây vừa là yêu cầu
của các nơi xét duyệt listing, vừa là điều đúng đắn cần làm với người dùng.

Chuỗi neo là `BTCx ──1:1 (vault)──► BTCB ──1:1 (Binance)──► BTC`. Mắt xích thứ
hai nằm ngoài tầm kiểm soát của bạn.

Mã nguồn **chưa được audit**. Có 30 test phủ các bất biến chính, nhưng test
không phải audit. Tài sản mã hoá không phải phương tiện thanh toán hợp pháp tại
Việt Nam; hỏi luật sư trước khi mời người khác bỏ tiền vào.
