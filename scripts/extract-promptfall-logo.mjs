import sharp from "sharp";

const input = "public/assets/promptfall-logo.png";
const output = "public/assets/promptfall-logo-transparent-v2.png";

const original = await sharp(input).ensureAlpha().raw().toBuffer({
  resolveWithObject: true,
});
const blurred = await sharp(input).blur(38).ensureAlpha().raw().toBuffer();
const { data, info } = original;
const { width, height, channels } = info;

for (let index = 0; index < width * height; index += 1) {
  const offset = index * channels;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const localDifference = Math.max(
    Math.abs(r - blurred[offset]),
    Math.abs(g - blurred[offset + 1]),
    Math.abs(b - blurred[offset + 2]),
  );
  data[offset + 3] = Math.max(
    0,
    Math.min(255, Math.round((localDifference - 24) * 12)),
  );
}

await sharp(data, { raw: info })
  .extract({ left: 70, top: 245, width: width - 140, height: 430 })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(output);
