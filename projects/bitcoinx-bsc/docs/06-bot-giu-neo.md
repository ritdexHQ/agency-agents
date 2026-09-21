# 06 — Bot giữ neo (peg keeper)

## Trước hết: bot tạo volume không nằm trong repo này, và có lý do

Yêu cầu thường gặp là "bot MM tự tạo ví, tự giao dịch để tạo vol". Đó là
**wash trading** — tự khớp lệnh với chính mình qua nhiều ví để bơm con số khối
lượng. Repo này không có và sẽ không có công cụ đó, vì ba lý do cụ thể:

1. **Nó phá đúng mục tiêu của bạn.** CoinGecko và CoinMarketCap đối chiếu tính
   xác thực của khối lượng khi xét hồ sơ. Volume từ một cụm ví mới tinh, khớp
   lệnh qua lại với nhau, là mẫu hình dễ nhận nhất. Bị gắn cờ một lần thì hồ sơ
   khó gỡ về sau — mà listing CoinGecko lại chính là đường găng để có logo và
   giá trong OKX/Rabby (xem `04-logo-va-gia-tren-vi.md`).
2. **Nó làm người mua hiểu sai độ sâu thị trường.** Người nhìn thấy volume lớn
   sẽ tưởng bán ra dễ. Với pool $175, lệnh $500 đã quét hết dải. Khoảng cách
   giữa hai điều đó là tiền thật của người khác.
3. **Nó tự lỗ.** Mỗi vòng wash trade mất phí pool và gas. Volume giả được mua
   bằng tiền thật, và không tạo ra người mua thật nào.

Thứ **thật sự** cần cho một token wrapper — và cũng là thứ đúng nghĩa "market
making" — là bot giữ neo dưới đây.

---

## Bot giữ neo làm gì

Theo dõi giá pool so với tỉ lệ 1:1 của vault. Khi chênh lệch đủ lớn để có lãi
**thật** sau phí pool, phí vault và gas, nó đóng một vòng arbitrage kéo giá về 1:1:

| Tình huống | Bot làm | Kết quả |
|---|---|---|
| BTCx **rẻ** hơn 1 BTCB trên pool | Mua BTCx trên pool → redeem 1:1 tại vault | Lệnh mua đẩy giá lên |
| BTCx **đắt** hơn 1 BTCB trên pool | Mint BTCx 1:1 tại vault → bán trên pool | Lệnh bán kéo giá xuống |

Mỗi lệnh có lý do kinh tế, có đối tác thật (pool và vault), và làm giá BTCx bám
sát giá Bitcoin hơn. Volume sinh ra là hệ quả phụ của việc sửa giá, không phải
mục đích.

Tài liệu `02-ngan-sach-200-usd.md` đã nói: ở quy mô này rất có thể bạn là
arbitrageur duy nhất. Bot này là cách bạn giữ vai trò đó mà không phải ngồi canh.

---

## Bot này không thể bị dùng để bơm volume

Không phải vì có lời khuyên trong tài liệu, mà vì cấu trúc:

- **Không tự sinh ví.** Chạy bằng đúng một ví mà bạn cấu hình trong `.env`.
- **Không tự khớp lệnh.** Đối tác luôn là pool PancakeSwap và vault.
- **Không giao dịch khi biên âm.** `decide()` trả về `none` và hàm gửi lệnh
  không bao giờ được gọi. Sau đó còn một chặn nữa: mô phỏng qua Quoter, lỗ thì
  từ chối.
- **Giới hạn tốc độ.** Mặc định 6 lệnh/giờ. Một bot tạo vol cần giao dịch liên
  tục bất kể giá.
- **Chặn vượt đà.** Nếu lệnh sẽ đẩy giá vượt qua 1:1 sang phía bên kia, bot từ
  chối — vì như vậy là tạo ra độ lệch mới thay vì đóng độ lệch cũ.

---

## Kinh tế thực tế — và một kết luận khó chịu về pool $175

