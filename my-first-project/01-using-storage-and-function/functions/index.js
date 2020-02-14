const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const spawn = require("child-process-promise").spawn;
const path = require("path");
const os = require("os");
const fs = require("fs");
// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//
exports.onFileUploaded = functions.storage.object().onFinalize(async object => {
  // [END generateThumbnailTrigger]
  // [START eventAttributes]
  const fileBucket = object.bucket; // The Storage bucket that contains the file.
  const filePath = object.name; // File path in the bucket.
  const contentType = object.contentType; // File content type.

  // [END eventAttributes]
  const THUMB_MAX_HEIGHT = 100;
  const THUMB_MAX_WIDTH = 100;
  // Thumbnail prefix added to file names.
  const THUMB_PREFIX = " ";

  // [START stopConditions]
  // Exit if this is triggered on a file that is not an image.
  if (!contentType.startsWith("image/")) {
    return console.log("This is not an image.");
  }

  // Get the file name.
  const fileName = path.basename(filePath);

  // Exit if the image is already a thumbnail.
  if (fileName.startsWith(THUMB_PREFIX)) {
    return console.log("Already a Thumbnail.");
  }

  // [START thumbnailGeneration]
  // Download file from bucket.
  const bucket = admin.storage().bucket(fileBucket);
  const thumbFileName = `${THUMB_PREFIX}${fileName}`;
  const thumbFilePath = path.join(path.dirname(filePath), thumbFileName);
  const tempLocalThumbFile = path.join(os.tmpdir(), thumbFilePath);
  const file = bucket.file(filePath);

  // Will put the thumb here:
  const uploadFile = bucket.file(thumbFilePath);

  const options = {
    resumable: false,
    metadata: {
      contentType: "image/png"
    }
  };

  const uploadStream = uploadFile.createWriteStream(options);
  // const tempFilePath = path.join(os.tmpdir(), fileName);

  // console.log("Image downloaded locally to", tempFilePath);
  await spawn(
    "convert",
    [
      filePath,
      "-crop",
      `${THUMB_MAX_WIDTH}x${THUMB_MAX_HEIGHT}>`,
      tempLocalThumbFile
    ],
    { capture: ["stdout", "stderr"] }
  );
  console.log("Thumbnail created at", tempLocalThumbFile);

  bucket
    .file(tempLocalThumbFile)
    .createReadStream()
    .pipe(uploadStream);

  const result = new Promise((resolve, reject) => {
    uploadStream
      .on("finish", () => {
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${
          bucket.name
        }/o/${encodeURI(thumbFileName).replace("/", "%2F")}`;
        resolve(publicUrl);
      })
      .on("error", err => {
        reject(err);
      });
  });

  console.log("Thumbnail created at", tempLocalThumbFile);

  // Unlink tempLocalThumbFile
  fs.unlinkSync(tempLocalThumbFile);

  const config = {
    action: "read",
    expires: "03-01-2500"
  };
  const results = await Promise.all([
    outFile.getSignedUrl(config),
    file.getSignedUrl(config)
  ]);
  console.log("Got Signed URLs.");

  return results;
  // [END thumbnailGeneration]
});
