const THERMAL_WIDTH_58MM = 164; // Approx 58mm in points
const THERMAL_WIDTH_80MM = 227; // Approx 80mm in points

export const getThermalPrintOptions = (itemCount = 0) => ({
  width: THERMAL_WIDTH_80MM,
  height: Math.max(580, 420 + itemCount * 34),
});
