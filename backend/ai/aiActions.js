import crypto from "crypto";
import { query, pool } from "../database.js";
import { normalizeCropName } from "./aiTools.js";

/**
 * Action Risk Classifications
 */
export const ACTION_RISK = {
  READ_ONLY: "READ_ONLY",
  LOW_RISK: "LOW_RISK",
  SENSITIVE: "SENSITIVE",
  HIGH_RISK: "HIGH_RISK"
};

/**
 * Standard Action Error Codes
 */
export const ACTION_ERRORS = {
  AUTH_REQUIRED: "AUTH_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  ACTION_NOT_FOUND: "ACTION_NOT_FOUND",
  ACTION_EXPIRED: "ACTION_EXPIRED",
  ACTION_ALREADY_PROCESSED: "ACTION_ALREADY_PROCESSED",
  ACTION_CANCELLED: "ACTION_CANCELLED",
  ACTION_STALE: "ACTION_STALE",
  INVALID_PARAMETERS: "INVALID_PARAMETERS",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
  OWNERSHIP_VIOLATION: "OWNERSHIP_VIOLATION",
  BUSINESS_RULE_VIOLATION: "BUSINESS_RULE_VIOLATION",
  TRANSACTION_FAILED: "TRANSACTION_FAILED",
  CONFIRMATION_REQUIRED: "CONFIRMATION_REQUIRED"
};

// 5 minutes confirmation token lifetime
export const ACTION_TOKEN_LIFETIME_MS = 5 * 60 * 1000;

