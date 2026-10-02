const sharp = require('sharp');

/**
 * Convert ANY image into a square WhatsApp profile photo with NO cropping.
 *
 * The whole photo is fitted inside the square ("contain") and the remaining
 * area is filled with a blurred + darkened copy of the same photo —
 * the classic "full DP" look.
 *
 * @param {Buffer} inputBuffer - the original image (any size / format)
 * @param {number} size - output square size in px (WhatsApp uses 640)
 * @returns {Promise<Buffer>} JPEG buffer, size x size
 */
async function makeFullSizeDp(inputBuffer, size = 640) {
  // Background: same photo stretched to cover the square, heavily blurred, darkened
  const background = await sharp(inputBuffer)
    .resize(size, size, { fit: 'cover' })
    .blur(Math.max(20, Math.round(size / 14)))
    .modulate({ brightness: 0.65 })
    .toBuffer();

  // Foreground: the ENTIRE photo, fitted inside the square — nothing cut off.
  // (PNG keeps the letterbox area transparent so the blurred background shows through.)
  const foreground = await sharp(inputBuffer)
    .resize(size, size, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp(background)
    .composite([{ input: foreground, gravity: 'center' }])
    .jpeg({ quality: 92 })
    .toBuffer();
}

/**
 * Read an image's real pixel dimensions (used so Baileys uploads it
 * at its original size instead of cropping/resizing to 640x640).
 */
async function getImageDimensions(inputBuffer) {
  const meta = await sharp(inputBuffer).metadata();
  if (!meta.width || !meta.height) throw new Error('Could not read image size');
  return { width: meta.width, height: meta.height };
}

module.exports = { makeFullSizeDp, getImageDimensions };
