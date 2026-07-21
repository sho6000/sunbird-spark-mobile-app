import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('\n📦 Consolidating player assets...\n');

const publicRoot = path.join(__dirname, 'public');

const players = [
  {
    name: 'PDF Player',
    package: '@project-sunbird/sunbird-pdf-player-web-component',
    assetDir: 'pdf-player',
  },
  {
    name: 'Video Player',
    package: '@project-sunbird/sunbird-video-player-web-component',
    assetDir: 'video-player',
  },
  {
    name: 'ePub Player',
    package: '@project-sunbird/sunbird-epub-player-web-component',
    assetDir: 'epub-player',
  },
  {
    name: 'QuML Player',
    package: '@project-sunbird/sunbird-quml-player-web-component-react',
    assetDir: 'quml-player',
  },
];

/**
 * Recursively copy directory contents from src to dest.
 */
function copyDirectory(src, dest) {
  if (!fs.existsSync(src)) {
    throw new Error(
      `Source directory "${src}" does not exist. This may indicate a missing npm package or an incorrect path.`
    );
  }
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

try {
  // Clean only managed player subdirectories (not the entire assets folder)
  console.log('🧹 Cleaning managed player asset directories...');
  for (const player of players) {
    for (const dir of [
      path.join(publicRoot, 'assets', player.assetDir),
      path.join(publicRoot, 'content', 'assets', player.assetDir),
    ]) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  }
  // Clean libs directory (jQuery)
  const libsDir = path.join(publicRoot, 'libs');
  if (fs.existsSync(libsDir)) {
    fs.rmSync(libsDir, { recursive: true, force: true });
  }

  for (const player of players) {
    const packageRoot = path.join(__dirname, 'node_modules', player.package);
    const assetsSource = path.join(packageRoot, 'assets', player.assetDir);
    const assetsDest = path.join(publicRoot, 'assets', player.assetDir);

    console.log(`📂 ${player.name} Source: ${assetsSource}`);
    fs.mkdirSync(assetsDest, { recursive: true });
    console.log(`📦 Copying ${player.name} files to public/assets/${player.assetDir}/...`);
    copyDirectory(assetsSource, assetsDest);

    // Also copy to public/content/assets/ — some player web components
    // resolve internal assets (e.g. viewer.html) at /content/assets/<player>/
    const contentAssetsDest = path.join(publicRoot, 'content', 'assets', player.assetDir);
    fs.mkdirSync(contentAssetsDest, { recursive: true });
    console.log(`📦 Copying ${player.name} files to public/content/assets/${player.assetDir}/...`);
    copyDirectory(assetsSource, contentAssetsDest);
  }

  // Copy shared SVG icons to public/assets/ and public/content/assets/
  // Players resolve icons at both /assets/*.svg and /content/assets/*.svg
  console.log('\n📦 Copying common icons to public/assets/ and public/content/assets/...');
  const iconDests = [
    path.join(publicRoot, 'assets'),
    path.join(publicRoot, 'content', 'assets'),
  ];

  const pdfAssetsSource = path.join(
    __dirname,
    'node_modules/@project-sunbird/sunbird-pdf-player-web-component/assets/pdf-player'
  );
  const pdfIcons = fs.readdirSync(pdfAssetsSource).filter((file) => file.endsWith('.svg'));
  for (const icon of pdfIcons) {
    for (const dest of iconDests) {
      fs.mkdirSync(dest, { recursive: true });
      fs.copyFileSync(path.join(pdfAssetsSource, icon), path.join(dest, icon));
    }
  }

  const qumlAssetsIconsDir = path.join(
    __dirname,
    'node_modules/@project-sunbird/sunbird-quml-player-web-component-react/assets/quml-player/assets'
  );
  if (fs.existsSync(qumlAssetsIconsDir)) {
    const qumlIcons = fs.readdirSync(qumlAssetsIconsDir).filter((file) => file.endsWith('.svg'));
    for (const icon of qumlIcons) {
      for (const dest of iconDests) {
        fs.mkdirSync(dest, { recursive: true });
        fs.copyFileSync(path.join(qumlAssetsIconsDir, icon), path.join(dest, icon));
      }
    }
  }

  // Copy jQuery from node_modules to public/libs/
  const libsDest = path.join(publicRoot, 'libs');
  fs.mkdirSync(libsDest, { recursive: true });
  const jquerySrc = path.join(__dirname, 'node_modules/jquery/dist/jquery.min.js');
  fs.copyFileSync(jquerySrc, path.join(libsDest, 'jquery.min.js'));
  console.log('📦 Copied jQuery to public/libs/jquery.min.js');

  console.log('\n✅ Assets consolidated successfully!');
  for (const player of players) {
    console.log(`📍 ${player.name}: public/assets/${player.assetDir}/`);
  }
  console.log(`📍 Common Icons: public/assets/*.svg`);
  console.log(`📍 jQuery: public/libs/jquery.min.js`);
} catch (error) {
  console.error('❌ Error consolidating assets:', error.message);
  process.exit(1);
}