Điều này phát hiện ra khi chạy bot thật trên chain mô phỏng, không phải suy đoán.

Bot không được chọn quy mô lệnh tuỳ ý: nó phải chọn đúng lượng đóng vừa hết độ
lệch. Trong một pool, lượng đó tỉ lệ với **độ sâu pool nhân với độ lệch**. Lệnh
càng nhỏ thì gas cố định càng ăn hết lãi. Ghép hai điều đó lại:

```
lãi gộp một vòng  ≈  (độ lệch)² × (độ sâu một bên) / 4
gas một vòng      ≈  $0,03      (400k gas @ 0,1 gwei, BNB $762)
```

Bot chỉ có lãi khi vế trên lớn hơn vế dưới. Quy ra độ sâu pool tối thiểu:

| Độ lệch neo | Pool tối thiểu để arbitrage có lãi |
|---:|---:|
| 1,0% | ~$2.400 |
| 2,0% | ~$600 |
| 3,0% | ~$270 |
| 5,0% | ~$100 |

**Với pool $175 của kế hoạch ngân sách, bot chỉ nổ khi giá lệch quá ~3,7%.**

Đây không phải giới hạn của bot — nó đúng với **mọi** arbitrageur, kể cả người
khác. Đó chính là lý do một pool mỏng để giá trôi được: dưới ngưỡng đó, sửa giá
lỗ hơn là kệ nó.

Hệ quả cần nói thẳng với người dùng: **neo giá thật nằm ở vault, không nằm ở
pool.** Ai cần đúng giá Bitcoin thì mint/redeem 1:1 tại vault — luôn chính xác,
không phụ thuộc độ sâu. Pool chỉ để các ví và bộ index có một con số giá để hiển thị.

Muốn bot giữ neo chặt trong vòng 1% thì cần pool khoảng **$2.400 trở lên**. Đó là
con số thật để cân nhắc khi quyết định có rót thêm vốn hay không — xem bảng ưu
tiên trong `02-ngan-sach-200-usd.md`.

Và nói rõ một lần nữa: **bot này không phải để kiếm tiền.** Lãi mỗi vòng ở mức
vài cent đến vài chục cent. Nó tồn tại để giá BTCx không trôi khỏi giá Bitcoin
trong lúc chưa có ai khác làm việc đó.

---

## Cấu hình

Tất cả trong `.env`, xem `.env.example`:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `KEEPER_EXECUTE` | *(trống)* | Phải đặt `=1` mới gửi giao dịch thật. Mặc định là mô phỏng. |
| `KEEPER_MIN_EDGE_BPS` | 5 | Biên lãi tối thiểu **trên** mức hoà vốn thì mới động tay |
| `KEEPER_MAX_TRADE_BTCB` | 0.0005 | Trần quy mô mỗi lệnh |
| `KEEPER_MAX_TRADES_PER_HOUR` | 6 | Trần số lệnh mỗi giờ |
| `KEEPER_SLIPPAGE_BPS` | 30 | Dung sai trượt giá cho chặng swap |
| `KEEPER_OVERSHOOT_BPS` | 2 | Dải hạ cánh quanh 1:1. Phải **hẹp hơn** `KEEPER_MIN_EDGE_BPS` |
| `KEEPER_RESERVE_BNB` | 0.005 | Giữ lại BNB cho gas, không tiêu vào |
| `KEEPER_BNB_PER_BTC` | 0.0094 | Tỉ giá quy gas ra BTCB — cập nhật theo thị trường |

---

## Bot chọn quy mô lệnh thế nào

Không dùng quy mô tối đa. Mỗi lượt, bot mô phỏng qua Quoter (staticcall, không
tốn gas) và **chia đôi** để tìm lệnh lớn nhất đưa giá về đúng dải `±KEEPER_OVERSHOOT_BPS`
quanh 1:1, rồi so lãi ở vài mức nhỏ hơn và chọn mức lãi nhất.

Hai chi tiết quan trọng:

