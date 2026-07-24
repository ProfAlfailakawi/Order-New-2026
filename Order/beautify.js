const fs = require('fs');
const path = require('path');

const target = path.join(__dirname, 'src', 'pages', 'CustomerSite.tsx');
let content = fs.readFileSync(target, 'utf8');

// Global changes geared towards an elegant, educational app aesthetic:
content = content.replace(/shadow-2xl/g, 'shadow-xl'); // soften extreme shadows
content = content.replace(/shadow-lg/g, 'shadow-md');  // soften heavy shadows
content = content.replace(/bg-stone-50/g, 'bg-stone-50/80 backdrop-blur-sm'); // give a translucent feel to stone-50 usually used in headers
content = content.replace(/border-stone-200/g, 'border-stone-100'); // softer borders globally
content = content.replace(/rounded-\[24px\]/g, 'rounded-3xl'); // consistency with standard tailwind tokens
content = content.replace(/rounded-\[32px\]/g, 'rounded-[2rem]');
content = content.replace(/font-black/g, 'font-extrabold'); // soften text weight slightly for elegance

fs.writeFileSync(target, content);
console.log('CustomerSite.tsx modified successfully.');

const orderPage = path.join(__dirname, 'src', 'pages', 'OrderPage.tsx');
if (fs.existsSync(orderPage)) {
    let optContent = fs.readFileSync(orderPage, 'utf8');
    optContent = optContent.replace(/shadow-2xl/g, 'shadow-xl');
    optContent = optContent.replace(/shadow-lg/g, 'shadow-md');
    optContent = optContent.replace(/border-stone-200/g, 'border-stone-100');
    optContent = optContent.replace(/font-black/g, 'font-extrabold');
    fs.writeFileSync(orderPage, optContent);
}

const adminPage = path.join(__dirname, 'src', 'pages', 'AdminDashboard.tsx');
if (fs.existsSync(adminPage)) {
    let aptContent = fs.readFileSync(adminPage, 'utf8');
    aptContent = aptContent.replace(/shadow-2xl/g, 'shadow-xl');
    aptContent = aptContent.replace(/shadow-lg/g, 'shadow-md');
    aptContent = aptContent.replace(/border-stone-200/g, 'border-stone-100');
    aptContent = aptContent.replace(/font-black/g, 'font-extrabold');
    fs.writeFileSync(adminPage, aptContent);
}
