const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Find ShardedAppDataKey definition
const match = code.match(/type ShardedAppDataKey = (.*?);/);
if (match) {
    console.log("Found:", match[1]);
} else {
    console.log("Not found ShardedAppDataKey");
}
