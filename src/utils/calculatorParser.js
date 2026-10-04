/**
 * Parses a calculator-style expression into a list of items with discounts.
 * Input: "200-10%+150-20+170" or "Bra: 160 + Blouse: 180-10%"
 * Output: [
 *   { name: "Bra", price: 160, discountType: null, discountValue: 0, final: 160 },
 *   { name: "Blouse", price: 180, discountType: "percent", discountValue: 10, final: 162 }
 * ]
 */
export const parseExpression = (input, defaultCategory = '') => {
  if (!input) return [];

  const parts = input.split('+');
  return parts.map(part => {
    part = part.trim();
    if (!part) return null;

    let categoryName = defaultCategory;
    let expressionPart = part;

    if (part.includes(':')) {
      const colonIndex = part.indexOf(':');
      const prefix = part.slice(0, colonIndex).trim();
      const rest = part.slice(colonIndex + 1).trim();
      if (prefix) {
        categoryName = prefix;
      }
      expressionPart = rest;
    }

    if (!expressionPart) return null;

    // Matches: price [- discountValue [%]]
    // Group 1: Price
    // Group 2: Discount operator and value
    // Group 3: Discount value
    // Group 4: Percentage sign
    const match = expressionPart.match(/^(\d+(?:\.\d+)?)(?:(-)(\d+(?:\.\d+)?)(%)?)?$/);

    if (!match) {
      // Partial match handling for live preview
      const partialPriceMatch = expressionPart.match(/^(\d+(?:\.\d+)?)/);
      if (partialPriceMatch) {
        const price = parseFloat(partialPriceMatch[0]);
        return { name: categoryName, price, discountType: null, discountValue: 0, final: price };
      }
      return null;
    }

    const price = parseFloat(match[1]);
    const hasDiscount = !!match[3];
    const discountValue = hasDiscount ? parseFloat(match[3]) : 0;
    const isPercent = !!match[4];

    let final = price;
    let discountType = null;

    if (hasDiscount) {
      if (isPercent) {
        discountType = 'percent';
        final = price - (price * (discountValue / 100));
      } else {
        discountType = 'flat';
        final = Math.max(0, price - discountValue);
      }
    }

    return {
      name: categoryName,
      price,
      discountType,
      discountValue,
      final: Math.round(final * 100) / 100 // Round to 2 decimal places
    };
  }).filter(item => item !== null);
};

/**
 * Calculates totals for the parsed items.
 */
export const calculateExpressionTotals = (parsedItems) => {
  return parsedItems.reduce((acc, item) => {
    const discountAmount = item.discountType === 'percent' 
      ? (item.price * item.discountValue / 100) 
      : item.discountValue;
    
    return {
      totalMrp: acc.totalMrp + item.price,
      totalDiscount: acc.totalDiscount + discountAmount,
      totalFinal: acc.totalFinal + item.final
    };
  }, { totalMrp: 0, totalDiscount: 0, totalFinal: 0 });
};
