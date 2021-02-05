const fs = require('fs');

const IMG_FILE = './test.jpg';
const OUT_FILE = './reverse.jpg';

const base64EncodeFile = (filePath, encoding = 'base64') => {
    const img = fs.readFileSync(filePath, { encoding });
    return img;
};

const base64 = base64EncodeFile(IMG_FILE);

console.log('size', base64.length);
// console.log('content', base64);

const writeImage = (imageData) => {
    fs.writeFileSync(OUT_FILE, imageData, { encoding: 'base64' });
};

writeImage(base64);
