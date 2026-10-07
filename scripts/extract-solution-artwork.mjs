// Пересобирает иллюстрации карточек «Our solutions» (public/media/solution-*.webp)
// из картинки, извлечённой из PDF макета:
//   node scripts/extract-solution-artwork.mjs <путь к image-002.jpg из PDF>
// Мягкая альфа-кромка проходит по пустому фону, а не по растениям, —
// так в кадр не попадает текст, впечатанный в PDF рядом с картинкой.
import sharp from "sharp";

const source = process.argv[2];
if (!source) throw new Error("Укажите путь к image-002.jpg, извлечённому из PDF");
const pieces = [
  { name: "moss", left: 460, top: 430, width: 353, height: 450 },
  { name: "soil", left: 1260, top: 410, width: 351, height: 450 },
];
for (const { name, ...region } of pieces) {
  const { width, height } = region;
  const alpha = Buffer.alloc(width * height * 4, 255);
  for (let y = 0; y < height; y++) {
    const inset = name === "moss" ? 29 : y > 300 ? 42 : 16;
    for (let x = 0; x < width; x++) {
      const edge = Math.min((x - inset) / 14, y / 12, (height - 4 - y) / 12);
      alpha[(y * width + x) * 4 + 3] = Math.round(255 * Math.max(0, Math.min(1, edge)));
    }
  }
  await sharp(source).extract(region).composite([
    { input: alpha, raw: { width, height, channels: 4 }, blend: "dest-in" },
  ]).webp({ lossless: true }).toFile(`public/media/solution-${name}.webp`);
}
