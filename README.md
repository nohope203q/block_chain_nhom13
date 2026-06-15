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
- Khi yêu cầu đang chờ, lô bị chặn thu hoạch, chế biến, vận chuyển, nhận hàng và niêm yết.
- Nếu yêu cầu bị từ chối, lô tiếp tục hoạt động ở trạng thái trước đó.
- Nếu thu hồi lô nguyên liệu được phê duyệt, các lô thành phẩm tạo từ nguyên liệu đó cũng chuyển sang `Recalled`.
- Nếu thành phẩm đang có yêu cầu riêng, thu hồi từ lô nguyên liệu sẽ đồng thời kết thúc yêu cầu đó ở trạng thái `Approved`.
- Admin chọn yêu cầu từ dropdown, không cần nhập mã lô thủ công.
- Timeline giữ đầy đủ yêu cầu, kết luận và người thực hiện.

## 7. Feedback và rating

- Feedback được lưu trên blockchain và gắn với địa chỉ ví.
- Chỉ lô đang ở trạng thái `ForSale` mới nhận đánh giá mới.
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
- Chặn thu hoạch, nhận hàng và niêm yết khi thu hồi đang chờ.
- Thu hồi thành phẩm khi nguyên liệu bị thu hồi.
- Kết thúc yêu cầu đang chờ của thành phẩm khi nguyên liệu bị thu hồi.
- Chặn niêm yết lô hết hạn.
- Chặn đánh giá lô chưa được niêm yết bán.
- Mỗi ví chỉ feedback một lần và rating thập phân.

Kết quả gần nhất:

```text
19 passing
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

---

# PHẦN II - GIẢI THÍCH MÃ NGUỒN PHỤC VỤ BÁO CÁO

Phần này giải thích cách các thành phần trong project phối hợp với nhau. Có thể sử dụng trực tiếp làm tài liệu ôn tập trước khi thuyết trình.

## 18. Kiến trúc tổng thể

Ứng dụng gồm bốn lớp chính:

```text
Người dùng và MetaMask
        ↓
Frontend HTML/CSS/JavaScript
        ↓ ethers.js
Smart Contract FoodTraceability
        ↓
