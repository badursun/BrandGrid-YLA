#!/usr/bin/env node

/**
 * YouTube Progress Bar - Automatic Setup Script
 * Installs all dependencies and configures the application
 */

const { exec, spawn } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');

const isWindows = os.platform() === 'win32';
const isMac = os.platform() === 'darwin';
const isLinux = os.platform() === 'linux';

console.log('================================================');
console.log('   YouTube Live Awards System - Setup');
console.log('================================================');
console.log(`Platform: ${os.platform()}`);
console.log(`Node Version: ${process.version}`);
console.log('');

// Check Node.js version
const nodeVersion = parseInt(process.version.split('.')[0].substring(1));
if (nodeVersion < 14) {
    console.error('❌ Node.js 14 or higher is required!');
    console.log('Please download from: https://nodejs.org/');
    process.exit(1);
}

// Function to run command
function runCommand(command, description) {
    return new Promise((resolve, reject) => {
        console.log(`📦 ${description}...`);

        const child = exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`❌ Error: ${error.message}`);
                reject(error);
                return;
            }
            if (stderr && !stderr.includes('WARN')) {
                console.error(`⚠️  Warning: ${stderr}`);
            }
            console.log(`✅ ${description} completed!`);
            resolve(stdout);
        });
    });
}

// Function to check if command exists
function commandExists(command) {
    return new Promise((resolve) => {
        const checkCommand = isWindows ? `where ${command}` : `which ${command}`;
        exec(checkCommand, (error) => {
            resolve(!error);
        });
    });
}

async function setupProject() {
    try {
        // Step 1: Install Node dependencies
        console.log('\n1. Installing Node.js dependencies...');
        console.log('----------------------------------------');

        // Root dependencies (including Electron)
        await runCommand('npm install', 'Installing application dependencies');

        // Server dependencies
        process.chdir(path.join(__dirname, 'server'));
        await runCommand('npm install', 'Installing server dependencies');

        // Return to root
        process.chdir(__dirname);

        // Step 2: Check Python
        console.log('\n2. Checking Python installation...');
        console.log('----------------------------------------');

        const hasPython3 = await commandExists('python3');
        const hasPython = await commandExists('python');

        let pythonCommand = null;

        if (hasPython3) {
            pythonCommand = 'python3';
        } else if (hasPython) {
            // Check if it's Python 3
            try {
                const version = await new Promise((resolve, reject) => {
                    exec('python --version', (error, stdout, stderr) => {
                        if (error) reject(error);
                        resolve(stdout || stderr);
                    });
                });

                if (version.includes('Python 3')) {
                    pythonCommand = 'python';
                }
            } catch (e) {}
        }

        if (!pythonCommand) {
            console.error('❌ Python 3 is not installed!');
            console.log('\nPlease install Python 3:');
            if (isWindows) {
                console.log('Download from: https://www.python.org/downloads/');
                console.log('IMPORTANT: Check "Add Python to PATH" during installation!');
            } else if (isMac) {
                console.log('Run: brew install python3');
                console.log('Or download from: https://www.python.org/downloads/');
            } else {
                console.log('Run: sudo apt-get install python3 python3-pip');
            }
            process.exit(1);
        }

        console.log(`✅ Python found: ${pythonCommand}`);

        // Step 3: Install Python dependencies
        console.log('\n3. Installing Python dependencies...');
        console.log('----------------------------------------');

        const pipCommand = pythonCommand === 'python3' ? 'pip3' : 'pip';

        // Check if pip exists
        const hasPip = await commandExists(pipCommand);
        if (!hasPip) {
            console.error(`❌ ${pipCommand} is not installed!`);
            if (isWindows) {
                console.log(`Try: ${pythonCommand} -m ensurepip`);
            } else {
                console.log(`Try: sudo apt-get install python3-pip`);
            }
            process.exit(1);
        }

        // Install Python packages
        await runCommand(
            `${pipCommand} install -r python/requirements.txt`,
            'Installing Python packages (pytchat, requests)'
        );

        // Step 4: Create necessary directories
        console.log('\n4. Creating necessary directories...');
        console.log('----------------------------------------');

        const dirs = [
            'logs',
            'assets/winner-gifs'
        ];

        for (const dir of dirs) {
            const fullPath = path.join(__dirname, dir);
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                console.log(`✅ Created: ${dir}/`);
            } else {
                console.log(`✓ Exists: ${dir}/`);
            }
        }

        // Step 5: Create default config if not exists
        console.log('\n5. Checking configuration...');
        console.log('----------------------------------------');

        const configPath = path.join(__dirname, 'config.json');
        if (!fs.existsSync(configPath)) {
            const defaultConfig = {
                port: 3001,
                pythonCommand: pythonCommand,
                defaultPrize: "100 TL",
                defaultInterval: 100
            };

            fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
            console.log('✅ Created config.json with default settings');
        } else {
            console.log('✓ Config file exists');
        }

        console.log('\n================================================');
        console.log('✅ SETUP COMPLETED SUCCESSFULLY!');
        console.log('================================================');
        console.log('\nTo start the application:');

        if (isWindows) {
            console.log('  Double-click: START.bat');
            console.log('  Or run: npm run start-electron');
        } else {
            console.log('  Double-click: START.command (macOS)');
            console.log('  Or run: ./START.sh');
            console.log('  Or run: npm run start-electron');
        }

        console.log('\nThe Electron app will open automatically with:');
        console.log('  - Control Panel window');
        console.log('  - Progress Display window');
        console.log('');

    } catch (error) {
        console.error('\n❌ Setup failed:', error.message);
        console.log('\nPlease check the error above and try again.');
        process.exit(1);
    }
}

// Run setup
setupProject();