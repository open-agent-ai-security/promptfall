import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const board = "work/promptfall/rig/praxi-rig-board-alpha.png";
const outDir = "public/assets/praxi-rig";

const regions = {
  tail: { left: 38, top: 224, width: 430, height: 266 },
  core: { left: 575, top: 28, width: 286, height: 545 },
  armNear: { left: 942, top: 235, width: 220, height: 235 },
  armFar: { left: 1204, top: 326, width: 209, height: 226 },
  legsBent: { left: 236, top: 580, width: 452, height: 399 },
  legsStride: { left: 844, top: 559, width: 456, height: 421 },
};

const crop = async (region, width) =>
  sharp(board)
    .extract(region)
    .resize({ width, fit: "inside" })
    .png()
    .toBuffer();

const transform = async (buffer, {
  angle = 0,
  flip = false,
  width,
} = {}) => {
  let image = sharp(buffer);
  if (width) image = image.resize({ width, fit: "inside" });
  if (flip) image = image.flop();
  if (angle) {
    image = image.rotate(angle, {
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    });
  }
  return image.png().toBuffer();
};

await mkdir(outDir, { recursive: true });

const parts = {
  tail: await crop(regions.tail, 250),
  core: await crop(regions.core, 172),
  armNear: await crop(regions.armNear, 122),
  armFar: await crop(regions.armFar, 108),
  legsBent: await crop(regions.legsBent, 250),
  legsStride: await crop(regions.legsStride, 264),
};

const frames = [
  { legs: "stride", bob: 0, near: -7, far: 7, phase: "contact-a" },
  { legs: "bent", bob: 12, near: 8, far: -8, phase: "down-a" },
  { legs: "bent", bob: 3, near: 25, far: -25, phase: "passing-a" },
  { legs: "bent", bob: -10, near: 42, far: -42, phase: "up" },
  { legs: "bent", bob: 3, near: 24, far: -24, swap: true, phase: "passing-b" },
  { legs: "bent", bob: 12, near: 8, far: -8, swap: true, phase: "down-b" },
  { legs: "stride", bob: 0, near: -7, far: 7, swap: true, phase: "contact-b" },
];

for (let index = 0; index < frames.length; index += 1) {
  const frame = frames[index];
  const baseY = frame.bob;
  const legsSource =
    frame.legs === "stride" ? parts.legsStride : parts.legsBent;
  const legs = await transform(legsSource, {
    angle: frame.legs === "bent" ? (index === 3 ? -4 : 0) : 0,
  });

  const forwardSource = frame.swap ? parts.armFar : parts.armNear;
  const rearSource = frame.swap ? parts.armNear : parts.armFar;
  const forward = await transform(forwardSource, {
    flip: true,
    angle: frame.near,
    width: frame.swap ? 122 : 128,
  });
  const rear = await transform(rearSource, {
    angle: frame.far,
    width: frame.swap ? 104 : 110,
  });

  const layers = [
    { input: parts.tail, left: 38, top: 188 + baseY },
    { input: rear, left: 139, top: 174 + baseY },
    { input: forward, left: 282, top: 174 + baseY },
    {
      input: legs,
      left: frame.legs === "stride" ? 200 : 137,
      top: (frame.legs === "stride" ? 263 : 270) + baseY,
    },
    { input: parts.core, left: 202, top: 46 + baseY },
  ];

  await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(layers)
    .png()
    .toFile(`${outDir}/praxi-run-${index}-${frame.phase}-v4.png`);
}