Hardhat Local Blockchain
```

### 18.1. MetaMask

MetaMask giữ private key và ký giao dịch. Frontend không đọc hoặc lưu private key. Khi người dùng thực hiện nghiệp vụ ghi dữ liệu, MetaMask hiển thị cửa sổ xác nhận trước khi giao dịch được gửi lên blockchain.

### 18.2. Frontend

Frontend có nhiệm vụ:

- Hiển thị giao diện riêng cho từng vai trò.
- Lấy địa chỉ ví đang kết nối.
- Kiểm tra sơ bộ dữ liệu biểu mẫu.
- Gọi các hàm đọc hoặc ghi của smart contract bằng Ethers.js.
- Hiển thị sản phẩm, timeline, feedback, QR và barcode.

Kiểm tra trên frontend chỉ giúp cải thiện trải nghiệm. Quyền ghi thật sự vẫn được kiểm tra lại trong smart contract.

### 18.3. Smart contract

`FoodTraceability.sol` là trung tâm xử lý nghiệp vụ:

- Quản lý participant và vai trò.
- Lưu lô nguyên liệu, thành phẩm và quan hệ nguồn gốc.
- Kiểm soát thứ tự trạng thái.
- Kiểm tra đúng ví được chỉ định ở mỗi lần bàn giao.
- Lưu lịch sử, vận chuyển, đánh giá và thu hồi.
- Phát event để các ứng dụng bên ngoài theo dõi thay đổi.

### 18.4. Hardhat

Hardhat cung cấp blockchain Ethereum local để compile, deploy và kiểm thử contract. Mạng local dùng Chain ID `31337`; ETH trong mạng này chỉ là ETH thử nghiệm để trả gas.

## 19. Giải thích `FoodTraceability.sol`

### 19.1. Enum vai trò

```solidity
enum Role { Admin, Farmer, Manufacturer, Distributor, Retailer, Consumer }
```

Enum chuyển tên vai trò thành số nguyên để lưu và so sánh tiết kiệm hơn chuỗi:

| Giá trị | Vai trò |
|---:|---|
| 0 | Admin |
| 1 | Farmer |
| 2 | Manufacturer |
| 3 | Distributor |
| 4 | Retailer |
| 5 | Consumer |

Admin được tạo trong constructor. Admin chỉ cấp các vai trò nghiệp vụ từ Farmer đến Retailer. Consumer không cần được cấp quyền vì chức năng tra cứu là công khai.

### 19.2. Enum trạng thái sản phẩm

```solidity
enum State { Created, Harvested, Processed, Shipped, Received, ForSale, Recalled }
```

| Trạng thái | Ý nghĩa |
|---|---|
| `Created` | Farmer vừa đăng ký lô nguyên liệu |
| `Harvested` | Đã thu hoạch và giao quyền xử lý cho Manufacturer |
| `Processed` | Manufacturer đã tạo lô thành phẩm |
| `Shipped` | Đang được một Distributor bàn giao |
| `Received` | Retailer đã nhận hàng |
| `ForSale` | Retailer đã niêm yết bán |
| `Recalled` | Lô bị thu hồi và không được tiếp tục lưu thông |

Contract không cho cập nhật trạng thái tùy ý. Ví dụ `setForSale()` chỉ chấp nhận lô đang ở trạng thái `Received`.

### 19.3. Enum trạng thái thu hồi

```solidity
enum RecallStatus { None, Pending, Approved, Rejected }
```

Trạng thái thu hồi được lưu riêng với trạng thái sản phẩm. Nhờ vậy, một lô đang `ForSale` vẫn có thể đồng thời có yêu cầu thu hồi `Pending` trong thời gian Admin xác minh.

### 19.4. Struct `Participant`

```solidity
struct Participant {
    address account;
    string name;
    Role role;
    bool isActive;
}
```

- `account`: địa chỉ ví đại diện cho đơn vị.
- `name`: tên doanh nghiệp hoặc tổ chức.
- `role`: vai trò được Admin cấp.
- `isActive`: cho biết tài khoản còn được phép thao tác hay không.

### 19.5. Struct `Product`

`Product` lưu toàn bộ thông tin chính của một lô:

| Thuộc tính | Ý nghĩa |
|---|---|
| `id` | ID nội bộ tăng dần |
| `batchCode` | Mã lô công khai và duy nhất |
| `name`, `origin`, `description` | Thông tin nhận dạng sản phẩm |
| `farmer` | Ví Farmer tạo nguyên liệu |
| `manufacturer` | Ví Manufacturer tạo thành phẩm |
| `distributors` | Danh sách các Distributor đã tham gia |
| `retailer` | Ví Retailer nhận hàng |
| `state` | Trạng thái hiện tại |
| `quantity`, `unit` | Số lượng và đơn vị |
| `harvestDate`, `expiryDate` | Ngày thu hoạch và hạn sử dụng |
| `parentProductId` | ID nguyên liệu nguồn của thành phẩm |
| `pendingRecipient` | Ví được chỉ định thực hiện bước tiếp theo |
| `price` | Giá bán lẻ tính bằng VND |
| `recallReason`, `recalledAt`, `recalledBy` | Thông tin thu hồi |
| `exists` | Cờ kiểm tra sản phẩm tồn tại |

`pendingRecipient` được tái sử dụng xuyên suốt quy trình:

```text
Nguyên liệu Harvested: pendingRecipient = Manufacturer được Farmer chọn
Thành phẩm Processed: pendingRecipient = Distributor đầu tiên
Đang Shipped: pendingRecipient = Distributor tiếp theo hoặc Retailer
```

Do đó, địa chỉ ví của bên nhận không cần nhập thủ công. Người dùng chọn tên doanh nghiệp từ dropdown và frontend lấy địa chỉ ví tương ứng.

### 19.6. Các struct hỗ trợ

- `ShippingRecord`: lưu Distributor, bên nhận, phương tiện, nhiệt độ, điểm giao và thời gian.
- `History`: lưu hành động, trạng thái, ví thực hiện, thời gian và ghi chú.
- `Feedback`: lưu ví đánh giá, số sao, bình luận và thời gian.
- `RecallRequest`: lưu người yêu cầu, lý do, trạng thái duyệt và kết luận Admin.
- `ProcessingInput`: gom các tham số tạo thành phẩm để tránh hàm có quá nhiều đối số.

### 19.7. Mapping

```solidity
mapping(address => Participant) private participants;
mapping(uint256 => Product) private products;
mapping(uint256 => History[]) private histories;
mapping(uint256 => Feedback[]) private feedbacks;
mapping(uint256 => ShippingRecord[]) private shippingRecords;
```

Mapping cho phép truy xuất dữ liệu trực tiếp theo khóa:

- Địa chỉ ví → participant.
- ID sản phẩm → sản phẩm.
- ID sản phẩm → lịch sử, feedback hoặc vận chuyển.

Các mapping nghiệp vụ khác:

```solidity
mapping(uint256 => RecallRequest) private recallRequests;
mapping(uint256 => uint256[]) private processedProductIds;
mapping(uint256 => uint256) private materialUsedQuantity;
mapping(bytes32 => uint256) private productIdByBatchHash;
mapping(uint256 => mapping(address => bool)) private distributorJoined;
mapping(uint256 => mapping(address => bool)) private feedbackSubmitted;
```

- `processedProductIds`: tìm các thành phẩm tạo từ một nguyên liệu.
- `materialUsedQuantity`: tính lượng nguyên liệu đã sử dụng.
- `productIdByBatchHash`: tìm nhanh ID từ mã lô.
- `distributorJoined`: ngăn một Distributor tham gia cùng lô hai lần.
- `feedbackSubmitted`: bảo đảm mỗi ví chỉ đánh giá một lần trên mỗi lô.

### 19.8. Modifier

```solidity
modifier onlyAdmin()
modifier onlyRole(Role role)
modifier productExists(uint256 productId)
```

- `onlyAdmin`: chỉ ví deploy contract được thực hiện.
- `onlyRole`: tài khoản phải đang hoạt động và đúng vai trò.
- `productExists`: ngăn thao tác với ID không tồn tại.

Ví dụ:

```solidity
function createProduct(...) external onlyRole(Role.Farmer)
```

Dù người dùng gọi trực tiếp contract mà không qua giao diện, ví không có vai trò Farmer vẫn bị từ chối.

### 19.9. Event

Các event quan trọng gồm:

- `ParticipantAdded`, `ParticipantDeactivated`.
- `ProductCreated`, `ProductTransformed`.
- `StateChanged`, `ProductForSale`.
- `RecallRequested`, `RecallReviewed`, `ProductRecalled`.
- `FeedbackAdded`.

Event không thay thế dữ liệu lưu trong contract. Event tạo nhật ký giao dịch, phù hợp cho frontend, backend indexer hoặc công cụ giám sát theo dõi thay đổi.

## 20. Giải thích các hàm ghi dữ liệu

Hàm ghi tạo giao dịch, cần ví ký bằng MetaMask và tốn gas trên mạng blockchain.

### 20.1. `addParticipant()`

Admin cấp tên và vai trò cho một ví. Contract kiểm tra:

- Địa chỉ khác `address(0)`.
- Tên không rỗng.
- Không cấp thêm Admin hoặc Consumer.
- Ví chưa có participant đang hoạt động.

### 20.2. `deactivateParticipant()`

Admin vô hiệu hóa participant. Dữ liệu lịch sử cũ không bị xóa, nhưng ví đó không thể tiếp tục gọi các hàm yêu cầu vai trò.

### 20.3. `createProduct()`

Farmer tạo nguyên liệu thô. Hàm kiểm tra mã lô, tên, nguồn gốc, mô tả, số lượng, đơn vị và ngày tháng. Sau khi tạo:

- Trạng thái là `Created`.
- `farmer` bằng `msg.sender`.
- `manufacturer`, `retailer` và `pendingRecipient` chưa có.
- Lịch sử “Tạo sản phẩm” được ghi lại.

Mã lô được băm bằng `keccak256` để kiểm tra duy nhất và tra cứu nhanh.

### 20.4. `harvestProduct()`

Farmer xác nhận thu hoạch và chọn Manufacturer:

```solidity
harvestProduct(productId, manufacturer, note)
```

Contract kiểm tra lô thuộc đúng Farmer, ví nhận đang hoạt động và có vai trò Manufacturer. Sau đó:

- `pendingRecipient = manufacturer`.
- Trạng thái chuyển `Created → Harvested`.

Manufacturer khác dù đang hoạt động cũng không thể dùng nguyên liệu này.

### 20.5. `createProcessedProduct()`

Manufacturer tạo thành phẩm từ nguyên liệu. Điều kiện chính:

- Nguyên liệu đang `Harvested`.
- `source.pendingRecipient == msg.sender`.
- Distributor đầu tiên hợp lệ.
- Lượng sử dụng không vượt lượng nguyên liệu còn lại.
- Mã thành phẩm chưa tồn tại.

Thành phẩm mới lưu:

- `parentProductId = sourceProductId`.
- `manufacturer = msg.sender`.
- `pendingRecipient = distributor`.
- Trạng thái `Processed`.

Nguyên liệu không đổi thành thành phẩm; hệ thống tạo một record mới và liên kết hai record. Cách này giữ được lịch sử và cho phép một nguyên liệu tạo nhiều lô đầu ra nếu còn số dư.

### 20.6. `shipProduct()`

Distributor ghi nhận một chặng vận chuyển:

```solidity
shipProduct(productId, recipient, vehicleCode,
            temperatureX10, destination, note)
