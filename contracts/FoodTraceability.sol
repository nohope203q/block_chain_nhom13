// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FoodTraceability {
    enum Role { Admin, Farmer, Manufacturer, Distributor, Retailer, Consumer }
    enum State { Created, Harvested, Processed, Shipped, Received, ForSale, Recalled }
    enum RecallStatus { None, Pending, Approved, Rejected }

    struct Participant {
        address account;
        string name;
        Role role;
        bool isActive;
    }

    struct Product {
        uint256 id;
        string batchCode;
        string name;
        string origin;
        string description;
        address farmer;
        address manufacturer;
        address[] distributors;
        address retailer;
        State state;
        uint256 createdAt;
        uint256 quantity;
        string unit;
        uint256 harvestDate;
        uint256 expiryDate;
        uint256 parentProductId;
        address pendingRecipient;
        uint256 price; // Giá bán lẻ tính bằng VND.
        string recallReason;
        uint256 recalledAt;
        address recalledBy;
        bool exists;
    }

    struct ShippingRecord {
        address distributor;
        address recipient;
        string vehicleCode;
        int16 temperatureX10;
        string destination;
        uint256 timestamp;
    }

    struct History {
        uint256 productId;
        string action;
        State state;
        address actor;
        uint256 timestamp;
        string note;
    }

    struct Feedback {
        uint256 productId;
        address reviewer;
        uint8 rating;
        string comment;
        uint256 timestamp;
    }

    struct RecallRequest {
        uint256 productId;
        address requester;
        string reason;
        uint256 requestedAt;
        RecallStatus status;
        string adminNote;
        uint256 resolvedAt;
    }

    struct ProcessingInput {
        string batchCode;
        string name;
        string description;
        uint256 materialQuantity;
        uint256 outputQuantity;
        string unit;
        uint256 expiryDate;
        string note;
    }

    address public immutable admin;
    uint256 private nextProductId = 1;

    mapping(address => Participant) private participants;
    mapping(uint256 => Product) private products;
    mapping(uint256 => History[]) private histories;
    mapping(uint256 => Feedback[]) private feedbacks;
    mapping(uint256 => ShippingRecord[]) private shippingRecords;
    mapping(uint256 => RecallRequest) private recallRequests;
    mapping(uint256 => uint256[]) private processedProductIds;
    mapping(uint256 => uint256) private materialUsedQuantity;
    mapping(bytes32 => uint256) private productIdByBatchHash;
    mapping(uint256 => mapping(address => bool)) private distributorJoined;
    mapping(uint256 => mapping(address => bool)) private feedbackSubmitted;
    uint256[] private productIds;

    event ParticipantAdded(address indexed account, string name, Role role);
    event ParticipantDeactivated(address indexed account);
    event ProductCreated(uint256 indexed productId, string batchCode, string name, address indexed farmer);
    event StateChanged(uint256 indexed productId, State state, address indexed actor, string note);
    event FeedbackAdded(uint256 indexed productId, address indexed reviewer, uint8 rating);
    event ProductForSale(uint256 indexed productId, uint256 price, address indexed retailer);
    event ProductRecalled(uint256 indexed productId, address indexed actor, string reason);
    event RecallRequested(uint256 indexed productId, address indexed requester, string reason);
    event RecallReviewed(uint256 indexed productId, address indexed admin, bool approved, string note);
    event ProductTransformed(uint256 indexed sourceProductId, uint256 indexed outputProductId, uint256 quantity);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can perform this action");
        _;
    }

    modifier onlyRole(Role role) {
        Participant memory participant = participants[msg.sender];
        require(participant.isActive, "Participant is not active");
        require(participant.role == role, "Caller has incorrect role");
        _;
    }

    modifier productExists(uint256 productId) {
        require(products[productId].exists, "Product does not exist");
        _;
    }

    constructor() {
        admin = msg.sender;
        participants[msg.sender] = Participant(msg.sender, "System Admin", Role.Admin, true);
        emit ParticipantAdded(msg.sender, "System Admin", Role.Admin);
    }

    function addParticipant(address account, string memory name, Role role) external onlyAdmin {
        require(account != address(0), "Participant address is invalid");
        require(bytes(name).length > 0, "Participant name is required");
        require(role != Role.Admin && role != Role.Consumer, "Role cannot be assigned by admin");
        require(!participants[account].isActive, "Participant is already active");

        participants[account] = Participant(account, name, role, true);
        emit ParticipantAdded(account, name, role);
    }

    function deactivateParticipant(address account) external onlyAdmin {
        require(account != admin, "Admin cannot be deactivated");
        require(participants[account].isActive, "Participant is not active");
        participants[account].isActive = false;
        emit ParticipantDeactivated(account);
    }

    function createProduct(
        string memory batchCode,
        string memory name,
        string memory origin,
        string memory description,
        uint256 quantity,
        string memory unit,
        uint256 harvestDate,
        uint256 expiryDate
    ) external onlyRole(Role.Farmer) returns (uint256) {
        _requireText(batchCode, 3, 40, "Batch code length is invalid");
        _requireText(name, 3, 120, "Product name length is invalid");
        _requireText(origin, 3, 200, "Product origin length is invalid");
        _requireText(description, 10, 500, "Product description length is invalid");
        require(quantity > 0, "Quantity must be greater than zero");
        _requireText(unit, 1, 20, "Product unit length is invalid");
        require(harvestDate > 0, "Harvest date is required");
        require(expiryDate > harvestDate, "Expiry date must be after harvest date");
        bytes32 batchHash = keccak256(bytes(batchCode));
        require(productIdByBatchHash[batchHash] == 0, "Batch code already exists");

        uint256 productId = nextProductId++;
        products[productId] = Product({
            id: productId,
            batchCode: batchCode,
            name: name,
            origin: origin,
            description: description,
            farmer: msg.sender,
            manufacturer: address(0),
            distributors: new address[](0),
            retailer: address(0),
            state: State.Created,
            createdAt: block.timestamp,
            quantity: quantity,
            unit: unit,
            harvestDate: harvestDate,
            expiryDate: expiryDate,
            parentProductId: 0,
            pendingRecipient: address(0),
            price: 0,
            recallReason: "",
            recalledAt: 0,
            recalledBy: address(0),
            exists: true
        });
        productIdByBatchHash[batchHash] = productId;
        productIds.push(productId);
        _recordHistory(productId, unicode"Tạo sản phẩm", State.Created, description);
        emit ProductCreated(productId, batchCode, name, msg.sender);
        return productId;
    }

    function createProcessedProduct(
        uint256 sourceProductId,
        ProcessingInput calldata input
    ) external onlyRole(Role.Manufacturer) productExists(sourceProductId) returns (uint256) {
        Product storage source = products[sourceProductId];
        require(source.state == State.Harvested, "Source batch must be harvested");
        require(recallRequests[sourceProductId].status != RecallStatus.Pending, "Recall pending");
        require(input.materialQuantity > 0, "Material quantity must be greater than zero");
        require(input.outputQuantity > 0, "Output quantity must be greater than zero");
        require(materialUsedQuantity[sourceProductId] + input.materialQuantity <= source.quantity, "Material usage exceeds source quantity");
        require(input.expiryDate > source.harvestDate, "Expiry date must be after harvest date");
        _requireText(input.batchCode, 3, 40, "Batch code length is invalid");
        _requireText(input.name, 3, 120, "Product name length is invalid");
        _requireText(input.description, 10, 500, "Product description length is invalid");
        _requireText(input.unit, 1, 20, "Product unit length is invalid");
        _requireText(input.note, 5, 500, "Processing note length is invalid");
        bytes32 outputHash = keccak256(bytes(input.batchCode));
        require(productIdByBatchHash[outputHash] == 0, "Batch code already exists");

        materialUsedQuantity[sourceProductId] += input.materialQuantity;
        uint256 outputProductId = nextProductId++;
        products[outputProductId] = Product({
            id: outputProductId,
            batchCode: input.batchCode,
            name: input.name,
            origin: source.origin,
            description: input.description,
            farmer: source.farmer,
            manufacturer: msg.sender,
            distributors: new address[](0),
            retailer: address(0),
            state: State.Processed,
            createdAt: block.timestamp,
            quantity: input.outputQuantity,
            unit: input.unit,
            harvestDate: source.harvestDate,
            expiryDate: input.expiryDate,
            parentProductId: sourceProductId,
            pendingRecipient: address(0),
            price: 0,
            recallReason: "",
            recalledAt: 0,
            recalledBy: address(0),
            exists: true
        });
        productIdByBatchHash[outputHash] = outputProductId;
        productIds.push(outputProductId);
        processedProductIds[sourceProductId].push(outputProductId);
        _recordHistory(sourceProductId, unicode"Cấp nguyên liệu chế biến", State.Harvested, input.note);
        _recordHistory(outputProductId, unicode"Tạo sản phẩm từ lô nguyên liệu", State.Processed, input.note);
        emit ProductCreated(outputProductId, input.batchCode, input.name, source.farmer);
        emit ProductTransformed(sourceProductId, outputProductId, input.outputQuantity);
        return outputProductId;
    }

    function requestRecall(uint256 productId, string memory reason)
        external productExists(productId)
    {
        Product storage product = products[productId];
        require(product.state != State.Recalled, "Batch is already recalled");
        require(participants[msg.sender].isActive, "Participant is not active");
        require(_isProductParticipant(productId, msg.sender), "Caller is not involved in this batch");
        require(recallRequests[productId].status != RecallStatus.Pending, "Recall request is already pending");
        _requireText(reason, 10, 500, "Recall reason length is invalid");
        recallRequests[productId] = RecallRequest({
            productId: productId,
            requester: msg.sender,
            reason: reason,
            requestedAt: block.timestamp,
            status: RecallStatus.Pending,
            adminNote: "",
            resolvedAt: 0
        });
        _recordHistory(productId, unicode"Yêu cầu thu hồi", product.state, reason);
        emit RecallRequested(productId, msg.sender, reason);
    }

    function reviewRecall(uint256 productId, bool approve, string memory adminNote)
        external onlyAdmin productExists(productId)
    {
        RecallRequest storage request = recallRequests[productId];
        require(request.status == RecallStatus.Pending, "No pending recall request");
        _requireText(adminNote, 5, 500, "Admin note length is invalid");
        request.status = approve ? RecallStatus.Approved : RecallStatus.Rejected;
        request.adminNote = adminNote;
        request.resolvedAt = block.timestamp;

        Product storage product = products[productId];
        if (approve) {
            _markRecalled(productId, request.reason, adminNote);
            uint256[] storage outputs = processedProductIds[productId];
            for (uint256 i = 0; i < outputs.length; i++) {
                if (products[outputs[i]].state != State.Recalled) {
                    _markRecalled(outputs[i], request.reason, adminNote);
                }
            }
        } else {
            _recordHistory(productId, unicode"Từ chối thu hồi", product.state, adminNote);
        }
        emit RecallReviewed(productId, msg.sender, approve, adminNote);
    }

    function harvestProduct(uint256 productId, string memory note)
        external onlyRole(Role.Farmer) productExists(productId)
    {
        Product storage product = products[productId];
        require(product.farmer == msg.sender, "Only the product farmer can harvest");
        _requireText(note, 5, 500, "Harvest note length is invalid");
        _changeState(productId, State.Created, State.Harvested, unicode"Thu hoạch sản phẩm", note);
    }

    function shipProduct(
        uint256 productId,
        address recipient,
        string memory vehicleCode,
        int16 temperatureX10,
        string memory destination,
        string memory note
    )
        external onlyRole(Role.Distributor) productExists(productId)
    {
        Product storage product = products[productId];
        require(
            recallRequests[productId].status != RecallStatus.Pending
                && (product.parentProductId == 0 || recallRequests[product.parentProductId].status != RecallStatus.Pending),
            "Recall pending"
        );
        require(
            product.state == State.Processed || product.state == State.Shipped,
            "Product is not ready for distribution"
        );
        require(!distributorJoined[productId][msg.sender], "Distributor already joined this batch");
        if (product.state == State.Shipped) {
            require(product.pendingRecipient == msg.sender, "Distributor is not the expected recipient");
        }
        Participant memory recipientParticipant = participants[recipient];
        require(recipientParticipant.isActive, "Recipient is not an active participant");
        require(
            recipientParticipant.role == Role.Distributor || recipientParticipant.role == Role.Retailer,
            "Recipient must be a distributor or retailer"
        );
        require(recipient != msg.sender, "Recipient must be different from distributor");
        _requireText(vehicleCode, 2, 40, "Vehicle code length is invalid");
        _requireText(destination, 3, 200, "Destination length is invalid");
        _requireText(note, 5, 500, "Shipping note length is invalid");
        require(temperatureX10 >= -500 && temperatureX10 <= 600, "Temperature is out of range");
        distributorJoined[productId][msg.sender] = true;
        product.distributors.push(msg.sender);
        product.pendingRecipient = recipient;
        product.state = State.Shipped;
        shippingRecords[productId].push(ShippingRecord({
            distributor: msg.sender,
            recipient: recipient,
            vehicleCode: vehicleCode,
            temperatureX10: temperatureX10,
            destination: destination,
            timestamp: block.timestamp
        }));
        _recordHistory(productId, unicode"Bàn giao vận chuyển", State.Shipped, note);
        emit StateChanged(productId, State.Shipped, msg.sender, note);
    }

    function receiveProduct(uint256 productId, string memory note)
        external onlyRole(Role.Retailer) productExists(productId)
    {
        Product storage product = products[productId];
        _requireText(note, 5, 500, "Receiving note length is invalid");
        require(
            recallRequests[productId].status != RecallStatus.Pending
                && (product.parentProductId == 0 || recallRequests[product.parentProductId].status != RecallStatus.Pending),
            "Recall pending"
        );
        require(product.pendingRecipient == msg.sender, "Retailer is not the expected recipient");
        product.retailer = msg.sender;
        product.pendingRecipient = address(0);
        _changeState(productId, State.Shipped, State.Received, unicode"Nhận sản phẩm", note);
    }

    function setForSale(uint256 productId, uint256 price, string memory note)
        external onlyRole(Role.Retailer) productExists(productId)
    {
        Product storage product = products[productId];
        require(
            recallRequests[productId].status != RecallStatus.Pending
                && (product.parentProductId == 0 || recallRequests[product.parentProductId].status != RecallStatus.Pending),
            "Recall pending"
        );
        require(product.retailer == msg.sender, "Only the receiving retailer can list product");
        require(price > 0, "Sale price must be greater than zero");
        require(block.timestamp < product.expiryDate, "Expired batch cannot be listed for sale");
        _requireText(note, 5, 500, "Sale note length is invalid");
        product.price = price;
        _changeState(productId, State.Received, State.ForSale, unicode"Niêm yết sản phẩm", note);
        emit ProductForSale(productId, price, msg.sender);
    }

    function addFeedback(uint256 productId, uint8 rating, string memory comment)
        external productExists(productId)
    {
        require(!feedbackSubmitted[productId][msg.sender], "Feedback already submitted");
        require(rating >= 1 && rating <= 5, "Rating must be between 1 and 5");
        _requireText(comment, 3, 500, "Feedback comment length is invalid");
        feedbackSubmitted[productId][msg.sender] = true;
        feedbacks[productId].push(Feedback(productId, msg.sender, rating, comment, block.timestamp));
        emit FeedbackAdded(productId, msg.sender, rating);
    }

    function getProduct(uint256 productId) external view productExists(productId) returns (Product memory) {
        return products[productId];
    }

    function getProductIdByBatchCode(string memory batchCode) external view returns (uint256) {
        uint256 productId = productIdByBatchHash[keccak256(bytes(batchCode))];
        require(productId != 0, "Batch does not exist");
        return productId;
    }

    function getProductHistory(uint256 productId)
        external view productExists(productId) returns (History[] memory)
    {
        return histories[productId];
    }

    function getFeedbacks(uint256 productId)
        external view productExists(productId) returns (Feedback[] memory)
    {
        return feedbacks[productId];
    }

    function getShippingRecords(uint256 productId)
        external view productExists(productId) returns (ShippingRecord[] memory)
    {
        return shippingRecords[productId];
    }

    function getProcessedProductIds(uint256 productId)
        external view productExists(productId) returns (uint256[] memory)
    {
        return processedProductIds[productId];
    }

    function getMaterialBalance(uint256 productId)
        external view productExists(productId) returns (uint256 used, uint256 remaining)
    {
        used = materialUsedQuantity[productId];
        remaining = products[productId].quantity - used;
    }

    function getRecallRequest(uint256 productId)
        external view productExists(productId) returns (RecallRequest memory)
    {
        return recallRequests[productId];
    }

    function getPendingRecallProductIds() external view returns (uint256[] memory) {
        uint256 count;
        for (uint256 i = 0; i < productIds.length; i++) {
            if (recallRequests[productIds[i]].status == RecallStatus.Pending) count++;
        }

        uint256[] memory pendingIds = new uint256[](count);
        uint256 index;
        for (uint256 i = 0; i < productIds.length; i++) {
            uint256 productId = productIds[i];
            if (recallRequests[productId].status == RecallStatus.Pending) {
                pendingIds[index++] = productId;
            }
        }
        return pendingIds;
    }

    function getParticipant(address account) external view returns (Participant memory) {
        return participants[account];
    }

    function getAllProductIds() external view returns (uint256[] memory) {
        return productIds;
    }

    function _changeState(
        uint256 productId,
        State expected,
        State next,
        string memory action,
        string memory note
    ) private {
        Product storage product = products[productId];
        require(product.state == expected, "Product is not in the required state");
        product.state = next;
        _recordHistory(productId, action, next, note);
        emit StateChanged(productId, next, msg.sender, note);
    }

    function _markRecalled(uint256 productId, string memory reason, string memory note) private {
        Product storage product = products[productId];
        product.state = State.Recalled;
        product.recallReason = reason;
        product.recalledAt = block.timestamp;
        product.recalledBy = msg.sender;
        product.pendingRecipient = address(0);
        _recordHistory(productId, unicode"Phê duyệt thu hồi", State.Recalled, note);
        emit StateChanged(productId, State.Recalled, msg.sender, note);
        emit ProductRecalled(productId, msg.sender, reason);
    }

    function _recordHistory(
        uint256 productId,
        string memory action,
        State state,
        string memory note
    ) private {
        histories[productId].push(History(productId, action, state, msg.sender, block.timestamp, note));
    }

    function _requireText(
        string memory value,
        uint256 minLength,
        uint256 maxLength,
        string memory errorMessage
    ) private pure {
        uint256 length = bytes(value).length;
        require(length >= minLength && length <= maxLength, errorMessage);
    }

    function _isProductParticipant(uint256 productId, address account) private view returns (bool) {
        Product storage product = products[productId];
        return account == product.farmer
            || account == product.manufacturer
            || account == product.retailer
            || distributorJoined[productId][account];
    }

}
