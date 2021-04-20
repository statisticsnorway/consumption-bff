const fs = require('fs');

export const getFileContent = (filePath: string): string => {
    return fs.readFileSync(filePath);
    // return fileBuf.toString("base64");
};

export const base64EncodeFile = (filePath: string): string => {
    return fs.readFileSync(filePath, 'base64');
    // return fileBuf.toString("base64");
};
