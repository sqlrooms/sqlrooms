import fs from 'fs';
import jsonwebtoken from 'jsonwebtoken';
import {dirname} from 'path';
import {fileURLToPath} from 'url';
import {v4 as uuidv4} from 'uuid';
const {sign, verify} = jsonwebtoken;
const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_DIR = `${__dirname}/../.jwt-keys`;
const privateKey = fs.readFileSync(`${KEYS_DIR}/rsa-private-key.pem`);
const publicKey = fs.readFileSync(`${KEYS_DIR}/rsa-public-key.pem`);

const tokenId = uuidv4();
// const token = sign({id: tokenId}, privateKey, {algorithm: 'RS256'});
const token = sign({id: tokenId}, 'shhhhh');
console.log(token);

const decoded = verify(token, 'shhhhh');
// const decoded = verify(token, publicKey,  {algorithms: ['RS256']});
console.log('Decoded:', decoded);
