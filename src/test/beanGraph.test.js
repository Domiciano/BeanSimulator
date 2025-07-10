import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildBeanGraph } from '../model/buildBeanGraph.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getAllTxtFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTxtFiles(filePath));
    } else if (file.endsWith('.txt')) {
      results.push(filePath);
    }
  });
  return results;
}

const testDir = __dirname;
const files = getAllTxtFiles(testDir);

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const model = buildBeanGraph(code);
  console.log(`\n==== ${path.relative(testDir, file)} ====`);
  console.log(JSON.stringify(model, null, 2));
}); 