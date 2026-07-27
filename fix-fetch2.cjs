const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');
files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(/fetchWithRetry\(\s*["']\/api\//g, 'fetchWithRetry((import.meta.env.VITE_API_BASE_URL || "") + "/api/');
  newContent = newContent.replace(/fetchWithRetry\(\s*`\/api\//g, 'fetchWithRetry((import.meta.env.VITE_API_BASE_URL || "") + `/api/');
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated', file);
  }
});
