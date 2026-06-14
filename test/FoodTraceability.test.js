const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("FoodTraceability", function () {
  let contract;
  let admin, farmer, manufacturer, distributor, distributorTwo, retailer, consumer, outsider;

  beforeEach(async function () {
    [admin, farmer, manufacturer, distributor, distributorTwo, retailer, consumer, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("FoodTraceability");
    contract = await Factory.deploy();
    await contract.waitForDeployment();

    await contract.addParticipant(farmer.address, "Green Farm", 1);
    await contract.addParticipant(manufacturer.address, "Fresh Foods", 2);
    await contract.addParticipant(distributor.address, "Fast Logistics", 3);
    await contract.addParticipant(distributorTwo.address, "Regional Logistics", 3);
    await contract.addParticipant(retailer.address, "City Market", 4);
  });

  async function createProduct() {
    await contract.connect(farmer).createProduct(
      "XCHL-2026-001", "Organic Mango", "Tien Giang", "VietGAP mango batch",
      480, "kg", 1767225600, 4102444800
    );
    return 1n;
  }

  async function createProcessedOutput() {
    const sourceId = await createProduct();
    await contract.connect(farmer).harvestProduct(sourceId, "Harvested raw mango batch");
    await contract.connect(manufacturer).createProcessedProduct(sourceId, {
      batchCode: "MANGO-BOX-001", name: "Packed mango box",
      description: "Selected and packed traceable mango", materialQuantity: 480,
      outputQuantity: 240, unit: "hộp 2 kg", expiryDate: 4102444800,
      note: "Washed, selected and packed into boxes",
    });
    return 2n;
  }

  it("lets admin add and deactivate a participant", async function () {
    const participant = await contract.getParticipant(farmer.address);
    expect(participant.name).to.equal("Green Farm");
    expect(participant.role).to.equal(1);
    expect(participant.isActive).to.equal(true);

    await expect(contract.deactivateParticipant(farmer.address))
      .to.emit(contract, "ParticipantDeactivated")
      .withArgs(farmer.address);
    expect((await contract.getParticipant(farmer.address)).isActive).to.equal(false);
  });

  it("rejects participant management by a non-admin", async function () {
    await expect(
      contract.connect(outsider).addParticipant(outsider.address, "Invalid", 1)
    ).to.be.revertedWith("Only admin can perform this action");
  });

  it("lets a farmer create a product and rejects other roles", async function () {
    await expect(contract.connect(farmer).createProduct("RICE-001", "Rice", "An Giang", "Organic rice batch", 1000, "kg", 1767225600, 4102444800))
      .to.emit(contract, "ProductCreated");
    expect((await contract.getProduct(1)).farmer).to.equal(farmer.address);

    await expect(
      contract.connect(manufacturer).createProduct("INVALID-001", "Invalid", "Nowhere", "Invalid batch", 1, "kg", 1767225600, 4102444800)
    ).to.be.revertedWith("Caller has incorrect role");
  });

  it("uses a unique batch code as the public product identifier", async function () {
    await createProduct();

    await expect(
      contract.connect(farmer).createProduct("XCHL-2026-001", "Another mango", "Tien Giang", "Duplicate batch", 20, "kg", 1767225600, 4102444800)
    ).to.be.revertedWith("Batch code already exists");

    expect(await contract.getProductIdByBatchCode("XCHL-2026-001")).to.equal(1n);
  });

  it("runs the complete supply-chain state flow", async function () {
    const id = await createProcessedOutput();
    await contract.connect(distributor).shipProduct(id, distributorTwo.address, "D01", 110, "Regional hub", "Cold-chain truck D01");
    await contract.connect(distributorTwo).shipProduct(id, retailer.address, "D02", 115, "City Market", "Transferred at regional hub");
    await contract.connect(retailer).receiveProduct(id, "Quality checked");
    await contract.connect(retailer).setForSale(id, 89000, "Quầy trái cây A3");

    const product = await contract.getProduct(id);
    expect(product.state).to.equal(5);
    expect(product.manufacturer).to.equal(manufacturer.address);
    expect(product.batchCode).to.equal("MANGO-BOX-001");
    expect(product.distributors).to.deep.equal([distributor.address, distributorTwo.address]);
    expect(product.retailer).to.equal(retailer.address);
    expect(product.price).to.equal(89000);
    expect(product.quantity).to.equal(240);
    expect(product.unit).to.equal("hộp 2 kg");
    expect((await contract.getProductHistory(id)).length).to.equal(5);
    expect((await contract.getShippingRecords(id)).length).to.equal(2);
    expect(await contract.getProductIdByBatchCode("MANGO-BOX-001")).to.equal(id);
  });

  it("records multiple distributors once each in chronological order", async function () {
    const id = await createProcessedOutput();
    await contract.connect(distributor).shipProduct(id, distributorTwo.address, "D01", 100, "Regional hub", "Factory to regional hub");

    await expect(
      contract.connect(distributor).shipProduct(id, retailer.address, "D01", 100, "Retailer", "Duplicate scan")
    ).to.be.revertedWith("Distributor already joined this batch");

    await contract.connect(distributorTwo).shipProduct(id, retailer.address, "D02", 105, "Retailer", "Regional hub to retailer");
    const history = await contract.getProductHistory(id);
    expect(history.slice(-2).map((item) => item.actor)).to.deep.equal([
      distributor.address,
      distributorTwo.address,
    ]);
  });

  it("rejects state updates from the wrong role or wrong state", async function () {
    const id = await createProduct();
    await expect(contract.connect(distributor).harvestProduct(id, "Invalid"))
      .to.be.revertedWith("Caller has incorrect role");
    await expect(contract.connect(manufacturer).createProcessedProduct(id, {
      batchCode: "OUTPUT-001", name: "Output product", description: "Processed output product",
      materialQuantity: 10, outputQuantity: 10, unit: "hộp", expiryDate: 4102444800, note: "Too early",
    })).to.be.revertedWith("Source batch must be harvested");
    await expect(contract.connect(outsider).shipProduct(id, retailer.address, "D01", 100, "Retailer", "Invalid"))
      .to.be.revertedWith("Participant is not active");
  });

  it("requires the designated recipient to continue or receive a shipment", async function () {
    const id = await createProcessedOutput();
    await contract.connect(distributor).shipProduct(id, distributorTwo.address, "D01", 110, "Regional hub", "Sealed shipment");

    await expect(
      contract.connect(retailer).receiveProduct(id, "Unexpected delivery")
    ).to.be.revertedWith("Retailer is not the expected recipient");

    await contract.connect(distributorTwo).shipProduct(id, retailer.address, "D02", 115, "City Market", "Final delivery");
    await expect(contract.connect(retailer).receiveProduct(id, "Seal and quantity verified"))
      .to.emit(contract, "StateChanged");
  });

  it("validates structured batch and transport data on-chain", async function () {
    await expect(
      contract.connect(farmer).createProduct("X", "Mango", "Tien Giang", "Valid description", 0, "kg", 100, 90)
    ).to.be.revertedWith("Batch code length is invalid");

    const id = await createProcessedOutput();
    await expect(
      contract.connect(distributor).shipProduct(id, distributorTwo.address, "D01", 700, "Regional hub", "Invalid temperature")
    ).to.be.revertedWith("Temperature is out of range");
  });

  it("creates processed output batches linked to harvested raw material", async function () {
    const sourceId = await createProduct();
    await contract.connect(farmer).harvestProduct(sourceId, "Harvested raw mango batch");

    await expect(
      contract.connect(manufacturer).createProcessedProduct(sourceId, {
        batchCode: "MANGO-JAM-001", name: "Mango jam jar 250g",
        description: "Processed mango jam from traceable raw mango", materialQuantity: 180,
        outputQuantity: 720, unit: "hũ 250 g", expiryDate: 4102444800,
        note: "Washed, cooked, pasteurized and packed into sealed jars",
      })
    ).to.emit(contract, "ProductTransformed").withArgs(sourceId, 2n, 720);

    const output = await contract.getProduct(2);
    expect(output.state).to.equal(2);
    expect(output.farmer).to.equal(farmer.address);
    expect(output.manufacturer).to.equal(manufacturer.address);
    expect(output.quantity).to.equal(720);
    expect(output.unit).to.equal("hũ 250 g");
    expect(output.parentProductId).to.equal(sourceId);
    expect(await contract.getProcessedProductIds(sourceId)).to.deep.equal([2n]);
    expect(await contract.getMaterialBalance(sourceId)).to.deep.equal([180n, 300n]);

    await expect(
      contract.connect(manufacturer).createProcessedProduct(sourceId, {
        batchCode: "MANGO-DRIED-001", name: "Dried mango", description: "Dried mango output batch",
        materialQuantity: 301, outputQuantity: 120, unit: "gói 500 g", expiryDate: 4102444800,
        note: "Dried and packed for distribution",
      })
    ).to.be.revertedWith("Material usage exceeds source quantity");
  });

  it("requires a participant request and admin approval before recalling a batch", async function () {
    const outputId = await createProcessedOutput();
    const id = 1n;
    await expect(
      contract.connect(outsider).requestRecall(id, "Unverified outsider recall request")
    ).to.be.revertedWith("Participant is not active");

    await expect(
      contract.connect(farmer).requestRecall(id, "Laboratory result detected unsafe pesticide residue")
    ).to.emit(contract, "RecallRequested");

    expect((await contract.getProduct(id)).state).to.equal(1);
    expect((await contract.getRecallRequest(id)).status).to.equal(1);
    expect(await contract.getPendingRecallProductIds()).to.deep.equal([id]);
    await expect(
      contract.connect(distributor).shipProduct(outputId, retailer.address, "D01", 100, "City Market", "Blocked pending recall")
    ).to.be.revertedWith("Recall pending");

    await expect(
      contract.reviewRecall(id, true, "Test result verified; stop sale and return all units")
    ).to.emit(contract, "ProductRecalled");

    const product = await contract.getProduct(id);
    expect(product.state).to.equal(6);
    expect(product.recallReason).to.contain("unsafe pesticide");
    expect((await contract.getProduct(outputId)).state).to.equal(6);
    expect((await contract.getProduct(outputId)).recallReason).to.contain("unsafe pesticide");
    expect((await contract.getRecallRequest(id)).status).to.equal(2);
    expect(await contract.getPendingRecallProductIds()).to.deep.equal([]);
    await expect(
      contract.connect(distributor).shipProduct(outputId, retailer.address, "D01", 100, "City Market", "Attempt after recall")
    ).to.be.revertedWith("Product is not ready for distribution");
  });

  it("allows admin to reject a recall request without stopping the batch", async function () {
    const id = await createProduct();
    await contract.connect(farmer).requestRecall(id, "Suspected issue requires additional verification");
    await expect(
      contract.reviewRecall(id, false, "Inspection found no defect in the registered batch")
    ).to.emit(contract, "RecallReviewed").withArgs(id, admin.address, false, "Inspection found no defect in the registered batch");

    expect((await contract.getProduct(id)).state).to.equal(0);
    expect((await contract.getRecallRequest(id)).status).to.equal(3);
    await expect(contract.connect(farmer).harvestProduct(id, "Harvest continues after rejection"))
      .to.emit(contract, "StateChanged");
  });

  it("blocks receiving and retail listing while a recall request is pending", async function () {
    const id = await createProcessedOutput();
    await contract.connect(distributor).shipProduct(id, retailer.address, "D01", 100, "City Market", "Shipment awaiting retailer");
    await contract.connect(distributor).requestRecall(id, "Seal issue requires verification before receiving goods");

    await expect(
      contract.connect(retailer).receiveProduct(id, "Attempt to receive pending batch")
    ).to.be.revertedWith("Recall pending");

    await contract.reviewRecall(id, false, "Seal image confirms the shipment remains intact");
    await contract.connect(retailer).receiveProduct(id, "Seal and quantity verified");
    await contract.connect(retailer).requestRecall(id, "Quality issue requires verification before retail listing");

    await expect(
      contract.connect(retailer).setForSale(id, 89000, "Attempt to list pending batch")
    ).to.be.revertedWith("Recall pending");
  });

  it("rejects expired retail listings", async function () {
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await contract.connect(farmer).createProduct(
      "EXPIRED-001", "Expired Mango", "Tien Giang", "Expired product test batch",
      10, "kg", now - 2000, now + 100
    );
    await contract.connect(farmer).harvestProduct(1n, "Harvested before expiry");
    await contract.connect(manufacturer).createProcessedProduct(1n, {
      batchCode: "EXPIRED-BOX-001", name: "Expired mango box",
      description: "Expired processed mango product", materialQuantity: 10,
      outputQuantity: 5, unit: "hộp 2 kg", expiryDate: now - 1000, note: "Packed before expiry",
    });
    const id = 2n;
    await contract.connect(distributor).shipProduct(id, retailer.address, "D01", 100, "City Market", "Delivered after expiry");
    await contract.connect(retailer).receiveProduct(id, "Received expired batch");
    await expect(contract.connect(retailer).setForSale(id, 10000, "Invalid expired listing"))
      .to.be.revertedWith("Expired batch cannot be listed for sale");
  });

  it("only accepts one feedback from each wallet for a batch", async function () {
    const id = await createProduct();
    await contract.connect(consumer).addFeedback(id, 5, "Very fresh");
    await expect(
      contract.connect(consumer).addFeedback(id, 4, "Second review")
    ).to.be.revertedWith("Feedback already submitted");

    await contract.connect(outsider).addFeedback(id, 4, "Good quality");

    const items = await contract.getFeedbacks(id);
    expect(items).to.have.length(2);
    const average = items.reduce((total, item) => total + Number(item.rating), 0) / items.length;
    expect(average).to.equal(4.5);
    await expect(contract.connect(distributorTwo).addFeedback(id, 6, "Invalid"))
      .to.be.revertedWith("Rating must be between 1 and 5");
  });
});
