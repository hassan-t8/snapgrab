import type { Tool } from "../tools";

/** Image forms: compress to KB, form photo & signature resizer; collage & grid; PDF compressor. */

const IMAGE_INPUTS = ["JPG", "JPEG", "PNG", "WEBP", "HEIC*"];

const PRIVACY_FAQ = {
  q: "Are my photos uploaded anywhere?",
  a: "No. Everything runs inside your browser on your own phone or computer — the image never leaves your device. We only count anonymously that the tool was used.",
};

const KB_FAQ = {
  q: "Is 1 KB 1,000 or 1,024 bytes?",
  a: "Websites differ, so the tool aims under the stricter number (1,000 bytes per KB). A file that fits that limit also passes a site that counts 1,024 bytes per KB.",
};

const KB_STEPS = (kb?: number) => [
  { title: "Add your photos", body: "Drop in one image or a batch — JPG, PNG, WEBP and most phone photos work." },
  {
    title: kb ? `Keep ${kb} KB or pick another size` : "Pick the target size",
    body: "Tap 10, 20, 30, 50, 100, 200 or 500 KB, or type the exact limit your form gives.",
  },
  { title: "Compare before and after", body: "Each file shows its new size, dimensions and JPEG quality, so you can check it against the limit." },
  { title: "Download or share", body: "Save files one by one, download all at once, or share them straight to WhatsApp or email." },
];

const compressKbPage = (kb: number, color: string, extra: { q: string; a: string }): Tool => ({
  slug: `compress-image-to-${kb}kb`,
  name: `Compress Image to ${kb}KB`,
  headline: `Compress Image to ${kb}KB — get a photo under ${kb} KB online, free`,
  title: `Compress Image to ${kb}KB Online — Free`,
  category: "Image",
  tagline: `Get any photo just under ${kb} KB`,
  description: `Reduce a photo or scanned document to under ${kb} KB for job portals, admission forms and uploads. Quality is lowered first and dimensions only if needed — all inside your browser.`,
  engine: "forms",
  mode: `compress-kb:${kb}`,
  accept: "image/*",
  inputs: IMAGE_INPUTS,
  outputs: ["JPG"],
  color,
  keywords: [
    `compress image to ${kb}kb`,
    `reduce image size to ${kb}kb`,
    `photo size ${kb}kb`,
    `resize image to ${kb}kb online`,
    `compress jpg to ${kb}kb`,
    `picture under ${kb} kb`,
    `${kb}kb photo for online form pakistan`,
  ],
  steps: KB_STEPS(kb),
  faqs: [
    extra,
    {
      q: `Why can't my photo reach ${kb} KB at full size?`,
      a: "A large phone photo holds millions of pixels, and below a certain quality JPEG starts to look blocky. When that happens the tool shrinks the width and height step by step until the file fits, and shows you the final dimensions.",
    },
    KB_FAQ,
    PRIVACY_FAQ,
  ],
  related: ["compress-image-to-kb", "photo-resizer-for-online-forms", "signature-resizer", "image-compressor"],
});

