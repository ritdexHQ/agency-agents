# 02 — Ngân sách $500: phân bổ và con số thật

> Giá tham chiếu dùng trong trang này, lấy on-chain ngày **20/09/2026**:
> **BTC ≈ $81.178** · **BNB ≈ $762,43**. Tính lại theo giá lúc bạn triển khai.

---

## Chi phí gas — đo thật, không ước lượng

Số gas dưới đây lấy từ `npm run gas` (script `scripts/99_gas_report.ts`), chạy
trên chính bytecode trong repo này:

| Giao dịch | Gas | @0,1 gwei | @1 gwei | @3 gwei |
|---|---:|---:|---:|---:|
| Deploy `BitcoinXVault` (tạo luôn `BitcoinX`) | 2.789.160 | $0,21 | $2,13 | $6,38 |
| Deploy `BTCxPriceLens` | 796.715 | $0,06 | $0,61 | $1,82 |
| Tạo + khởi tạo pool V3 (~) | 4.600.000 | $0,35 | $3,51 | $10,52 |
| Nạp thanh khoản (mint position) (~) | 500.000 | $0,04 | $0,38 | $1,14 |
| 3 lệnh approve | 141.000 | $0,01 | $0,11 | $0,32 |
| **Tổng triển khai** | **~8.830.000** | **$0,67** | **$6,73** | **$20,19** |

BSC thường chạy ở vùng gas phí rất thấp; kiểm tra mức hiện tại tại
`bscscan.com/gastracker` ngay trước khi deploy. Cấp **$15 BNB** là dư kể cả
trong kịch bản 3 gwei cộng thêm hai chục giao dịch phát sinh.

Chi phí vận hành cho người dùng cuối: mint ~$0,005, redeem ~$0,005, chuyển BTCx
~$0,004 (ở 0,1 gwei). Gas rẻ chính là điều kiện để arbitrage neo giá hoạt động
được ở quy mô nhỏ.

---

## Phân bổ $500

| Khoản | Số tiền | Quy ra |
|---|---:|---|
| BNB cho gas + dự phòng giao dịch | $15 | ~0,0197 BNB |
| Thanh khoản pool BTCx/BTCB | $175 | ~0,002156 BTC |
| &nbsp;&nbsp;↳ nửa khoá trong vault làm bảo chứng | $87,50 | ~0,0010779 BTCB → mint ra BTCx |
| &nbsp;&nbsp;↳ nửa còn lại là BTCB nằm trong pool | $87,50 | ~0,0010779 BTCB |
| **DEX Screener Enhanced Token Info** | **$299** | Logo + banner + website + social trên trang cặp |
| Dự phòng (trượt giá, phí rút sàn, mua hụt) | $11 | |

Chỉ còn $11 dự phòng, nên hai điều phải làm đúng ngay lần đầu: **rút BTCB đúng
một lần** khỏi sàn, và **chọn gói $299** — DEX Screener có các gói tới $499, mua
nhầm là vỡ ngân sách.

Lưu ý khi mua: phí rút BTCB khỏi sàn tập trung có thể ăn mất một phần đáng kể của
$175 nếu bạn rút nhiều lần. **Rút đúng một lần.**

---

## Vì sao là PancakeSwap V3 dải hẹp, không phải V2

Với V2, thanh khoản trải đều từ giá 0 đến vô cực. Độ sâu tại vùng giá thực tế
gần như bằng không khi vốn nhỏ. Công thức tích số không đổi cho:

```
Δvào ≈ x · δ/2      với x = một nửa giá trị pool
```

Pool V2 trị giá $175 → mỗi nửa $87,50 → **một lệnh $0,44 đủ đẩy giá lệch 1%**.
Biểu đồ sẽ trông như một đường răng cưa, và mọi bot sẽ coi đó là token rác.

Với V3 và toàn bộ $175 dồn vào dải ±1% quanh 1:1, để đẩy giá từ 1,00 lên 1,01
phải mua hết phần BTCB trong dải, tức **~$87**. Chênh lệch khoảng **200 lần** ở
cùng số vốn.

Chọn độ rộng dải theo bảng này (đặt bằng `LP_BAND_BPS` trong `.env`):

