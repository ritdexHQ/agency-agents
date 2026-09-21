# RUNBOOK — triển khai BitcoinX từ đầu đến cuối

Bản copy-paste. Mỗi bước có **kết quả mong đợi** và **điều kiện dừng**. Nếu kết
quả thực tế khác kết quả mong đợi, dừng lại — đừng đi tiếp.

> **Bước lên chain phải do bạn chạy.** Nó cần private key và tiền thật của bạn.
> Không ai khác nên giữ khoá đó, kể cả công cụ hỗ trợ. Toàn bộ phần còn lại —
> hợp đồng, test, script, logo, website, hồ sơ listing — đã xong và nằm trong repo.

---

## 0. Chuẩn bị (làm một lần)

Cần có:

- [ ] Node.js 22+, Python 3 (để sinh logo)
- [ ] **Ví mới hoàn toàn** cho deployer. Không dùng lại ví cá nhân.
- [ ] ~0,02 BNB trong ví đó (gas). Ở giá BNB $762 là khoảng **$15**.
- [ ] ~0,002156 BTCB trong ví đó (thanh khoản). Khoảng **$175**.
      **Rút một lần** từ sàn — rút nhiều lần ăn phí nhiều lần.
- [ ] API key BscScan (miễn phí, để verify mã nguồn)
- [ ] Một website sống (xem mục 6). Mọi hồ sơ listing đều bắt buộc có.

```bash
cd projects/bitcoinx-bsc
npm ci
npm test          # kỳ vọng: 30 passing
npm run logo      # kỳ vọng: 8 file trong brand/, logo.png < 100000 bytes
cp .env.example .env
```

Điền `.env`: `DEPLOYER_PRIVATE_KEY`, `BSCSCAN_API_KEY`, `FEE_RECIPIENT`,
`LOGO_BASE_URL`, `PROJECT_URL`, `GITHUB_URL`.

**Điều kiện dừng:** `.env` không bao giờ được commit. Kiểm tra:
```bash
git status --porcelain | grep -c "\.env$"   # kỳ vọng: 0
```

---

## 1. Xem trước website bằng dữ liệu on-chain thật (không tốn gas)

```bash
npx hardhat node          # cửa sổ 1, để chạy nền
npm run demo:local        # cửa sổ 2
# mở web/index.html?local=1 trong trình duyệt
```

Kỳ vọng: trang hiện `0,00215600 BTCB` đang khoá, `0,00215600 BTCx` lưu hành,
độ bảo chứng `100,0000%`, `mint mở` / `redeem luôn mở`.

Đây là đúng đường code mà trang sẽ dùng ở mainnet — chỉ khác địa chỉ RPC.

---

## 2. Diễn tập trên testnet

```bash
npm run check:testnet
```
Kỳ vọng: mọi dòng bắt đầu bằng `  OK  `. **Một dòng `FAIL` là dừng** — sửa
`scripts/config.ts` trước, đừng deploy.

```bash
npm run deploy:testnet
npm run verify:testnet
```
Kỳ vọng ở bước deploy: 9 dòng kiểm tra đều `OK`, trong đó `btcx.vault() == vault`.
Script tự dừng nếu có dòng nào FAIL.

Bây giờ **mint và redeem bằng tay trên BscScan testnet**:

1. Hợp đồng BTCB testnet → `approve(vault, <số lượng>)`
2. Vault → `mint(<số lượng>, <ví của bạn>)`
3. Vault → `redeem(<số lượng>, <ví của bạn>)` — không cần approve
4. Vault → `backingRatio()` → kỳ vọng `1000000000000000000`

```bash
npm run pool:testnet
npm run lens:testnet
npm run peg:testnet
```

> **CỔNG CHẶN.** Chưa redeem thành công trên testnet thì **không** sang mainnet.
> Mọi đồng trên mainnet là không hoàn lại được.

---

## 3. Lên mainnet

```bash
npm run check:mainnet
```
Kỳ vọng: tất cả `OK`, và dòng collateral in ra `symbol=BTCB decimals=18`.
Đối chiếu bằng mắt địa chỉ BTCB: `0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c`.

```bash
npm run deploy:mainnet
npm run verify:mainnet
```

Địa chỉ được ghi vào `deployments/56.json`. Mở BscScan, xác nhận tab **Contract**
có dấu tích xanh (đã verify).

**Mint thử số rất nhỏ rồi redeem lại ngay**, trên mainnet, trước khi làm gì tiếp:

```
BTCB.approve(vault, 100000000000000)      # 0,0001 BTCB
vault.mint(100000000000000, <ví bạn>)
vault.redeem(100000000000000, <ví bạn>)
```
Kỳ vọng: BTCB về lại ví đủ số. Đường rút phải được kiểm chứng bằng giao dịch
thật **trước khi** mời bất kỳ ai tham gia.

---

## 4. Tạo pool và nạp thanh khoản

```bash
LP_BTCB_TOTAL=0.002156 LP_BAND_BPS=100 npm run pool:mainnet
npm run lens:mainnet
```

Script tự động: đổi một nửa BTCB thành BTCx qua vault, tạo pool V3 fee 0,01%
khởi tạo đúng tại 1:1, rồi nạp thanh khoản tập trung trong dải ±1%.

Kỳ vọng: in ra địa chỉ pool và số `Position NFT #`. Nếu pool đã tồn tại và giá
lệch ngoài dải, script dừng và bảo bạn arbitrage về 1:1 trước — làm đúng như vậy.

Thực hiện **một lệnh swap nhỏ** trên PancakeSwap để kích hoạt các bộ index.
Vài phút sau, kiểm tra:

