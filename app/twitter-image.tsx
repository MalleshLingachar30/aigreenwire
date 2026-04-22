import {
  HOME_SHARE_IMAGE_ALT,
  HOME_SHARE_IMAGE_CONTENT_TYPE,
  HOME_SHARE_IMAGE_SIZE,
  renderHomeShareImage,
} from "@/lib/home-share-image";

export const alt = HOME_SHARE_IMAGE_ALT;
export const size = HOME_SHARE_IMAGE_SIZE;
export const contentType = HOME_SHARE_IMAGE_CONTENT_TYPE;

export default function Image() {
  return renderHomeShareImage();
}
