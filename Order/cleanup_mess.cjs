const fs = require('fs');
const path = require('path');
const target = path.join(__dirname, 'src', 'pages', 'CustomerSite.tsx');
let content = fs.readFileSync(target, 'utf8');

content = content.replace(/bg-white border-2 border-accent\/10 focus:border-accent\/40 bg-stone-50\/50/g, 'border-2 border-accent/10 focus:border-accent/40 bg-stone-50/50');
content = content.replace(/fixed bg-white border-2/g, 'fixed border-2');

fs.writeFileSync(target, content);
console.log('Cleanup messy classes.');
