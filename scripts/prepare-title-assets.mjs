import sharp from "sharp";
import path from "node:path";

const sourceDirectory = process.argv[2] ?? ".";

const assets = [
  {
    input: path.join(sourceDirectory, "Main-title.png"),
    output: "public/assets/title-main-v3.png",
  },
  {
    input: path.join(sourceDirectory, "Sub-title-1.png"),
    output: "public/assets/title-sub-1-v3.png",
  },
  {
    input: path.join(sourceDirectory, "Sub-title-2.png"),
    output: "public/assets/title-sub-2-v3.png",
  },
];

for (const asset of assets) {
  await sharp(asset.input)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(asset.output);
}