```
https://dexscreener.com/bsc/<địa chỉ pool>
```
Kỳ vọng: có giá và biểu đồ. **Đây là mốc "token đã có giá công khai".**

---

## 5. Sinh hồ sơ listing từ địa chỉ thật

```bash
npm run assets:mainnet
```

Sinh ra: `tokenlist/bitcoinx.tokenlist.json`, `tokenlist/trustwallet-info.json`,
`tokenlist/submission.json`, và `web/config.js` (website tự lấy số liệu on-chain
từ đây).

**Điều kiện dừng:** nếu script cảnh báo `LOGO_BASE_URL vẫn là example.com`, sửa
`.env` rồi chạy lại. Đừng nộp hồ sơ có URL example.com.

---

## 6. Xuất bản website

```bash
cp deploy/github-pages.yml ../../.github/workflows/
git add -A && git commit -m "chore: publish BitcoinX site" && git push
```
Rồi bật: repo → **Settings → Pages → Source = GitHub Actions**.

Sau khi có URL Pages, đặt `LOGO_BASE_URL=https://<user>.github.io/<repo>/brand`
trong `.env`, chạy lại `npm run assets:mainnet`, commit `web/config.js` và
`tokenlist/`.

Kiểm tra trang đã sống: phần **Bằng chứng dự trữ** phải hiện đúng số BTCB đang
khoá, đọc trực tiếp từ BSC trong trình duyệt.

---

## 7. Nộp hồ sơ (theo thứ tự này)

| # | Nơi | Chi phí | Thời gian | Ghi chú |
|---|---|---|---|---|
| 1 | BscScan — Update Token Info | miễn phí | vài ngày | Ký xác thực từ ví deployer |
| 2 | CoinGecko | miễn phí | 2–6 tuần | **Quan trọng nhất** — hầu hết ví lấy giá/logo từ đây |
| 3 | CoinMarketCap | miễn phí | chậm hơn | Trust Wallet lấy giá từ CMC |
| 4 | OKX Web3 Wallet — ticket hỗ trợ | miễn phí | vài tuần | Kèm PNG 256×256 |
| 5 | DeBank (cho Rabby) | miễn phí | vài tuần | |
| 6 | PR vào `pancakeswap/token-list` | miễn phí | — | Dùng file tokenlist đã sinh |

Chi tiết từng form: [`docs/04-logo-va-gia-tren-vi.md`](docs/04-logo-va-gia-tren-vi.md).

Chưa nộp Trust Wallet — họ đòi 10.000 holder + 15.000 giao dịch + audit.

---

## 8. Giám sát 72 giờ đầu

```bash
*/5 * * * * cd /đường/dẫn/bitcoinx-bsc && npm run peg:mainnet >> /var/log/btcx-peg.log 2>&1
```

Script thoát mã `2` khi có cảnh báo. Ba tình huống:

| Cảnh báo | Làm gì |
|---|---|
| Lệch neo > 50 bps | Arbitrage về 1:1. Pool rẻ → mua trên pool rồi redeem ở vault. Pool đắt → mint ở vault rồi bán trên pool. Ở quy mô này rất có thể chỉ có bạn làm việc đó. |
| `backingRatio` < 100% | **Dừng mọi thứ và điều tra.** Về lý thuyết không xảy ra được. |
| Chainlink feed cũ > 1 giờ | Chỉ ảnh hưởng số hiển thị. Neo giá không phụ thuộc Chainlink. |

Thay vì arbitrage bằng tay, chạy bot giữ neo — **mô phỏng trước**:

```bash
npm run keeper:mainnet                    # không gửi giao dịch nào
KEEPER_EXECUTE=1 npm run keeper:mainnet   # chỉ khi "lai rong du kien" dương
touch keeper.stop                         # dừng khẩn cấp
```

Chi tiết và cấu hình: [`docs/06-bot-giu-neo.md`](docs/06-bot-giu-neo.md).

---

## 9. Bàn giao quyền sở hữu (trong vòng 48 giờ)

Không để quyền owner nằm ở ví deployer nóng. Chọn một:

```
vault.renounceOwnership()                  # mạnh nhất về niềm tin, mất khả năng đặt phí/pause mint
vault.transferOwnership(<địa chỉ Safe>)    # ví đa chữ ký 2/3 — rồi Safe gọi acceptOwnership()
vault.transferOwnership(<timelock 24-48h>) # mọi thay đổi công khai trước khi có hiệu lực
```

`Ownable2Step`: chủ mới **phải** gọi `acceptOwnership()` thì mới đổi. Xác nhận
bằng `vault.owner()`.

Nhắc lại phạm vi quyền owner — kể cả khi bị chiếm: **không** mint được, **không**
rút được collateral, **không** chặn được redeem, **không** đặt phí quá 0,50%.

---

## Khi có sự cố

| Triệu chứng | Nguyên nhân thường gặp |
|---|---|
| `check:*` báo FAIL ở collateral | Sai địa chỉ trong `scripts/config.ts`, hoặc sai mạng |
| `verify` báo `already verified` | Bình thường — bytecode trùng hợp đồng đã verify |
| `verify` FAIL khác | Thiếu `BSCSCAN_API_KEY`, hoặc sai tham số constructor |
| `pool:mainnet` dừng vì lệch dải | Giá pool đã trôi — arbitrage về 1:1 rồi chạy lại |
| Website hiện "không kết nối được RPC" | RPC công cộng chặn; thêm endpoint vào `rpcs` trong `web/config.js` |
| DexScreener chưa thấy cặp | Chưa có giao dịch nào — thực hiện một swap nhỏ |
