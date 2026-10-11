import { FileSystemUploadType, getInfoAsync, uploadAsync } from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import * as attachments from '@/api/attachments';

/** § Media Storage: JPEG/PNG/WebP, at most 5 MB. Covers are re-encoded as JPEG here. */
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_EDGE = 1600;

/**
 * Let the owner pick a photo, cropped square (covers show square in the
 * app and on the public site), then shrink and re-encode it as JPEG so a
 * phone camera's 8–12 MB original fits the 5 MB limit. Null if cancelled.
 */
export async function pickCover(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];

  const ctx = ImageManipulator.manipulate(asset.uri);
  if (Math.max(asset.width, asset.height) > MAX_EDGE) {
    ctx.resize(asset.width >= asset.height ? { width: MAX_EDGE } : { height: MAX_EDGE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  return saved.uri;
}

/**
 * Upload a local JPEG as a product cover, per § Media Storage: reserve, PUT
 * the bytes straight to Spaces with the signed headers, then confirm (the
 * server checks the object against the bucket). Returns the attachment id
 * to set as `coverImageAttachmentId`. Needs a connection.
 */
export async function uploadCover(uri: string): Promise<string> {
  const info = await getInfoAsync(uri);
  if (!info.exists || !info.size) throw new Error('The photo could not be read');
  if (info.size > MAX_BYTES) throw new Error('The photo is larger than 5 MB');

  const reservation = await attachments.reserve({
    directory: 'productCovers',
    name: 'cover.jpg',
    extension: 'jpg',
    contentType: 'image/jpeg',
    sizeBytes: info.size,
  });

  // Content-Length is computed by the HTTP stack from the body itself (the
  // same file whose size we declared); setting it by hand as well can make
  // the platform reject or double the header.
  const headers = Object.fromEntries(
    Object.entries(reservation.requiredHeaders).filter(([k]) => k.toLowerCase() !== 'content-length'),
  );
  let put;
  try {
    put = await uploadAsync(reservation.uploadUrl, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      headers,
    });
  } catch {
    // The PUT goes straight to Spaces on the public internet, not to our API,
    // so it can fail where API calls still work.
    throw new Error("Couldn't upload the photo. Check the internet connection and try again.");
  }
  if (put.status < 200 || put.status >= 300) throw new Error(`Upload failed (HTTP ${put.status})`);

  await attachments.confirm(reservation.id);
  return reservation.id;
}
