const fs = require('fs');
const path = require('path');

const paths = [
    path.join(__dirname, 'src', 'pages', 'AdminDashboard.tsx'),
    path.join(__dirname, 'src', 'pages', 'OrderPage.tsx'),
    path.join(__dirname, 'src', 'pages', 'SplitPayment.tsx')
];

for (const p of paths) {
    if (fs.existsSync(p)) {
        let optContent = fs.readFileSync(p, 'utf8');
        // Admin dashboard should mostly have solid backgrounds
        optContent = optContent.replace(/bg-stone-50\/80 backdrop-blur-sm/g, 'bg-stone-50');
        fs.writeFileSync(p, optContent);
    }
}
console.log('Fixed blurry solid containers.');
