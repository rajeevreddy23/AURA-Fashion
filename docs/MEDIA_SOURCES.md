# Reference refresh media

`public/brand/bridal-hero.webp` is a generated bridal fashion-inspiration asset based on the user's supplied AURA design reference. It is decorative inspiration, not a product photograph, a generated customer try-on, or an editable 3D garment. The original generated image remains outside the repository in the local generated-images library. The web asset preserves its composition and is encoded as WebP for delivery.

The locally cached sample photographs are unchanged copies of the existing catalog URLs:

| File | Existing image source |
|---|---|
| w1.jpg | https://images.unsplash.com/photo-1610030469983-98e550d6193c |
| w3.jpg | https://images.unsplash.com/photo-1551163943-3f6a855d1153 |
| w4.jpg | https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b |
| w5.jpg | https://images.unsplash.com/photo-1589156229687-496a31ad1d1f |
| w6.jpg | https://images.unsplash.com/photo-1566174053879-31528523f8ae |

Names and descriptions for the reviewed white blouse, ivory occasion set, white ribbed top and plum dress were corrected to match the visible sample photographs. These remain demonstration catalog records. Other sample catalog photographs and supplier claims have not all been reviewed. The broken w9 image returns HTTP 404; unavailable media now displays an explicit placeholder. The UI only uses a cached photograph when the product still references its original source image, so an administrator's replacement image is preserved.

The hero and sample catalog images do not enable paid try-on. Product approval and the existing server-side image safeguards remain required. Photorealistic editable 3D still requires suitable avatar/garment assets and a more advanced fitting pipeline.
