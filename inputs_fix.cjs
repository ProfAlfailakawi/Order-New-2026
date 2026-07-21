const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'pages', 'CustomerSite.tsx');
let content = fs.readFileSync(target, 'utf8');

// Refine typography in inputs: replace font-extrabold with font-bold or font-medium for standard inputs
content = content.replace(/font-extrabold text-2xl/g, 'font-bold text-xl');
content = content.replace(/font-extrabold text-brand/g, 'font-bold text-brand'); // Usually headings, keep bolder
content = content.replace(/text-4xl sm:text-5xl font-extrabold/g, 'text-4xl sm:text-5xl font-bold'); // soften hero slightly
content = content.replace(/border-2 border-accent\/20/g, 'border-2 border-accent/10 focus:border-accent/40 bg-stone-50/50 hover:bg-stone-50 transition-colors'); 

fs.writeFileSync(target, content);
console.log('Inputs updated.');