```

`temperatureX10` lưu nhiệt độ nhân 10. Ví dụ `12.5°C` được lưu thành `125`, tránh sử dụng số thực vì Solidity không hỗ trợ floating point trực tiếp.

Contract yêu cầu:

- Người gọi đúng là `pendingRecipient`.
- Người gọi chưa tham gia lô trước đó.
- Bên nhận là Distributor hoặc Retailer đang hoạt động.
- Không giao cho chính mình.
- Lô không có yêu cầu thu hồi đang chờ.

Sau mỗi chặng:

- Distributor được thêm vào `product.distributors`.
- `pendingRecipient` đổi sang bên nhận tiếp theo.
- Tạo một `ShippingRecord`.
- Trạng thái chuyển hoặc giữ ở `Shipped`.

### 20.7. `receiveProduct()`

Retailer chỉ được nhận khi `pendingRecipient == msg.sender`. Sau khi nhận:

- `retailer = msg.sender`.
- `pendingRecipient = address(0)`.
- Trạng thái `Shipped → Received`.

### 20.8. `setForSale()`

Retailer đã nhận hàng niêm yết giá VND. Contract kiểm tra giá lớn hơn 0, lô chưa hết hạn và không có thu hồi đang chờ. Trạng thái chuyển `Received → ForSale`.

ETH không được dùng làm giá sản phẩm. ETH local chỉ trả gas; `price` là số nguyên VND.

### 20.9. `requestRecall()` và `reviewRecall()`

Participant đã tham gia hoặc đang được chỉ định nhận lô có thể gửi yêu cầu thu hồi. Trong trạng thái `Pending`, các thao tác thu hoạch, chế biến, vận chuyển, nhận hàng và niêm yết bị chặn.

Admin có hai lựa chọn:

- Từ chối: sản phẩm giữ trạng thái cũ và tiếp tục lưu thông.
- Phê duyệt: sản phẩm chuyển sang `Recalled`.

Nếu Admin thu hồi nguyên liệu, contract duyệt qua `processedProductIds` và thu hồi các thành phẩm được tạo từ nguyên liệu đó.
Yêu cầu đang chờ của thành phẩm liên quan cũng được kết thúc để danh sách Admin không còn yêu cầu treo trên một lô đã thu hồi.

### 20.10. `addFeedback()`

Bất kỳ ví nào cũng có thể đánh giá, nhưng:

- Sản phẩm phải đang ở trạng thái `ForSale`.
- Rating phải từ 1 đến 5.
- Bình luận phải có độ dài hợp lệ.
- Một ví chỉ được đánh giá một lần cho mỗi lô.

Phiên bản hiện tại chưa xác minh người đánh giá đã mua hàng.

## 21. Giải thích các hàm đọc dữ liệu

Hàm `view` không thay đổi blockchain và frontend có thể gọi qua RPC mà không cần MetaMask ký:

| Hàm | Dữ liệu trả về |
|---|---|
| `getProduct()` | Chi tiết một lô |
| `getProductIdByBatchCode()` | ID từ mã lô |
| `getProductHistory()` | Timeline trạng thái |
| `getShippingRecords()` | Các chặng vận chuyển |
| `getFeedbacks()` | Danh sách đánh giá |
| `getProcessedProductIds()` | Thành phẩm của nguyên liệu |
| `getMaterialBalance()` | Lượng nguyên liệu đã dùng/còn lại |
| `getRecallRequest()` | Thông tin yêu cầu thu hồi |
| `getPendingRecallProductIds()` | Danh sách chờ Admin duyệt |
| `getParticipant()` | Vai trò và trạng thái của ví |
| `getAllProductIds()` | Danh sách ID toàn hệ thống |

## 22. Giải thích frontend theo module

### 22.1. `main.js`

Đây là điểm khởi động chung của các trang. File này:

- Gắn sự kiện cho nút kết nối ví.
- Ánh xạ ID form với hàm nghiệp vụ.
- Chặn submit lặp trong lúc giao dịch đang xử lý.
- Tải lại dashboard, dropdown và danh sách thu hồi sau giao dịch.
- Khởi tạo mã lô tự động và chức năng QR/barcode.

### 22.2. `wallet.js`

Quản lý MetaMask:

- Chuyển hoặc thêm mạng Hardhat Localhost.
- Tạo `BrowserProvider` và signer.
- Theo dõi sự kiện `accountsChanged`.
- Làm mới dữ liệu khi người dùng đổi ví.

Signer dùng cho hàm ghi; RPC provider trong `contract.js` dùng cho hàm đọc.

### 22.3. `contract.js`

- `getReadContract()`: tạo contract chỉ đọc từ `JsonRpcProvider`.
- `getWriteContract()`: tạo contract có signer để gửi giao dịch.
- `resolveBatchId()`: chuẩn hóa mã lô và đổi mã lô thành ID.

Tách hàm đọc/ghi giúp Consumer tra cứu mà không cần kết nối ví, trong khi thao tác nghiệp vụ vẫn cần MetaMask.

### 22.4. `dashboard.js`

Đọc participant của ví hiện tại và so sánh với `data-required-role` trên thẻ `<body>`. Nếu sai vai trò, trang hiển thị cổng cảnh báo và ẩn nội dung nghiệp vụ.

Contract vẫn kiểm tra lại quyền; việc ẩn giao diện không được xem là lớp bảo mật duy nhất.

### 22.5. `batches.js`

Tải toàn bộ lô và tạo dropdown theo ngữ cảnh:

- Farmer chỉ thấy lô của mình cần thu hoạch.
- Manufacturer chỉ thấy nguyên liệu được chỉ định cho ví mình.
- Distributor chỉ thấy lô đang chờ mình nhận.
- Retailer chỉ thấy lô được giao cho mình.
- Lô có thu hồi đang chờ hoặc nguyên liệu đã dùng hết bị loại khỏi lựa chọn.

File này cũng tạo mã lô tự động từ tên, ngày hiện tại và hậu tố thời gian.

### 22.6. Các module theo vai trò

- `admin.js`: cấp và vô hiệu hóa participant.
- `farmer.js`: tạo nguyên liệu, thu hoạch và chỉ định Manufacturer.
- `manufacturer.js`: tạo thành phẩm và chỉ định Distributor đầu tiên.
- `distributor.js`: tải đối tác hợp lệ và ghi chặng vận chuyển.
- `retailer.js`: nhận hàng và niêm yết giá.
- `recall.js`: gửi, hiển thị và xử lý yêu cầu thu hồi.

### 22.7. `product.js`

Tra cứu sản phẩm theo mã lô, tải song song:

- Thông tin sản phẩm.
- Lịch sử.
- Các chặng vận chuyển.
- Thành phẩm đầu ra.
- Yêu cầu thu hồi.

Nếu sản phẩm là thành phẩm, frontend tải thêm lịch sử nguyên liệu cha rồi ghép vào timeline.

### 22.8. `feedback.js`

Gửi và hiển thị feedback. Điểm trung bình được tính trên frontend:

```javascript
sum(rating) / numberOfFeedbacks
```

Cách tính này hiển thị được điểm thập phân như `4.5`, trong khi Solidity thường ưu tiên số nguyên để giảm chi phí.

### 22.9. `qr.js`

File này xử lý hai nhóm chức năng:

1. Tạo QR/barcode cho một mã lô tồn tại.
2. Quét mã bằng camera hoặc ảnh tải lên.

Trong môi trường local:

- QR chứa `FT-MÃ-LÔ` để dữ liệu ngắn và dễ quét.
- Barcode CODE128 chứa trực tiếp mã lô.
- Consumer có chế độ camera riêng cho QR và barcode vì hình dạng vùng quét khác nhau.

Trước khi Farmer tạo lại tem, frontend đọc sản phẩm và kiểm tra lô thuộc đúng ví Farmer hiện tại.

### 22.10. `ui.js`

Cung cấp toast, loading overlay, định dạng thời gian và `runTransaction()`. Quy trình một giao dịch:

```text
Hiện loading
→ gọi contract
→ MetaMask xác nhận
→ chờ transaction.wait()
→ hiện thông báo thành công hoặc lỗi
→ tắt loading
```

## 23. ABI và địa chỉ triển khai

### 23.1. `abi.js`

ABI mô tả các hàm, struct và event mà frontend có thể gọi. File này được tạo tự động từ Hardhat artifact sau khi deploy; không nên chỉnh sửa thủ công.

### 23.2. `deployment.js`

Lưu địa chỉ contract và Chain ID hiện tại:

```javascript
export const DEPLOYED_ADDRESS = "0x...";
export const DEPLOYED_CHAIN_ID = 31337n;
```

Mỗi lần Hardhat node khởi động lại, blockchain local trở về trạng thái mới. Vì vậy phải deploy lại để lấy địa chỉ contract mới.

### 23.3. `config.js`

Lưu RPC URL, Chain ID, tên mạng và URL công khai tùy chọn. `getDeploymentConfig()` ưu tiên dữ liệu trong `deployment.js`.

## 24. Giải thích script triển khai và dữ liệu mẫu

### 24.1. `scripts/deploy.js`

Script thực hiện:

1. Lấy `ContractFactory`.
2. Deploy `FoodTraceability`.
3. Chờ giao dịch deploy hoàn tất.
4. Đọc địa chỉ, Chain ID và artifact.
5. Sinh lại `deployment.js` và `abi.js`.
6. Cập nhật `CONTRACT_ADDRESS` trong `.env`.

Nhờ vậy frontend và contract luôn dùng cùng địa chỉ và ABI.

### 24.2. `scripts/seedDemoData.js`

Script lấy các signer Hardhat theo thứ tự và cấp vai trò. Với mỗi sản phẩm mẫu, script chạy đầy đủ:

```text
Tạo nguyên liệu
→ Thu hoạch và chỉ định Manufacturer
→ Tạo thành phẩm và chỉ định Distributor A
→ Distributor A giao Distributor B
→ Distributor B giao Retailer
→ Retailer nhận và niêm yết
→ Thêm feedback hoặc tình huống thu hồi
```

Script kiểm tra mã lô đã tồn tại để hạn chế tạo trùng khi chạy lại trên cùng contract.

## 25. Giải thích kiểm thử

`FoodTraceability.test.js` deploy một contract mới trước mỗi test bằng `beforeEach`. Điều này bảo đảm các test độc lập, không phụ thuộc dữ liệu của test trước.

19 test hiện tại bao phủ:

- Cấp quyền và vô hiệu hóa participant.
- Ngăn người không phải Admin quản lý tài khoản.
- Chỉ Farmer được tạo nguyên liệu.
- Mã lô duy nhất.
- Quy trình đầy đủ đến niêm yết.
- Nhiều Distributor và đúng thứ tự.
- Sai vai trò hoặc sai trạng thái bị từ chối.
- Đúng bên nhận được chỉ định.
- Farmer → Manufacturer → Distributor bắt buộc đúng ví.
- Validation dữ liệu và nhiệt độ.
- Liên kết nguyên liệu, thành phẩm và số dư.
- Quy trình yêu cầu/phê duyệt/từ chối thu hồi.
- Chặn giao dịch khi thu hồi đang chờ.
- Cho phép bên nhận được chỉ định báo cáo thu hồi.
- Đồng bộ yêu cầu thành phẩm khi nguyên liệu bị thu hồi.
- Chặn niêm yết lô hết hạn.
- Chỉ cho đánh giá sản phẩm đang bán.
- Mỗi ví chỉ feedback một lần.

## 26. Kịch bản demo khi thuyết trình

### Bước 1: giới thiệu hệ thống

Mở `index.html`, trình bày sáu vai trò và mục tiêu truy xuất theo mã lô thay vì theo tên sản phẩm.

### Bước 2: Admin

Kết nối Account 0, giới thiệu cơ chế địa chỉ ví gắn với tên doanh nghiệp và vai trò.

### Bước 3: Farmer

Kết nối Account 1:

- Tạo nguyên liệu.
- Xác nhận thu hoạch.
- Chọn Manufacturer từ dropdown.
- Trình bày QR/barcode được tạo từ mã lô và có thể tạo lại.

### Bước 4: Manufacturer

Kết nối Account 2:

- Chỉ thấy nguyên liệu được Farmer chỉ định.
- Nhập lượng nguyên liệu sử dụng và sản lượng đầu ra.
- Chọn Distributor đầu tiên.

### Bước 5: Distributor

Kết nối Account 3 rồi Account 4:

- Account 3 chỉ thấy lô chờ mình nhận.
- Ghi phương tiện, nhiệt độ và chỉ định Account 4.
- Account 4 tiếp tục giao cho Retailer.

### Bước 6: Retailer

Kết nối Account 5:

- Xác nhận nhận hàng.
- Niêm yết giá VND.
- Tạo QR và barcode bán lẻ.

### Bước 7: Consumer

Mở `consumer.html`:

- Tra mã `XCHL-2026-0612`.
- Trình bày timeline từ nguyên liệu đến bán lẻ.
- Xem nhiệt độ, phương tiện và các ví tham gia.
- Kết nối Account 6 để gửi feedback.

### Bước 8: thu hồi

Dùng các mã demo:

- `DRVL-BT-1306`: yêu cầu đang chờ.
- `RAU-DL-0906`: đã thu hồi.
- `BUOI-BR-0806`: đã bị từ chối.

Giải thích rằng thu hồi đang chờ sẽ khóa các bước tiếp theo, và thu hồi nguyên liệu sẽ lan sang thành phẩm liên quan.

## 27. Các câu hỏi thường gặp khi bảo vệ

### Tại sao dùng blockchain?

Blockchain giúp dữ liệu đã ghi khó bị sửa đơn phương, mỗi giao dịch gắn với ví ký và các bên có thể kiểm chứng cùng một lịch sử.

### Blockchain có bảo đảm dữ liệu nhập vào đúng ngoài đời không?

Không. Contract chỉ bảo đảm ai ghi, ghi lúc nào và quy trình có đúng quyền hay không. Để xác minh sự thật ngoài đời cần kiểm định, IoT, oracle hoặc chữ ký tổ chức.

### Tại sao vẫn cần Admin?

Admin chỉ quản lý danh tính/vai trò và xử lý thu hồi. Admin không thể thay Farmer, Manufacturer, Distributor hoặc Retailer thực hiện nghiệp vụ vì các hàm có modifier theo vai trò.

### Tại sao dùng mã lô thay vì tên sản phẩm?

Tên có thể trùng, nhưng mỗi mã lô là duy nhất và đại diện cho một đợt sản xuất cụ thể với nguồn gốc, số lượng và lịch sử riêng.

### Tại sao thành phẩm là record mới?

Nguyên liệu và thành phẩm có mã, số lượng, đơn vị và hạn sử dụng khác nhau. Tạo record mới rồi liên kết bằng `parentProductId` giúp giữ nguyên dữ liệu nguồn và truy ngược rõ ràng.

### Vì sao một lô có nhiều Distributor?

Hàng hóa thực tế có thể qua kho vùng, trung tâm phân phối và đơn vị giao cuối. Mảng `distributors` và `ShippingRecord[]` lưu đầy đủ các chặng.

### Nếu người dùng nhập sai thì sao?

Frontend validation kiểm tra dữ liệu cơ bản; contract kiểm tra lại độ dài, số lượng, vai trò, trạng thái và bên nhận. Dữ liệu nghiệp vụ đã ghi không sửa trực tiếp; sai nghiêm trọng có thể yêu cầu thu hồi và tạo lô đúng mới.

### Dữ liệu blockchain có bí mật không?

Không trên mô hình Ethereum công khai. Frontend ẩn chức năng theo vai trò nhưng dữ liệu đọc vẫn có thể truy vấn RPC. Dữ liệu mật cần mã hóa, lưu ngoài chuỗi hoặc dùng permissioned blockchain.

### Vì sao contract gần giới hạn bytecode?

Contract demo gom quản lý vai trò, sản phẩm, vận chuyển, feedback và thu hồi trong một contract để dễ trình diễn. Bản production nên tách thành các contract hoặc thư viện nhỏ hơn.

## 28. Tóm tắt một phút

FoodTraceability là DApp truy xuất nguồn gốc theo lô. Admin cấp vai trò cho địa chỉ ví. Farmer tạo nguyên liệu và chỉ định Manufacturer; Manufacturer tạo thành phẩm và chỉ định Distributor đầu tiên; mỗi Distributor chỉ định bên nhận tiếp theo; Retailer nhận và niêm yết giá VND. Mỗi bước được smart contract kiểm tra vai trò, trạng thái và đúng ví nhận, đồng thời ghi lịch sử bất biến. Consumer tra cứu bằng mã lô, QR hoặc barcode, xem timeline và gửi feedback. Hệ thống còn hỗ trợ quy trình thu hồi có Admin xác minh và lan truyền từ nguyên liệu sang thành phẩm.