function generateId(prefix = "act") {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

function generateConfirmationToken() {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function hashParameters(params) {
  return crypto.createHash("sha256").update(JSON.stringify(params || {})).digest("hex");
}

/**
 * Action Registry Definitions
 */
export const ACTION_REGISTRY = {
  UPDATE_PRODUCT_PRICE: {
    actionId: "UPDATE_PRODUCT_PRICE",
    name: "Update Product Price",
    description: "Update the listing price per unit for a farmer's product.",
    riskLevel: ACTION_RISK.SENSITIVE,
    requiredRole: ["farmer", "admin"],
    requiresConfirmation: true
  },
  UPDATE_INVENTORY: {
    actionId: "UPDATE_INVENTORY",
    name: "Update Inventory Stock",
    description: "Add to or adjust the available inventory quantity for a farmer's product.",
    riskLevel: ACTION_RISK.SENSITIVE,
    requiredRole: ["farmer", "admin"],
    requiresConfirmation: true
  },
  CREATE_PRODUCT_LISTING: {
    actionId: "CREATE_PRODUCT_LISTING",
    name: "Create Product Listing",
    description: "Publish a new produce listing onto the FarmConnect marketplace.",
    riskLevel: ACTION_RISK.SENSITIVE,
    requiredRole: ["farmer", "admin"],
    requiresConfirmation: true
  },
  CANCEL_ORDER: {
    actionId: "CANCEL_ORDER",
    name: "Cancel Order",
    description: "Cancel a pending order and safely restock inventory.",
    riskLevel: ACTION_RISK.SENSITIVE,
    requiredRole: ["farmer", "vendor", "admin"],
    requiresConfirmation: true
  },
  SEND_MESSAGE: {
    actionId: "SEND_MESSAGE",
    name: "Send Marketplace Message",
    description: "Send a direct B2B communication message to a counterparty.",
    riskLevel: ACTION_RISK.SENSITIVE,
    requiredRole: ["farmer", "vendor", "admin"],
    requiresConfirmation: true
  }
};

/**
 * Prepares an action proposal without mutating application data.
 * Validates role, ownership, and inputs, generates a short-lived cryptographic token,
 * and stores pending state in ai_pending_actions.
 */
export async function prepareActionProposal(opts, argActionId, argParams, argConvId, argLang) {
  let user, actionId, parameters, conversationId, lang;
  if (opts && opts.id && typeof opts.id === "string" && !opts.user) {
    user = opts;
    actionId = argActionId;
    parameters = argParams;
    conversationId = argConvId || null;
    lang = argLang || "en";
  } else if (opts && typeof opts === "object") {
    ({ user, actionId, parameters, conversationId = null, lang = "en" } = opts);
  } else {
    user = opts;
    actionId = argActionId;
    parameters = argParams;
    conversationId = argConvId || null;
    lang = argLang || "en";
  }
  if (!user || !user.id) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.AUTH_REQUIRED, message: "Authentication required to prepare actions." }
    };
  }

  const def = ACTION_REGISTRY[actionId];
  if (!def) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.ACTION_NOT_FOUND, message: `Unknown action '${actionId}'.` }
    };
  }

  // Verify user role
  if (!def.requiredRole.includes(user.role)) {
    return {
      success: false,
      error: {
        code: ACTION_ERRORS.FORBIDDEN,
        message: `Your role (${user.role}) is not authorized to execute '${def.name}'.`
      }
    };
  }

  const cleanLang = (lang || "en").toLowerCase().trim();
  let proposalData = {};
  let expectedState = {};
  let displayFields = [];
  let title = def.name;
  let description = def.description;
  let impactText = "";
  let warningText = "";

  // -------------------------------------------------------------
  // ACTION: UPDATE_PRODUCT_PRICE
  // -------------------------------------------------------------
  if (actionId === "UPDATE_PRODUCT_PRICE") {
    let { productId, commodity, crop, newPrice, price } = parameters || {};
    const proposedPrice = parseFloat(newPrice !== undefined ? newPrice : price);

    if (isNaN(proposedPrice) || proposedPrice <= 0) {
      return {
        success: false,
        error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Price must be a valid positive number greater than zero." }
      };
    }

    if (proposedPrice > 100000) {
      return {
        success: false,
        error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Price exceeds the maximum platform limit (₹1,00,000)." }
      };
    }

    // Locate product: by ID, or by matching crop name owned by this farmer
    let product = null;
    if (productId) {
      product = await query.get("SELECT * FROM products WHERE id = ?", [productId]);
    } else {
      const targetCrop = normalizeCropName(crop || commodity || "");
      if (targetCrop) {
        product = await query.get(
          "SELECT * FROM products WHERE farmerId = ? AND (name LIKE ? OR category LIKE ?) ORDER BY createdAt DESC LIMIT 1",
          [user.id, `%${targetCrop}%`, `%${targetCrop}%`]
        );
      }
    }

    if (!product) {
      return {
        success: false,
        error: { code: ACTION_ERRORS.RESOURCE_NOT_FOUND, message: `No active product listing found for '${crop || commodity || productId}'.` }
      };
    }

    // Strict Anti-Spoofing: Farmer must own the product (or be Admin)
    if (product.farmerId !== user.id && user.role !== "admin") {
      return {
        success: false,
        error: { code: ACTION_ERRORS.OWNERSHIP_VIOLATION, message: "You are not authorized to update products belonging to another farmer." }
      };
    }

    const currentPrice = parseFloat(product.price);
    expectedState = { productId: product.id, price: currentPrice };
    proposalData = { productId: product.id, currentPrice, newPrice: proposedPrice };

    // Multilingual display formatting
    if (cleanLang === "ta") {
      title = "விலை மாற்றத்தை உறுதிப்படுத்தவும்";
      description = `${product.name} விலை மாற்றத்திற்கான தயாரிப்பு.`;
      impactText = `இது FarmConnect சந்தையில் பொது பட்டியலிடப்பட்ட விலையை மாற்றும்.`;
      warningText = `உறுதிப்படுத்திய பிறகு புதிய விலை வாங்குபவர்களுக்கு உடனடியாகக் காண்பிக்கப்படும்.`;
    } else if (cleanLang === "hi") {
      title = "उत्पाद मूल्य अद्यतन की पुष्टि करें";
      description = `${product.name} की कीमत बदलने का प्रस्ताव।`;
      impactText = `यह FarmConnect बाज़ार में सार्वजनिक सूची मूल्य को बदल देगा।`;
      warningText = `पुष्टि के बाद नई कीमत खरीदारों को तुरंत दिखाई देगी।`;
    } else {
      title = "Confirm Product Price Update";
      description = `Update public listing price for ${product.name}.`;
      impactText = `This will update the public marketplace price visible to all B2B buyers.`;
      warningText = `Ensure the new price aligns with current quality and market demand.`;
    }

    displayFields = [
      { label: cleanLang === "ta" ? "பயிர் / தயாரிப்பு" : cleanLang === "hi" ? "उत्पाद" : "Product", value: product.name },
      { label: cleanLang === "ta" ? "தற்போதைய விலை" : cleanLang === "hi" ? "वर्तमान कीमत" : "Current Price", value: `₹${currentPrice}/${product.unit}` },
      { label: cleanLang === "ta" ? "புதிய விலை" : cleanLang === "hi" ? "नई कीमत" : "Proposed Price", value: `₹${proposedPrice}/${product.unit}`, highlight: true }
    ];
  }

  // -------------------------------------------------------------
  // ACTION: UPDATE_INVENTORY
  // -------------------------------------------------------------
  else if (actionId === "UPDATE_INVENTORY") {
    let { productId, commodity, crop, quantityDelta, newStock, stock } = parameters || {};

    let product = null;
    if (productId) {
      product = await query.get("SELECT * FROM products WHERE id = ?", [productId]);
    } else {
      const targetCrop = normalizeCropName(crop || commodity || "");
      if (targetCrop) {
        product = await query.get(
          "SELECT * FROM products WHERE farmerId = ? AND (name LIKE ? OR category LIKE ?) ORDER BY createdAt DESC LIMIT 1",
          [user.id, `%${targetCrop}%`, `%${targetCrop}%`]
        );
      }
    }

    if (!product) {
      return {
        success: false,
        error: { code: ACTION_ERRORS.RESOURCE_NOT_FOUND, message: `No active product listing found for '${crop || commodity || productId}'.` }
      };
    }

    // Ownership check
    if (product.farmerId !== user.id && user.role !== "admin") {
      return {
        success: false,
        error: { code: ACTION_ERRORS.OWNERSHIP_VIOLATION, message: "You are not authorized to modify inventory belonging to another farmer." }
      };
    }

    const currentStock = parseInt(product.stock, 10);
    let targetStock = currentStock;

    if (newStock !== undefined || stock !== undefined) {
      targetStock = parseInt(newStock !== undefined ? newStock : stock, 10);
    } else if (quantityDelta !== undefined) {
      targetStock = currentStock + parseInt(quantityDelta, 10);
    }

    if (isNaN(targetStock) || targetStock < 0) {
      return {
        success: false,
        error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Inventory stock cannot be negative or invalid." }
      };
    }

    expectedState = { productId: product.id, stock: currentStock };
    proposalData = { productId: product.id, currentStock, newStock: targetStock, delta: targetStock - currentStock };

    if (cleanLang === "ta") {
      title = "கையிருப்பு மாற்றத்தை உறுதிப்படுத்தவும்";
      description = `${product.name} தயாரிப்பின் கையிருப்பு அளவை மாற்றுதல்.`;
      impactText = `இது கிடைக்கக்கூடிய விற்பனை அளவை மாற்றியமைக்கும்.`;
    } else if (cleanLang === "hi") {
      title = "स्टॉक अद्यतन की पुष्टि करें";
      description = `${product.name} के स्टॉक की मात्रा में परिवर्तन।`;
      impactText = `यह बिक्री के लिए उपलब्ध मात्रा को बदल देगा।`;
    } else {
      title = "Confirm Inventory Stock Update";
      description = `Adjust available stock for ${product.name}.`;
      impactText = `This directly updates the available quantity for buyer procurement.`;
    }

    displayFields = [
      { label: cleanLang === "ta" ? "பயிர் / தயாரிப்பு" : cleanLang === "hi" ? "उत्पाद" : "Product", value: product.name },
      { label: cleanLang === "ta" ? "தற்போதைய கையிருப்பு" : cleanLang === "hi" ? "वर्तमान स्टॉक" : "Current Stock", value: `${currentStock} ${product.unit}` },
      { label: cleanLang === "ta" ? "புதிய கையிருப்பு" : cleanLang === "hi" ? "नया स्टॉक" : "New Stock", value: `${targetStock} ${product.unit}`, highlight: true }
    ];
  }

  // -------------------------------------------------------------
  // ACTION: CREATE_PRODUCT_LISTING
  // -------------------------------------------------------------
  else if (actionId === "CREATE_PRODUCT_LISTING") {
    const { name, category, price, stock, unit, moq, organic, description: itemDesc } = parameters || {};
    const parsedPrice = parseFloat(price);
    const parsedStock = parseInt(stock, 10);

    if (!name || !name.trim()) {
      return { success: false, error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Product name is required." } };
    }
    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      return { success: false, error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Valid positive price is required." } };
    }
    if (isNaN(parsedStock) || parsedStock <= 0) {
      return { success: false, error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Valid positive stock quantity is required." } };
    }

    proposalData = {
      name: name.trim(),
      category: category || "Vegetables",
      price: parsedPrice,
      stock: parsedStock,
      unit: unit || "kg",
      moq: parseInt(moq, 10) || 10,
      organic: Boolean(organic),
      description: itemDesc || `Freshly harvested ${name}`
    };

    if (cleanLang === "ta") {
      title = "புதிய விளைபொருள் பட்டியலை உறுதிப்படுத்தவும்";
      description = `${name} புதிய பட்டியலை சந்தையில் பதிவேற்றுதல்.`;
      impactText = `உறுதிப்படுத்திய பிறகு இது பொது சந்தையில் வாங்குபவர்களுக்குத் தெரியும்.`;
    } else if (cleanLang === "hi") {
      title = "नई उत्पाद सूची की पुष्टि करें";
      description = `${name} की नई लिस्टिंग बाज़ार में जोड़ना।`;
      impactText = `पुष्टि के बाद यह खरीदारों के लिए बाज़ार में लाइव हो जाएगी।`;
    } else {
      title = "Confirm New Product Listing";
      description = `Create public listing for ${name}.`;
      impactText = `This will publish the produce onto the FarmConnect marketplace.`;
    }

    displayFields = [
      { label: "Produce", value: name },
      { label: "Price", value: `₹${parsedPrice}/${unit || "kg"}` },
      { label: "Quantity", value: `${parsedStock} ${unit || "kg"}` },
      { label: "Organic", value: organic ? "Yes (Certified)" : "Conventional" }
    ];
  }

  // -------------------------------------------------------------
  // ACTION: CANCEL_ORDER
  // -------------------------------------------------------------
  else if (actionId === "CANCEL_ORDER") {
    const { orderId, reason } = parameters || {};
    if (!orderId) {
      return { success: false, error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Order ID is required to cancel." } };
    }

    const order = await query.get("SELECT * FROM orders WHERE id = ?", [orderId]);
    if (!order) {
      return { success: false, error: { code: ACTION_ERRORS.RESOURCE_NOT_FOUND, message: `Order #${orderId} was not found.` } };
    }

    // Ownership check: vendor owns order, or farmer owns an item in it, or admin
    let isAuthorized = user.role === "admin" || order.vendorId === user.id;
    if (!isAuthorized && user.role === "farmer") {
      const item = await query.get("SELECT id FROM order_items WHERE orderId = ? AND farmerId = ? LIMIT 1", [orderId, user.id]);
      if (item) isAuthorized = true;
    }

    if (!isAuthorized) {
      return { success: false, error: { code: ACTION_ERRORS.OWNERSHIP_VIOLATION, message: "You are not authorized to cancel this order." } };
    }

    // Cancellation constraint: only Pending or Payment_Pending can be cancelled
    if (order.status.toLowerCase() !== "pending" && order.status.toLowerCase() !== "payment_pending") {
      return {
        success: false,
        error: {
          code: ACTION_ERRORS.BUSINESS_RULE_VIOLATION,
          message: `Order #${orderId} cannot be cancelled because its current status is '${order.status}'. Only pending orders can be cancelled.`
        }
      };
    }

    expectedState = { orderId, status: order.status };
    proposalData = { orderId, reason: reason || "User requested cancellation via AI." };

    if (cleanLang === "ta") {
      title = "ஆர்டர் ரத்து செய்ய உறுதிப்படுத்தவும்";
      description = `ஆர்டர் #${orderId} ரத்து செய்வதற்கான கோரிக்கை.`;
      impactText = `இந்த ஆர்டர் ரத்து செய்யப்பட்டு கையிருப்பு மீட்டமைக்கப்படும்.`;
      warningText = `ரத்து செய்த செயல் மாற்ற முடியாதது.`;
    } else if (cleanLang === "hi") {
      title = "ऑर्डर रद्द करने की पुष्टि करें";
      description = `ऑर्डर #${orderId} को रद्द करने का अनुरोध।`;
      impactText = `यह ऑर्डर रद्द कर दिया जाएगा और स्टॉक पुनर्स्थापित होगा।`;
      warningText = `रद्द करने की क्रिया को पूर्ववत नहीं किया जा सकता।`;
    } else {
      title = "Confirm Order Cancellation";
      description = `Cancel pending order #${orderId}.`;
      impactText = `The order will be cancelled and reserved product inventory will be restored.`;
      warningText = `This action cannot be undone once confirmed.`;
    }

    displayFields = [
      { label: "Order ID", value: `#${orderId}` },
      { label: "Total Value", value: `₹${order.totalAmount}` },
      { label: "Current Status", value: order.status },
      { label: "Reason", value: reason || "Cancellation requested" }
    ];
  }

  // -------------------------------------------------------------
  // ACTION: SEND_MESSAGE
  // -------------------------------------------------------------
  else if (actionId === "SEND_MESSAGE") {
    const { conversationId: convId, recipientId, message } = parameters || {};
    if (!message || !message.trim()) {
      return { success: false, error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Message content cannot be empty." } };
    }

    let targetConv = null;
    if (convId) {
      targetConv = await query.get("SELECT * FROM conversations WHERE id = ?", [convId]);
    } else if (recipientId) {
      targetConv = await query.get(
        "SELECT * FROM conversations WHERE (farmerId = ? AND vendorId = ?) OR (farmerId = ? AND vendorId = ?) LIMIT 1",
        [user.id, recipientId, recipientId, user.id]
      );
    }

    if (!targetConv) {
      return { success: false, error: { code: ACTION_ERRORS.RESOURCE_NOT_FOUND, message: "Active conversation not found." } };
    }

    if (targetConv.farmerId !== user.id && targetConv.vendorId !== user.id && user.role !== "admin") {
      return { success: false, error: { code: ACTION_ERRORS.OWNERSHIP_VIOLATION, message: "You are not a participant in this conversation." } };
    }

    const counterpartyId = targetConv.farmerId === user.id ? targetConv.vendorId : targetConv.farmerId;
    const counterparty = await query.get("SELECT name FROM users WHERE id = ?", [counterpartyId]);

    proposalData = { conversationId: targetConv.id, recipientId: counterpartyId, message: message.trim() };

    title = cleanLang === "ta" ? "செய்தி அனுப்ப உறுதிப்படுத்தவும்" : cleanLang === "hi" ? "संदेश भेजने की पुष्टि करें" : "Confirm Marketplace Message";
    description = `Send message to ${counterparty ? counterparty.name : "counterparty"}.`;
    displayFields = [
      { label: "Recipient", value: counterparty ? counterparty.name : "Counterparty" },
      { label: "Message", value: message.trim() }
    ];
  }

  // Generate cryptographic confirmation token
  const pendingId = generateId("pact");
  const rawConfirmationToken = generateConfirmationToken();
  const tokenHash = hashToken(rawConfirmationToken);
  const paramHash = hashParameters(proposalData);
  const expiresAt = Date.now() + ACTION_TOKEN_LIFETIME_MS;
  const createdAt = new Date().toISOString();

  // Save pending action to database
  await query.run(
    `INSERT INTO ai_pending_actions 
      (id, userId, conversationId, actionId, parametersJson, parametersHash, status, confirmationTokenHash, expectedStateJson, expiresAt, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?, ?)`,
    [
      pendingId,
      user.id,
      conversationId || null,
      actionId,
      JSON.stringify(proposalData),
      paramHash,
      tokenHash,
      JSON.stringify(expectedState),
      expiresAt,
      createdAt
    ]
  );

  return {
    success: true,
    requiresConfirmation: true,
    action: {
      actionId,
      pendingId,
      actionType: actionId,
      riskLevel: def.riskLevel,
      confirmationToken: rawConfirmationToken,
      expiresAt,
      summary: description,
      impact: impactText,
      currentValue: proposalData.currentPrice !== undefined ? proposalData.currentPrice : proposalData.currentStock,
      proposedValue: proposalData.newPrice !== undefined ? proposalData.newPrice : proposalData.newStock,
      display: {
        title,
        description,
        fields: displayFields,
        impact: impactText,
        warning: warningText,
        language: cleanLang
      }
    }
  };
}

/**
 * Authoritatively confirms and executes an action.
 * Revalidates user identity, expiration, stale data, and executes inside a database transaction.
 */
export async function confirmAction(opts, legacyToken) {
  let user, confirmationToken;
  if (legacyToken) {
    user = typeof opts === "string" ? { id: opts } : opts;
    confirmationToken = legacyToken;
  } else if (opts && typeof opts === "object") {
    confirmationToken = opts.confirmationToken;
    user = opts.user || (opts.userId ? { id: opts.userId, role: opts.userRole || "farmer" } : null);
  } else {
    user = typeof opts === "string" ? { id: opts } : opts;
    confirmationToken = legacyToken;
  }

  if (!user || !user.id) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.AUTH_REQUIRED, message: "Authentication required to confirm actions." }
    };
  }

  if (!confirmationToken || typeof confirmationToken !== "string") {
    return {
      success: false,
      error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Confirmation token is required." }
    };
  }

  const tokenHash = hashToken(confirmationToken);

  // Look up pending action record
  const pending = await query.get(
    "SELECT * FROM ai_pending_actions WHERE confirmationTokenHash = ?",
    [tokenHash]
  );

  if (!pending) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.ACTION_NOT_FOUND, message: "No action found matching this confirmation token." }
    };
  }

  // Idempotency: check previous statuses
  if (pending.status === "CONFIRMED") {
    let prevResult = null;
    try {
      prevResult = JSON.parse(pending.resultJson || "{}");
    } catch {
      /* ignore */
    }
    return {
      success: false,
      error: {
        code: ACTION_ERRORS.ACTION_ALREADY_PROCESSED,
        message: "This action has already been confirmed and executed.",
        result: prevResult
      }
    };
  }

  if (pending.status === "CANCELLED") {
    return {
      success: false,
      error: { code: ACTION_ERRORS.ACTION_CANCELLED, message: "This action was previously cancelled." }
    };
  }

  // Expiration Check (5 minutes)
  if (Date.now() > Number(pending.expiresAt)) {
    await query.run("UPDATE ai_pending_actions SET status = 'EXPIRED' WHERE id = ?", [pending.id]);
    return {
      success: false,
      error: {
        code: ACTION_ERRORS.ACTION_EXPIRED,
        message: "This confirmation token has expired (5-minute limit). Please ask the AI to prepare the action again."
      }
    };
  }

  // Anti-Spoofing: Confirming user must match authenticated proposing user
  if (pending.userId !== user.id) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.OWNERSHIP_VIOLATION, message: "You are not authorized to confirm this action." }
    };
  }

  let parameters = {};
  let expectedState = {};
  try {
    parameters = JSON.parse(pending.parametersJson || "{}");
    expectedState = JSON.parse(pending.expectedStateJson || "{}");
  } catch (e) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.INVALID_PARAMETERS, message: "Corrupted action parameters in database." }
    };
  }

  const now = new Date().toISOString();
  let executionResult = {};
  let successMessage = "Action confirmed and executed successfully.";

  // -------------------------------------------------------------
  // ATOMIC DATABASE TRANSACTION EXECUTION
  // -------------------------------------------------------------
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (pending.actionId === "UPDATE_PRODUCT_PRICE") {
      const [currentRows] = await conn.query("SELECT * FROM products WHERE id = ? FOR UPDATE", [parameters.productId]);
      const currentProduct = currentRows[0];

      if (!currentProduct) {
        throw new Error("RESOURCE_NOT_FOUND: Product no longer exists.");
      }

      // Re-verify ownership in transaction
      if (currentProduct.farmerId !== user.id && user.role !== "admin") {
        throw new Error("OWNERSHIP_VIOLATION: Farmer does not own this product.");
      }

      // Stale data check
      if (expectedState.price !== undefined && Math.abs(parseFloat(currentProduct.price) - parseFloat(expectedState.price)) > 0.001) {
        throw new Error(`ACTION_STALE: Product price changed to ₹${currentProduct.price} since proposal.`);
      }

      // Execute update
      await conn.query("UPDATE products SET price = ? WHERE id = ?", [parameters.newPrice, parameters.productId]);
      executionResult = {
        productId: parameters.productId,
        productName: currentProduct.name,
        oldPrice: currentProduct.price,
        newPrice: parameters.newPrice,
        price: parameters.newPrice,
        unit: currentProduct.unit
      };
      successMessage = `Price for '${currentProduct.name}' updated to ₹${parameters.newPrice}/${currentProduct.unit}.`;
    }

    else if (pending.actionId === "UPDATE_INVENTORY") {
      const [currentRows] = await conn.query("SELECT * FROM products WHERE id = ? FOR UPDATE", [parameters.productId]);
      const currentProduct = currentRows[0];

      if (!currentProduct) {
        throw new Error("RESOURCE_NOT_FOUND: Product no longer exists.");
      }

      if (currentProduct.farmerId !== user.id && user.role !== "admin") {
        throw new Error("OWNERSHIP_VIOLATION: Farmer does not own this product.");
      }

      // Stale data check
      if (expectedState.stock !== undefined && parseInt(currentProduct.stock, 10) !== parseInt(expectedState.stock, 10)) {
        throw new Error(`ACTION_STALE: Product inventory changed to ${currentProduct.stock} since proposal.`);
      }

      await conn.query("UPDATE products SET stock = ? WHERE id = ?", [parameters.newStock, parameters.productId]);
      executionResult = {
        productId: parameters.productId,
        productName: currentProduct.name,
        oldStock: currentProduct.stock,
        newStock: parameters.newStock,
        unit: currentProduct.unit
      };
      successMessage = `Inventory for '${currentProduct.name}' updated to ${parameters.newStock} ${currentProduct.unit}.`;
    }

    else if (pending.actionId === "CREATE_PRODUCT_LISTING") {
      const newProdId = generateId("prod");
      await conn.query(
        `INSERT INTO products (id, name, category, price, stock, unit, moq, organic, description, farmerId, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newProdId,
          parameters.name,
          parameters.category,
          parameters.price,
          parameters.stock,
          parameters.unit,
          parameters.moq,
          parameters.organic ? 1 : 0,
          parameters.description,
          user.id,
          now
        ]
      );
      executionResult = { productId: newProdId, ...parameters };
      successMessage = `Product listing '${parameters.name}' created successfully on the marketplace.`;
    }

    else if (pending.actionId === "CANCEL_ORDER") {
      const [orderRows] = await conn.query("SELECT * FROM orders WHERE id = ? FOR UPDATE", [parameters.orderId]);
      const order = orderRows[0];

      if (!order) {
        throw new Error("RESOURCE_NOT_FOUND: Order no longer exists.");
      }

      if (expectedState.status && order.status !== expectedState.status) {
        throw new Error(`ACTION_STALE: Order status changed to '${order.status}' since proposal.`);
      }

      // Restock inventory for items in this order
      const [items] = await conn.query("SELECT * FROM order_items WHERE orderId = ?", [parameters.orderId]);
      for (const item of items) {
        if (item.productId && item.qty) {
          await conn.query("UPDATE products SET stock = stock + ? WHERE id = ?", [item.qty, item.productId]);
        }
      }

      await conn.query("UPDATE orders SET status = 'Cancelled' WHERE id = ?", [parameters.orderId]);
      executionResult = { orderId: parameters.orderId, previousStatus: order.status, status: "Cancelled" };
      successMessage = `Order #${parameters.orderId} has been cancelled and reserved stock restored.`;
    }

    else if (pending.actionId === "SEND_MESSAGE") {
      const msgId = generateId("msg");
      await conn.query(
        `INSERT INTO messages (id, conversationId, senderId, message, messageType, isRead, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'text', 0, 'delivered', ?, ?)`,
        [msgId, parameters.conversationId, user.id, parameters.message, now, now]
      );
      await conn.query("UPDATE conversations SET updatedAt = ? WHERE id = ?", [now, parameters.conversationId]);
      executionResult = { messageId: msgId, conversationId: parameters.conversationId };
      successMessage = "Marketplace message sent successfully.";
    }

    // Mark pending action CONFIRMED
    await conn.query(
      "UPDATE ai_pending_actions SET status = 'CONFIRMED', confirmedAt = ?, resultJson = ? WHERE id = ?",
      [now, JSON.stringify(executionResult), pending.id]
    );

    // Record in Audit Log
    const auditId = generateId("audit");
    await conn.query(
      `INSERT INTO ai_action_audit (id, userId, role, actionId, conversationId, status, parametersSummary, resultSummary, createdAt, completedAt)
       VALUES (?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?)`,
      [
        auditId,
        user.id,
        user.role,
        pending.actionId,
        pending.conversationId || null,
        JSON.stringify(parameters).slice(0, 500),
        JSON.stringify(executionResult).slice(0, 500),
        pending.createdAt,
        now
      ]
    );

    await conn.commit();

    return {
      success: true,
      actionId: pending.actionId,
      status: "CONFIRMED",
      result: executionResult,
      message: successMessage
    };
  } catch (err) {
    await conn.rollback();
    console.error("[Action Confirmation Error]:", err.message || err);

    let errCode = ACTION_ERRORS.TRANSACTION_FAILED;
    let errMsg = "Action execution failed in database transaction.";

    if (err.message && err.message.startsWith("ACTION_STALE:")) {
      errCode = ACTION_ERRORS.ACTION_STALE;
      errMsg = err.message.replace("ACTION_STALE:", "").trim();
    } else if (err.message && err.message.startsWith("OWNERSHIP_VIOLATION:")) {
      errCode = ACTION_ERRORS.OWNERSHIP_VIOLATION;
      errMsg = err.message.replace("OWNERSHIP_VIOLATION:", "").trim();
    } else if (err.message && err.message.startsWith("RESOURCE_NOT_FOUND:")) {
      errCode = ACTION_ERRORS.RESOURCE_NOT_FOUND;
      errMsg = err.message.replace("RESOURCE_NOT_FOUND:", "").trim();
    }

    // Log failure in audit log
    try {
      const auditId = generateId("audit");
      await query.run(
        `INSERT INTO ai_action_audit (id, userId, role, actionId, conversationId, status, failureReason, createdAt, completedAt)
         VALUES (?, ?, ?, ?, ?, 'FAILED', ?, ?, ?)`,
        [auditId, user.id, user.role, pending.actionId, pending.conversationId || null, errMsg, pending.createdAt, now]
      );
    } catch {
      /* ignore audit logging failure */
    }

    return {
      success: false,
      error: { code: errCode, message: errMsg }
    };
  } finally {
    conn.release();
  }
}

