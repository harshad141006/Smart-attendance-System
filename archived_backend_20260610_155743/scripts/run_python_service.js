import { spawn, spawnSync } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const faceModelsDir = path.join(projectRoot, 'python', 'face_models');

function findPythonCmd() {
  const candidates = [];
  if (process.env.PYTHON) candidates.push(process.env.PYTHON);
  if (process.env.PYTHON_PATH) candidates.push(process.env.PYTHON_PATH);
  candidates.push('python', 'py', 'python3');

  for (const cmd of candidates) {
    if (!cmd) continue;
    try {
      const res = spawnSync(cmd, ['--version'], { stdio: 'ignore', shell: false });
      if (res.status === 0) return cmd;
    } catch (e) {
      // ignore
    }
  }
  return null;
}

function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
  p.on('close', (code) => {
    if (code !== 0) {
      console.error(`${cmd} exited with code ${code}`);
      process.exit(code);
    }
  });
  return p;
}

async function main() {
  const isWin = os.platform() === 'win32';
  const background = process.argv.includes('--background');
  const pythonCmd = findPythonCmd();
  if (!pythonCmd) {
    console.error('Python executable not found. Install Python and ensure it is on your PATH, or set PYTHON/PYTHON_PATH env var.');
    process.exit(1);
  }
  console.log('Preparing virtual environment in', faceModelsDir);
  const venvDir = path.join(faceModelsDir, '.venv');
  if (fs.existsSync(venvDir)) {
    console.log('.venv already exists — skipping creation.');
  } else {
    console.log('Creating .venv using', pythonCmd);
    try {
      await new Promise((res, rej) => {
        const p = spawn(pythonCmd, ['-m', 'venv', '.venv'], { cwd: faceModelsDir, stdio: 'inherit', shell: false });
        p.on('close', (code) => code === 0 ? res() : rej(new Error('venv creation failed with code ' + code)));
        p.on('error', (err) => rej(err));
      });
    } catch (err) {
      console.error('Failed to create virtual environment:', err.message || err);
      process.exit(1);
    }
  }

  const pipPath = isWin ? path.join(faceModelsDir, '.venv', 'Scripts', 'pip.exe') : path.join(faceModelsDir, '.venv', 'bin', 'pip');
  console.log('Installing Python requirements...');
  try {
    if (fs.existsSync(pipPath)) {
      await new Promise((res, rej) => {
        const p = spawn(pipPath, ['install', '-r', 'requirements.txt'], { cwd: faceModelsDir, stdio: 'inherit' });
        p.on('close', (code) => code === 0 ? res() : rej(new Error('pip install failed with code ' + code)));
        p.on('error', (err) => rej(err));
      });
    } else {
      // Fall back to using python -m pip inside the chosen python executable
      console.log('pip executable not found in venv; using python -m pip');
      await new Promise((res, rej) => {
        const p = spawn(pythonCmd, ['-m', 'pip', 'install', '-r', 'requirements.txt'], { cwd: faceModelsDir, stdio: 'inherit' });
        p.on('close', (code) => code === 0 ? res() : rej(new Error('pip install failed with code ' + code)));
        p.on('error', (err) => rej(err));
      });
    }
  } catch (err) {
    console.error('Failed to install Python requirements:', err.message || err);
    process.exit(1);
  }

  const pythonPath = isWin ? path.join(faceModelsDir, '.venv', 'Scripts', 'python.exe') : path.join(faceModelsDir, '.venv', 'bin', 'python');
  console.log('Starting FastAPI (uvicorn) on http://127.0.0.1:8000');
  const uvicornArgs = ['-m', 'uvicorn', 'api:app', '--host', '127.0.0.1', '--port', '8000'];
  if (background) {
    // Spawn detached background process
    const proc = spawn(pythonPath, uvicornArgs, {
      cwd: faceModelsDir,
      detached: true,
      stdio: 'ignore',
      shell: false,
    });
    // write pid to file for later management
    try {
      const pidFile = path.join(faceModelsDir, 'python_service.pid');
      fs.writeFileSync(pidFile, String(proc.pid), { encoding: 'utf8' });
      console.log('Python service started detached with PID', proc.pid, 'pid written to', pidFile);
    } catch (err) {
      console.warn('Could not write pid file:', err.message || err);
    }
    proc.unref();
    // Exit the starter without waiting for the child
    process.exit(0);
  } else {
    const proc = spawn(pythonPath, uvicornArgs, { cwd: faceModelsDir, stdio: 'inherit' });
    proc.on('close', (code) => {
      console.log('Python service exited with', code);
      process.exit(code);
    });
  }
}

main().catch((err) => {
  console.error('Error starting python service:', err);
  process.exit(1);
});