- **Dải hạ cánh phải hẹp hơn ngưỡng ra tay.** Nếu bot dừng ngay mép một dải rộng,
  nó để lại độ lệch ngược đủ lớn cho lượt sau đánh ngược lại — đánh qua đánh lại
  quanh mức neo, tốn phí và sinh volume vô nghĩa. Mặc định 2 bps < 5 bps nghĩa là
  đóng xong thì bot tự im.
- **Thang bậc cố định không dùng được.** Với pool vài trăm đô, quy mô hợp lý có
  thể nhỏ hơn trần cấu hình hàng trăm lần. Chia đôi tìm ra nó; thang 5 bậc thì bỏ sót.

Kiểm chứng trên chain mô phỏng: pool lệch 200 bps, bot chọn 0,0005026 BTCB
trong trần 0,01 BTCB (nhỏ hơn 20 lần), đưa giá từ 1,0200 về 0,9998, rồi lượt sau
báo `none`.

---

## Thử toàn bộ trên chain cục bộ trước

Chạy được cả nhánh gửi lệnh thật mà không tốn đồng gas nào:

```bash
npx hardhat node                                          # cửa sổ 1
DEMO_POOL_BTCX=0.05 DEMO_SKEW_BPS=200 npm run demo:local  # cửa sổ 2
npm run keeper:local                                      # mô phỏng
KEEPER_EXECUTE=1 KEEPER_MAX_TRADE_BTCB=0.01 npm run keeper:local
npm run keeper:local                                      # phải báo "none"
```

`DEMO_POOL_BTCX` đổi độ sâu pool, `DEMO_SKEW_BPS` đổi độ lệch — dùng để tự kiểm
chứng bảng kinh tế ở trên trước khi tin nó.

---

## Chạy

```bash
# 1. Luôn chạy mô phỏng trước. Không gửi giao dịch nào.
npm run keeper:mainnet

# 2. Đọc kỹ dòng "lai rong du kien". Chỉ khi nó dương và hợp lý mới bật thật.
KEEPER_EXECUTE=1 npm run keeper:mainnet

# 3. Dừng khẩn cấp — bot kiểm tra file này trước mọi thứ khác.
touch keeper.stop
```

Chạy định kỳ (mỗi 5 phút trong 72 giờ đầu):

```bash
*/5 * * * * cd /đường/dẫn/bitcoinx-bsc && KEEPER_EXECUTE=1 npm run keeper:mainnet >> /var/log/btcx-keeper.log 2>&1
```

Mỗi lần chạy đều ghi một dòng JSON vào `keeper.log.jsonl`, **kể cả khi không làm
gì**. Nhờ vậy về sau đối chiếu được từng lệnh với lý do kinh tế của nó — hữu ích
cả khi bạn cần chứng minh mình không thao túng thị trường.

```bash
# Xem các lệnh đã thực hiện
grep '"action":"executed"' keeper.log.jsonl | tail -20
```

---

## Cảnh báo vận hành

- Ví chạy bot cần giữ **cả BTCB lẫn BNB**. Hết một trong hai là bot đứng im.
- Ví chạy bot **không nên** là ví owner của vault. Tách quyền: bot chỉ cần tiền,
  không cần quyền quản trị.
- Bot dừng hoàn toàn khi `backingRatio() < 100%`. Nếu thấy điều này trong log,
  đó là sự cố nghiêm trọng — xem `05-bao-mat-va-van-hanh.md`.
- `KEEPER_BNB_PER_BTC` sai lệch nhiều sẽ làm ước lượng gas sai, dẫn tới bot giao
  dịch ở mức lỗ nhẹ hoặc bỏ lỡ cơ hội. Cập nhật nó khi thị trường đổi đáng kể.
- Giới hạn tốc độ và trần quy mô là tuyến phòng thủ, không phải gợi ý. Nới chúng
  ra chỉ khi thanh khoản pool đã lớn hơn nhiều lần quy mô lệnh.
