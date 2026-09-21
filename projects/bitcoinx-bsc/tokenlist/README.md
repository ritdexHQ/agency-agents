# tokenlist/

Thư mục này **được sinh tự động**, không sửa tay.

```bash
npm run assets:mainnet    # hoặc assets:testnet
```

Script `scripts/06_make_listing_assets.ts` đọc địa chỉ từ `deployments/<chainId>.json`
— tức là từ hợp đồng đã deploy thật — rồi sinh ra:

| File | Nộp ở đâu |
|---|---|
| `bitcoinx.tokenlist.json` | Token list chuẩn Uniswap. PR vào `pancakeswap/token-list`, hoặc tự host để người dùng import vào MetaMask/Rabby. |
| `trustwallet-info.json` | Đổi tên thành `info.json`, đặt cạnh `logo.png` trong PR vào `trustwallet/assets`. |
| `submission.json` | Bộ tham số sẵn sàng dán vào form CoinGecko / CoinMarketCap / OKX / DeBank. |

Lý do sinh tự động thay vì gõ tay: một ký tự sai trong địa chỉ hợp đồng khiến
người dùng mua nhầm token khác. Địa chỉ trong các file này được checksum hoá từ
`ethers.getAddress()`.

Nhớ đặt `LOGO_BASE_URL` và `PROJECT_URL` trong `.env` trước khi chạy — mặc định
là `example.com` và script sẽ cảnh báo nếu bạn quên.

Xem [`../docs/04-logo-va-gia-tren-vi.md`](../docs/04-logo-va-gia-tren-vi.md) để
biết thứ tự nộp hồ sơ.
