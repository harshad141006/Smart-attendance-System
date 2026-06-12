import fs from 'fs';
import fetch from 'node-fetch';

const imgPath = './public/test_face.jpg';
if (!fs.existsSync(imgPath)) {
  console.error('Place a small JPEG at', imgPath);
  process.exit(1);
}

const b64 = fs.readFileSync(imgPath, { encoding: 'base64' });
(async () => {
  const res = await fetch('http://localhost:5000/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: b64 }),
  });
  console.log('status', res.status);
  console.log(await res.text());
})();