export const FORMS_TOOLS: Tool[] = [
  /* ------------------------------ compress to KB ------------------------------ */
  {
    slug: "compress-image-to-kb",
    name: "Compress Image to KB",
    headline: "Compress Image to KB — reduce photo size to an exact KB limit",
    title: "Compress Image to Exact KB Online — Free",
    category: "Image",
    tagline: "Hit any size limit: 10 KB to 500 KB",
    description:
      "Reduce photos to an exact size in KB — 10, 20, 50, 100, 200 KB or any number you type. Batch several images, compare before and after, then download them. Nothing is uploaded.",
    engine: "forms",
    mode: "compress-kb",
    accept: "image/*",
    inputs: IMAGE_INPUTS,
    outputs: ["JPG"],
    color: "#0ea5e9",
    keywords: [
      "compress image to kb",
      "reduce image size in kb",
      "resize image in kb",
      "image size reducer kb",
      "photo kb reducer",
      "reduce photo size for online form",
      "compress jpg to specific size",
      "image compressor pakistan",
    ],
    steps: KB_STEPS(),
    faqs: [
      {
        q: "How does it get the file just under my limit?",
        a: "It tries JPEG quality settings with a binary search to find the highest quality that fits. Only if even a low quality is too big does it reduce the width and height, then fills the remaining budget with quality again.",
      },
      {
        q: "Will my photo look worse?",
        a: "At 100 KB and above most photos look much like the original on a phone screen. At 10–20 KB the image has to become small and softer — that is the trade-off every form with a tiny limit forces.",
      },
      {
        q: "What if my image is already under the limit?",
        a: "If it is a JPG that already fits, the original file is kept unchanged so it loses no quality. Other formats are converted to JPG within the limit.",
      },
      KB_FAQ,
      PRIVACY_FAQ,
    ],
    related: ["compress-image-to-20kb", "compress-image-to-50kb", "compress-image-to-100kb", "photo-resizer-for-online-forms"],
  },
  compressKbPage(20, "#06b6d4", {
    q: "What is a 20 KB photo used for?",
    a: "Many online application forms ask for a photo or scanned signature under 20 KB. At that size an image is usually a few hundred pixels wide — fine for a form, too small to print.",
  }),
  compressKbPage(50, "#0891b2", {
    q: "Is 50 KB enough for a passport-size photo?",
    a: "Usually yes. A passport-style photo around 400 × 500 pixels normally fits under 50 KB with good quality. If your form gives exact pixel dimensions too, use the photo resizer for online forms.",
  }),
  compressKbPage(100, "#0284c7", {
    q: "Is 100 KB good quality?",
    a: "For on-screen use, usually yes — a 100 KB JPEG of around 1000–1500 pixels looks clear on phones and laptops, which makes it a common limit for document scans and profile photos.",
  }),

  /* ------------------------------ forms photo & signature ------------------------------ */
  {
    slug: "photo-resizer-for-online-forms",
    name: "Photo Resizer for Online Forms",
    headline: "Photo Resizer for Online Forms — exact pixels and KB for job & admission forms",
    title: "Photo Resizer for Online Forms — px & KB",
    category: "Image",
    tagline: "Exact width, height and KB limit in one go",
    description:
      "Resize your photo, signature or thumb impression to the exact pixels and maximum KB an online form asks for. Crop it, clean up a signature and download a JPG or PNG that fits the limit.",
    engine: "forms",
    mode: "form-photo",
    accept: "image/*",
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "PNG"],
    color: "#4f46e5",
    keywords: [
      "photo resizer for online form",
      "resize photo for online application",
      "photo size for job application online",
      "passport size photo in kb",
      "photo 200x230 pixels",
      "resize image to 35x45 mm",
      "photo resize for admission form",
      "online form photo size pakistan",
    ],
    steps: [
      { title: "Enter what the form asks for", body: "Pick a common example or type the exact width, height (in pixels) and maximum KB from the form's instructions." },
      { title: "Add your photo", body: "Upload an existing picture or take one with your phone's camera." },
      { title: "Crop and adjust", body: "Drag and zoom so your face — or your signature — sits neatly in the frame." },
      { title: "Download", body: "The result is shown at its real size with its file size, ready to upload to the form." },
    ],
    faqs: [
      {
        q: "Which size should I choose?",
        a: "Always use the numbers printed in your form's instructions — every portal sets its own. The presets are only common examples; type the exact width, height and KB limit and the tool will match them.",
      },
      {
        q: "My form gives the size in mm, not pixels. What do I do?",
        a: "At 300 DPI, multiply millimetres by 11.8: 35 × 45 mm becomes about 413 × 531 pixels. If the form also lists pixels, use those instead.",
      },
      {
        q: "What do 'Fill' and 'Fit' mean?",
        a: "Fill crops your photo to exactly the requested shape. Fit keeps the whole picture and adds white edges where the shapes don't match.",
      },
      {
        q: "The form still rejects my photo — why?",
        a: "Check the format (JPG or PNG), the exact pixel size and the KB limit. Some forms also check the background colour or face position, which the tool cannot verify for you.",
      },
      PRIVACY_FAQ,
    ],
    related: ["signature-resizer", "compress-image-to-kb", "passport-photo-maker", "remove-background"],
  },
  {
    slug: "signature-resizer",
    name: "Signature Resizer",
    headline: "Signature Resizer — resize & clean your signature for online forms",
    title: "Signature Resizer Online — px & KB for Forms",
    category: "Image",
    tagline: "Clean white background, exact size, under the KB limit",
    description:
      "Photograph your signature on paper and turn it into a clean, high-contrast image at the exact pixels and KB your online form asks for, such as 300 × 80 px under 20 KB. Runs in your browser.",
    engine: "forms",
    mode: "form-photo:signature",
    accept: "image/*",
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "PNG"],
    color: "#1d4ed8",
    keywords: [
      "signature resizer",
      "resize signature for online form",
      "signature 300x80 pixels",
      "signature size in kb",
      "signature under 20kb",
      "scan signature with phone",
      "thumb impression resize",
      "signature resize for job application pakistan",
    ],
    steps: [
      { title: "Sign on white paper", body: "Use a dark pen, then take a straight photo in good light — no flash shadows." },
      { title: "Enter the size", body: "Pick an example or type the width, height and KB limit from your form." },
      { title: "Crop and clean", body: "Zoom in on the signature; the clean-up whitens the paper and darkens the ink." },
      { title: "Download", body: "Save the JPG or PNG and upload it to the form." },
    ],
    faqs: [
      {
        q: "How do I get a clean white background?",
        a: "Leave 'Clean up paper & ink' switched on. It evens out shadows, turns the paper white and strengthens the pen strokes. Raise 'Background whitening' if grey patches remain, lower it if thin strokes disappear.",
      },
      {
        q: "Can I use it for a thumb impression?",
        a: "Yes. Choose 'Thumb impression', photograph the print on white paper and crop it. The same clean-up makes the ridges stand out against a white background.",
      },
      {
        q: "Is this the same as drawing a signature?",
        a: "No — this tool works from a photo of your real signature. To draw one with your finger or mouse instead, use the Signature Maker.",
      },
      PRIVACY_FAQ,
    ],
    related: ["photo-resizer-for-online-forms", "signature-maker", "compress-image-to-20kb", "crop-image"],
  },

  /* ------------------------------ collage & grid ------------------------------ */
  {
    slug: "photo-collage-maker",
    name: "Photo Collage Maker",
    headline: "Photo Collage Maker — combine 2 to 9 photos online, free",
    title: "Photo Collage Maker Online — Free, No Watermark",
    category: "Creative",
    tagline: "Grids, big-and-small layouts, strips",
    description:
      "Put 2 to 9 photos into one picture with grid, strip and big-plus-small layouts. Choose a shape for Instagram, Stories, WhatsApp status or A4, set spacing and corners, then save a sharp JPG or PNG.",
    engine: "collage",
    mode: "collage",
    accept: "image/*",
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "PNG"],
    color: "#ec4899",
    keywords: [
      "photo collage maker",
      "collage maker online free",
      "combine photos into one",
      "photo grid maker",
      "picture collage no watermark",
      "instagram collage",
      "whatsapp status collage",
      "join two photos side by side",
    ],
    steps: [
      { title: "Add your photos", body: "Choose 2 to 9 pictures — a layout that fits them is picked for you." },
      { title: "Pick a layout and shape", body: "Grid, strips or one big photo with smaller ones; square, 4:5, 9:16, 16:9 or A4." },
      { title: "Arrange", body: "Tap a space, drag to reposition and pinch or use the slider to zoom. Swap photos between spaces." },
      { title: "Save or share", body: "Download a high-resolution JPG or PNG, or share it straight from your phone." },
    ],
    faqs: [
      {
        q: "Does the collage have a watermark?",
        a: "No. The saved image contains only your photos and the background you chose.",
      },
      {
        q: "What size is the saved collage?",
        a: "High gives 2400 × 2400 px for square, 2160 × 2700 for 4:5, 2160 × 3840 for 9:16, 3840 × 2160 for 16:9 and 2480 × 3508 (300 DPI) for A4. Std gives smaller files, 1080 px on the short side (A4 at 150 DPI).",
      },
      {
        q: "How do I swap two photos?",
        a: "Select one space, tap Swap, then tap the other space. You can also select a space and tap any photo in the tray to put it there.",
      },
      PRIVACY_FAQ,
    ],
    related: ["instagram-grid-maker", "print-photos", "crop-image", "image-resizer"],
  },
  {
    slug: "instagram-grid-maker",
    name: "Instagram Grid Maker",
    headline: "Instagram Grid Maker — split a photo into 3, 6 or 9 posts",
    title: "Instagram Grid Maker — Split Photo 3x3",
    category: "Creative",
    tagline: "One big picture across your profile",
    description:
      "Split one photo into a 3×1, 3×2 or 3×3 grid of Instagram posts at 1080 px wide. Preview how it looks on your profile, then download the tiles numbered in the order you should post them.",
    engine: "collage",
    mode: "grid-split",
    accept: "image/*",
    inputs: IMAGE_INPUTS,
    outputs: ["JPG"],
    color: "#d946ef",
    keywords: [
      "instagram grid maker",
      "split image for instagram",
      "instagram grid splitter",
      "3x3 grid instagram",
      "instagram puzzle feed",
      "split photo into 9 parts",
      "instagram panorama split",
    ],
    steps: [
      { title: "Add one photo", body: "A wide or detailed picture works best — it will be spread across several posts." },
      { title: "Choose the grid", body: "3×1, 3×2 or 3×3, with tiles at 1080 × 1440, 1080 × 1350 or 1080 × 1080." },
      { title: "Position it", body: "Drag and zoom while watching the profile preview." },
      { title: "Post in order", body: "Download the numbered tiles and post number 1 first, finishing with the top-left tile." },
    ],
    faqs: [
      {
        q: "Why do I post the last tile first?",
        a: "Instagram shows your newest post in the top-left corner. To build the picture you upload the bottom-right tile first and the top-left tile last — the files are numbered in exactly that order.",
      },
      {
        q: "Which tile size should I use?",
        a: "Instagram's profile grid shows 3:4 thumbnails, so 1080 × 1440 tiles line up edge to edge there. 4:5 and square tiles work too, but the profile grid trims their sides; opening a post still shows the whole tile.",
      },
      {
        q: "My grid doesn't line up — what went wrong?",
        a: "Pinned posts appear before everything else, so unpin them. Also post each tile as a separate single-photo post, in order, with nothing posted in between.",
      },
      PRIVACY_FAQ,
    ],
    related: ["photo-collage-maker", "crop-image", "image-resizer", "image-compressor"],
  },

  /* ------------------------------ PDF ------------------------------ */
  {
    slug: "compress-pdf",
    name: "Compress PDF",
    headline: "Compress PDF — reduce PDF file size online, free",
    title: "Compress PDF Online — Reduce PDF Size Free",
    category: "PDF",
    tagline: "Shrink scans and big PDFs for email and uploads",
    description:
      "Reduce PDF size in your browser. Basic keeps text selectable; Strong turns pages into compressed images for big savings on scanned documents. See before and after sizes — nothing is uploaded.",
    engine: "pdf-compress",
    mode: "pdf-compress",
    accept: "application/pdf,.pdf",
    inputs: ["PDF"],
    outputs: ["PDF"],
    color: "#dc2626",
    keywords: [
      "compress pdf",
      "reduce pdf size",
      "pdf compressor online free",
      "compress pdf to 1mb",
      "reduce scanned pdf size",
      "shrink pdf for email",
      "compress pdf without uploading",
      "pdf size reducer pakistan",
    ],
    steps: [
      { title: "Add your PDF", body: "Drop in one document — it opens on your device, not on a server." },
      { title: "Pick Basic or Strong", body: "Basic keeps the text; Strong rebuilds the pages as images at 72, 100 or 150 DPI." },
      { title: "Compress", body: "Watch the progress page by page and cancel at any time." },
      { title: "Download", body: "Compare the sizes, then save or share the smaller PDF — or keep your original if it was already smaller." },
    ],
    faqs: [
      {
        q: "Basic or Strong — which should I use?",
        a: "Use Strong for scanned documents and photo-heavy PDFs: it often cuts the size dramatically, but the text becomes part of an image and can no longer be selected or searched. Use Basic when you need selectable text; it repacks the file and often saves only a little.",
      },
      {
        q: "Why is my compressed PDF bigger?",
        a: "PDFs that are mostly typed text are already small, and turning their pages into images can make them larger. The tool warns you when that happens and lets you keep the original.",
      },
      {
        q: "Can I compress a password-protected PDF?",
        a: "Not if it needs a password to open. Remove the password first (open it and save or print an unprotected copy), then compress it.",
      },
      {
        q: "Is there a page limit?",
        a: "Strong compression handles up to 400 pages at a time, and long documents are slower on phones. Split very big files first.",
      },
      {
        q: "Is my PDF uploaded?",
        a: "No. It is processed entirely in your browser with pdf.js and pdf-lib, so confidential documents never leave your device.",
      },
    ],
    related: ["merge-pdf", "split-pdf", "pdf-to-jpg", "image-to-pdf"],
  },
];
