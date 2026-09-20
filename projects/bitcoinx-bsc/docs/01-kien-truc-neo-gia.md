# 01 — Kiến trúc và cơ chế neo giá

## Sơ đồ

```
         nạp BTCB                         mint BTCx 1:1
  Người dùng ───────────────► BitcoinXVault ───────────────► BitcoinX (BTCx)
         ◄─────────────── rút BTCB          ◄─────────── burn BTCx 1:1
                       (KHÔNG BAO GIỜ pause được)

                              │ khoá 100% BTCB
                              ▼
                    totalSupply(BTCx) ≤ BTCB đang khoá   ← bất biến, kiểm tra mỗi giao dịch

  PancakeSwap V3  ◄──── arbitrage kéo giá pool về 1:1 ────►  BitcoinXVault
   (BTCx / BTCB)

  BTCxPriceLens ──► đọc Chainlink BTC/USD + slot0 của pool + độ bảo chứng
                    (chỉ phục vụ dashboard & giám sát — ví KHÔNG đọc hợp đồng này)
```

## Ba hợp đồng

| Hợp đồng | Vai trò | Bytecode | Gas deploy (đo thật) |
|---|---|---|---|
| `BitcoinX` | ERC20 + EIP-2612 permit. Không owner, không blacklist, không thuế. | 5.312 B | (cùng tx với vault) |
| `BitcoinXVault` | Khoá BTCB, mint/redeem 1:1. Tự tạo `BitcoinX` trong constructor. | 6.588 B | 2.789.160 |
| `BTCxPriceLens` | Chỉ đọc. Gộp giá Chainlink + giá pool + độ bảo chứng. | 3.342 B | 796.715 |

Gas vận hành: mint ~69.158 (lần đầu của một ví: ~120.458), redeem ~64.726,
transfer BTCx ~51.396.

## Vì sao giá bám theo Bitcoin

Không có dòng code nào "đặt" giá. Neo giá đến từ một bất đẳng thức kinh tế luôn
đúng, miễn là đường redeem còn mở:

- **Pool rẻ hơn vault** (1 BTCx < 1 BTCB): mua BTCx rẻ trên pool → redeem tại
  vault lấy đúng 1 BTCB → bỏ túi chênh lệch. Lệnh mua đó đẩy giá pool lên.
- **Pool đắt hơn vault** (1 BTCx > 1 BTCB): mint BTCx tại vault đúng 1:1 → bán
  trên pool → bỏ túi chênh lệch. Lệnh bán đó kéo giá pool xuống.

Biên lợi nhuận của arbitrageur bị giới hạn bởi phí pool (0,01%) + phí vault
(mặc định 0%) + gas (~$0,05 trên BSC). Nghĩa là độ lệch neo cân bằng lý thuyết
nằm trong khoảng vài bps — miễn là có người nhìn. Script `05_peg_monitor.ts`
chính là để bạn là người nhìn đó trong 72 giờ đầu.

Vì BTCB bản thân nó được Binance bảo chứng 1:1 bởi BTC thật, chuỗi neo là:

```
BTCx ──1:1 (vault, on-chain, kiểm chứng được)──► BTCB ──1:1 (Binance)──► BTC
```

Bạn kế thừa luôn rủi ro của mắt xích thứ hai. Phải nói rõ điều này với người dùng:
nếu BTCB mất neo, BTCx mất neo theo. Đó là rủi ro của nhà phát hành BTCB, không
phải thứ code của bạn sửa được.

## Những quyết định thiết kế và lý do

**`BitcoinX.vault` là `immutable`, và vault tự tạo token trong constructor của nó.**
Không có hàm `setMinter`, không có giai đoạn nào quyền mint nằm ở ví deployer.
Nếu dùng cách thông thường (deploy token trước, gán minter sau) thì tồn tại một
"cửa sổ tin cậy" mà người đọc hợp đồng không thể loại trừ. Cách này loại bỏ nó
hoàn toàn ở mức bytecode.

**`redeem()` không có modifier pause.** Đây là quyết định quan trọng nhất trong
repo. Chủ sở hữu có thể tạm dừng `mint()` (ví dụ khi BTCB gặp sự cố) nhưng
**không có bất kỳ đường nào** để chặn người dùng rút tài sản của họ. Nếu redeem
chặn được thì neo giá chỉ tồn tại khi chủ sở hữu cho phép — tức là không phải neo.

**`sweep()` từ chối chạm vào collateral.** Chủ sở hữu thu hồi được token gửi
nhầm, nhưng `sweep(BTCB)` revert với `CollateralNotSweepable`. Phần bảo chứng
nằm ngoài tầm với của admin theo đúng bytecode, không phải theo lời hứa.

**Phí có trần cứng 0,50% (`MAX_FEE_BPS = 50`).** Không ai, kể cả owner, đặt được
phí cao hơn. Ngăn kịch bản "honeypot": token mua được nhưng bán ra mất 99%.

**Đo số dư thực nhận thay vì tin tham số `amount`.** BTCB không có thuế chuyển
khoản, nhưng vault vẫn so sánh `balanceOf` trước/sau. Nhờ vậy bất biến bảo chứng
không thể bị phá kể cả khi tái sử dụng vault với collateral khác.

**Fee tier pool 0,01% (100), không phải 0,25%.** Cặp BTCx/BTCB gần như luôn giao
dịch ở 1:1. Phí 0,25% tạo ra một dải chết rộng 25 bps mà arbitrage không có lời —
tức là neo giá lỏng hơn 25 lần so với cần thiết.

**PancakeSwap V3 tập trung thanh khoản, không phải V2.** Xem `02-ngan-sach-200-usd.md`
để thấy con số: cùng $175, V3 trong dải ±1% cho độ sâu thực tế cao gấp hàng chục
lần V2 trải đều từ 0 đến vô cực.

## Những gì hợp đồng này KHÔNG làm

- Không mint được token không có bảo chứng — kể cả owner, kể cả deployer.
- Không "đặt giá" cho ví. Ví đọc từ CoinGecko/DeBank, không đọc `BTCxPriceLens`.
- Không tự cân bằng pool. Arbitrage là do thị trường (và bạn) làm, không tự động.
- Không có cơ chế nâng cấp (proxy). Có chủ đích: proxy nghĩa là owner đổi được
  logic sau này, và như vậy lời hứa redeem 1:1 không còn là lời hứa.
