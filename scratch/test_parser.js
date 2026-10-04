const { parseExpression, calculateExpressionTotals } = require('./src/utils/calculatorParser');

const testCases = [
  "200",
  "200-10%",
  "150-20",
  "200-10%+150-20+170",
  "100.5-5%",
  "100-10",
  "100-",
  "100+",
  "",
  "invalid",
  "200-10%+100-"
];

testCases.forEach(input => {
  const result = parseExpression(input);
  const totals = calculateExpressionTotals(result);
  console.log(`Input: "${input}"`);
  console.log(`Result: ${JSON.stringify(result, null, 2)}`);
  console.log(`Totals: ${JSON.stringify(totals, null, 2)}`);
  console.log('-------------------');
});
