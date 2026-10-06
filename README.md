# Gallerify

Set your Minecraft profile banner from a local image.

## Example

![Gallerify example](https://cdn.discordapp.com/attachments/1544356375000522883/1556304414652768398/example.png?backend=b2&ex=6ac5a72f&is=6ac455af&hm=4876d59c78f64fbd20b72458ff482683af82df43fcd5bcf41c66371b5cc43b03&)

## Setup

Requires Node.js 18 or newer.

```bash
npm i
```

Put your images in the `images` folder. The path is set at the top of `index.js` (`imageDir`).

## Usage

```bash
node .
```

| Key         | Action                     |
|-------------|----------------------------|
| Up / Down   | Move                       |
| Enter       | Upload selected image      |
| R           | Refresh image list         |
| L           | Log out                    |
| Q           | Exit                       |

On the first upload you get a Microsoft login link and code. After that the login is reused automatically.

## Notes

- Supported inputs: PNG, JPG, JPEG, WEBP, GIF
- Images are cropped to 1920x1080 and uploaded as JPEG
- The login is stored in `.auth/`. Do not share this folder.
- If the login expires, you are asked to log in again on the next upload

## Troubleshooting

| Problem                    | Fix                                              |
|----------------------------|--------------------------------------------------|
| No images found            | Check `imageDir` and the file extensions         |
| Login fails                | Choose Log out, then try again                   |
| Server returned 400        | The image is bugged or corrupted                 |
