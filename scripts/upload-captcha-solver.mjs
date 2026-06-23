// One-off uploader: pushes the captcha-solver zip to Cloudflare R2.
// Reads R2 creds from .env (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY /
// S3_ENDPOINT / S3_BUCKET). Usage: node scripts/upload-captcha-solver.mjs <zipPath> <key>
import fs from "node:fs";
import "dotenv/config";
import { S3Client } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const zipPath = process.argv[2];
const key = process.argv[3];
if (!zipPath || !key) {
  console.error("usage: node upload-captcha-solver.mjs <zipPath> <key>");
  process.exit(1);
}

const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_ENDPOINT, S3_BUCKET } = process.env;
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !S3_ENDPOINT || !S3_BUCKET) {
  console.error("Missing R2 env vars (AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY/S3_ENDPOINT/S3_BUCKET)");
  process.exit(1);
}

const client = new S3Client({
  region: "auto",
  endpoint: S3_ENDPOINT,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

const total = fs.statSync(zipPath).size;
console.log(`Uploading ${zipPath} (${(total / 1024 / 1024).toFixed(0)} MB) -> ${S3_BUCKET}/${key}`);

const upload = new Upload({
  client,
  params: {
    Bucket: S3_BUCKET,
    Key: key,
    Body: fs.createReadStream(zipPath),
    ContentType: "application/zip",
  },
  queueSize: 4,
  partSize: 16 * 1024 * 1024, // 16 MB parts
});

let lastPct = -1;
upload.on("httpUploadProgress", (p) => {
  if (p.loaded) {
    const pct = Math.floor((p.loaded / total) * 100);
    if (pct !== lastPct && pct % 5 === 0) {
      console.log(`  ${pct}%`);
      lastPct = pct;
    }
  }
});

try {
  const res = await upload.done();
  console.log("DONE");
  console.log("ETag:", res.ETag);
  console.log("Location key:", key);
} catch (err) {
  console.error("UPLOAD_FAILED:", err?.message || err);
  process.exit(1);
}
