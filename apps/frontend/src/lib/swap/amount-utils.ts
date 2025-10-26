export function clampAmountDecimals(value: string, decimals?: number): string {
  if (!value || decimals === undefined || decimals < 0) {
    return value;
  }

  // Skip scientific notation or values without decimals
  if (!value.includes('.') || /e/i.test(value)) {
    return value;
  }

  const isNegative = value.startsWith('-');
  const unsignedValue = isNegative ? value.slice(1) : value;
  const [integerPart = '', fractionalPart = ''] = unsignedValue.split('.');

  if (fractionalPart.length <= decimals) {
    return value;
  }

  if (decimals === 0) {
    const normalizedInteger = integerPart === '' ? '0' : integerPart;
    return `${isNegative ? '-' : ''}${normalizedInteger}`;
  }

  const truncatedFraction = fractionalPart.slice(0, decimals);
  const normalizedInteger = integerPart === '' ? '0' : integerPart;
  const clamped = `${normalizedInteger}.${truncatedFraction}`;

  return `${isNegative ? '-' : ''}${clamped}`;
}