| `LP_BAND_BPS` | Dải giá | Độ sâu tới mép dải | Rủi ro |
|---:|---|---:|---|
| 30 (±0,30%) | 0,997 – 1,003 | ~$87 | Hết dải sớm; ngoài dải pool không có giá → biểu đồ gãy |
| **100 (±1%)** | 0,990 – 1,010 | ~$87 | **Mặc định khuyến nghị cho pool < $500** |
| 300 (±3%) | 0,970 – 1,030 | ~$87 | Neo lỏng hơn; arbitrage phải chịu độ lệch lớn hơn mới có lời |

Độ sâu tới mép dải như nhau ở cả ba — cái khác là **giá còn giao dịch được trong
bao nhiêu phần trăm** trước khi pool hết thanh khoản. Với vốn nhỏ, dải rộng hơn
đổi độ chặt của neo lấy việc biểu đồ không bị gãy. Vault vẫn giữ neo thật ở 1:1
trong mọi trường hợp.

---

## Nói thẳng: $175 thanh khoản nghĩa là gì

- **Đủ để** DEX Screener index cặp và hiển thị giá + biểu đồ. Tự động, miễn phí,
  **không có ngưỡng thanh khoản tối thiểu** — chỉ cần pool có thanh khoản và ít
  nhất một giao dịch.
- **Đủ để** chứng minh cơ chế chạy đúng: ai cũng kiểm tra được mint/redeem 1:1.
- **Không đủ để** chống một cú swap $500 — lệnh đó sẽ quét hết dải và làm giá pool
  lệch xa 1:1. Và ở độ sâu này **không ai arbitrage về có lãi dưới mức lệch ~3,7%**
  (tính toán trong `06-bot-giu-neo.md`). Neo thật nằm ở vault, không ở pool.
- **Không mua được logo trên DEX Screener.** Xem ngay dưới đây.

---

## Khoản $299: đã quyết mua

Đã bỏ CoinGecko và CoinMarketCap khỏi kế hoạch. DEX Screener lấy logo từ token
list được hỗ trợ (CoinGecko là nguồn chính) **hoặc** từ gói Enhanced Token Info
trả phí. Bỏ nguồn thứ nhất thì chỉ còn nguồn thứ hai.

| | Ngân sách $200 (đã bỏ) | **Ngân sách $500 (đang dùng)** |
|---|---|---|
| BNB gas | $15 | $15 |
| Thanh khoản pool | $175 | $175 |
| Enhanced Token Info | — | **$299** |
| Dự phòng | $10 | $11 |
| Giá + biểu đồ trên DEX Screener | Có | Có |
| Logo + banner + social trên DEX Screener | Không | **Có** — thường vài phút, tối đa 12 giờ |

Lý do chọn: trong tất cả các khoản chi có thể, $299 này là khoản duy nhất mua
được một kết quả hiển thị chắc chắn, không qua hàng đợi xét duyệt. Mọi thứ khác
đều là hàng đợi hoặc là điều kiện về quy mô.

Ba điều cần biết trước khi trả tiền:

- **Phải index xong trước.** Gói này gắn thông tin vào một trang cặp đang tồn
  tại. Chạy `npm run ds:mainnet` thấy `DA DUOC INDEX` rồi mới mua.
- **Nó chỉ tác dụng trên DEX Screener.** Không đưa logo sang ví OKX hay Rabby.
- **Thanh toán bằng crypto hoặc thẻ.** Xử lý thường vài phút, có thể tới 12 giờ.

---

## Nếu nâng được ngân sách — thứ tự ưu tiên theo hiệu quả trên mỗi đô

| Thêm | Chi phí | Mở ra điều gì |
|---|---:|---|
| Nâng thanh khoản lên ~$2.400 | +$2.200 | Ngưỡng để arbitrage giữ neo trong vòng 1% có lãi — tức là neo giá mới thật sự chặt. Con số này tính ra ở `06-bot-giu-neo.md`. |
| Audit bảo mật | $5.000–15.000 | Điều kiện bắt buộc của Trust Wallet, và là thứ duy nhất khiến người lạ dám bỏ tiền thật vào vault. |

Không khuyến nghị mua **Boosts** ($100–$1.500) ở giai đoạn này: nó mua lượt xem
chứ không mua logo, và đổ lưu lượng vào một pool $175 là cách nhanh nhất để mất
uy tín. Xem `04-logo-va-gia-tren-vi.md`.

Sau $500 này, khoản đáng cân nhắc tiếp theo là thanh khoản — không phải quảng cáo.
