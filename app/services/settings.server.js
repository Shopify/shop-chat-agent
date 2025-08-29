import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const ITERATIONS = 210000;

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY is not set in the environment variables.');
}

function encrypt(text) {
  if (!text) {
    return null;
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha512');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([salt, iv, tag, encrypted]).toString('hex');
}

function decrypt(encryptedText) {
  if (!encryptedText) {
    return null;
  }
  try {
    const encryptedBuffer = Buffer.from(encryptedText, 'hex');
    const salt = encryptedBuffer.slice(0, SALT_LENGTH);
    const iv = encryptedBuffer.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const tag = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const encrypted = encryptedBuffer.slice(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
    const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, ITERATIONS, KEY_LENGTH, 'sha512');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

export async function getShopSettings(shop) {
  const settings = await prisma.shopSettings.findUnique({ where: { shop } });
  if (!settings) {
    return null;
  }
  return {
    ...settings,
    claudeApiKey: decrypt(settings.claudeApiKey),
    openaiApiKey: decrypt(settings.openaiApiKey),
    geminiApiKey: decrypt(settings.geminiApiKey),
    groqApiKey: decrypt(settings.groqApiKey),
    openrouterApiKey: decrypt(settings.openrouterApiKey),
  };
}

export async function updateShopSettings(shop, data) {
  const encryptedData = {
    ...data,
    claudeApiKey: data.claudeApiKey ? encrypt(data.claudeApiKey) : undefined,
    openaiApiKey: data.openaiApiKey ? encrypt(data.openaiApiKey) : undefined,
    geminiApiKey: data.geminiApiKey ? encrypt(data.geminiApiKey) : undefined,
    groqApiKey: data.groqApiKey ? encrypt(data.groqApiKey) : undefined,
    openrouterApiKey: data.openrouterApiKey ? encrypt(data.openrouterApiKey) : undefined,
  };

  return prisma.shopSettings.upsert({
    where: { shop },
    update: encryptedData,
    create: { shop, ...encryptedData },
  });
}
