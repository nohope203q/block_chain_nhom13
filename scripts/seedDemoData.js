const fs = require("fs");
const path = require("path");
require("dotenv").config();
const { ethers } = require("hardhat");

const toTimestamp = (date) => Math.floor(new Date(`${date}T00:00:00+07:00`).getTime() / 1000);

function getContractAddress() {
  const deploymentPath = path.join(__dirname, "..", "frontend", "js", "deployment.js");
  if (fs.existsSync(deploymentPath)) {
    const deployment = fs.readFileSync(deploymentPath, "utf8");
    const match = deployment.match(/DEPLOYED_ADDRESS\s*=\s*["'](0x[0-9a-fA-F]{40})["']/);
    if (match?.[1]) return match[1];
  }

  return ethers.isAddress(process.env.CONTRACT_ADDRESS || "")
    ? process.env.CONTRACT_ADDRESS
    : null;
}

async function addParticipantIfNeeded(contract, signer, name, role) {
  const participant = await contract.getParticipant(signer.address);
  if (participant.isActive && Number(participant.role) === role) return;

  if (participant.isActive) {
    await (await contract.deactivateParticipant(signer.address)).wait();
  }
  await (await contract.addParticipant(signer.address, name, role)).wait();
}

async function createCompletedProduct(contract, actors, data) {
  const { farmer, manufacturer, distributorA, distributorB, retailer } = actors;

  try {
    const existingId = await contract.getProductIdByBatchCode(data.batchCode);
    return { productId: existingId, created: false };
  } catch {
    // Lô chưa tồn tại, tiếp tục tạo dữ liệu mẫu.
  }

  const sourceBatchCode = data.sourceBatchCode || `RAW-${data.batchCode}`;
  await (await contract.connect(farmer).createProduct(
    sourceBatchCode,
    data.sourceName || `${data.name} - nguyên liệu`,
    data.origin,
    data.sourceDescription || `Lô nguyên liệu dùng để sản xuất ${data.name}.`,
    data.sourceQuantity || data.materialQuantity,
    data.sourceUnit || "kg",
    toTimestamp(data.harvestDate),
    toTimestamp(data.expiryDate)
  )).wait();
  const sourceProductId = await contract.getProductIdByBatchCode(sourceBatchCode);
  await (await contract.connect(farmer).harvestProduct(sourceProductId, data.harvestNote)).wait();
  await (await contract.connect(manufacturer).createProcessedProduct(sourceProductId, {
    batchCode: data.batchCode,
    name: data.name,
    description: data.description,
    materialQuantity: data.materialQuantity,
    outputQuantity: data.quantity,
    unit: data.unit,
    expiryDate: toTimestamp(data.expiryDate),
    note: data.processNote,
  })).wait();
  const productId = await contract.getProductIdByBatchCode(data.batchCode);

  await (await contract.connect(distributorA).shipProduct(
    productId,
    distributorB.address,
    data.vehicleA,
    data.temperatureX10,
    "Trung tâm phân phối Nông sản Sài Gòn",
    `Niêm phong lô ${data.batchCode}, vận chuyển từ nhà máy đến kho trung chuyển.`
  )).wait();

  await (await contract.connect(distributorB).shipProduct(
    productId,
    retailer.address,
    data.vehicleB,
    data.temperatureX10,
    "Siêu thị Thực phẩm Xanh Sài Gòn",
    "Kiểm tra niêm phong đạt yêu cầu, tiếp tục giao đến nhà bán lẻ."
  )).wait();

  await (await contract.connect(retailer).receiveProduct(
    productId,
    "Đã kiểm đếm số lượng, kiểm tra bao bì và điều kiện vận chuyển; lô hàng đạt yêu cầu nhập kho."
  )).wait();
  await (await contract.connect(retailer).setForSale(
    productId,
    data.priceVnd,
    `Giá bán ${data.priceVnd.toLocaleString("vi-VN")} VND/${data.unit}; trưng bày tại khu thực phẩm truy xuất nguồn gốc.`
  )).wait();

  return { productId, created: true };
}

async function seedRecallScenario(contract, actors, productId, recall) {
  if (!recall) return "Không có";

  let request = await contract.getRecallRequest(productId);
  if (Number(request.status) === 0) {
    await (await contract.connect(actors[recall.requester]).requestRecall(
      productId,
      recall.reason
    )).wait();
    request = await contract.getRecallRequest(productId);
  }

  if (Number(request.status) === 1 && recall.status === "approved") {
    await (await contract.reviewRecall(productId, true, recall.adminNote)).wait();
    return "Đã thu hồi";
  }

  if (Number(request.status) === 1 && recall.status === "rejected") {
    await (await contract.reviewRecall(productId, false, recall.adminNote)).wait();
    return "Đã từ chối";
  }

  const labels = ["Không có", "Chờ Admin duyệt", "Đã thu hồi", "Đã từ chối"];
  return labels[Number((await contract.getRecallRequest(productId)).status)];
}

async function main() {
  const address = getContractAddress();
  if (!address) {
    throw new Error("Không tìm thấy địa chỉ hợp đồng. Hãy deploy trên localhost trước.");
  }

  if ((await ethers.provider.getCode(address)) === "0x") {
    throw new Error(`Không có hợp đồng tại ${address}. Hãy deploy lại rồi mới chạy seed.`);
  }

  const [admin, farmer, manufacturer, distributorA, distributorB, retailer, consumerA, consumerB] =
    await ethers.getSigners();
  const contract = await ethers.getContractAt("FoodTraceability", address, admin);
  const actors = { admin, farmer, manufacturer, distributorA, distributorB, retailer };

  const participants = [
    [farmer, "Hợp tác xã Nông nghiệp Hòa Lộc", 1],
    [manufacturer, "Công ty Chế biến Nông sản Mekong", 2],
    [distributorA, "Công ty Logistics Chuỗi Lạnh Miền Nam", 3],
    [distributorB, "Trung tâm Phân phối Nông sản Sài Gòn", 3],
    [retailer, "Siêu thị Thực phẩm Xanh Sài Gòn", 4],
  ];

  for (const [signer, name, role] of participants) {
    await addParticipantIfNeeded(contract, signer, name, role);
  }

  const defaults = {
    harvestDate: "2026-06-10",
    expiryDate: "2027-06-10",
    harvestNote: "Thu hoạch đúng độ chín, loại bỏ sản phẩm không đạt và ghi nhận sản lượng tại vùng trồng.",
    processNote: "Sơ chế, phân loại, kiểm tra ngoại quan và đóng gói theo tiêu chuẩn an toàn thực phẩm.",
    vehicleA: "51D-246.80",
    vehicleB: "51D-782.14",
    temperatureX10: 120,
    unit: "sản phẩm",
    sourceUnit: "kg",
    feedbacks: [],
  };

  const products = [
    {
      batchCode: "XCHL-2026-0612", name: "Xoài cát Hòa Lộc loại 1 - Hộp 2 kg",
      origin: "Cái Bè, Tiền Giang", description: "Xoài VietGAP, độ chín 80%, quy cách 4-6 quả/hộp.",
      materialQuantity: 480, quantity: 240, harvestDate: "2026-06-12", expiryDate: "2026-06-22", priceVnd: 189000, unit: "hộp 2 kg",
      sourceBatchCode: "XCHL-RAW-0612", sourceName: "Xoài cát Hòa Lộc nguyên liệu",
      sourceDescription: "Lô xoài nguyên liệu VietGAP sau thu hoạch dùng để phân loại và đóng gói.", sourceQuantity: 500,
      feedbacks: [[consumerA, 5, "Xoài thơm, ngọt và thông tin truy xuất rất rõ ràng."]],
    },
    {
      batchCode: "ST25-HC-2606", name: "Gạo ST25 hữu cơ - Túi 5 kg",
      origin: "Mỹ Xuyên, Sóc Trăng", description: "Gạo vụ Hè Thu 2026, vùng trồng hữu cơ, đóng túi hút chân không.",
      materialQuantity: 1600, sourceQuantity: 1600, quantity: 320, harvestDate: "2026-06-06", expiryDate: "2027-06-06", priceVnd: 215000, unit: "túi 5 kg",
      sourceName: "Lúa ST25 hữu cơ sau thu hoạch",
      sourceBatchCode: "LUA-ST25-2606",
      sourceDescription: "Lúa ST25 hữu cơ vừa thu hoạch, chưa xay xát, dùng làm nguyên liệu sản xuất gạo đóng túi.",
      temperatureX10: 270, feedbacks: [[consumerB, 5, "Cơm dẻo, thơm nhẹ và bao bì chắc chắn."]],
    },
    {
      batchCode: "ARA-DL-1206", name: "Cà phê Arabica rang vừa - Gói 500 g",
      origin: "Đà Lạt, Lâm Đồng", description: "Arabica Catimor sơ chế ướt, rang Medium, bao bì van một chiều.",
      materialQuantity: 200, sourceQuantity: 200, quantity: 400, harvestDate: "2026-05-28", expiryDate: "2027-05-28", priceVnd: 168000, unit: "gói 500 g",
      sourceName: "Quả cà phê Arabica chín đỏ",
      sourceBatchCode: "QCP-ARA-DL-2605",
      sourceDescription: "Quả cà phê Arabica Catimor hái chọn khi chín đỏ, chưa sơ chế, rang hoặc đóng gói.",
      temperatureX10: 230, feedbacks: [[consumerA, 4, "Hương thơm rõ, vị chua thanh và hậu ngọt."]],
    },
    {
      batchCode: "DRVL-BT-1306", name: "Thanh long ruột đỏ - Thùng 5 kg",
      origin: "Hàm Thuận Nam, Bình Thuận", description: "Thanh long GlobalGAP, đồng đều kích cỡ, đóng thùng lưới 5 kg.",
      materialQuantity: 650, sourceQuantity: 650, quantity: 130, harvestDate: "2026-06-11", expiryDate: "2026-06-25", priceVnd: 145000, unit: "thùng 5 kg",
      sourceName: "Thanh long ruột đỏ tươi",
      sourceBatchCode: "TLRD-BT-1106",
      sourceDescription: "Thanh long ruột đỏ vừa thu hoạch tại vườn, chưa phân loại kích cỡ hoặc đóng thùng.",
      temperatureX10: 100,
      recall: {
        requester: "retailer", status: "pending",
        reason: "Kiểm tra ngẫu nhiên tại siêu thị phát hiện một số thùng có dấu hiệu hư hỏng sớm bất thường; đề nghị tạm dừng bán để xác minh điều kiện bảo quản.",
      },
    },
    {
      batchCode: "RAU-DL-0906", name: "Xà lách Romaine VietGAP - Túi 500 g",
      origin: "Đơn Dương, Lâm Đồng", description: "Rau ăn lá rửa sơ bộ, đóng túi khí biến đổi, bảo quản lạnh.",
      materialQuantity: 450, sourceQuantity: 450, quantity: 900, harvestDate: "2026-06-09", expiryDate: "2026-06-18", priceVnd: 42000, unit: "túi 500 g",
      sourceName: "Xà lách Romaine nguyên cây",
      sourceBatchCode: "XLR-DL-0906",
      sourceDescription: "Xà lách Romaine VietGAP vừa thu hoạch, chưa rửa, cắt gốc hoặc đóng túi bảo quản.",
      temperatureX10: 50,
      recall: {
        requester: "distributorB", status: "approved",
        reason: "Kết quả kiểm nghiệm hậu kiểm phát hiện dư lượng thuốc bảo vệ thực vật vượt ngưỡng cho phép trong mẫu thuộc đúng mã lô.",
        adminNote: "Đã đối chiếu phiếu kiểm nghiệm và mã mẫu. Phê duyệt thu hồi, yêu cầu ngừng bán và cách ly toàn bộ sản phẩm còn lại.",
      },
    },
    {
      batchCode: "BUOI-BR-0806", name: "Bưởi da xanh loại 1 - Thùng 10 kg",
      origin: "Châu Thành, Bến Tre", description: "Bưởi tuyển chọn 1,2-1,6 kg/quả, bao lưới chống va đập.",
      materialQuantity: 320, sourceQuantity: 320, quantity: 32, harvestDate: "2026-06-08", expiryDate: "2026-07-08", priceVnd: 590000, unit: "thùng 10 kg",
      sourceName: "Bưởi da xanh tươi tại vườn",
      sourceBatchCode: "BDX-BT-0806",
      sourceDescription: "Bưởi da xanh vừa thu hoạch, chưa tuyển chọn trọng lượng, bọc lưới hoặc đóng thùng.",
      temperatureX10: 180,
      recall: {
        requester: "farmer", status: "rejected",
        reason: "Nghi ngờ tem ngày đóng gói trên một số thùng bị in mờ, cần kiểm tra khả năng nhầm lẫn với lô thu hoạch trước.",
        adminNote: "Đã kiểm tra biên bản đóng gói, mã pallet và mẫu lưu; không có sai lệch lô hàng. Từ chối thu hồi và cho phép tiếp tục lưu thông.",
      },
    },
    {
      batchCode: "CASHEW-BP-2606", name: "Hạt điều rang muối - Hộp 500 g",
      origin: "Bù Đăng, Bình Phước", description: "Hạt điều nhân loại A, rang muối ít, hộp kín có màng bảo vệ.",
      materialQuantity: 375, sourceQuantity: 375, quantity: 750, harvestDate: "2026-05-20", expiryDate: "2027-02-20", priceVnd: 195000, unit: "hộp 500 g",
      sourceName: "Hạt điều thô sau thu hoạch",
      sourceBatchCode: "HDT-BP-2005",
      sourceDescription: "Hạt điều thô đã tách khỏi quả, chưa bóc vỏ, rang muối, phân loại nhân hoặc đóng hộp.",
      temperatureX10: 260,
    },
    {
      batchCode: "CAM-VCA-1106", name: "Cam sành VietGAP - Túi 3 kg",
      origin: "Tam Bình, Vĩnh Long", description: "Cam sành thu hoạch trong ngày, phân loại 5-7 quả/kg.",
      materialQuantity: 540, sourceQuantity: 540, quantity: 180, harvestDate: "2026-06-11", expiryDate: "2026-06-27", priceVnd: 99000, unit: "túi 3 kg",
      sourceName: "Cam sành tươi tại vườn",
      sourceBatchCode: "CST-VL-1106",
      sourceDescription: "Cam sành VietGAP vừa thu hoạch, chưa rửa, phân loại kích cỡ hoặc đóng túi bán lẻ.",
      temperatureX10: 120,
    },
    {
      batchCode: "NUOCMAM-PQ-2606", name: "Nước mắm cá cơm 40 độ đạm - Chai 500 ml",
      origin: "Phú Quốc, Kiên Giang", description: "Nước mắm truyền thống ủ chượp cá cơm và muối biển trong thùng gỗ.",
      materialQuantity: 600, sourceQuantity: 600, sourceUnit: "kg", quantity: 1200, harvestDate: "2026-01-15", expiryDate: "2028-01-15", priceVnd: 135000, unit: "chai 500 ml",
      sourceName: "Cá cơm tươi Phú Quốc",
      sourceBatchCode: "CCT-PQ-1501",
      sourceDescription: "Cá cơm tươi đánh bắt trong ngày, chưa phối trộn muối, ủ chượp, lọc hoặc đóng chai.",
      temperatureX10: 280,
    },
    {
      batchCode: "MATONG-DN-2606", name: "Mật ong hoa cà phê - Chai 500 ml",
      origin: "Cư M'gar, Đắk Lắk", description: "Mật ong nguyên chất mùa hoa cà phê, lọc thô và không pha đường.",
      materialQuantity: 340, sourceQuantity: 340, sourceUnit: "lít", quantity: 680, harvestDate: "2026-03-18", expiryDate: "2028-03-18", priceVnd: 175000, unit: "chai 500 ml",
      sourceName: "Mật ong hoa cà phê thô",
      sourceBatchCode: "MOT-DL-1803",
      sourceDescription: "Mật ong mới khai thác từ cầu ong trong mùa hoa cà phê, chưa lọc cặn hoặc đóng chai.",
      temperatureX10: 250,
    },
  ].map((product) => ({ ...defaults, ...product }));

  const seededProducts = [];
  for (const product of products) {
    const { productId, created } = await createCompletedProduct(contract, actors, product);

    if (created) {
      for (const [reviewer, rating, comment] of product.feedbacks) {
        await (await contract.connect(reviewer).addFeedback(productId, rating, comment)).wait();
      }
    }

    const recallStatus = await seedRecallScenario(contract, actors, productId, product.recall);
    seededProducts.push({
      id: productId.toString(),
      batchCode: product.batchCode,
      name: product.name,
      price: `${product.priceVnd.toLocaleString("vi-VN")} VND`,
      recall: recallStatus,
    });
  }

  console.log("Đã tạo 10 lô sản phẩm mẫu thành công:");
  console.table(seededProducts);
  console.log("Tài khoản theo vai trò:");
  console.table(Object.fromEntries(participants.map(([signer, name]) => [name, signer.address])));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
