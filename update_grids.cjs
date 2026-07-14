const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'pages', 'CustomerSite.tsx');
let content = fs.readFileSync(target, 'utf8');

// Update grids to be more responsive on desktop based on context
content = content.replace(/<div className="grid grid-cols-1 gap-4">/g, '<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">');
content = content.replace(/grid-cols-2 gap-3/g, 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4'); // for smaller items

fs.writeFileSync(target, content);
console.log('Grid logic updated.');
