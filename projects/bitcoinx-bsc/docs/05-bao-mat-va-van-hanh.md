# 05 — Bảo mật và vận hành

## Trước khi deploy

- [ ] **Ví deployer là ví mới hoàn toàn.** Không dùng lại ví cá nhân. Chỉ nạp
      đúng số BNB cần dùng.
- [ ] Private key **không** nằm trong repo, không nằm trong lịch sử shell, không
      gửi qua chat. `.env` đã có trong `.gitignore` — kiểm tra lại bằng
      `git status` trước mỗi commit.
- [ ] `npm test` xanh 30/30.
- [ ] `npm run check:mainnet` xanh toàn bộ. Địa chỉ collateral sai = mất toàn bộ
      tiền nạp vào, không cứu được.
- [ ] Đã diễn tập trọn vẹn mint → redeem trên testnet.

## Ngay sau khi deploy

- [ ] `npm run verify:mainnet` thành công; xem được mã nguồn trên BscScan.
- [ ] Mint một lượng rất nhỏ rồi redeem lại. **Đường rút phải được kiểm chứng
      bằng giao dịch thật trước khi mời bất kỳ ai tham gia.**
- [ ] `backingRatio()` trả về đúng `1e18` (100%).
- [ ] `btcx.vault()` đúng bằng địa chỉ vault — script deploy đã kiểm tra, xác
      nhận lại bằng mắt trên BscScan.
- [ ] `mintFeeBps` và `redeemFeeBps` đều bằng 0.

## Xử lý quyền sở hữu vault

Vault dùng `Ownable2Step`. Quyền của owner đã bị thu hẹp tối đa ở mức bytecode:
đặt phí (trần cứng 0,50%), đổi ví nhận phí, tạm dừng **mint**, và thu hồi token
gửi nhầm **không phải collateral**. Owner **không** mint được, **không** rút được
collateral, **không** chặn được redeem.

Dù vậy vẫn phải xử lý dứt điểm — chọn một trong ba, theo thứ tự ưu tiên:

1. **Từ bỏ quyền sở hữu** (`renounceOwnership()`) — mạnh nhất về niềm tin. Đánh
   đổi: không bao giờ đặt được phí và không tạm dừng mint được nữa. Với một
   wrapper thuần tuý, đây thường là lựa chọn đúng.
2. **Chuyển cho ví đa chữ ký** (Safe, ngưỡng 2/3 trở lên) — giữ lại khả năng vận
   hành mà không có điểm thất bại đơn lẻ.
3. **Chuyển cho hợp đồng khoá thời gian (timelock) 24–48 giờ** — mọi thay đổi đều
   công khai trước khi có hiệu lực.

**Không** để quyền sở hữu nằm ở ví deployer nóng quá 48 giờ.

## Giám sát liên tục

Đặt cron 5 phút trong 72 giờ đầu, sau đó mỗi giờ:

```bash
*/5 * * * * cd /duong/dan/bitcoinx-bsc && npm run peg:mainnet >> /var/log/btcx-peg.log 2>&1
```

Script thoát với mã 2 khi có cảnh báo, để cron hoặc CI bắt được.

Ba tín hiệu và cách xử lý:

| Tín hiệu | Ý nghĩa | Xử lý |
|---|---|---|
| Lệch neo > 50 bps | Chưa ai arbitrage về. Với pool nhỏ, rất có thể chỉ có bạn. | Tự làm: pool rẻ → mua trên pool rồi redeem ở vault; pool đắt → mint ở vault rồi bán trên pool. |
| `backingRatio` < 100% | **Nghiêm trọng.** Về lý thuyết không xảy ra được (bất biến được kiểm tra mỗi giao dịch). | Dừng lại, điều tra trước khi làm bất cứ việc gì khác. |
| Chainlink feed cũ > 1 giờ | Con số BTCx/USD trên dashboard không đáng tin. | Chỉ ảnh hưởng hiển thị. Neo giá không phụ thuộc Chainlink. |

## Những gì hợp đồng này cố tình không có

Người quen đọc token BSC sẽ tìm mấy thứ dưới đây. Không có chúng là có chủ đích,
và nên nói rõ trong tài liệu công khai:

- **Không có proxy / không nâng cấp được.** Logic đã deploy là logic vĩnh viễn.
  Nâng cấp được nghĩa là lời hứa redeem 1:1 có thể bị viết lại.
- **Không có blacklist, không có pause transfer.** Không ai đóng băng được token
  của bạn.
- **Không có thuế mua/bán, không có giới hạn ví.** Lượng vào bằng đúng lượng ra.
- **Không có hàm mint cho owner.** Nguồn cung chỉ đến từ tài sản thế chấp.

## Giới hạn đã biết — nói ra, đừng giấu

1. **Rủi ro BTCB.** BTCx neo vào BTCB, BTCB neo vào BTC bởi Binance. Mắt xích thứ
   hai nằm ngoài tầm kiểm soát của bạn. BTCB mất neo thì BTCx mất neo theo.
2. **Chưa audit.** Repo có 30 test bao phủ các bất biến chính, nhưng test không
   phải audit. Đừng nói "đã kiểm toán".
3. **Thanh khoản mỏng.** Ở mức $175, một cú swap vài trăm đô sẽ quét hết dải.
   Neo thật nằm ở vault, không ở pool — nói rõ điều này với người dùng.
4. **Tập trung ở khâu vận hành.** Trong giai đoạn đầu bạn gần như là
   arbitrageur duy nhất. Neo giá phụ thuộc việc có người theo dõi.

## Việc không bao giờ làm

- Không quảng bá BTCx là Bitcoin, hay là "Bitcoin phiên bản rẻ".
- Không hứa lợi suất, không hứa giá tăng.
- Không đặt phí khác 0 mà không thông báo trước — dù trần cứng chỉ 0,50%.
- Không mời người ngoài bỏ tiền vào khi chưa có ý kiến luật sư về bối cảnh
  Việt Nam (xem `00-su-that-can-biet-truoc.md`, mục 3).