/**
 * Explicitly cancels an action proposal.
 */
export async function cancelAction(opts, legacyToken) {
  let user, confirmationToken, actionId;
  if (legacyToken) {
    user = typeof opts === "string" ? { id: opts } : opts;
    confirmationToken = legacyToken;
  } else if (opts && typeof opts === "object") {
    confirmationToken = opts.confirmationToken;
    actionId = opts.actionId;
    user = opts.user || (opts.userId ? { id: opts.userId, role: opts.userRole || "farmer" } : null);
  } else {
    user = typeof opts === "string" ? { id: opts } : opts;
    confirmationToken = legacyToken;
  }

  if (!user || !user.id) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.AUTH_REQUIRED, message: "Authentication required to cancel action." }
    };
  }

  let pending = null;
  if (confirmationToken) {
    const tokenHash = hashToken(confirmationToken);
    pending = await query.get("SELECT * FROM ai_pending_actions WHERE confirmationTokenHash = ?", [tokenHash]);
  } else if (actionId) {
    pending = await query.get("SELECT * FROM ai_pending_actions WHERE id = ?", [actionId]);
  }

  if (!pending) {
    return {
      success: false,
      error: { code: ACTION_ERRORS.ACTION_NOT_FOUND, message: "Pending action not found." }
    };
  }

  if (pending.userId !== user.id && user.role !== "admin") {
    return {
      success: false,
      error: { code: ACTION_ERRORS.OWNERSHIP_VIOLATION, message: "You are not authorized to cancel this action." }
    };
  }

  const now = new Date().toISOString();
  await query.run(
    "UPDATE ai_pending_actions SET status = 'CANCELLED', cancelledAt = ? WHERE id = ?",
    [now, pending.id]
  );

  // Record in audit log
  const auditId = generateId("audit");
  await query.run(
    `INSERT INTO ai_action_audit (id, userId, role, actionId, conversationId, status, createdAt, completedAt)
     VALUES (?, ?, ?, ?, ?, 'CANCELLED', ?, ?)`,
    [auditId, user.id, user.role, pending.actionId, pending.conversationId || null, pending.createdAt, now]
  );

  return {
    success: true,
    actionId: pending.actionId,
    status: "CANCELLED",
    message: "Action cancelled. No modifications were made to the database."
  };
}

/**
 * Retrieves audit history for an authenticated user.
 */
export async function getActionAuditHistory(opts, legacyLimit = 20) {
  let userId, limit;
  if (opts && typeof opts === "object") {
    userId = opts.user ? opts.user.id : (opts.userId || opts.id);
    limit = opts.limit || legacyLimit;
  } else {
    userId = opts;
    limit = legacyLimit;
  }

  if (!userId) return [];
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  return await query.all(
    "SELECT * FROM ai_action_audit WHERE userId = ? ORDER BY createdAt DESC LIMIT ?",
    [userId, safeLimit]
  );
}
