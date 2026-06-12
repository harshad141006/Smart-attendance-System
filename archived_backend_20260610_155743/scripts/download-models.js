import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
}

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

const filesToDownload = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const downloadFile = (fileName) => {
  return new Promise((resolve, reject) => {
    const filePath = path.join(MODELS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      console.log(`Already exists: ${fileName}`);
      return resolve();
    }
    
    console.log(`Downloading: ${fileName}...`);
    const file = fs.createWriteStream(filePath);
    
    https.get(BASE_URL + fileName, (response) => {
      if (response.statusCode !== 200) {
        fs.unlinkSync(filePath);
        return reject(new Error(`Failed to download ${fileName}: ${response.statusCode}`));
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Saved: ${fileName}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(filePath);
      reject(err);
    });
  });
};

const run = async () => {
  for (const file of filesToDownload) {
    try {
      await downloadFile(file);
    } catch (e) {
      console.error(e);
    }
  }
  console.log('All models downloaded successfully!');
};

run();
