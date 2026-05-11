import { renderHomeShareImage } from "@/lib/home-share-image";

export async function GET() {
  return renderHomeShareImage();
}
