import * as fs from 'fs';
import * as path from 'path';

const sourceDir = './github-sync';
const targetDir = './';
const excludeFiles = ['firebase-applet-config.json', '.git', 'github-sync', 'sync.ts', 'node_modules'];

function copyRecursiveSync(src: string, dest: string) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats && stats.isDirectory();

  if (isDirectory) {
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest);
    }
    fs.readdirSync(src).forEach((childItemName) => {
      if (excludeFiles.includes(childItemName)) return;
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    // Only copy if it exists and is a file
    if (exists && stats && stats.isFile()) {
       if (excludeFiles.includes(path.basename(src))) return;
       fs.copyFileSync(src, dest);
       console.log(`Copied: ${src} -> ${dest}`);
    }
  }
}

console.log('Starting sync...');
copyRecursiveSync(sourceDir, targetDir);
console.log('Sync complete!');
