const fs = require('fs');
const path = 'c:/Users/arnab/Task/LIBERTY/assets/logo.png';
const base64 = fs.readFileSync(path, 'base64');
const content = `export const logoBase64 = "data:image/png;base64,${base64}";`;
fs.writeFileSync('c:/Users/arnab/Task/LIBERTY/src/utils/logoBase64.js', content);
