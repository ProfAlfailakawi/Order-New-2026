const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'pages', 'CustomerSite.tsx');
let content = fs.readFileSync(target, 'utf8');

content = content.replace(/shadow-2xl/g, 'shadow-xl'); 
content = content.replace(/shadow-lg/g, 'shadow-md');  
content = content.replace(/bg-stone-50([^/])/g, 'bg-stone-50/80 backdrop-blur-sm$1'); 
content = content.replace(/border-stone-200/g, 'border-stone-100'); 
content = content.replace(/rounded-\[24px\]/g, 'rounded-3xl'); 
content = content.replace(/rounded-\[32px\]/g, 'rounded-[2rem]');
content = content.replace(/font-black/g, 'font-extrabold'); 

fs.writeFileSync(target, content);
console.log('CustomerSite.tsx modified successfully.');

const paths = [
    path.join(__dirname, 'src', 'pages', 'OrderPage.tsx'),
    path.join(__dirname, 'src', 'pages', 'AdminDashboard.tsx'),
    path.join(__dirname, 'src', 'pages', 'SplitPayment.tsx'),
    path.join(__dirname, 'src', 'components', 'Navigation.tsx')
];

for (const p of paths) {
    if (fs.existsSync(p)) {
        let optContent = fs.readFileSync(p, 'utf8');
        optContent = optContent.replace(/shadow-2xl/g, 'shadow-xl');
        optContent = optContent.replace(/shadow-lg/g, 'shadow-md');
        optContent = optContent.replace(/border-stone-200/g, 'border-stone-100');
        optContent = optContent.replace(/font-black/g, 'font-extrabold');
        optContent = optContent.replace(/bg-stone-50([^/])/g, 'bg-stone-50/80 backdrop-blur-sm$1');
        fs.writeFileSync(p, optContent);
    }
}
console.log('Other files modified successfully.');
