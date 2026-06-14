# FoodTraceability DApp

Ứng dụng blockchain quản lý chuỗi cung ứng và truy xuất nguồn gốc thực phẩm theo lô. Hệ thống ghi nhận trách nhiệm của Nông dân, Nhà máy, Đơn vị vận chuyển và Nhà bán lẻ bằng địa chỉ ví; người tiêu dùng tra cứu hành trình bằng mã lô, QR hoặc barcode.

## 1. Mục tiêu

- Quản lý danh tính và vai trò bằng địa chỉ ví Ethereum.
- Ghi dữ liệu chuỗi cung ứng lên smart contract theo đúng thứ tự nghiệp vụ.
- Phân biệt lô nguyên liệu thô và lô thành phẩm.
- Cho phép thành phẩm truy ngược về lô nguyên liệu.
- Ghi nhận nhiều chặng vận chuyển và đúng bên nhận được chỉ định.
- Hỗ trợ yêu cầu, phê duyệt, từ chối và lan truyền thu hồi.
- Cung cấp timeline, QR, barcode, feedback và rating.
- Dùng VND làm đơn vị giá bán; ETH local chỉ dùng trả gas mô phỏng.

## 2. Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Smart contract | Solidity `0.8.20` |
| Blockchain local | Hardhat `2.x` |
| Tương tác contract | Ethers.js `6.x` |
| Ví | MetaMask |
| Frontend | HTML5, CSS3, Bootstrap `5.3`, JavaScript modules |
| QR và barcode | QRCode.js, JsBarcode |
| Quét mã | html5-qrcode |
| Kiểm thử | Mocha, Chai, Hardhat Toolbox |

## 3. Vai trò

| Vai trò | Chức năng |
|---|---|
| Admin | Cấp/vô hiệu hóa tài khoản, duyệt hoặc từ chối thu hồi |
| Farmer | Tạo lô nguyên liệu, xác nhận thu hoạch và chỉ định Nhà máy tiếp nhận |
| Manufacturer | Chỉ xử lý nguyên liệu được giao, tạo thành phẩm và chỉ định Nhà phân phối đầu tiên |
| Distributor | Ghi nhận từng chặng vận chuyển và chỉ định đối tác nhận |
| Retailer | Xác nhận nhận hàng, niêm yết giá, tạo QR/barcode |
| Consumer | Tra cứu timeline và gửi đánh giá |

Frontend được chia thành trang riêng cho từng vai trò. Khi chưa kết nối ví hoặc dùng sai vai trò, dashboard và chức năng nghiệp vụ bị ẩn. Smart contract tiếp tục kiểm tra quyền ở lớp blockchain.

## 4. Quy trình nghiệp vụ

```text
Farmer tạo lô nguyên liệu
→ Farmer xác nhận thu hoạch và chỉ định Manufacturer
→ Manufacturer tạo thành phẩm và chỉ định Distributor đầu tiên
→ Distributor được chỉ định nhận chuyến đầu
→ Các Distributor chỉ định bên nhận ở từng chặng tiếp theo
→ Retailer xác nhận nhận hàng
→ Retailer niêm yết giá VND
→ Consumer quét mã và xem timeline
```

### Nguyên liệu và thành phẩm

Farmer chỉ tạo dữ liệu nguyên liệu chưa chế biến, ví dụ:

- Xoài tươi, thanh long tươi, cam tươi, bưởi tươi.
- Lúa ST25 sau thu hoạch.
- Quả cà phê chín đỏ.
- Hạt điều thô.
- Cá cơm tươi.
- Mật ong thô.

Manufacturer tạo lô thành phẩm có mã và đơn vị riêng. Hệ thống tách rõ:

- Lượng nguyên liệu sử dụng, ví dụ `480 kg`.
- Sản lượng đầu ra, ví dụ `240 hộp 2 kg`.
- Đơn vị thành phẩm: hộp, chai, túi, gói, thùng, kg hoặc lít.

Smart contract không cho tổng lượng nguyên liệu sử dụng vượt số lượng lô nguồn. Thành phẩm lưu `parentProductId` để truy ngược nguyên liệu.

Phiên bản hiện tại hỗ trợ một lô nguyên liệu chính cho mỗi lô thành phẩm. Mô hình nhiều nguyên liệu cho một thành phẩm chưa được triển khai.

## 5. Mã lô và lựa chọn tự động

- Mã lô Farmer được tạo tự động từ tên sản phẩm, ngày và hậu tố thời gian.
- Mã thành phẩm Manufacturer được tạo tự động.
- Các bước thu hoạch, chế biến, vận chuyển, nhận hàng, niêm yết và thu hồi dùng dropdown lô hợp lệ.
- Dropdown lọc theo trạng thái, vai trò, ví liên quan và yêu cầu thu hồi.
- Lô nguyên liệu đã dùng hết không còn xuất hiện để chế biến.
- Đối tác nhận hàng được chọn theo tên doanh nghiệp; địa chỉ ví được dùng tự động phía dưới.
- Manufacturer chỉ nhìn thấy nguyên liệu mà Farmer đã chỉ định cho đúng ví của mình.
- Distributor chỉ nhìn thấy thành phẩm hoặc chuyến hàng đang chờ chính ví đó tiếp nhận.

