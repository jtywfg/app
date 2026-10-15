// Preserve source files; create transparent, tightly cropped runtime PNGs.
// macOS: node scripts/prepare-formalwear.cjs (uses sips for WebP decoding).
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
const { PNG } = require('pngjs');
const root = path.resolve(__dirname, '../assets/formalwear');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'pinpic-formalwear-'));

function removeBackground(image, matches) {
  const { width, height, data } = image;
  const visited = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0, tail = 0;
  const visit = (index) => {
    if (visited[index]) return;
    visited[index] = 1;
    const offset = index * 4;
    if (data[offset + 3] === 0 || matches(data[offset], data[offset + 1], data[offset + 2])) {
      data[offset + 3] = 0;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x++) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { visit(y * width); visit(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width);
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y < height - 1) visit(index + width);
  }
}

for (const group of ['men', 'women']) {
  const output = path.join(root, 'prepared', group);
  fs.mkdirSync(output, { recursive: true });
  for (const filename of fs.readdirSync(path.join(root, group)).filter((name) => /\.(png|webp)$/.test(name)).sort()) {
    const source = path.join(root, group, filename);
    let decoded = source;
    if (filename.endsWith('.webp')) {
      decoded = path.join(temporary, `${group}-${filename}.png`);
      execFileSync('sips', ['-s', 'format', 'png', source, '--out', decoded], { stdio: 'ignore' });
    }
    const image = PNG.sync.read(fs.readFileSync(decoded));
    if (filename.endsWith('.webp')) {
      const [red, green, blue] = image.data;
      removeBackground(image, (r, g, b) => Math.hypot(r - red, g - green, b - blue) < 65);
    }
    if (group === 'women' && filename === '02.png') {
      // The source has pink/red bands outside the garment and inside the neck.
      removeBackground(image, (r, g, b) => r > 120 && r - g > 30 && r - b > 20);
    }
    if (group === 'men' && filename === '11.png') {
      // Remove only the white frame, retaining the white shirt and collar.
      for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
        if (x < 6 || x >= image.width - 6 || y < 6 || y >= image.height - 6) image.data[(y * image.width + x) * 4 + 3] = 0;
      }
    }
    let left = image.width, top = image.height, right = -1, bottom = -1;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] > 16) {
        left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
      }
    }
    if (right < left) throw new Error(`Empty garment: ${source}`);
    const cropped = new PNG({ width: right - left + 1, height: bottom - top + 1 });
    PNG.bitblt(image, cropped, left, top, cropped.width, cropped.height, 0, 0);
    const destination = path.join(output, filename.replace(/\.webp$/, '.png'));
    fs.writeFileSync(destination, PNG.sync.write(cropped));
    console.log(`${group}/${filename} -> ${cropped.width}×${cropped.height} PNG`);
  }
}
