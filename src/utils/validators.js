/**
 * Simple, dependency-free form validators used across
 * Add/Edit Product and Checkout forms.
 */
export function required(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

export function isPositiveNumber(value) {
  const n = Number(value);
  return !Number.isNaN(n) && n > 0;
}

export function isPhone(value) {
  return /^[6-9]\d{9}$/.test(String(value).trim());
}

export function isPincode(value) {
  return /^\d{6}$/.test(String(value).trim());
}

export function validateProductForm(form, t) {
  const errors = {};
  if (!required(form.name)) errors.name = t("fieldRequired");
  if (!required(form.category)) errors.category = t("fieldRequired");
  if (!required(form.grade)) errors.grade = t("fieldRequired");
  if (!required(form.unit)) errors.unit = t("fieldRequired");
  if (!isPositiveNumber(form.price)) errors.price = t("invalidNumber");
  if (!isPositiveNumber(form.stock)) errors.stock = t("invalidNumber");
  if (!required(form.description)) errors.description = t("fieldRequired");
  return errors;
}

export function validateCheckoutForm(form, t) {
  const errors = {};
  if (!required(form.fullName)) errors.fullName = t("fieldRequired");
  if (!isPhone(form.phone)) errors.phone = t("invalidPhone");
  if (!required(form.address)) errors.address = t("fieldRequired");
  if (!required(form.city)) errors.city = t("fieldRequired");
  if (!isPincode(form.pincode)) errors.pincode = t("invalidPincode");
  return errors;
}
