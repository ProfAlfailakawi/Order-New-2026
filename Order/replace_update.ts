import fs from 'fs';
let content = fs.readFileSync('server.ts', 'utf8');

// Replace standard variables
content = content.replace(/await updateDoc\(docRef,\s*([^)]+)\)/g, 'await updateAppData($1)');

// Replace inline declarations
content = content.replace(/await updateDoc\(doc\(db,\s*"appData",\s*"shared_company_data"\),\s*([^)]+)\)/g, 'await updateAppData($1)');

// Replace getDoc
content = content.replace(/await getDoc\(docRef\)/g, 'await getAppDataRef()');
content = content.replace(/await getDoc\(doc\(db,\s*"appData",\s*"shared_company_data"\)\)/g, 'await getAppDataRef()');

fs.writeFileSync('server.ts', content);