## 6. Quy trình thu hồi

```text
Đang lưu thông
→ Yêu cầu thu hồi
→ Admin phê duyệt hoặc từ chối
→ Đã thu hồi / Tiếp tục lưu thông
```

- Farmer, Manufacturer, Distributor hoặc Retailer đã tham gia lô có thể gửi yêu cầu.
- Khi yêu cầu đang chờ, lô bị chặn chế biến, vận chuyển, nhận hàng và niêm yết.
- Nếu yêu cầu bị từ chối, lô tiếp tục hoạt động ở trạng thái trước đó.
- Nếu thu hồi lô nguyên liệu được phê duyệt, các lô thành phẩm tạo từ nguyên liệu đó cũng chuyển sang `Recalled`.
- Admin chọn yêu cầu từ dropdown, không cần nhập mã lô thủ công.
- Timeline giữ đầy đủ yêu cầu, kết luận và người thực hiện.

## 7. Feedback và rating

- Feedback được lưu trên blockchain và gắn với địa chỉ ví.
- Mỗi ví chỉ được đánh giá một lần trên mỗi lô.
- Rating hợp lệ từ 1 đến 5.
- Điểm trung bình được tính từ danh sách feedback trên frontend nên hỗ trợ số thập phân, ví dụ `4.5/5`.
- Phiên bản demo không xác minh giao dịch mua hàng trước khi đánh giá.

## 8. Truy xuất nguồn gốc

Consumer có thể:

- Nhập hoặc quét mã lô.
- Quét QR và barcode CODE128 bằng hai chế độ camera riêng, hoặc tải ảnh mã lên.
- QR local chứa `FT-MÃ-LÔ`; barcode CODE128 chứa trực tiếp mã lô để giảm độ dài và tăng khả năng nhận diện.
- Farmer và Retailer có thể tạo lại tem từ lô thuộc đúng ví của mình mà không tạo giao dịch blockchain mới.
- Xem thông tin lô, nguồn gốc, hạn sử dụng, giá VND và trạng thái thu hồi.
- Xem lịch sử nguyên liệu và thành phẩm trên cùng timeline.
- Xem từng chặng vận chuyển, phương tiện, nhiệt độ và ví giao/nhận.

## 9. Cấu trúc dự án

```text
block_chain_nhom13/
├── contracts/
│   └── FoodTraceability.sol
├── scripts/
│   ├── deploy.js
│   └── seedDemoData.js
├── test/
│   └── FoodTraceability.test.js
├── frontend/
│   ├── index.html
│   ├── admin.html
│   ├── farmer.html
│   ├── manufacturer.html
│   ├── distributor.html
│   ├── retailer.html
│   ├── consumer.html
│   ├── css/
│   └── js/
├── hardhat.config.js
└── package.json
```

## 10. Các hàm contract chính

| Hàm | Mô tả |
|---|---|
| `addParticipant()` | Cấp vai trò cho ví |
| `deactivateParticipant()` | Vô hiệu hóa participant |
| `createProduct()` | Farmer tạo lô nguyên liệu |
| `harvestProduct()` | Farmer xác nhận thu hoạch và chỉ định Manufacturer |
| `createProcessedProduct()` | Manufacturer tạo thành phẩm và chỉ định Distributor đầu tiên |
| `shipProduct()` | Distributor ghi chặng vận chuyển |
| `receiveProduct()` | Retailer xác nhận nhận hàng |
| `setForSale()` | Retailer niêm yết giá VND |
| `requestRecall()` | Gửi yêu cầu thu hồi |
| `reviewRecall()` | Admin duyệt hoặc từ chối |
| `addFeedback()` | Gửi rating và bình luận |
| `getProductIdByBatchCode()` | Tra ID nội bộ từ mã lô |
| `getProductHistory()` | Đọc timeline |
| `getShippingRecords()` | Đọc các chặng vận chuyển |
| `getProcessedProductIds()` | Đọc thành phẩm tạo từ nguyên liệu |
| `getMaterialBalance()` | Đọc lượng nguyên liệu đã dùng và còn lại |

## 11. Cài đặt và chạy

### Cài dependency và kiểm thử

```powershell
npm install
npx.cmd hardhat compile
npx.cmd hardhat test
```

### Terminal 1: chạy blockchain local

```powershell
npx.cmd hardhat node
```

Giữ terminal này hoạt động. Khi dừng hoặc khởi động lại node, toàn bộ contract và dữ liệu local bị mất.

### Terminal 2: deploy

```powershell
npx.cmd hardhat run scripts/deploy.js --network localhost
```

Script deploy tự động cập nhật:

- `frontend/js/deployment.js`
- `frontend/js/abi.js`
- `CONTRACT_ADDRESS` trong `.env`

