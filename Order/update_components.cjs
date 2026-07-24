const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'pages', 'CustomerSite.tsx');
let content = fs.readFileSync(target, 'utf8');

// Upgrade sticking navs to be blurred
content = content.replace(/sticky bottom-0 bg-white pb-4/g, 'sticky bottom-0 bg-white/90 backdrop-blur-xl pb-4');
content = content.replace(/bg-white border text-stone-600/g, 'bg-white/80 backdrop-blur-md border text-stone-600');
content = content.replace(/fixed px-4 pb-6 sm:px-6/g, 'flex justify-center fixed px-4 pb-6 sm:px-6');

fs.writeFileSync(target, content);
console.log('CustomerSite tweaks updated.');
