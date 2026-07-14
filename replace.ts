import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');
content = content.replace(/getDoc\(doc\(db, "appData", "shared_company_data"\)\)/g, 'getAppDataRef()');
fs.writeFileSync('server.ts', content);
