# 00 — Ba sự thật cần biết trước khi tiêu đồng nào

Đọc hết trang này trước khi làm bất cứ bước nào. Ba điều dưới đây quyết định
toàn bộ thiết kế trong repo này.

---

## 1. Không hợp đồng nào "đặt giá" được cho token

Đây là hiểu nhầm phổ biến nhất. Giá của một token ERC20 **không nằm trong hợp
đồng token**. Giá là mức người ta thực sự trả trong một thị trường. Ví (OKX,
Rabby, Trust, MetaMask) hiển thị giá bằng cách hỏi backend của chính họ —
CoinGecko, CoinMarketCap, DeBank, hoặc bộ index DEX riêng — chứ không bao giờ gọi
một hàm `getPrice()` trong hợp đồng của bạn.

Hệ quả: mọi thiết kế kiểu "gắn Chainlink vào token để token có giá Bitcoin",
"rebase nguồn cung theo giá BTC", "ghi giá vào biến trong contract" đều **không
làm ví hiện giá Bitcoin**. Chúng chỉ tạo ra một con số trang trí mà không ai đọc.

**Cách duy nhất khiến giá BTCx thực sự bám giá Bitcoin** là làm cho việc đổi
1 BTCx lấy 1 đơn vị Bitcoin thật luôn khả thi với bất kỳ ai, không cần xin phép.
Khi đó, nếu giá trên sàn lệch khỏi giá BTC, người khác kiếm được tiền bằng cách
kéo nó về — và họ sẽ làm, tự động, vì lợi nhuận. Đó chính là thứ
`BitcoinXVault` làm: khoá BTCB, mint/redeem 1:1, không giới hạn, không pause
được đường rút.

Không có tài sản thế chấp thật thì không có neo giá thật. Chỉ có một token trùng tên.

---

## 2. Ngân sách $200 đủ cho kỹ thuật, không đủ cho phân phối

Chia rõ hai nhóm mục tiêu:

| Mục tiêu | $200 / 72 giờ có làm được không? |
|---|---|
| Token BTCx sống trên BSC, mã nguồn đã verify | **Được** — chi phí gas dưới $10 |
| Cơ chế neo 1:1 với BTC hoạt động thật | **Được** — `BitcoinXVault` trong repo này |
| Có pool trên PancakeSwap, có giá giao dịch | **Được** — nhưng độ sâu chỉ ~$175 |
| Giá + biểu đồ hiện trên DexScreener | **Được** — index tự động, miễn phí, vài phút sau giao dịch đầu |
| Logo hiện trên DexScreener | **Không** — Enhanced Token Info giá $299, vượt cả ngân sách |
| Logo + giá trong ví OKX / Rabby / Trust | **Không trong 72 giờ** — xem bảng dưới |

Vì sao nhóm cuối không khả thi — đây là yêu cầu thật của họ, không phải suy đoán:

- **Trust Wallet** yêu cầu tối thiểu **10.000 holder + 15.000 giao dịch + một bản
  audit bảo mật đầy đủ từ đơn vị có uy tín** trước khi merge PR logo.
- **CoinGecko** không thu phí niêm yết, nhưng yêu cầu thanh khoản thật, dữ liệu
  thị trường kiểm chứng được, và **xét duyệt 2–6 tuần**.
- **OKX Wallet** không có form một-bước; phần lớn token có logo/giá trong OKX là
  do đã được CoinGecko/CMC index trước rồi OKX đồng bộ về.
- **Rabby** lấy dữ liệu token từ DeBank, cũng theo logic tương tự.

Nói thẳng: **CoinGecko là đường găng**. Gần như mọi ví trong danh sách của bạn
đều lấy logo và giá từ đó hoặc từ nguồn có yêu cầu còn cao hơn. Một pool $175 rất
nhiều khả năng bị CoinGecko từ chối vì không đủ thanh khoản thật.

Kế hoạch 72 giờ trong `03-ke-hoach-72-gio.md` vì vậy đặt mục tiêu là **hoàn tất
mọi thứ nằm trong tầm kiểm soát của bạn và nộp xong mọi hồ sơ**, chứ không hứa
ngày logo xuất hiện trong ví — ngày đó do bên thứ ba quyết định.

---

## 3. Tên "BitcoinX / BTCx" là rủi ro lớn nhất của dự án, không phải là tài sản

Một token tên BitcoinX, ký hiệu BTCx, quảng bá là "giá bám theo Bitcoin", trên
BSC sẽ bị đọc theo hai cách rất khác nhau:

- **Cách đúng:** một chứng chỉ bọc (wrapper) BTCB, nói rõ cơ chế, có thể redeem
  1:1 bất cứ lúc nào. Hợp pháp, minh bạch, có ích.
- **Cách sai:** một token trông giống Bitcoin, mua vào tưởng là Bitcoin. Đây là
  lý do bị từ chối listing, và là rủi ro pháp lý thật.

Ba điểm cụ thể cần xử lý:

1. **Nhận diện phải phân biệt được.** Logo trong `brand/` cố ý dùng nền navy và
   gradient teal–xanh, **không** dùng tròn cam chữ B nghiêng của Bitcoin. Đừng đổi
   lại cho "giống Bitcoin hơn" — đó chính là thứ khiến hồ sơ bị đánh dấu mạo danh.
2. **Mô tả phải nói rõ bản chất.** Mọi nơi mô tả token (`tokenlist/`, website,
   form đăng ký) đều phải có câu: BTCx được bảo chứng 1:1 bởi BTCB, **không phải
   Bitcoin**, và redeem được tại `BitcoinXVault`.
3. **Bối cảnh Việt Nam.** Tài sản mã hoá không phải phương tiện thanh toán hợp
   pháp tại Việt Nam. Nếu bạn định mời người khác góp vốn/mua BTCx như một khoản
   đầu tư, việc đó có thể chạm tới quy định về chứng khoán và huy động vốn. Repo
   này là công cụ kỹ thuật; nó không thay thế ý kiến luật sư. Hỏi luật sư trước
   khi bán ra công chúng.

Nếu điều bạn thực sự muốn là một memecoin mang hơi hướng Bitcoin, không có tài
sản bảo chứng — thì kiến trúc trong repo này **không phải thứ bạn cần**, và hãy
nói rõ để đổi hướng. Nhưng khi đó cũng đừng mô tả nó là "neo theo giá Bitcoin",
vì nó sẽ không neo.
