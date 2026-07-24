import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const sourceDir = "work/promptfall/user-run-cycle";
const outputDir = "public/assets/praxi-run-v5";

await mkdir(outputDir, { recursive: true });

async function normalizeSprite(input, output, maxWidth = 405, maxHeight = 405) {
  const trimmed = await sharp(input)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize({
      width: maxWidth,
      height: maxHeight,
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const { width = 1, height = 1 } = await sharp(trimmed).metadata();
  const left = Math.round((512 - width) / 2);
  const top = 482 - height;

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left, top }])
    .png()
    .toFile(output);
}

for (let frame = 0; frame < 7; frame += 1) {
  await normalizeSprite(
    `${sourceDir}/frame-${frame}-alpha.png`,
    `${outputDir}/praxi-run-${frame}.png`,
  );
}

await normalizeSprite(
  "work/promptfall/matched-poses/praxi-idle-alpha.png",
  "public/assets/praxi-idle-v6.png",
  390,
  410,
);

await normalizeSprite(
  "work/promptfall/matched-poses/praxi-jump-alpha.png",
  "public/assets/praxi-jump-v6.png",
  405,
  405,
);
