import { query } from "../database.js";
import { calculateRoute } from "./mapService.js";

/**
 * Calculate authoritative server-side delivery charge based on road distance and active pricing rules
 */
export async function calculateDeliveryCharge({
  originLat,
  originLng,
  destLat,
  destLng,
  orderValue = 0
}) {
  // 1. Calculate real road distance and ETA
  const route = await calculateRoute(originLat, originLng, destLat, destLng);
  const distanceKm = route.distanceKm;
  const etaMinutes = route.etaMinutes;

  // Free delivery threshold check (orders above ₹25,000 unlock free vendor delivery)
  const FREE_DELIVERY_THRESHOLD = parseFloat(process.env.FREE_DELIVERY_THRESHOLD || "25000");
  if (orderValue >= FREE_DELIVERY_THRESHOLD) {
    return {
      distanceKm,
      etaMinutes,
      deliveryCharge: 0,
      isFreeDelivery: true,
      formattedCharge: "FREE Delivery (Order > ₹25,000)",
      formattedDistance: route.formattedDistance,
      formattedEta: route.formattedEta,
      breakdown: {
        baseCharge: 0,
        distanceCharge: 0,
        discount: "Free Shipping Unlocked"
      }
    };
  }

  let deliveryCharge = 50; // Base default fee
  let appliedRuleName = "Standard Regional Delivery";

  try {
    // Fetch active delivery pricing rules from database
    const rules = await query.all(
      `SELECT * FROM delivery_pricing_rules WHERE active = 1 ORDER BY minDistanceKm ASC`
    );

    if (rules && rules.length > 0) {
      // Find rule matching calculated distance
      const matchedRule = rules.find(
        (r) => distanceKm >= r.minDistanceKm && distanceKm <= r.maxDistanceKm
      ) || rules[rules.length - 1];

      if (matchedRule) {
        const extraKm = Math.max(0, distanceKm - matchedRule.minDistanceKm);
        const distanceAddon = Math.round(extraKm * (matchedRule.perKmCharge || 0));
        deliveryCharge = Math.round(matchedRule.baseCharge + distanceAddon);
        appliedRuleName = `${matchedRule.minDistanceKm}-${matchedRule.maxDistanceKm} km Tier (Base ₹${matchedRule.baseCharge} + ₹${matchedRule.perKmCharge}/km)`;
      }
    }
  } catch (err) {
    console.warn("Delivery pricing rules database query failed, using fallback formula:", err.message);
    // Fallback formula if DB unreachable
    if (distanceKm <= 5) deliveryCharge = 30;
    else if (distanceKm <= 15) deliveryCharge = 50 + Math.round((distanceKm - 5) * 2);
    else if (distanceKm <= 50) deliveryCharge = 80 + Math.round((distanceKm - 15) * 3);
    else deliveryCharge = 150 + Math.round((distanceKm - 50) * 4);
  }

  return {
    distanceKm,
    etaMinutes,
    deliveryCharge,
    isFreeDelivery: false,
    formattedCharge: `₹${deliveryCharge}`,
    formattedDistance: route.formattedDistance,
    formattedEta: route.formattedEta,
    provider: route.provider,
    breakdown: {
      appliedRule: appliedRuleName,
      distanceKm,
      baseCharge: deliveryCharge
    }
  };
}
