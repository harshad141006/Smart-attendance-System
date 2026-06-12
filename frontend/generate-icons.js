import fs from 'fs';

const base64Pixel = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const buffer = Buffer.from(base64Pixel, 'base64');

fs.writeFileSync('public/pwa-192x192.png', buffer);
fs.writeFileSync('public/pwa-512x512.png', buffer);
fs.writeFileSync('public/apple-touch-icon.png', buffer);
fs.writeFileSync('public/favicon.ico', buffer);
fs.writeFileSync('public/masked-icon.svg', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#667eea"/></svg>');

console.log('Icons generated successfully.');