Không đưa `.env` lên Git. File `.env.example` chỉ mô tả biến cấu hình và không chứa khóa bí mật.

### Tạo dữ liệu demo

```powershell
npx.cmd hardhat run scripts/seedDemoData.js --network localhost
```

### Chạy frontend

Dùng VS Code Live Server hoặc static server:

```powershell
npx.cmd serve frontend
```

Không mở HTML trực tiếp bằng `file://` vì frontend sử dụng ES modules.

## 12. MetaMask local

| Thuộc tính | Giá trị |
|---|---|
| Network name | Hardhat Localhost |
| RPC URL | `http://127.0.0.1:8545` |
| Chain ID | `31337` |
| Currency symbol | `ETH` |

Import private key được in bởi `npx hardhat node`. Chỉ sử dụng các key này trên mạng local.

| Account | Vai trò demo |
|---|---|
| 0 | Admin, deployer |
| 1 | Farmer |
| 2 | Manufacturer |
| 3 | Distributor A |
| 4 | Distributor B |
| 5 | Retailer |
| 6-7 | Consumer |

## 13. Dữ liệu demo

Seed tạo 10 lô nguyên liệu và 10 lô thành phẩm. Các mã thành phẩm dùng để tra cứu:

```text
XCHL-2026-0612
ST25-HC-2606
ARA-DL-1206
DRVL-BT-1306
RAU-DL-0906
BUOI-BR-0806
CASHEW-BP-2606
CAM-VCA-1106
NUOCMAM-PQ-2606
MATONG-DN-2606
```

Tình huống thu hồi mẫu:

- `DRVL-BT-1306`: chờ Admin duyệt.
- `RAU-DL-0906`: đã thu hồi.
- `BUOI-BR-0806`: yêu cầu đã bị từ chối.

## 14. Kiểm thử

Bộ test kiểm tra:

- Quản lý participant và quyền Admin.
- Quyền Farmer và mã lô duy nhất.
- Tạo thành phẩm, đơn vị và cân bằng nguyên liệu.
- Chuỗi trạng thái qua nhiều Distributor.
- Bắt buộc đúng Manufacturer và Distributor được bên trước chỉ định.
- Đúng ví nhận ở từng chặng.
- Validation dữ liệu và nhiệt độ.
- Yêu cầu, từ chối và phê duyệt thu hồi.
- Chặn nhận hàng/niêm yết khi thu hồi đang chờ.
- Thu hồi thành phẩm khi nguyên liệu bị thu hồi.
- Chặn niêm yết lô hết hạn.
- Mỗi ví chỉ feedback một lần và rating thập phân.

Kết quả gần nhất:

```text
16 passing
```

## 15. Giới hạn bảo mật và phạm vi

- Phân quyền frontend chỉ ẩn giao diện nghiệp vụ; đây không phải cơ chế mã hóa dữ liệu.
- Các hàm đọc của contract và dữ liệu trên blockchain local vẫn có thể được truy vấn trực tiếp qua RPC.
- Smart contract bảo vệ quyền ghi và thứ tự trạng thái, không thể tự chứng minh dữ liệu nhập vào đúng với hàng hóa ngoài đời.
- Hệ thống thực tế cần kiểm định độc lập, chữ ký doanh nghiệp, IoT hoặc oracle.
- Muốn giới hạn quyền đọc cần dùng blockchain permissioned hoặc mã hóa dữ liệu ngoài chuỗi.
- Hardhat Localhost chỉ phù hợp phát triển và trình diễn.
- Camera trên điện thoại thường yêu cầu frontend chạy qua HTTPS.
- Chưa có thanh toán, trạng thái Sold hoặc xác minh người mua trước khi feedback.
- Contract có bytecode `24.574/24.576 byte`, chỉ còn 2 byte trước giới hạn EVM; phát triển lớn hơn phải tách thành nhiều contract hoặc thư viện.

## 16. Hướng phát triển

- Hỗ trợ nhiều lô nguyên liệu cho một thành phẩm.
- Tích hợp IoT cho nhiệt độ và độ ẩm vận chuyển.
- Dùng backend index event để truy vấn nhanh khi dữ liệu lớn.
- Thêm trạng thái Sold, Expired và quản lý tồn kho bán lẻ.
- Triển khai testnet hoặc Hyperledger Fabric/permissioned blockchain.
- Lưu tài liệu kiểm định ngoài chuỗi bằng hệ thống có kiểm soát truy cập.

## 17. Kết luận

FoodTraceability mô phỏng đầy đủ luồng nguyên liệu, chế biến, vận chuyển, bán lẻ, truy xuất và thu hồi bằng blockchain. Mỗi giao dịch ghi lại địa chỉ ví, thời gian và trạng thái, giúp tăng khả năng kiểm chứng trách nhiệm giữa các bên. Project phù hợp cho mục tiêu học tập và trình diễn kiến trúc DApp quản lý chuỗi cung ứng; để vận hành thực tế cần bổ sung hạ tầng định danh doanh nghiệp, kiểm định dữ liệu và bảo mật quyền đọc.
