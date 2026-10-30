import { auth } from "../firebase";
import { checkout } from "./api";
export function resizeBase64Image(
  base64Str: string,
  maxDim: number = 800,
  quality: number = 0.8,
): Promise<string> {
  return new Promise((resolve) => {
    if (!base64Str || !base64Str.startsWith("data:")) {
      resolve(base64Str);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(base64Str);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", quality);
      resolve(compressed);
    };

    img.onerror = () => {
      resolve(base64Str);
    };

    img.src = base64Str;
  });
}

export async function tryOnDress(
  _person: string,
  _garment: string,
): Promise<string> {
  throw new Error(
    "Choose an eligible Shop product and use its paid try-on flow.",
  );
}
export async function processSketch(
  sketch: string,
  _type: string,
  userPhoto?: string | null,
  instructions?: string,
): Promise<string> {
  if (userPhoto)
    throw new Error(
      "Rendering a personal photo requires the approved Shop try-on flow. Remove the model photo to render this sketch.",
    );
  if (!auth.currentUser)
    throw new Error(
      "Please log in before paying for a render. Download your sketch to keep a copy.",
    );
  sessionStorage.setItem(
    "aura-classic-render:" + auth.currentUser.uid,
    JSON.stringify({ image: sketch, instructions: instructions || "" }),
  );
  await checkout("render");
  throw new Error("Continue in the payment window.");
}
