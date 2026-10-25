import { QUOTA_PROVIDERS, type CostTier, type ProviderId } from "./quota-providers";

export type ToolEngine =
  | "image" | "photo" | "print" | "image-ai" | "utility" | "pdf" | "pdf-pages" | "text" | "generate" | "calc" | "doc" | "link-audio" | "link-video";

export type ToolCategory = "Image" | "Print" | "PDF" | "Calculators" | "Text" | "Everyday" | "Generators" | "Audio" | "Video";

export type Tool = {
  slug: string;
  name: string;
  /** H1 on the tool page — keep it keyword-led */
  headline: string;
  /** shorter <title> for search results when the headline runs past ~55 characters */
  title?: string;
  category: ToolCategory;
  tagline: string;
  description: string;
  engine: ToolEngine;
  /** for the image engine: which output format the converter targets, or null to let the user pick */
  output?: "image/jpeg" | "image/png" | "image/webp" | null;
  /** engine-specific mode */
  mode?:
    | "convert" | "compress" | "resize" | "favicon" | "to-base64"
    | "images-to-pdf" | "merge" | "split" | "rotate" | "page-numbers"
    | "case" | "base64" | "url" | "json" | "hash" | "count"
    | "password" | "uuid" | "qr" | "wifi-qr" | "whatsapp" | "vcard-qr" | "color" | "lorem"
    | "income-tax-pk" | "zakat" | "emi" | "cgpa" | "age" | "percentage" | "bmi" | "unit"
    | "currency" | "prayer" | "qibla" | "passport-photo" | "pdf-to-image" | "organize" | "invoice" | "cv"
    | "id-card-print" | "photo-print" | "ocr" | "remove-bg" | "signature" | "crop-image"
    | "hijri" | "ramadan" | "date-diff" | "discount" | "typing-test"
    | "gold" | "solar-load" | "fuel" | "calories"
    | "urdu-keyboard" | "voice-typing" | "text-to-speech" | "tasbeeh" | "timer" | "spin-wheel";
  accept?: string;
  inputs: string[];
  outputs: string[];
  color: string;
  keywords: string[];
  steps: { title: string; body: string }[];
  faqs: { q: string; a: string }[];
  /** related tool slugs */
  related: string[];
  /** external API the tool depends on; tools without one run fully in the browser */
  provider?: ProviderId;
};

const IMAGE_ACCEPT = "image/*";

const IMAGE_INPUTS = ["JPG", "JPEG", "PNG", "WEBP", "GIF", "BMP", "AVIF", "HEIC*", "SVG"];

const IMAGE_PRIVACY_FAQ = {
  q: "Are my files uploaded to your server?",
  a: "No. Image tools run entirely inside your browser using the Canvas API — the file never leaves your device. We only record an anonymous count of how many conversions ran, never the image itself.",
};

const IMAGE_SIZE_FAQ = {
  q: "Is there a file size limit?",
  a: "There is no server limit because nothing is uploaded. The practical ceiling is your device's memory — very large images (over roughly 8000×8000) can be slow on older phones.",
};

export const TOOLS: Tool[] = [
  /* ------------------------------- image converters ------------------------------- */
  {
    slug: "image-converter",
    name: "Image Converter",
    headline: "Free Image Converter — JPG, PNG, WEBP & more",
    category: "Image",
    tagline: "Convert between JPG, PNG and WEBP",
    description:
      "Convert images between JPG, PNG and WEBP right in your browser. Drop in a batch, pick the output format and quality, and download the results — nothing is uploaded to a server.",
    engine: "image",
    mode: "convert",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "PNG", "WEBP"],
    color: "#7048f0",
    keywords: ["image converter", "convert jpg to png", "png to jpg", "webp converter", "free image converter online"],
    steps: [
      { title: "Drop your images", body: "Drag files onto the panel or tap to browse. You can queue as many as your device can hold." },
      { title: "Choose the output", body: "Pick JPG, PNG or WEBP, then set the quality if the format supports it." },
      { title: "Convert", body: "Everything runs locally — a large batch finishes in seconds with no upload wait." },
      { title: "Save", body: "Download files one by one, or use Download all to save the whole batch." },
    ],
    faqs: [
      IMAGE_PRIVACY_FAQ,
      {
        q: "Which format should I pick?",
        a: "WEBP for the web — it is typically 25–35% smaller than JPG at the same visual quality. JPG for maximum compatibility with older software. PNG when you need lossless quality or transparency.",
      },
      {
        q: "Does converting to JPG remove transparency?",
        a: "Yes. JPG has no alpha channel, so transparent areas are flattened onto a white background. Convert to PNG or WEBP if you need to keep transparency.",
      },
      IMAGE_SIZE_FAQ,
    ],
    related: ["png-to-jpg", "jpg-to-png", "webp-converter", "image-compressor"],
  },
  {
    slug: "png-to-jpg",
    name: "PNG to JPG",
    headline: "PNG to JPG Converter — free and instant",
    category: "Image",
    tagline: "Flatten PNGs into smaller JPGs",
    description:
      "Turn PNG files into JPG in one step. JPG files are dramatically smaller for photographs, which makes them faster to email, upload and post.",
    engine: "image",
    mode: "convert",
    output: "image/jpeg",
    accept: IMAGE_ACCEPT,
    inputs: ["PNG", "JPG", "WEBP", "GIF", "BMP", "AVIF"],
    outputs: ["JPG"],
    color: "#f59e0b",
    keywords: ["png to jpg", "convert png to jpg", "png to jpeg converter", "png jpg online free"],
    steps: [
      { title: "Add your PNG files", body: "Drag them in, or tap the panel to browse your device." },
      { title: "Set the quality", body: "85% is the sweet spot — visually identical to most eyes at roughly a fifth of the size." },
      { title: "Convert and save", body: "Files are produced locally and download straight away." },
    ],
    faqs: [
      {
        q: "Why is my PNG so much bigger than the JPG?",
        a: "PNG is lossless — it stores every pixel exactly. JPG discards detail the eye is poor at noticing, which is why a photograph often shrinks by 80% or more with no visible difference.",
      },
      {
        q: "What happens to transparent areas?",
        a: "They are filled with white, because JPG cannot store transparency. If you need the transparent background, use the WEBP converter instead.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["jpg-to-png", "image-converter", "image-compressor", "webp-converter"],
  },
  {
    slug: "jpg-to-png",
    name: "JPG to PNG",
    headline: "JPG to PNG Converter — lossless output",
    category: "Image",
    tagline: "Convert photos to lossless PNG",
    description:
      "Convert JPG images to PNG when you need a lossless file for editing, screenshots or graphics with sharp edges and text.",
    engine: "image",
    mode: "convert",
    output: "image/png",
    accept: IMAGE_ACCEPT,
    inputs: ["JPG", "PNG", "WEBP", "GIF", "BMP", "AVIF"],
    outputs: ["PNG"],
    color: "#14c8be",
    keywords: ["jpg to png", "jpeg to png", "convert jpg to png free", "png converter online"],
    steps: [
      { title: "Add your JPGs", body: "Drop in one file or a whole folder's worth." },
      { title: "Convert", body: "PNG is lossless, so there is no quality setting to worry about." },
      { title: "Save", body: "Download individually or grab the whole batch." },
    ],
    faqs: [
      {
        q: "Will this restore quality my JPG lost?",
        a: "No, and no tool can. JPG compression is destructive — converting to PNG preserves what is left without adding further loss, which matters if you plan to edit and re-save repeatedly.",
      },
      {
        q: "When is PNG the right choice?",
        a: "Screenshots, logos, line art, anything with text or hard edges, and any image you will edit in several passes.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["png-to-jpg", "image-converter", "webp-converter", "image-resizer"],
  },
  {
    slug: "webp-converter",
    name: "WEBP Converter",
    headline: "WEBP Converter — to and from WEBP",
    category: "Image",
    tagline: "Modern format, much smaller files",
    description:
      "Convert images to WEBP for faster page loads, or convert existing WEBP files back to JPG and PNG for software that cannot open them.",
    engine: "image",
    mode: "convert",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: ["WEBP", "JPG", "PNG", "GIF", "BMP", "AVIF"],
    outputs: ["WEBP", "JPG", "PNG"],
    color: "#8f74ff",
    keywords: ["webp converter", "webp to jpg", "webp to png", "convert to webp", "jpg to webp"],
    steps: [
      { title: "Add your files", body: "WEBP in, or anything you want turned into WEBP." },
      { title: "Pick the direction", body: "Choose WEBP as the output to shrink files, or JPG/PNG to make a WEBP openable anywhere." },
      { title: "Convert and save", body: "All local, all instant." },
    ],
    faqs: [
      {
        q: "Why does WEBP produce smaller files?",
        a: "It uses more modern compression than JPG — typically 25–35% smaller at matching visual quality, with transparency support JPG lacks.",
      },
      {
        q: "Why will my software not open WEBP?",
        a: "Older applications predate the format. Converting to JPG or PNG here solves it in one step.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["image-converter", "png-to-jpg", "jpg-to-png", "image-compressor"],
  },
  {
    slug: "image-compressor",
    name: "Image Compressor",
    headline: "Image Compressor — shrink photos without the mush",
    category: "Image",
    tagline: "Cut file size, keep the detail",
    description:
      "Compress JPG, PNG and WEBP images with a live quality control and a before/after size readout, so you can see exactly what each setting costs you.",
    engine: "image",
    mode: "compress",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "WEBP", "PNG"],
    color: "#ef4444",
    keywords: ["image compressor", "compress jpg", "reduce image size", "photo compressor online", "compress png"],
    steps: [
      { title: "Add your images", body: "Drop in the files you need to slim down." },
      { title: "Move the quality slider", body: "The saving is shown per file, so you can trade size against detail with your eyes open." },
      { title: "Compress", body: "Runs locally at full speed — no upload, no queue." },
      { title: "Save", body: "Keep the results that hit your target and re-run the rest at a different setting." },
    ],
    faqs: [
      {
        q: "What quality should I use?",
        a: "80–85% is invisible to almost everyone and usually cuts file size by 60–80%. Below 60% you start to see blocking in skies, gradients and flat colour.",
      },
      {
        q: "Can I compress a PNG?",
        a: "Yes, but PNG is lossless, so real savings come from converting it to WEBP or JPG. The tool will show you the difference for your own file.",
      },
      IMAGE_PRIVACY_FAQ,
      IMAGE_SIZE_FAQ,
    ],
    related: ["image-converter", "image-resizer", "webp-converter", "png-to-jpg"],
  },
  {
    slug: "image-resizer",
    name: "Image Resizer",
    headline: "Image Resizer — exact pixel dimensions",
    category: "Image",
    tagline: "Resize by width, height or percentage",
    description:
      "Resize images to an exact width or height, with the aspect ratio locked by default. Ideal for upload limits, thumbnails and profile pictures.",
    engine: "image",
    mode: "resize",
    output: null,
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["JPG", "PNG", "WEBP"],
    color: "#0aa39c",
    keywords: ["image resizer", "resize image online", "resize photo pixels", "bulk image resize"],
    steps: [
      { title: "Add your images", body: "One file or a whole batch — the same dimensions apply to all of them." },
      { title: "Set the size", body: "Enter a width and leave the ratio locked, and the height follows automatically." },
      { title: "Resize and save", body: "Output format and quality are yours to choose." },
    ],
    faqs: [
      {
        q: "Will enlarging an image make it sharper?",
        a: "No. Scaling up invents pixels from the ones you already have, so it always looks softer. Downscaling is the operation that preserves quality.",
      },
      {
        q: "Can I resize a batch to the same size?",
        a: "Yes — every queued file gets the same settings, which is the fastest way to prepare a consistent set of thumbnails.",
      },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["image-compressor", "image-converter", "jpg-to-png", "webp-converter"],
  },

  /* ------------------------------- image extras ------------------------------- */
  {
    slug: "favicon-generator",
    name: "Favicon Generator",
    headline: "Favicon Generator — every size from one image",
    category: "Image",
    tagline: "16px to 512px in one click",
    description:
      "Turn any square image into a complete favicon set — 16, 32, 48, 96, 180, 192 and 512 pixel PNGs for browsers, Apple touch icons and PWA manifests, with the HTML snippet to paste.",
    engine: "image",
    mode: "favicon",
    output: "image/png",
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["PNG 16-512px"],
    color: "#f59e0b",
    keywords: ["favicon generator", "make favicon from image", "apple touch icon", "pwa icon generator", "favicon png"],
    steps: [
      { title: "Add a square image", body: "A 512×512 PNG or SVG gives the sharpest result at every size." },
      { title: "Generate", body: "Seven standard sizes are produced locally in one pass." },
      { title: "Download", body: "Save the sizes you need, or grab all of them at once." },
      { title: "Paste the HTML", body: "Copy the generated link tags into the head of your site." },
    ],
    faqs: [
      { q: "Do I need an .ico file?", a: "Not any more. Every browser in current use accepts PNG favicons, and PNG scales better. Only very old Internet Explorer required .ico." },
      { q: "Which sizes actually matter?", a: "32px for browser tabs, 180px for Apple touch icons, and 192 plus 512 for Android and PWA installs. The rest are useful fallbacks." },
      { q: "What if my image is not square?", a: "It is centred and letterboxed rather than stretched. For the best result, crop to a square first with the resizer." },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["image-resizer", "image-converter", "image-to-base64", "png-to-jpg"],
  },
  {
    slug: "image-to-base64",
    name: "Image to Base64",
    headline: "Image to Base64 Converter — data URI encoder",
    category: "Image",
    tagline: "Inline images in CSS, HTML or JSON",
    description:
      "Convert an image into a Base64 data URI you can paste straight into CSS, HTML, JSON or an email template — no hosting, no extra request.",
    engine: "image",
    mode: "to-base64",
    accept: IMAGE_ACCEPT,
    inputs: IMAGE_INPUTS,
    outputs: ["Data URI", "CSS", "HTML"],
    color: "#0aa39c",
    keywords: ["image to base64", "base64 image encoder", "data uri converter", "png to base64", "css inline image"],
    steps: [
      { title: "Add an image", body: "Small images work best — icons, logos, spinners." },
      { title: "Encode", body: "The data URI is produced instantly in your browser." },
      { title: "Copy", body: "Take the raw string, or a ready-made CSS or HTML snippet." },
    ],
    faqs: [
      { q: "When should I inline an image?", a: "For small assets under roughly 5KB — icons and logos — where saving an HTTP request beats the size penalty." },
      { q: "Why did my file get bigger?", a: "Base64 adds about 33% overhead by design. That is the trade for embedding it directly in the document." },
      { q: "Does this work in email?", a: "In most modern clients, though some — notably older Outlook — block data URIs. Test before a large send." },
      IMAGE_PRIVACY_FAQ,
    ],
    related: ["favicon-generator", "image-converter", "base64-encoder", "image-compressor"],
  },

  /* ------------------------------- pdf ------------------------------- */
  {
    slug: "image-to-pdf",
    name: "Image to PDF",
    headline: "Image to PDF Converter — JPG and PNG to PDF",
    category: "PDF",
    tagline: "Turn photos into one PDF document",
    description:
      "Combine JPG and PNG images into a single PDF, in the order you choose, with page size and orientation that match your images. Nothing is uploaded.",
    engine: "pdf",
    mode: "images-to-pdf",
    accept: "image/jpeg,image/png",
    inputs: ["JPG", "PNG"],
    outputs: ["PDF"],
    color: "#ef4444",
    keywords: ["image to pdf", "jpg to pdf", "png to pdf", "photos to pdf converter", "combine images into pdf"],
    steps: [
      { title: "Add your images", body: "Drop in as many JPGs or PNGs as you need." },
      { title: "Set the order", body: "Files are added in the order you queue them; remove any you do not want." },
      { title: "Create the PDF", body: "Each image becomes one page, sized to fit." },
      { title: "Download", body: "One PDF, built entirely on your device." },
    ],
    faqs: [
      { q: "Are my documents uploaded?", a: "No. PDFs are assembled in your browser with pdf-lib, so scans, IDs and contracts never leave your device." },
      { q: "Can I reorder pages?", a: "Remove and re-add files in the order you want. A drag-to-reorder queue is on the roadmap." },
      { q: "Which image formats work?", a: "JPG and PNG. Convert other formats with the image converter first." },
      { q: "Is there a page limit?", a: "No fixed limit — very large batches are only bounded by your device's memory." },
    ],
    related: ["merge-pdf", "split-pdf", "rotate-pdf", "image-compressor"],
  },
  {
    slug: "merge-pdf",
    name: "Merge PDF",
    headline: "Merge PDF — combine files into one document",
    category: "PDF",
    tagline: "Join several PDFs in order",
    description:
      "Merge multiple PDF files into a single document in the order you add them. Runs entirely in your browser, so confidential documents stay private.",
    engine: "pdf",
    mode: "merge",
    accept: "application/pdf",
    inputs: ["PDF"],
    outputs: ["PDF"],
    color: "#7048f0",
    keywords: ["merge pdf", "combine pdf files", "join pdf online free", "pdf merger no upload"],
    steps: [
      { title: "Add your PDFs", body: "Queue two or more files in the order you want them joined." },
      { title: "Merge", body: "Pages are concatenated with their original size and orientation preserved." },
      { title: "Download", body: "One combined PDF, produced locally." },
    ],
    faqs: [
      { q: "Is there a file size limit?", a: "No server limit, because nothing is uploaded. Your device's memory is the only constraint." },
      { q: "Are password-protected PDFs supported?", a: "No. Remove the password in your PDF reader first, then merge." },
      { q: "Do bookmarks and form fields survive?", a: "Page content, size and rotation are preserved. Interactive form fields and bookmarks may not carry across." },
      { q: "Is this safe for confidential files?", a: "Yes — merging happens in your browser and no copy is ever sent to us." },
    ],
    related: ["split-pdf", "image-to-pdf", "rotate-pdf", "image-compressor"],
  },
  {
    slug: "split-pdf",
    name: "Split PDF",
    headline: "Split PDF — extract pages from a document",
    category: "PDF",
    tagline: "Pull out the pages you need",
    description:
      "Extract a page range from a PDF into a new document, or split every page into its own file. Processed locally, so nothing is uploaded.",
    engine: "pdf",
    mode: "split",
    accept: "application/pdf",
    inputs: ["PDF"],
    outputs: ["PDF"],
    color: "#14c8be",
    keywords: ["split pdf", "extract pdf pages", "pdf page remover", "separate pdf pages online"],
    steps: [
      { title: "Add a PDF", body: "The page count is read as soon as the file loads." },
      { title: "Choose a range", body: "Enter something like 2-5, or switch to one file per page." },
      { title: "Split", body: "New documents are built in your browser." },
      { title: "Download", body: "Save the extracted range or every page separately." },
    ],
    faqs: [
      { q: "How do I write the page range?", a: "Use a dash for a range (3-8) or a single number for one page. Pages are numbered from 1." },
      { q: "Can I split a scanned document?", a: "Yes — scans are ordinary PDF pages and split exactly the same way." },
      { q: "Does splitting reduce quality?", a: "No. Pages are copied byte-for-byte into the new document, not re-rendered." },
      { q: "Are encrypted PDFs supported?", a: "No, remove the password first." },
    ],
    related: ["merge-pdf", "rotate-pdf", "image-to-pdf", "word-counter"],
  },
  {
    slug: "rotate-pdf",
    name: "Rotate PDF",
    headline: "Rotate PDF — fix sideways and upside-down pages",
    category: "PDF",
    tagline: "Turn every page 90, 180 or 270°",
    description:
      "Rotate every page of a PDF and save the result permanently, so scans that came out sideways open the right way up everywhere.",
    engine: "pdf",
    mode: "rotate",
    accept: "application/pdf",
    inputs: ["PDF"],
    outputs: ["PDF"],
    color: "#8f74ff",
    keywords: ["rotate pdf", "turn pdf pages", "fix sideways pdf", "rotate pdf and save free"],
    steps: [
      { title: "Add a PDF", body: "Any unencrypted document works." },
      { title: "Pick an angle", body: "90° clockwise, 180°, or 270° for counter-clockwise." },
      { title: "Rotate and download", body: "The rotation is written into the file, so it sticks in every reader." },
    ],
    faqs: [
      { q: "Why does my reader forget the rotation?", a: "Viewing tools often rotate only the display. This writes the rotation into the page itself, so it persists." },
      { q: "Can I rotate a single page?", a: "Not yet — the angle applies to every page. Split the document first if you need one page only." },
      { q: "Does it re-compress the file?", a: "No. Only the page rotation attribute changes, so quality and size stay the same." },
      { q: "Are my files uploaded?", a: "Never — everything happens in your browser." },
    ],
    related: ["split-pdf", "merge-pdf", "image-to-pdf", "image-resizer"],
  },

  /* ------------------------------- text & developer ------------------------------- */
  {
    slug: "word-counter",
    name: "Word Counter",
    headline: "Word Counter — words, characters and reading time",
    category: "Text",
    tagline: "Live counts as you type",
    description:
      "Count words, characters with and without spaces, sentences, paragraphs and estimated reading time — updating live as you type or paste.",
    engine: "text",
    mode: "count",
    inputs: ["Any text"],
    outputs: ["Statistics"],
    color: "#14c8be",
    keywords: ["word counter", "character count", "words to reading time", "essay word count tool", "letter counter"],
    steps: [
      { title: "Paste or type", body: "The panel accepts anything from a tweet to a full manuscript." },
      { title: "Read the counts", body: "Every statistic updates on each keystroke." },
      { title: "Copy if needed", body: "Your text stays in the box until you clear it." },
    ],
    faqs: [
      { q: "How is a word counted?", a: "Any run of non-whitespace characters counts as one word, which matches how Word and Google Docs behave for ordinary prose." },
      { q: "How is reading time worked out?", a: "At 200 words per minute, the widely used average for adult silent reading." },
      { q: "Is my text stored?", a: "No. It never leaves the browser tab and is gone when you close it." },
      { q: "Does it work offline?", a: "Once the page has loaded, yes — the counting is pure client-side JavaScript." },
    ],
    related: ["case-converter", "lorem-ipsum-generator", "json-formatter", "slug-generator"],
  },
  {
    slug: "case-converter",
    name: "Case Converter",
    headline: "Case Converter — UPPER, lower, Title, camelCase & more",
    title: "Case Converter — UPPER, lower, Title & camelCase",
    category: "Text",
    tagline: "Nine cases, one click each",
    description:
      "Convert text between UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, snake_case, kebab-case and CONSTANT_CASE.",
    engine: "text",
    mode: "case",
    inputs: ["Any text"],
    outputs: ["9 case styles"],
    color: "#7048f0",
    keywords: ["case converter", "uppercase to lowercase", "title case converter", "camelcase converter", "snake case"],
    steps: [
      { title: "Paste your text", body: "Anything from a headline to a whole document." },
      { title: "Pick a case", body: "Every style is one button, applied instantly." },
      { title: "Copy the result", body: "One tap copies the converted text to your clipboard." },
    ],
    faqs: [
      { q: "What is the difference between Title and Sentence case?", a: "Title Case capitalises each significant word — good for headings. Sentence case capitalises only the first word of each sentence." },
      { q: "Which case should I use for code?", a: "camelCase for JavaScript variables, PascalCase for classes and components, snake_case in Python, kebab-case for URLs and CSS." },
      { q: "Does it handle accented characters?", a: "Yes, casing is Unicode-aware, so accents and non-Latin scripts convert correctly." },
      { q: "Is my text sent anywhere?", a: "No — every conversion runs in your browser." },
    ],
    related: ["word-counter", "slug-generator", "lorem-ipsum-generator", "json-formatter"],
  },
  {
    slug: "json-formatter",
    name: "JSON Formatter",
    headline: "JSON Formatter & Validator — prettify or minify",
    category: "Text",
    tagline: "Format, validate and minify JSON",
    description:
      "Paste raw JSON to pretty-print it with proper indentation, minify it for production, or find out exactly where and why it is invalid.",
    engine: "text",
    mode: "json",
    inputs: ["JSON"],
    outputs: ["Formatted", "Minified"],
    color: "#f59e0b",
    keywords: ["json formatter", "json validator", "prettify json", "minify json", "json beautifier online"],
    steps: [
      { title: "Paste your JSON", body: "An API response, a config file, anything." },
      { title: "Format or minify", body: "Pretty-print with two-space indentation, or strip every byte of whitespace." },
      { title: "Fix any errors", body: "Invalid JSON reports the exact position and reason." },
    ],
    faqs: [
      { q: "Why does my JSON fail to parse?", a: "The usual causes are trailing commas, single quotes instead of double, unquoted keys, or a stray comment — none of which strict JSON allows." },
      { q: "Is my data sent to a server?", a: "No. Parsing uses the browser's own JSON engine, so API keys and payloads stay local." },
      { q: "How much does minifying save?", a: "Typically 15–30% on indented JSON, which matters on API responses served at volume." },
      { q: "Does it keep key order?", a: "Yes, key order is preserved exactly as written." },
    ],
    related: ["base64-encoder", "url-encoder", "case-converter", "hash-generator"],
  },
  {
    slug: "base64-encoder",
    name: "Base64 Encoder",
    headline: "Base64 Encoder & Decoder — text to Base64 both ways",
    category: "Text",
    tagline: "Encode and decode in one panel",
    description:
      "Encode text to Base64 or decode Base64 back to plain text, with full Unicode support so emoji and non-Latin scripts survive the round trip.",
    engine: "text",
    mode: "base64",
    inputs: ["Text", "Base64"],
    outputs: ["Base64", "Text"],
    color: "#0aa39c",
    keywords: ["base64 encoder", "base64 decoder", "encode base64 online", "decode base64 text", "base64 converter"],
    steps: [
      { title: "Paste your input", body: "Plain text to encode, or a Base64 string to decode." },
      { title: "Choose a direction", body: "Encode or decode — switch at any time." },
      { title: "Copy the result", body: "One tap to the clipboard." },
    ],
    faqs: [
      { q: "Is Base64 encryption?", a: "No, and this matters. It is reversible encoding with no key — anyone can decode it. Never use it to protect secrets." },
      { q: "Does it handle emoji and Unicode?", a: "Yes. Text is UTF-8 encoded first, so emoji, Arabic, Chinese and accents all round-trip correctly." },
      { q: "Why does my decode fail?", a: "The input is not valid Base64 — usually a truncated string or one that picked up spaces or line breaks when copied." },
      { q: "What is Base64 used for?", a: "Embedding binary data in text-only formats: data URIs, JSON payloads, email attachments and HTTP basic auth headers." },
    ],
    related: ["url-encoder", "json-formatter", "hash-generator", "image-to-base64"],
  },
  {
    slug: "url-encoder",
    name: "URL Encoder",
    headline: "URL Encoder & Decoder — percent encoding tool",
    category: "Text",
    tagline: "Escape query strings safely",
    description:
      "Percent-encode text for safe use in URLs and query strings, or decode an encoded URL back into readable text.",
    engine: "text",
    mode: "url",
    inputs: ["Text", "Encoded URL"],
    outputs: ["Encoded", "Decoded"],
    color: "#8f74ff",
    keywords: ["url encoder", "url decoder", "percent encoding", "encode url online", "query string encoder"],
    steps: [
      { title: "Paste the text or URL", body: "A full URL, or just the parameter value you need to escape." },
      { title: "Encode or decode", body: "Switch direction with one button." },
      { title: "Copy", body: "Paste it straight into your code or address bar." },
    ],
    faqs: [
      { q: "Why do spaces become %20?", a: "URLs cannot contain raw spaces, so each is replaced with its hex byte value. Some contexts use + instead inside query strings." },
      { q: "Which characters get encoded?", a: "Anything outside the unreserved set — letters, digits, hyphen, underscore, dot and tilde are left alone." },
      { q: "Should I encode the whole URL?", a: "No, only the individual values. Encoding the whole thing would escape the :// and & separators and break the URL." },
      { q: "Is my input sent anywhere?", a: "No — it is handled entirely in your browser." },
    ],
    related: ["base64-encoder", "json-formatter", "slug-generator", "hash-generator"],
  },
  {
    slug: "hash-generator",
    name: "Hash Generator",
    headline: "Hash Generator — SHA-256, SHA-1, SHA-384 & SHA-512",
    category: "Text",
    tagline: "Cryptographic checksums from text",
    description:
      "Generate SHA-256, SHA-1, SHA-384 and SHA-512 hashes from any text using the browser's own Web Crypto API — the same implementation your browser uses for TLS.",
    engine: "text",
    mode: "hash",
    inputs: ["Any text"],
    outputs: ["SHA-1", "SHA-256", "SHA-384", "SHA-512"],
    color: "#ef4444",
    keywords: ["hash generator", "sha256 generator", "sha512 online", "checksum calculator", "sha1 hash tool"],
    steps: [
      { title: "Paste your text", body: "A string, a token, a file's contents — anything." },
      { title: "Read the hashes", body: "All four algorithms are computed at once." },
      { title: "Copy the one you need", body: "Each row copies independently." },
    ],
    faqs: [
      { q: "Where is MD5?", a: "The Web Crypto API deliberately omits MD5 because it is cryptographically broken. If you need it for a legacy checksum, use a dedicated offline tool." },
      { q: "Can a hash be reversed?", a: "No. Hashing is one-way. Short or common inputs can still be found by brute force or rainbow tables, which is why passwords need a salt." },
      { q: "Which algorithm should I use?", a: "SHA-256 for almost everything. SHA-1 is broken for security but still appears in older systems like Git object ids." },
      { q: "Is my input transmitted?", a: "No. Hashing happens locally through the browser's Web Crypto API." },
    ],
    related: ["password-generator", "uuid-generator", "base64-encoder", "json-formatter"],
  },
  {
    slug: "slug-generator",
    name: "Slug Generator",
    headline: "URL Slug Generator — SEO friendly permalinks",
    category: "Text",
    tagline: "Clean, readable URL slugs",
    description:
      "Turn any headline into a clean, lowercase, hyphenated URL slug with accents transliterated and punctuation stripped — the format search engines prefer.",
    engine: "text",
    mode: "case",
    inputs: ["Any text"],
    outputs: ["URL slug"],
    color: "#0aa39c",
    keywords: ["slug generator", "url slug maker", "permalink generator", "seo friendly url", "text to slug"],
    steps: [
      { title: "Paste a headline", body: "Your article title, product name or page heading." },
      { title: "Pick the slug style", body: "It appears in the kebab-case row, ready to use." },
      { title: "Copy it", body: "Paste straight into your CMS permalink field." },
    ],
    faqs: [
      { q: "What makes a good slug?", a: "Short, lowercase, hyphen-separated, keyword-bearing and stable. Three to five meaningful words beats a full sentence." },
      { q: "Hyphens or underscores?", a: "Hyphens. Google treats hyphens as word separators and underscores as joiners, so word_two reads as one token." },
      { q: "Should I change an existing slug?", a: "Only with a 301 redirect in place — changing a live URL without one loses the accumulated ranking." },
      { q: "How are accents handled?", a: "They are transliterated to their closest ASCII equivalent, so café becomes cafe." },
    ],
    related: ["case-converter", "url-encoder", "word-counter", "lorem-ipsum-generator"],
  },

  /* ------------------------------- generators ------------------------------- */
  {
    slug: "password-generator",
    name: "Password Generator",
    headline: "Strong Password Generator — cryptographically random",
    category: "Generators",
    tagline: "Random passwords that resist cracking",
    description:
      "Generate strong random passwords using the browser's cryptographic random source, with control over length and character sets and a live strength estimate.",
    engine: "generate",
    mode: "password",
    inputs: ["Length", "Character sets"],
    outputs: ["Password"],
    color: "#ef4444",
    keywords: ["password generator", "strong random password", "secure password maker", "random password online"],
    steps: [
      { title: "Set the length", body: "Sixteen characters or more is the sensible modern default." },
      { title: "Choose character sets", body: "Uppercase, lowercase, digits and symbols — mix as you like." },
      { title: "Generate and copy", body: "Regenerate as often as you want; one tap copies." },
    ],
    faqs: [
      { q: "Is this actually random?", a: "It uses crypto.getRandomValues, the browser's cryptographically secure generator — not Math.random, which is predictable and unsuitable for passwords." },
      { q: "Is the password sent anywhere?", a: "No. It is generated in your browser, never transmitted and never logged." },
      { q: "How long should a password be?", a: "Sixteen or more mixed characters. Length beats complexity — a longer password with fewer symbol types is generally stronger than a short cryptic one." },
      { q: "Should I reuse it?", a: "Never. Use a password manager so every account has its own, which limits the damage when any one service is breached." },
    ],
    related: ["uuid-generator", "hash-generator", "qr-code-generator", "base64-encoder"],
  },
  {
    slug: "uuid-generator",
    name: "UUID Generator",
    headline: "UUID Generator — random v4 identifiers in bulk",
    category: "Generators",
    tagline: "Version 4 UUIDs, up to 500 at once",
    description:
      "Generate cryptographically random version 4 UUIDs one at a time or in bulk, with optional uppercase and braces formatting for SQL Server and Windows.",
    engine: "generate",
    mode: "uuid",
    inputs: ["Count"],
    outputs: ["UUID v4"],
    color: "#7048f0",
    keywords: ["uuid generator", "guid generator", "random uuid v4", "bulk uuid online", "generate guid"],
    steps: [
      { title: "Choose how many", body: "One, or up to five hundred for seeding a database." },
      { title: "Pick a format", body: "Standard lowercase, uppercase, or wrapped in braces." },
      { title: "Copy the list", body: "One tap copies every generated id." },
    ],
    faqs: [
      { q: "What is a version 4 UUID?", a: "An identifier with 122 random bits. Collisions are so improbable that you can safely generate them independently on many machines." },
      { q: "Are these safe as database keys?", a: "Yes, though sequential ids or UUIDv7 index better in large tables because v4 values are randomly distributed." },
      { q: "Is it the same as a GUID?", a: "Yes — GUID is Microsoft's name for the same 128-bit format." },
      { q: "Are they generated locally?", a: "Yes, using crypto.randomUUID in your browser." },
    ],
    related: ["password-generator", "hash-generator", "qr-code-generator", "json-formatter"],
  },
  {
    slug: "qr-code-generator",
    name: "QR Code Generator",
    headline: "QR Code Generator — free, no watermark, no expiry",
    category: "Generators",
    tagline: "URLs, text, WiFi and more",
    description:
      "Create a high-resolution QR code for a link, plain text, phone number or WiFi network. Download it as PNG or SVG — permanent, with no tracking redirect and no expiry.",
    engine: "generate",
    mode: "qr",
    inputs: ["URL", "Text", "WiFi"],
    outputs: ["PNG", "SVG"],
    color: "#14c8be",
    keywords: ["qr code generator", "free qr code", "url to qr code", "wifi qr code generator", "qr code png download"],
    steps: [
      { title: "Enter your content", body: "A URL, some text, or WiFi credentials." },
      { title: "Adjust size and colour", body: "Larger codes scan more reliably in print." },
      { title: "Download", body: "PNG for general use, SVG when it needs to scale for print." },
    ],
    faqs: [
      { q: "Will this QR code ever expire?", a: "No. The data is encoded directly in the image, so there is no redirect service that could go away or start charging." },
      { q: "Does it track scans?", a: "No. Free generators that offer analytics point the code at their own redirect — if that service dies, so does your code. This one encodes your URL directly." },
      { q: "What size should I print?", a: "At least 2×2cm for a short URL, and larger for longer data. Keep a quiet white margin around it." },
      { q: "Can I use it commercially?", a: "Yes — on packaging, menus, posters, anywhere. There is no watermark and no licence to buy." },
    ],
    related: ["password-generator", "uuid-generator", "url-encoder", "image-converter"],
  },
  {
    slug: "color-converter",
    name: "Color Converter",
    headline: "Color Converter — HEX, RGB, HSL and CSS",
    category: "Generators",
    tagline: "Convert between every CSS colour format",
    description:
      "Convert a colour between HEX, RGB, HSL and CSS syntax, with a live preview, a generated tint and shade scale, and a WCAG contrast check against black and white.",
    engine: "generate",
    mode: "color",
    inputs: ["HEX", "RGB", "HSL"],
    outputs: ["HEX", "RGB", "HSL", "Scale"],
    color: "#f59e0b",
    keywords: ["color converter", "hex to rgb", "rgb to hex", "hsl converter", "color picker online"],
    steps: [
      { title: "Pick or paste a colour", body: "Use the swatch picker, or type a HEX, RGB or HSL value." },
      { title: "Read every format", body: "All notations update together, ready to copy." },
      { title: "Check contrast", body: "The WCAG ratio against black and white tells you which text colour is readable." },
    ],
    faqs: [
      { q: "What contrast ratio do I need?", a: "WCAG AA requires 4.5:1 for body text and 3:1 for large text. AAA asks for 7:1." },
      { q: "When is HSL more useful than HEX?", a: "When building a palette. Holding hue and saturation while varying lightness gives a coherent set of tints and shades." },
      { q: "What do the tints and shades do?", a: "They generate a ready-made scale around your colour, which is how design systems build 50–900 palettes." },
      { q: "Is any data sent to a server?", a: "No, all conversion happens in your browser." },
    ],
    related: ["qr-code-generator", "image-converter", "favicon-generator", "password-generator"],
  },
  {
    slug: "lorem-ipsum-generator",
    name: "Lorem Ipsum Generator",
    headline: "Lorem Ipsum Generator — placeholder text for mockups",
    category: "Generators",
    tagline: "Paragraphs, sentences or words",
    description:
      "Generate classic lorem ipsum placeholder text by paragraph, sentence or word count — for wireframes, templates and design mockups.",
    engine: "generate",
    mode: "lorem",
    inputs: ["Count", "Unit"],
    outputs: ["Text"],
    color: "#8f74ff",
    keywords: ["lorem ipsum generator", "placeholder text", "dummy text generator", "filler text for design"],
    steps: [
      { title: "Choose a unit", body: "Paragraphs, sentences or words." },
      { title: "Set the amount", body: "However much your layout needs." },
      { title: "Copy", body: "Paste it straight into your design or template." },
    ],
    faqs: [
      { q: "Why use lorem ipsum at all?", a: "Nonsense text stops reviewers reading the copy and lets them judge the layout, spacing and hierarchy instead." },
      { q: "Where does it come from?", a: "A scrambled passage of Cicero's De Finibus Bonorum et Malorum, in use by typesetters since the 1500s." },
      { q: "Should real copy replace it?", a: "Always, before launch. Real text is a different length and rhythm, and layouts that only work with lorem ipsum tend to break." },
      { q: "Is it generated locally?", a: "Yes, entirely in your browser." },
    ],
    related: ["word-counter", "case-converter", "slug-generator", "json-formatter"],
  },

  /* ------------------------------- link based media ------------------------------- */
  {
    slug: "video-to-mp3",
    provider: "rapidapi-downloader",
    name: "Video to MP3",
    headline: "Video to MP3 Converter — extract audio from any link",
    category: "Audio",
    tagline: "Pull the audio out of any supported video",
    description:
      "Paste a video link from YouTube, Facebook, TikTok, Instagram or any supported platform and download just the audio track as an MP3 — no video payload, no re-encoding.",
    engine: "link-audio",
    inputs: ["YouTube", "Facebook", "TikTok", "Instagram", "X", "SoundCloud", "+8 more"],
    outputs: ["MP3", "M4A"],
    color: "#14c8be",
    keywords: ["video to mp3", "youtube to mp3", "convert video to audio", "extract audio from video", "mp3 converter"],
    steps: [
      { title: "Copy the video link", body: "Use the Share or Copy link button in any supported app." },
      { title: "Paste it here", body: "The platform is detected automatically the moment you paste." },
      { title: "Pick the audio track", body: "Only audio formats are listed, at the highest bitrate the source published." },
      { title: "Download", body: "The MP3 saves straight to your device." },
    ],
    faqs: [
      {
        q: "What bitrate will I get?",
        a: "The best the source provides — usually 128kbps or 320kbps. No tool can add detail that was never in the upload.",
      },
      {
        q: "Is the audio re-encoded?",
        a: "No. The original audio stream is passed through untouched, so there is no second round of compression loss.",
      },
      {
        q: "Which platforms work?",
        a: "All fourteen the downloader supports, including YouTube, Facebook, Instagram, TikTok, X and SoundCloud.",
      },
      {
        q: "Can I convert a file from my computer?",
        a: "Not yet — this tool works from links. Local audio and video conversion needs a heavier engine, and it is on the roadmap.",
      },
    ],
    related: ["audio-downloader", "video-downloader", "image-converter"],
  },
  {
    slug: "audio-downloader",
    provider: "rapidapi-downloader",
    name: "Audio Downloader",
    headline: "Audio Downloader — save tracks and podcasts",
    category: "Audio",
    tagline: "SoundCloud, podcasts and background sound",
    description:
      "Download the audio behind any supported link — SoundCloud tracks, podcast episodes, TikTok sounds and the background music from reels.",
    engine: "link-audio",
    inputs: ["SoundCloud", "YouTube", "TikTok", "Instagram", "Facebook", "+9 more"],
    outputs: ["MP3", "M4A"],
    color: "#FF5500",
    keywords: ["audio downloader", "soundcloud downloader", "download podcast mp3", "tiktok sound download"],
    steps: [
      { title: "Copy the track link", body: "From SoundCloud, a podcast page or any supported platform." },
      { title: "Paste and resolve", body: "Audio-only formats are filtered out for you." },
      { title: "Download", body: "Artwork and metadata are preserved where the source provides them." },
    ],
    faqs: [
      {
        q: "Do private tracks work?",
        a: "No — only publicly streamable content can be processed.",
      },
      {
        q: "Can I download a whole playlist?",
        a: "Playlist links return each track separately so you can pick what you want. Queued batch downloads are on the roadmap.",
      },
      {
        q: "Is it legal to keep these files?",
        a: "For personal offline listening, generally yes. Redistributing or monetising someone else's audio is a copyright matter and your responsibility.",
      },
    ],
    related: ["video-to-mp3", "video-downloader"],
  },
  {
    slug: "video-downloader",
    provider: "rapidapi-downloader",
    name: "Video Downloader",
    headline: "Video Downloader — every platform, one box",
    category: "Video",
    tagline: "All 14 platforms in a single tool",
    description:
      "The universal downloader: paste a link from any supported platform and pick from every video quality the source published, up to 4K, with no watermark.",
    engine: "link-video",
    inputs: ["YouTube", "Instagram", "Facebook", "TikTok", "X", "+9 more"],
    outputs: ["MP4", "WEBM", "MP3"],
    color: "#7048f0",
    keywords: ["video downloader", "download video online", "4k video downloader", "all in one video downloader"],
    steps: [
      { title: "Copy any video link", body: "From any of the fourteen supported platforms." },
      { title: "Paste it in", body: "Detection is automatic; you never pick the platform yourself." },
      { title: "Choose a quality", body: "From 4K down to 360p, plus audio-only options." },
      { title: "Save", body: "The file downloads with a clean, readable filename." },
    ],
    faqs: [
      {
        q: "How is this different from the home page?",
        a: "It is the same engine — this page simply exists as a direct entry point for people searching for a general video downloader rather than a specific platform.",
      },
      {
        q: "Is 4K really available?",
        a: "When the uploader published a 4K render, yes. If it is missing from the list, the source never had it.",
      },
      {
        q: "Are watermarks removed?",
        a: "On platforms that publish a clean render — TikTok being the notable one — you get the version without the watermark.",
      },
    ],
    related: ["video-to-mp3", "audio-downloader", "image-converter"],
  },

  /* --------------------------------- calculators --------------------------------- */
  {
    slug: "salary-tax-calculator-pakistan",
    name: "Salary Tax Calculator Pakistan",
    headline: "Salary Tax Calculator Pakistan 2026-27 — FBR income tax on your salary",
    title: "Salary Tax Calculator Pakistan 2026-27 (FBR)",
    category: "Calculators",
    tagline: "Monthly and yearly income tax on your salary",
    description:
      "Work out the income tax on your salary for tax year 2026-27 (July 2026 to June 2027). Enter your monthly or yearly salary and see your tax, take-home pay and the slab you fall in — instantly, with no signup.",
    engine: "calc",
    mode: "income-tax-pk",
    inputs: ["Monthly salary", "Yearly salary"],
    outputs: ["Tax", "Take-home"],
    color: "#16a34a",
    keywords: [
      "salary tax calculator pakistan",
      "income tax calculator pakistan 2026-27",
      "fbr tax calculator",
      "tax on salary pakistan",
      "salary tax slabs 2026-27",
      "take home salary calculator pakistan",
    ],
    steps: [
      { title: "Enter your salary", body: "Type your gross salary and choose whether it is the monthly or yearly figure." },
      { title: "See your tax", body: "The calculator applies the 2026-27 salaried slabs and shows monthly and yearly tax." },
      { title: "Check take-home pay", body: "Your net salary after tax appears next to the tax amount, along with your effective rate." },
      { title: "Understand your slab", body: "The breakdown shows which slab you fall in and how the tax is built up." },
    ],
    faqs: [
      {
        q: "Which tax slabs does this calculator use?",
        a: "The salaried-individual slabs for tax year 2026-27: 0% up to Rs 600,000 a year, then 1%, 11%, 20%, 25%, 29%, 32% and 35% across eight brackets, with the top rate starting above Rs 7,000,000. Always confirm against the latest FBR notification, because budgets can change slabs mid-year.",
      },
      {
        q: "Is the tax worked out on my monthly or yearly salary?",
        a: "Income tax in Pakistan is calculated on your yearly taxable income. If you enter a monthly salary, the calculator multiplies it by 12, works out the yearly tax, then divides it back into a monthly deduction.",
      },
      {
        q: "Does it include allowances, bonuses or deductions?",
        a: "It uses the single salary figure you enter. If you receive a taxable bonus, add it to your yearly salary. Exemptions, tax credits (such as for donations or pension contributions) and any surcharge are not included — your employer's or the FBR's figure is final.",
      },
      {
        q: "Is this an official FBR calculator?",
        a: "No. It is a free estimate based on the published slabs. For filing your return or resolving a dispute, use the FBR IRIS portal or ask a tax adviser.",
      },
    ],
    related: ["zakat-calculator", "loan-emi-calculator", "percentage-calculator", "age-calculator"],
  },
  {
    slug: "zakat-calculator",
    name: "Zakat Calculator",
    headline: "Zakat Calculator — work out your Zakat on cash, gold and savings",
    title: "Zakat Calculator — cash, gold & savings",
    category: "Calculators",
    tagline: "2.5% Zakat on wealth above the Nisab",
    description:
      "Calculate the Zakat you owe in a minute. Add your cash, bank balance, gold, silver, business stock and money owed to you, subtract what you owe, and see whether you are above the Nisab and how much Zakat to pay.",
    engine: "calc",
    mode: "zakat",
    inputs: ["Cash", "Gold", "Silver", "Savings"],
    outputs: ["Zakat due"],
    color: "#059669",
    keywords: [
      "zakat calculator",
      "zakat calculator pakistan",
      "how to calculate zakat",
      "nisab amount 2026",
      "zakat on gold calculator",
      "zakat on savings",
    ],
    steps: [
      { title: "Set today's Nisab", body: "Enter the current price of silver (or gold) per tola. The Nisab is worked out from it automatically." },
      { title: "Add your assets", body: "Fill in cash, bank balances, the value of gold and silver, business stock, investments and money owed to you." },
      { title: "Subtract liabilities", body: "Enter debts and bills that are due now — they reduce your zakatable wealth." },
      { title: "See your Zakat", body: "If your net wealth is at or above the Nisab, your Zakat is 2.5% of it." },
    ],
    faqs: [
      {
        q: "What is the Nisab?",
        a: "The Nisab is the minimum wealth a Muslim must hold for a full lunar year before Zakat becomes due. It equals 52.5 tola (612.36 g) of silver or 7.5 tola (87.48 g) of gold. Many scholars recommend the silver Nisab because it is lower, so more people give.",
      },
      {
        q: "How much Zakat do I pay?",
        a: "2.5% (one fortieth) of your total zakatable wealth, once your wealth has stayed above the Nisab for a full lunar year.",
      },
      {
        q: "Is Zakat due on my house or car?",
        a: "No. Zakat is not due on the home you live in, your personal car, household items or clothes. It is due on cash, savings, gold, silver, trade goods and investments.",
      },
      {
        q: "Where do I get the gold and silver price?",
        a: "Use today's rate per tola from your local sarafa (jewellery) market or a trusted news source. Prices change daily, so update them when you calculate.",
      },
      {
        q: "Is this a religious ruling?",
        a: "No. It is a calculator that follows the common method. For special cases — business partnerships, pension funds, loans given — please consult a qualified scholar.",
      },
    ],
    related: ["salary-tax-calculator-pakistan", "percentage-calculator", "loan-emi-calculator", "unit-converter"],
  },
  {
    slug: "loan-emi-calculator",
    name: "Loan EMI Calculator",
    headline: "Loan EMI Calculator — monthly installment for car, home and personal loans",
    title: "Loan EMI Calculator — car, home & personal loans",
    category: "Calculators",
    tagline: "Monthly installment, total interest and payoff",
    description:
      "Find the monthly installment (EMI) on any loan. Enter the loan amount, yearly interest rate and loan period to see your EMI, the total interest you will pay and the full cost of the loan — for car, home, bike or personal financing.",
    engine: "calc",
    mode: "emi",
    inputs: ["Amount", "Rate", "Tenure"],
    outputs: ["EMI", "Interest"],
    color: "#2563eb",
    keywords: [
      "emi calculator",
      "loan calculator",
      "car loan calculator pakistan",
      "home loan emi calculator",
      "monthly installment calculator",
      "personal loan calculator",
    ],
    steps: [
      { title: "Enter the loan amount", body: "The amount you are borrowing, after any down payment." },
      { title: "Add the interest rate", body: "The yearly rate the bank quotes, for example 18%." },
      { title: "Choose the period", body: "Set the loan length in years or months." },
      { title: "Read your installment", body: "See the monthly EMI, total interest and a year-by-year payoff table." },
    ],
    faqs: [
      {
        q: "How is EMI calculated?",
        a: "EMI = P × r × (1 + r)^n ÷ ((1 + r)^n − 1), where P is the loan amount, r is the monthly interest rate (yearly rate ÷ 12 ÷ 100) and n is the number of months.",
      },
      {
        q: "Does it work for Islamic (Ijarah / Diminishing Musharakah) financing?",
        a: "The maths of a fixed monthly rental is similar, so it gives a useful estimate. The bank's own schedule — including insurance, processing fees and rate resets — is the final figure.",
      },
      {
        q: "Why is my bank's installment different?",
        a: "Banks add insurance, processing fees or tax, and many car and home loans use a variable rate linked to KIBOR, which changes the installment over time.",
      },
    ],
    related: ["salary-tax-calculator-pakistan", "percentage-calculator", "zakat-calculator", "unit-converter"],
  },
  {
    slug: "cgpa-calculator",
    name: "GPA & CGPA Calculator",
    headline: "GPA & CGPA Calculator — semester GPA and cumulative CGPA on a 4.0 scale",
    title: "GPA & CGPA Calculator (4.0 scale)",
    category: "Calculators",
    tagline: "Semester GPA and overall CGPA (4.0 scale)",
    description:
      "Calculate your semester GPA from course grades and credit hours, then your cumulative CGPA across all semesters. Uses the 4.0 grading scale followed by most universities in Pakistan.",
    engine: "calc",
    mode: "cgpa",
    inputs: ["Grades", "Credit hours"],
    outputs: ["GPA", "CGPA"],
    color: "#7c3aed",
    keywords: [
      "cgpa calculator",
      "gpa calculator",
      "semester gpa calculator",
      "cgpa calculator pakistan",
      "hec cgpa calculator",
      "how to calculate cgpa",
    ],
    steps: [
      { title: "Add your courses", body: "Enter each course's credit hours and pick your grade (or type the grade points)." },
      { title: "Get your GPA", body: "Your semester GPA updates as you type." },
      { title: "Add past semesters", body: "Enter the GPA and credit hours of earlier semesters." },
      { title: "See your CGPA", body: "Your cumulative CGPA across every semester appears instantly." },
    ],
    faqs: [
      {
        q: "How is GPA calculated?",
        a: "Multiply each course's grade points by its credit hours, add them up, then divide by the total credit hours. CGPA does the same across all semesters.",
      },
      {
        q: "Which grade points does it use?",
        a: "A common 4.0 scale: A = 4.0, A− = 3.67, B+ = 3.33, B = 3.0, B− = 2.67, C+ = 2.33, C = 2.0, C− = 1.67, D+ = 1.33, D = 1.0, F = 0. Universities differ slightly, so you can also type the exact grade points from your transcript.",
      },
      {
        q: "Can I convert CGPA to percentage?",
        a: "Each university publishes its own conversion, so there is no single formula. Check your university's rules or transcript for the official method.",
      },
    ],
    related: ["percentage-calculator", "age-calculator", "word-counter", "unit-converter"],
  },
  {
    slug: "age-calculator",
    name: "Age Calculator",
    headline: "Age Calculator — exact age in years, months and days",
    category: "Calculators",
    tagline: "Exact age and next birthday countdown",
    description:
      "Find your exact age in years, months and days from your date of birth, plus the total days you have lived and how long until your next birthday. Check age eligibility for jobs, admissions and forms on any date.",
    engine: "calc",
    mode: "age",
    inputs: ["Date of birth"],
    outputs: ["Exact age"],
    color: "#db2777",
    keywords: [
      "age calculator",
      "calculate age from date of birth",
      "age calculator for job",
      "exact age calculator",
      "how old am i",
      "date of birth calculator",
    ],
    steps: [
      { title: "Enter your date of birth", body: "Pick the day you were born." },
      { title: "Choose the 'age on' date", body: "Leave it as today, or set the closing date of a job ad or admission form." },
      { title: "Read your exact age", body: "Years, months and days — plus total months, weeks and days." },
    ],
    faqs: [
      {
        q: "How do I check age eligibility for a job?",
        a: "Set the 'age on' date to the closing date in the job advertisement. The calculator shows your exact age on that day so you can compare it with the upper and lower age limits.",
      },
      {
        q: "Does it handle leap years?",
        a: "Yes. It counts real calendar months and days, so leap years and months of different lengths are handled correctly.",
      },
    ],
    related: ["cgpa-calculator", "percentage-calculator", "bmi-calculator", "unit-converter"],
  },
  {
    slug: "percentage-calculator",
    name: "Percentage Calculator",
    headline: "Percentage Calculator — marks percentage, percent of a number and % change",
    title: "Percentage Calculator — marks, % of & % change",
    category: "Calculators",
    tagline: "Marks %, X% of Y, and percentage change",
    description:
      "Every everyday percentage sum in one place: your marks percentage, what X% of a number is, what percentage one number is of another, and the percentage increase or decrease between two values.",
    engine: "calc",
    mode: "percentage",
    inputs: ["Numbers", "Marks"],
    outputs: ["Percentage"],
    color: "#ea580c",
    keywords: [
      "percentage calculator",
      "marks percentage calculator",
      "percentage of marks",
      "percentage increase calculator",
      "discount percentage calculator",
      "how to calculate percentage",
    ],
    steps: [
      { title: "Pick a calculation", body: "Marks percentage, X% of Y, X as a % of Y, or percentage change." },
      { title: "Enter your numbers", body: "Results update instantly as you type." },
      { title: "Copy the answer", body: "Use the result for results cards, discounts, salary raises or price changes." },
    ],
    faqs: [
      {
        q: "How do I calculate marks percentage?",
        a: "Divide the marks you obtained by the total marks and multiply by 100. For example, 850 out of 1100 is (850 ÷ 1100) × 100 = 77.27%.",
      },
      {
        q: "How do I calculate a discount?",
        a: "Use 'X% of Y' to find the discount amount (for example 20% of Rs 5,000 = Rs 1,000), then subtract it from the price.",
      },
    ],
    related: ["cgpa-calculator", "salary-tax-calculator-pakistan", "loan-emi-calculator", "unit-converter"],
  },
  {
    slug: "bmi-calculator",
    name: "BMI Calculator",
    headline: "BMI Calculator — check your Body Mass Index in kg and feet",
    title: "BMI Calculator — Body Mass Index in kg & feet",
    category: "Calculators",
    tagline: "Body Mass Index with healthy weight range",
    description:
      "Calculate your Body Mass Index from your weight and height in kilograms, centimetres or feet and inches. See your BMI category and the healthy weight range for your height.",
    engine: "calc",
    mode: "bmi",
    inputs: ["Weight", "Height"],
    outputs: ["BMI"],
    color: "#0891b2",
    keywords: ["bmi calculator", "bmi calculator kg feet", "body mass index calculator", "healthy weight calculator", "bmi chart"],
    steps: [
      { title: "Enter your weight", body: "In kilograms." },
      { title: "Enter your height", body: "In centimetres, or feet and inches." },
      { title: "See your BMI", body: "Your BMI, category and the healthy weight range for your height." },
    ],
    faqs: [
      {
        q: "What is a healthy BMI?",
        a: "For most adults, 18.5 to 24.9. Below 18.5 is underweight, 25 to 29.9 is overweight and 30 or above is obese. For South Asian adults, health risks can start at a lower BMI (around 23).",
      },
      {
        q: "Is BMI accurate for everyone?",
        a: "BMI is a quick screening number, not a diagnosis. It does not separate muscle from fat, and it is not meant for children, pregnant women or athletes. Talk to a doctor about your health.",
      },
    ],
    related: ["age-calculator", "unit-converter", "percentage-calculator", "cgpa-calculator"],
  },
  {
    slug: "unit-converter",
    name: "Unit Converter",
    headline: "Unit Converter — length, weight, temperature, area and more",
    title: "Unit Converter — length, weight, area & more",
    category: "Calculators",
    tagline: "Convert length, weight, temperature, area, volume and speed",
    description:
      "Convert between metric and imperial units instantly: length (km, miles, feet, inches), weight (kg, pounds, grams, tola), temperature (°C, °F, K), area (marla, kanal, square feet, acres), volume and speed.",
    engine: "calc",
    mode: "unit",
    inputs: ["Any unit"],
    outputs: ["Converted unit"],
    color: "#ca8a04",
    keywords: [
      "unit converter",
      "marla to square feet",
      "kanal to marla",
      "kg to pounds",
      "feet to cm",
      "celsius to fahrenheit",
      "tola to grams",
    ],
    steps: [
      { title: "Pick a category", body: "Length, weight, temperature, area, volume or speed." },
      { title: "Choose units", body: "Select the unit you have and the unit you need." },
      { title: "Type a value", body: "The converted value appears instantly, along with a quick reference table." },
    ],
    faqs: [
      {
        q: "How many square feet are in a marla?",
        a: "It depends on where the land is. Many housing societies use 1 marla = 225 square feet, while older revenue records often use 272.25 square feet. The converter offers both — check which one your property documents use.",
      },
      {
        q: "How many grams are in a tola?",
        a: "One tola is 11.6638 grams — the standard unit for gold and silver in Pakistan and India.",
      },
    ],
    related: ["percentage-calculator", "bmi-calculator", "zakat-calculator", "age-calculator"],
  },

  /* ------------------------------- QR & link generators ------------------------------- */
  {
    slug: "wifi-qr-code-generator",
    name: "WiFi QR Code Generator",
    headline: "WiFi QR Code Generator — let guests join your WiFi by scanning",
    title: "WiFi QR Code Generator — share WiFi by scan",
    category: "Generators",
    tagline: "Share your WiFi without typing the password",
    description:
      "Create a QR code that connects phones to your WiFi network in one scan — perfect for homes, offices, cafés and shops. Enter the network name and password, then print or share the code. Nothing is sent to a server.",
    engine: "generate",
    mode: "wifi-qr",
    inputs: ["WiFi name", "Password"],
    outputs: ["PNG", "SVG"],
    color: "#0ea5e9",
    keywords: ["wifi qr code generator", "wifi qr code", "share wifi qr", "wifi password qr code", "qr code for wifi"],
    steps: [
      { title: "Enter the network name", body: "Type your WiFi name (SSID) exactly as it appears on your phone." },
      { title: "Add the password and security", body: "Choose WPA/WPA2 for most routers and type the password." },
      { title: "Download and print", body: "Save the QR code as PNG or SVG and stick it where guests can scan it." },
    ],
    faqs: [
      {
        q: "Which phones can scan a WiFi QR code?",
        a: "Almost all: iPhones with iOS 11 or later and Android phones with Android 10 or later connect straight from the camera app. Older phones can use a QR scanner app.",
      },
      {
        q: "Is my WiFi password safe?",
        a: "The QR code is generated entirely in your browser — the password never leaves your device. Anyone who scans the printed code can join, so only display it where you would share the password anyway.",
      },
    ],
    related: ["qr-code-generator", "whatsapp-link-generator", "vcard-qr-code-generator", "password-generator"],
  },
  {
    slug: "whatsapp-link-generator",
    name: "WhatsApp Link Generator",
    headline: "WhatsApp Link Generator — create a wa.me link and QR code",
    title: "WhatsApp Link Generator — wa.me link & QR",
    category: "Generators",
    tagline: "Click-to-chat link and QR for your number",
    description:
      "Create a WhatsApp click-to-chat link (wa.me) with an optional pre-filled message, plus a QR code customers can scan. Ideal for businesses, shops, Instagram bios and visiting cards.",
    engine: "generate",
    mode: "whatsapp",
    inputs: ["Phone number", "Message"],
    outputs: ["Link", "QR code"],
    color: "#22c55e",
    keywords: [
      "whatsapp link generator",
      "wa.me link",
      "whatsapp qr code",
      "click to chat whatsapp",
      "whatsapp business link",
    ],
    steps: [
      { title: "Enter your number", body: "Include the country code, for example 92 for Pakistan, without the leading zero." },
      { title: "Add a message (optional)", body: "Pre-fill the first message customers send, such as 'Hi, I want to order…'." },
      { title: "Copy or download", body: "Copy the wa.me link or download the QR code for print." },
    ],
    faqs: [
      {
        q: "How do I write a Pakistani number?",
        a: "Drop the leading zero and add 92. For example, 0300 1234567 becomes 923001234567.",
      },
      {
        q: "Does the other person need to save my number?",
        a: "No. The link opens a chat with your number directly, even if they have not saved it.",
      },
    ],
    related: ["qr-code-generator", "wifi-qr-code-generator", "vcard-qr-code-generator", "url-encoder"],
  },
  {
    slug: "vcard-qr-code-generator",
    name: "vCard QR Code Generator",
    headline: "vCard QR Code Generator — digital business card QR",
    category: "Generators",
    tagline: "Save your contact to any phone in one scan",
    description:
      "Turn your contact details into a QR code that saves your name, phone, email, company and website straight into a phone's contacts. Print it on business cards, CVs or your shop counter.",
    engine: "generate",
    mode: "vcard-qr",
    inputs: ["Name", "Phone", "Email"],
    outputs: ["PNG", "SVG"],
    color: "#6366f1",
    keywords: ["vcard qr code generator", "business card qr code", "contact qr code", "digital business card", "qr code for contact"],
    steps: [
      { title: "Fill in your details", body: "Name, phone, email, company, job title and website — only name is required." },
      { title: "Preview the QR code", body: "It updates as you type." },
      { title: "Download and print", body: "Save as PNG for sharing or SVG for sharp printing on cards." },
    ],
    faqs: [
      {
        q: "What happens when someone scans it?",
        a: "Their phone shows a 'Create contact' card with your details filled in — they just tap Save.",
      },
      {
        q: "Why is the QR code getting dense?",
        a: "Every detail you add makes the code larger. Keep only what people need, and print it at least 2.5 cm wide.",
      },
    ],
    related: ["qr-code-generator", "whatsapp-link-generator", "wifi-qr-code-generator", "image-resizer"],
  },

  /* ------------------------------------ PDF ------------------------------------ */
  {
    slug: "add-page-numbers-to-pdf",
    name: "Add Page Numbers to PDF",
    headline: "Add Page Numbers to PDF — free, in your browser",
    category: "PDF",
    tagline: "Number the pages of any PDF",
    description:
      "Add page numbers to a PDF in seconds. Choose the position, style (1, Page 1, 1 of 10) and starting number — for assignments, theses, reports and contracts. The file never leaves your device.",
    engine: "pdf",
    mode: "page-numbers",
    accept: "application/pdf",
    inputs: ["PDF"],
    outputs: ["PDF"],
    color: "#e11d48",
    keywords: ["add page numbers to pdf", "pdf page numbers", "number pdf pages", "insert page numbers pdf free"],
    steps: [
      { title: "Add your PDF", body: "Drop the document onto the panel." },
      { title: "Pick the style", body: "Choose where the numbers go, the format and the starting number." },
      { title: "Download", body: "Your numbered PDF is created locally and downloads straight away." },
    ],
    faqs: [
      {
        q: "Can I start numbering from a page other than 1?",
        a: "Yes — set 'Start at' to any number, for example 3 if your cover and contents pages come first.",
      },
      {
        q: "Is my document uploaded?",
        a: "No. The numbering is done in your browser with pdf-lib, so the PDF never leaves your device.",
      },
    ],
    related: ["merge-pdf", "split-pdf", "rotate-pdf", "image-to-pdf"],
  },
  /* ------------------------------ daily life & money ------------------------------ */
  {
    slug: "currency-converter",
    name: "Currency Converter",
    headline: "Currency Converter — live USD, AED, SAR, GBP to PKR rates",
    title: "Currency Converter — USD, AED, SAR to PKR",
    category: "Calculators",
    tagline: "Convert 160+ currencies with daily rates",
    description:
      "Convert dollars, dirhams, riyals, pounds, euros and 160+ other currencies to Pakistani rupees and back. Rates update every day, and a quick table shows your amount in the currencies people send home most.",
    engine: "calc",
    mode: "currency",
    provider: "exchange-rates",
    inputs: ["Amount", "USD", "AED", "SAR", "GBP", "EUR"],
    outputs: ["PKR", "Any currency"],
    color: "#0ea5e9",
    keywords: [
      "currency converter",
      "dollar to pkr",
      "usd to pkr today",
      "aed to pkr",
      "sar to pkr",
      "pound to pkr",
      "euro to pkr",
      "dirham rate in pakistan today",
      "riyal rate today",
    ],
    steps: [
      { title: "Enter the amount", body: "Type how much you want to convert. Commas are fine." },
      { title: "Pick the currencies", body: "Choose the currency you have and the one you want. Use ⇄ to swap them." },
      { title: "Read the result", body: "See the converted amount, the exact rate, and a table of the same amount in other popular currencies." },
    ],
    faqs: [
      {
        q: "How often are the rates updated?",
        a: "Once a day. They are mid-market reference rates from Exchange Rate API, which is what most converters show. Banks, exchange companies and money-transfer apps add their own margin, so the rate you actually get will be a little lower.",
      },
      {
        q: "Is this the open market or interbank rate in Pakistan?",
        a: "It is an international mid-market rate, closest to the interbank rate. The open-market rate at exchange companies can differ by a few rupees, especially when the rupee is moving quickly.",
      },
      {
        q: "Can I use it for remittances from Saudi Arabia, the UAE or the UK?",
        a: "Yes — choose SAR, AED or GBP as the 'From' currency and PKR as 'To'. Use the result as a guide, then compare it with what your bank or transfer app offers.",
      },
      {
        q: "Is it free?",
        a: "Completely free, with no signup and no limit on how many conversions you do.",
      },
    ],
    related: ["salary-tax-calculator-pakistan", "zakat-calculator", "loan-emi-calculator", "percentage-calculator"],
  },
  {
    slug: "prayer-times",
    name: "Prayer Times",
    headline: "Prayer Times Today — Namaz timings for Karachi, Lahore, Islamabad & worldwide",
    title: "Prayer Times Today — Namaz Timings Pakistan",
    category: "Calculators",
    tagline: "Today's Fajr, Dhuhr, Asr, Maghrib and Isha",
    description:
      "Accurate namaz timings for today in Karachi, Lahore, Islamabad and every major Pakistani city, plus the Gulf, UK, Europe and North America. Hanafi or Shafi Asr, a countdown to the next prayer, and the Qibla direction — all calculated on your device.",
    engine: "calc",
    mode: "prayer",
    inputs: ["City", "Your location"],
    outputs: ["Prayer times", "Qibla"],
    color: "#059669",
    keywords: [
      "prayer times",
      "namaz time today",
      "prayer times karachi",
      "prayer times lahore",
      "prayer times islamabad",
      "fajr time today",
      "maghrib time today",
      "namaz timing",
      "salah times",
    ],
    steps: [
      { title: "Choose your city", body: "Pick from the list or tap 'Use my location' for exact times where you are." },
      { title: "Check the method", body: "Pakistan defaults to the Karachi method with Hanafi Asr. Change either to match your local mosque." },
      { title: "See today's times", body: "All five prayers and sunrise are shown, with a live countdown to the next one." },
    ],
    faqs: [
      {
        q: "How are the prayer times calculated?",
        a: "Astronomically, from the sun's position for your city's coordinates and today's date, using the same standard methods mosques use (University of Islamic Sciences Karachi, Umm al-Qura, Muslim World League and others). The calculation runs on your device, so it also works offline once the page has loaded.",
      },
      {
        q: "Why is my mosque's time a few minutes different?",
        a: "Many mosques add a few minutes of caution (ihtiyat) or use a slightly different angle for Fajr and Isha. If your local timetable is consistently different, try another calculation method.",
      },
      {
        q: "What is the difference between Hanafi and Shafi Asr?",
        a: "Hanafi Asr begins when an object's shadow is twice its length (plus its noon shadow); Shafi, Maliki and Hanbali Asr begin at once its length. Hanafi Asr is therefore later. Most mosques in Pakistan follow Hanafi timing.",
      },
      {
        q: "Is my location stored?",
        a: "No. If you use 'Use my location', your coordinates stay in your browser to calculate the times and are never sent to our server.",
      },
    ],
    related: ["qibla-direction", "zakat-calculator", "age-calculator", "currency-converter"],
  },
  {
    slug: "qibla-direction",
    name: "Qibla Direction Finder",
    headline: "Qibla Direction Finder — find the Qibla from anywhere with a compass",
    title: "Qibla Direction Finder with Compass",
    category: "Calculators",
    tagline: "Exact Qibla bearing from your location",
    description:
      "Find the Qibla direction from your city or exact location. See the bearing in degrees from north, and on a phone use the live compass to turn until the arrow points to the Kaaba in Makkah.",
    engine: "calc",
    mode: "qibla",
    inputs: ["City", "Your location"],
    outputs: ["Bearing", "Compass"],
    color: "#047857",
    keywords: ["qibla direction", "qibla finder", "qibla compass", "qibla direction from my location", "kaaba direction", "qibla direction pakistan"],
    steps: [
      { title: "Set your location", body: "Pick your city, or tap 'Use my location' for the most accurate bearing." },
      { title: "Read the bearing", body: "The Qibla is shown in degrees clockwise from true north, with the compass point." },
      { title: "Use the live compass", body: "On a phone, turn on the compass, hold it flat and rotate until the Kaaba marker points straight up." },
    ],
    faqs: [
      {
        q: "How accurate is the Qibla direction?",
        a: "The bearing is calculated with the great-circle formula from your coordinates to the Kaaba, which is exact. The live compass depends on your phone's sensor — keep it away from metal and magnets, and move it in a figure-eight to calibrate if the arrow drifts.",
      },
      {
        q: "What is the Qibla direction from Pakistan?",
        a: "Roughly west, slightly south: about 268° from north in Karachi, 260° in Lahore and 256° in Islamabad. Choose your city for the exact figure.",
      },
      {
        q: "Why does the live compass not work on my laptop?",
        a: "Most laptops and desktops have no compass sensor. Use the degree bearing with a phone compass app, or open this page on your phone.",
      },
    ],
    related: ["prayer-times", "zakat-calculator", "unit-converter"],
  },

  /* ------------------------------------ photos ------------------------------------ */
  {
    slug: "passport-photo-maker",
    name: "Passport Photo Maker",
    headline: "Passport Photo Maker — Pakistan passport, CNIC & visa photos online",
    title: "Passport Photo Maker — Pakistan, CNIC & Visa",
    category: "Image",
    tagline: "Print-ready 35×45 mm, 2×2 in and visa photos",
    description:
      "Make passport-size photos at home for your Pakistani passport, NADRA CNIC, UK or Schengen visa, US visa or Canada passport. Crop to the exact size, set a white or light background, and download a single photo or a print sheet for 4×6 photo paper or A4.",
    engine: "photo",
    mode: "passport-photo",
    accept: "image/*",
    inputs: ["JPG", "PNG", "WEBP", "HEIC*"],
    outputs: ["JPG", "Print sheet", "PDF"],
    color: "#2563eb",
    keywords: [
      "passport photo maker",
      "passport size photo online",
      "passport size photo pakistan",
      "cnic photo size",
      "nadra photo",
      "35x45 photo",
      "2x2 photo maker",
      "visa photo maker",
      "passport photo print sheet 4x6",
    ],
    steps: [
      { title: "Upload a photo", body: "Use a well-lit photo taken straight on, against a plain wall." },
      { title: "Choose the size", body: "Pick Pakistan passport/CNIC, UK/Schengen, US or Canada — or enter a custom size in millimetres." },
      { title: "Frame your face", body: "Drag and zoom so your head fits the guide, and choose a background colour." },
      { title: "Download or print", body: "Save a single photo, or a print sheet with several copies to print on 4×6 photo paper or A4." },
    ],
    faqs: [
      {
        q: "What size is a Pakistani passport and CNIC photo?",
        a: "35 × 45 mm with a white or light background, your face centred and looking straight at the camera with a neutral expression. NADRA and the Directorate of Passports usually capture photos at the counter, but many visa and form applications still ask you to attach one.",
      },
      {
        q: "Can I print the photos myself?",
        a: "Yes. Download the 4×6 inch print sheet and print it at any photo shop or on a photo printer at 100% scale (no 'fit to page'), then cut along the gaps.",
      },
      {
        q: "Is my photo uploaded anywhere?",
        a: "No. Cropping and the print sheet are made entirely in your browser — your photo never leaves your device.",
      },
      {
        q: "Will my photo be accepted?",
        a: "The tool gets the size and layout right, but acceptance also depends on lighting, expression, glasses and background. Always check the latest rules of the office you are applying to.",
      },
    ],
    related: ["id-card-print", "print-photos", "remove-background", "image-resizer"],
  },

  /* ------------------------------------ PDF pages ------------------------------------ */
  {
    slug: "pdf-to-jpg",
    name: "PDF to JPG",
    headline: "PDF to JPG — convert PDF pages to JPG or PNG images free",
    title: "PDF to JPG — convert PDF pages to images",
    category: "PDF",
    tagline: "Turn every PDF page into an image",
    description:
      "Convert PDF pages to high-quality JPG or PNG images. Choose the resolution, pick which pages you need, and download them one by one or all together. Works offline in your browser — nothing is uploaded.",
    engine: "pdf-pages",
    mode: "pdf-to-image",
    accept: "application/pdf",
    inputs: ["PDF"],
    outputs: ["JPG", "PNG"],
    color: "#f97316",
    keywords: ["pdf to jpg", "pdf to image", "pdf to png", "convert pdf to jpg free", "pdf page to image", "save pdf as jpg"],
    steps: [
      { title: "Add your PDF", body: "Drop a PDF onto the panel or choose it from your device." },
      { title: "Choose format and quality", body: "Pick JPG for small files or PNG for sharp text, and a resolution from 1× to 3×." },
      { title: "Convert and download", body: "Every page becomes an image you can download individually or all at once." },
    ],
    faqs: [
      {
        q: "Which resolution should I choose?",
        a: "2× is a good default for sharing and printing on A4. Use 3× for very fine print or diagrams, and 1× for large documents on a phone, because high resolutions use a lot of memory.",
      },
      {
        q: "JPG or PNG?",
        a: "JPG makes much smaller files and suits photos and scanned pages. PNG keeps text and line drawings perfectly sharp but files are larger.",
      },
      {
        q: "Does it work with password-protected PDFs?",
        a: "Not yet — remove the password first in your PDF reader, then convert the unlocked copy.",
      },
      {
        q: "Is my PDF uploaded?",
        a: "No. Pages are rendered inside your browser with PDF.js, so the document never leaves your device.",
      },
    ],
    related: ["organize-pdf", "image-to-pdf", "split-pdf", "image-compressor"],
  },
  {
    slug: "organize-pdf",
    name: "Organize PDF",
    headline: "Organize PDF — reorder, delete and rotate PDF pages online",
    title: "Organize PDF — reorder, delete & rotate pages",
    category: "PDF",
    tagline: "Rearrange, remove or rotate pages visually",
    description:
      "See every page of your PDF as a thumbnail, then drag to reorder, delete pages you do not need and rotate sideways scans. Save a clean new PDF in one click — free, private and right in your browser.",
    engine: "pdf-pages",
    mode: "organize",
    accept: "application/pdf",
    inputs: ["PDF"],
    outputs: ["PDF"],
    color: "#db2777",
    keywords: ["organize pdf", "reorder pdf pages", "delete pages from pdf", "remove pages from pdf", "rearrange pdf pages", "rotate pdf page"],
    steps: [
      { title: "Add your PDF", body: "Drop the document and wait a moment for the page thumbnails." },
      { title: "Arrange the pages", body: "Drag pages into a new order, delete the ones you do not want and rotate any that are sideways." },
      { title: "Save the new PDF", body: "Download your reorganised document. The original file is never changed." },
    ],
    faqs: [
      {
        q: "Will the quality of my PDF change?",
        a: "No. Pages are copied as they are — text stays selectable and images are not recompressed. Only the order, rotation and which pages are included change.",
      },
      {
        q: "Can I undo a deleted page?",
        a: "Until you save, yes — your original file is untouched, so you can start again at any time.",
      },
      {
        q: "Is there a page limit?",
        a: "There is no fixed limit. Very large documents (hundreds of pages) just take longer to show thumbnails, especially on phones.",
      },
    ],
    related: ["merge-pdf", "split-pdf", "rotate-pdf", "pdf-to-jpg"],
  },

  /* ------------------------------------ documents ------------------------------------ */
  {
    slug: "invoice-generator",
    name: "Invoice Generator",
    headline: "Free Invoice Generator — create and download PDF invoices",
    title: "Free Invoice Generator — PDF invoices",
    category: "Generators",
    tagline: "Professional invoices in PKR, USD and more",
    description:
      "Create a professional invoice in minutes. Add your business details, client, line items, discount, sales tax and payment details, then download a clean PDF. Your details are saved in your browser for next time — no account needed.",
    engine: "doc",
    mode: "invoice",
    inputs: ["Business details", "Line items"],
    outputs: ["PDF invoice"],
    color: "#7c3aed",
    keywords: [
      "invoice generator",
      "free invoice maker",
      "invoice template pdf",
      "online invoice generator pakistan",
      "bill maker",
      "freelance invoice",
      "invoice format",
    ],
    steps: [
      { title: "Add your details", body: "Enter your business name, contact details and the client you are billing." },
      { title: "List the items", body: "Add products or services with quantity and price. Totals, discount and tax calculate automatically." },
      { title: "Download the PDF", body: "Check the live preview and download a print-ready invoice to send to your client." },
    ],
    faqs: [
      {
        q: "Is the invoice generator really free?",
        a: "Yes — unlimited invoices, no watermark and no signup.",
      },
      {
        q: "Can I add sales tax or GST?",
        a: "Yes. Enter the tax name and rate (for example Sales tax 16% or GST 18%) and it is applied after any discount.",
      },
      {
        q: "Where is my data saved?",
        a: "Only in your own browser, so your business details are filled in next time you visit on the same device. Nothing is sent to our server.",
      },
      {
        q: "Which currencies are supported?",
        a: "Pakistani rupees, US dollars, pounds, euros, dirhams, riyals and other common currencies — pick one from the currency list.",
      },
    ],
    related: ["cv-maker", "percentage-calculator", "currency-converter", "qr-code-generator"],
  },
  {
    slug: "cv-maker",
    name: "CV Maker",
    headline: "Free CV Maker — build an ATS-friendly resume and download PDF",
    title: "Free CV Maker — ATS-friendly resume PDF",
    category: "Generators",
    tagline: "A clean, ATS-friendly CV in minutes",
    description:
      "Build a professional CV that passes applicant tracking systems. Fill in your experience, education and skills, choose a clean layout and download a PDF ready for jobs in Pakistan, the Gulf or abroad. No signup, and your data stays in your browser.",
    engine: "doc",
    mode: "cv",
    inputs: ["Experience", "Education", "Skills"],
    outputs: ["PDF CV"],
    color: "#0d9488",
    keywords: ["cv maker", "resume builder", "free cv maker", "ats resume", "cv format pakistan", "cv template", "resume maker online free", "cv for job"],
    steps: [
      { title: "Fill in your details", body: "Add your contact details, a short summary, work experience, education and skills." },
      { title: "Choose a layout", body: "Pick a clean, single-column template that ATS software can read reliably." },
      { title: "Download your CV", body: "Preview it live and download a PDF ready to send or upload to job portals." },
    ],
    faqs: [
      {
        q: "What makes a CV ATS-friendly?",
        a: "Simple single-column layout, standard section headings (Experience, Education, Skills), real text instead of images, and keywords from the job description. Our templates follow all of these.",
      },
      {
        q: "Should I add a photo to my CV?",
        a: "For most private-sector jobs in Pakistan and the Gulf a photo is optional; for UK, US and European applications leave it out. Focus on clear, measurable achievements instead.",
      },
      {
        q: "How long should my CV be?",
        a: "One page for students and up to about five years of experience, two pages for more senior roles.",
      },
      {
        q: "Is my information saved?",
        a: "Only in your browser on this device, so you can come back and edit it. Nothing is uploaded to our server.",
      },
    ],
    related: ["passport-photo-maker", "invoice-generator", "word-counter", "image-to-pdf"],
  },
  /* ------------------------------------ print at home ------------------------------------ */
  {
    slug: "id-card-print",
    name: "ID Card Print (Front & Back)",
    headline: "Print ID Card Front and Back — CNIC & card size on A4",
    title: "Print ID Card Front & Back on A4 (CNIC size)",
    category: "Print",
    tagline: "Exact card size, both sides, any printer",
    description:
      "Print your CNIC, student card, office card or driving licence front and back at the exact card size (85.6 × 54 mm). Put both sides on one page like a photocopy, or print them back-to-back — with a double-sided printer or by flipping the sheet on a normal printer, with step-by-step help and a printer test.",
    engine: "print",
    mode: "id-card-print",
    accept: "image/*",
    inputs: ["Front photo", "Back photo"],
    outputs: ["Print", "PDF"],
    color: "#0f766e",
    keywords: [
      "print id card front and back",
      "cnic print size",
      "id card print on a4",
      "print both sides of id card on one page",
      "cnic copy print",
      "id card size 85.6 x 54",
      "double sided id card print",
      "how to print cnic back side",
    ],
    steps: [
      { title: "Add both sides", body: "Upload or take a photo of the front and the back, then fit each one inside the card frame." },
      { title: "Choose how to print", body: "Both sides on one page, a double-sided printer, or a normal printer where you flip the sheet yourself." },
      { title: "Pick copies and paper", body: "Choose A4 or Letter and how many cards per sheet; cutting guides are added for you." },
      { title: "Print or save", body: "Print at 100% scale, or download a PDF to print at a shop. You can also share it on WhatsApp." },
    ],
    faqs: [
      {
        q: "What size is a CNIC / ID card?",
        a: "Pakistani CNICs, bank cards and most ID cards use the international ID-1 size: 85.6 × 53.98 mm (3.37 × 2.13 in). The tool prints at exactly that size as long as you print at 100% scale (not “Fit to page”).",
      },
      {
        q: "My printer prints only one side. Can I still print the back behind the front?",
        a: "Yes. Choose “Single-sided printer”: print the front, put the same sheet back in the tray as shown, then print the back. The positions are mirrored so each back lands behind its front. Run the quick printer test once and the tool remembers how your printer feeds paper.",
      },
      {
        q: "Which option should I use for forms and applications?",
        a: "“Both sides on one page” — it gives you a photocopy-style page with the front and back of the card together, which is what most forms, banks and offices ask for.",
      },
      {
        q: "Are my ID card photos uploaded?",
        a: "No. Everything happens inside your browser and nothing is sent to our server — important for a document as sensitive as an ID card.",
      },
    ],
    related: ["passport-photo-maker", "print-photos", "crop-image", "image-to-pdf"],
  },
  {
    slug: "print-photos",
    name: "Print Photos at Home",
    headline: "Print Photos at Home — 4×6, 5×7 and wallet size on A4",
    title: "Print Photos on A4 — 4×6, 5×7, Wallet Sizes",
    category: "Print",
    tagline: "Fit many photos on one sheet at exact sizes",
    description:
      "Lay out your photos at real print sizes — wallet, 3R, 4×6, 5×7, passport or square — on A4, Letter or photo paper, as many per page as fit, with cutting guides. Print at home or save a print-ready PDF for the photo shop.",
    engine: "print",
    mode: "photo-print",
    accept: "image/*",
    inputs: ["JPG", "PNG", "WEBP", "HEIC*"],
    outputs: ["Print", "PDF"],
    color: "#c026d3",
    keywords: ["print photos at home", "print 4x6 photos on a4", "photo print size", "print multiple photos on one page", "wallet size photo print", "5x7 photo print"],
    steps: [
      { title: "Add your photos", body: "Pick one or more photos from your phone or computer." },
      { title: "Choose the print size", body: "Wallet, 4×6, 5×7, passport and more — fill or fit each photo." },
      { title: "Choose paper and copies", body: "A4, Letter or photo paper; the tool fits as many as possible and adds pages when needed." },
      { title: "Print or save PDF", body: "Print at 100% scale or take the PDF to a print shop." },
    ],
    faqs: [
      {
        q: "Why are my printed photos the wrong size?",
        a: "The print dialog is probably scaling the page. Choose Scale: 100% (or “Actual size”) and Margins: None. Saving the PDF and printing that usually avoids the problem completely.",
      },
      {
        q: "How many 4×6 photos fit on A4?",
        a: "Two 4×6 in (102 × 152 mm) photos fit on an A4 sheet; four 3.5×5 in photos, or nine wallet-size photos.",
      },
      {
        q: "Are my photos uploaded?",
        a: "No. The layout is made in your browser; your photos never leave your device.",
      },
    ],
    related: ["passport-photo-maker", "id-card-print", "image-resizer", "crop-image"],
  },

  /* ------------------------------------ smart image tools ------------------------------------ */
  {
    slug: "image-to-text",
    name: "Image to Text (OCR)",
    headline: "Image to Text — copy text from photos in English & Urdu",
    title: "Image to Text (OCR) — English & Urdu, Free",
    category: "Image",
    tagline: "Pull editable text out of any photo or screenshot",
    description:
      "Extract text from photos, screenshots and scanned documents in English, Urdu, Arabic and Hindi. Copy it, edit it or save it as a text file — the recognition runs in your browser, so your documents stay private.",
    engine: "image-ai",
    mode: "ocr",
    accept: "image/*",
    inputs: ["JPG", "PNG", "WEBP", "Screenshot"],
    outputs: ["Text", "TXT"],
    color: "#4f46e5",
    keywords: ["image to text", "ocr online free", "extract text from image", "urdu ocr", "photo to text", "screenshot to text", "copy text from picture"],
    steps: [
      { title: "Add an image", body: "Upload, paste a screenshot with Ctrl+V, or take a photo of a page." },
      { title: "Pick the language", body: "English, Urdu, Arabic, Hindi or English + Urdu together." },
      { title: "Copy the text", body: "Edit the result, copy it, save it as .txt or share it." },
    ],
    faqs: [
      { q: "Does it work with Urdu?", a: "Yes. Choose Urdu (or English + Urdu). Printed Urdu text is recognised well; handwriting and decorative Nastaliq fonts are less accurate." },
      { q: "How do I get the best result?", a: "Use a sharp, well-lit photo taken straight on, with the text filling most of the picture. Turn on “Improve contrast” for photos of paper." },
      { q: "Is my document uploaded?", a: "No. The text recognition runs inside your browser. The first run downloads the language data once; after that it is cached." },
    ],
    related: ["crop-image", "image-compressor", "word-counter", "pdf-to-jpg"],
  },
  {
    slug: "remove-background",
    name: "Background Remover",
    headline: "Remove Background from Photo — free, transparent PNG",
    title: "Remove Background from Photo — Free PNG",
    category: "Image",
    tagline: "Cut out people from photos in one click",
    description:
      "Remove the background from portraits, profile pictures and passport photos automatically. Download a transparent PNG or put the person on a white, blue or custom colour — free, with no signup and no upload.",
    engine: "image-ai",
    mode: "remove-bg",
    accept: "image/*",
    inputs: ["JPG", "PNG", "WEBP"],
    outputs: ["PNG", "JPG"],
    color: "#e11d48",
    keywords: ["remove background", "background remover", "remove bg free", "transparent background", "white background photo", "change photo background"],
    steps: [
      { title: "Add a photo", body: "Works best with photos of people — portraits, selfies and passport photos." },
      { title: "Wait a moment", body: "The AI model loads once, then cuts out the person in seconds on your device." },
      { title: "Pick a background", body: "Keep it transparent or choose white, blue, grey or any colour." },
      { title: "Download or share", body: "Save as PNG or JPG, or send it straight to WhatsApp." },
    ],
    faqs: [
      { q: "Does it work for products and objects?", a: "It is designed for people. Products, pets and objects may not be cut out cleanly." },
      { q: "Can I make a white background passport photo?", a: "Yes — remove the background, choose white, then open the Passport Photo Maker to crop it to the exact size." },
      { q: "Is my photo uploaded?", a: "No. The model runs in your browser; the photo never leaves your device." },
    ],
    related: ["passport-photo-maker", "crop-image", "image-compressor", "signature-maker"],
  },
  {
    slug: "signature-maker",
    name: "Signature Maker",
    headline: "Online Signature Maker — draw or type, transparent PNG",
    title: "Signature Maker — Draw or Type, Transparent PNG",
    category: "Image",
    tagline: "Create a clean digital signature",
    description:
      "Draw your signature with a finger or mouse, type it in a handwriting font, or clean up a photo of your signature on paper. Download a transparent PNG to place on documents, PDFs and forms.",
    engine: "image-ai",
    mode: "signature",
    inputs: ["Draw", "Type", "Photo"],
    outputs: ["PNG", "JPG"],
    color: "#1d4ed8",
    keywords: ["signature maker", "online signature", "digital signature png", "draw signature", "transparent signature", "e signature generator"],
    steps: [
      { title: "Draw, type or upload", body: "Sign with your finger or mouse, type your name, or upload a photo of your signature." },
      { title: "Adjust", body: "Choose ink colour and thickness; undo any stroke." },
      { title: "Download", body: "Save a transparent PNG trimmed to your signature." },
    ],
    faqs: [
      { q: "Is a drawn signature legally valid?", a: "Many organisations accept a signature image on forms, but legal rules differ by country and document. For contracts and government documents, check what the receiver accepts." },
      { q: "Is my signature stored?", a: "No. It is created in your browser and never sent to our server." },
    ],
    related: ["remove-background", "image-to-pdf", "cv-maker", "invoice-generator"],
  },
  {
    slug: "crop-image",
    name: "Crop Image",
    headline: "Crop Image Online — rotate, flip and resize for Instagram",
    title: "Crop, Rotate & Flip Image Online — Free",
    category: "Image",
    tagline: "Crop to 1:1, 4:5, 9:16 or any size",
    description:
      "Crop photos to the exact shape you need — square for Instagram, 4:5 portrait, 9:16 for Stories and Reels, 16:9 for YouTube — and rotate, flip or straighten them. Free, quick and private.",
    engine: "image-ai",
    mode: "crop-image",
    accept: "image/*",
    inputs: ["JPG", "PNG", "WEBP"],
    outputs: ["JPG", "PNG", "WEBP"],
    color: "#ea580c",
    keywords: ["crop image", "crop photo online", "rotate image", "flip image", "instagram crop", "crop picture free"],
    steps: [
      { title: "Add a photo", body: "Pick any image from your device." },
      { title: "Crop and straighten", body: "Drag the box or choose a preset shape; rotate or flip if needed." },
      { title: "Save", body: "Download as JPG, PNG or WEBP, or share it directly." },
    ],
    faqs: [
      { q: "Which size is best for Instagram?", a: "Square (1:1) or portrait (4:5) for feed posts and 9:16 for Stories and Reels." },
      { q: "Does cropping reduce quality?", a: "No — the cropped area keeps its original pixels. Choose PNG for no compression at all." },
    ],
    related: ["image-resizer", "image-compressor", "remove-background", "image-converter"],
  },

  /* ------------------------------------ dates, money, Islamic ------------------------------------ */
  {
    slug: "hijri-date-converter",
    name: "Hijri Date Converter",
    headline: "Hijri Date Converter — Islamic date today & English to Hijri",
    title: "Hijri Date Converter — Islamic Date Today",
    category: "Calculators",
    tagline: "Convert between Islamic and English dates",
    description:
      "Find today's Islamic (Hijri) date, or convert any English date to Hijri and back. Adjust for moon sighting in Pakistan and other countries where the Islamic month often starts a day later.",
    engine: "calc",
    mode: "hijri",
    inputs: ["English date", "Hijri date"],
    outputs: ["Islamic date", "English date"],
    color: "#15803d",
    keywords: ["hijri date today", "islamic date today", "hijri to gregorian", "english to islamic date converter", "chand ki tarikh", "islamic calendar 1448"],
    steps: [
      { title: "Choose a direction", body: "English → Islamic or Islamic → English." },
      { title: "Enter the date", body: "Pick a date or type the Hijri day, month and year." },
      { title: "Adjust for moon sighting", body: "Pakistan often starts the month one day after Saudi Arabia." },
    ],
    faqs: [
      { q: "Why does the Hijri date differ between countries?", a: "Islamic months start with the sighting of the new moon. Saudi Arabia follows the Umm al-Qura calendar, while Pakistan's Ruet-e-Hilal committee announces sightings locally — so dates can differ by a day." },
      { q: "What is the current Hijri year?", a: "The Islamic year 1448 AH runs from mid-2026 to mid-2027. Open the converter for today's exact date." },
    ],
    related: ["ramadan-timetable", "prayer-times", "qibla-direction", "age-calculator"],
  },
  {
    slug: "ramadan-timetable",
    name: "Ramadan Sehri & Iftar Timetable",
    headline: "Ramadan Timetable 2027 — Sehri & Iftar times for your city",
    title: "Ramadan Timetable 2027 — Sehri & Iftar Times",
    category: "Calculators",
    tagline: "Full 30-day Sehri and Iftar timetable",
    description:
      "Sehri and Iftar times for every day of Ramadan in Karachi, Lahore, Islamabad and cities worldwide. Choose your calculation method, add a caution margin for Sehri, then print or share the timetable.",
    engine: "calc",
    mode: "ramadan",
    inputs: ["City"],
    outputs: ["30-day timetable"],
    color: "#7c3aed",
    keywords: ["ramadan timetable 2027", "sehri time", "iftar time", "sehri iftar timetable karachi", "ramzan calendar 2027 lahore", "ramadan calendar pakistan"],
    steps: [
      { title: "Choose your city", body: "Pick from Pakistan, the Gulf, UK, Europe and more." },
      { title: "Set the method", body: "Karachi method for Pakistan; Umm al-Qura for Saudi Arabia and others." },
      { title: "Print or share", body: "Print the 30-day timetable or send it to family on WhatsApp." },
    ],
    faqs: [
      { q: "When does Ramadan 2027 start?", a: "Ramadan 1448 AH is expected to begin around 8 February 2027 in Saudi Arabia and about a day later in Pakistan, subject to the moon sighting announcement." },
      { q: "Is Sehri time the same as Fajr?", a: "Sehri ends when Fajr begins. Many timetables stop Sehri a few minutes earlier as a precaution — set that margin with the “Stop Sehri earlier” option." },
    ],
    related: ["prayer-times", "hijri-date-converter", "zakat-calculator", "qibla-direction"],
  },
  {
    slug: "date-calculator",
    name: "Date Calculator",
    headline: "Date Calculator — days between dates, add or subtract days",
    title: "Date Calculator — Days Between Dates",
    category: "Calculators",
    tagline: "Count days, weeks and working days",
    description:
      "Count the days, weeks, months and working days between two dates, or add and subtract days from any date — for deadlines, notice periods, pregnancy weeks, visa stays and countdowns.",
    engine: "calc",
    mode: "date-diff",
    inputs: ["Two dates", "Days to add"],
    outputs: ["Days", "Date"],
    color: "#0891b2",
    keywords: ["days between dates", "date calculator", "add days to date", "working days calculator", "how many days until", "date difference calculator"],
    steps: [
      { title: "Pick a calculation", body: "Days between two dates, or a date plus or minus some days." },
      { title: "Enter the dates", body: "Today is filled in for you." },
      { title: "Read the answer", body: "Total days, weeks, years-months-days and working days." },
    ],
    faqs: [
      { q: "Is the end date included?", a: "The count is the number of days from the start date to the end date (end date not included). Add 1 if you need to count both days." },
      { q: "Does it skip public holidays?", a: "Working days skip Saturdays and Sundays only; public holidays are not removed." },
    ],
    related: ["age-calculator", "hijri-date-converter", "percentage-calculator", "loan-emi-calculator"],
  },
  {
    slug: "discount-calculator",
    name: "Discount & GST Calculator",
    headline: "Discount Calculator — sale price, savings and GST",
    title: "Discount Calculator with GST / Sales Tax",
    category: "Calculators",
    tagline: "Sale price after discount and tax",
    description:
      "Work out the sale price after a percentage discount, stack an extra discount, and add or remove GST / sales tax. See exactly how much you save before you buy.",
    engine: "calc",
    mode: "discount",
    inputs: ["Price", "Discount %", "Tax %"],
    outputs: ["Final price", "Savings"],
    color: "#db2777",
    keywords: ["discount calculator", "sale price calculator", "percent off calculator", "gst calculator pakistan", "sales tax calculator", "price after discount"],
    steps: [
      { title: "Enter the price", body: "The original price before any discount." },
      { title: "Add the discounts", body: "For example 50% off plus an extra 10% at checkout." },
      { title: "Add tax if needed", body: "Add GST on top, or work out the tax already included in a price." },
    ],
    faqs: [
      { q: "Is 50% + 10% off the same as 60% off?", a: "No. The extra 10% is taken from the already-discounted price, so 50% + 10% equals 55% off in total." },
      { q: "What is the GST rate in Pakistan?", a: "The standard sales tax rate on most goods is 18%; some goods and services use other rates. Enter the rate on your receipt." },
    ],
    related: ["percentage-calculator", "currency-converter", "salary-tax-calculator-pakistan", "invoice-generator"],
  },
  {
    slug: "typing-test",
    name: "Typing Speed Test",
    headline: "Typing Speed Test — check your WPM and accuracy",
    title: "Typing Speed Test — Check Your WPM",
    category: "Text",
    tagline: "1-minute test with live WPM and accuracy",
    description:
      "Test your typing speed in words per minute with a 30-second, 1-minute or 2-minute test. See live speed and accuracy, beat your personal best and share your score.",
    engine: "calc",
    mode: "typing-test",
    inputs: ["Keyboard"],
    outputs: ["WPM", "Accuracy"],
    color: "#2563eb",
    keywords: ["typing test", "typing speed test", "wpm test", "typing master online", "check typing speed", "1 minute typing test"],
    steps: [
      { title: "Choose a duration", body: "30 seconds, 1 minute or 2 minutes." },
      { title: "Start typing", body: "The timer starts with your first key; mistakes are highlighted." },
      { title: "See your score", body: "Words per minute and accuracy — then try to beat it." },
    ],
    faqs: [
      { q: "What is a good typing speed?", a: "About 40 WPM is average; 60+ WPM is fast; many office and data-entry jobs ask for 35–45 WPM with high accuracy." },
      { q: "How is WPM calculated?", a: "Correct characters divided by five (one standard word) per minute, so mistakes lower your speed." },
    ],
    related: ["word-counter", "case-converter", "cv-maker", "percentage-calculator"],
  },
  /* ------------------------------------ money & home ------------------------------------ */
  {
    slug: "gold-rate-calculator",
    name: "Gold Rate Calculator",
    headline: "Gold Rate Calculator — price of gold in tola, gram, masha & ratti",
    title: "Gold Rate Calculator — Tola, Gram, Masha, Ratti",
    category: "Calculators",
    tagline: "Gold price by weight, karat and making charges",
    description:
      "Work out the price of gold jewellery from today's rate. Enter the weight in tola, masha, ratti or grams, choose 24K, 22K, 21K or 18K, add making charges and see the buying price and the approximate selling value.",
    engine: "calc",
    mode: "gold",
    inputs: ["Rate", "Tola / gram", "Karat"],
    outputs: ["Price"],
    color: "#ca8a04",
    keywords: ["gold rate calculator", "gold price per tola", "tola to gram", "22k gold price calculator", "gold jewellery price calculator", "masha ratti to gram"],
    steps: [
      { title: "Enter today's rate", body: "Use the 24K rate per tola, per 10 grams or per gram from your jeweller." },
      { title: "Enter the weight", body: "Tola, masha, ratti and grams can be combined — e.g. 2 tola 3 masha." },
      { title: "Choose purity and charges", body: "Pick 24K–18K and add making charges and the shop's selling deduction." },
    ],
    faqs: [
      { q: "How many grams are in one tola?", a: "One tola is 11.6638 grams. It is divided into 12 masha, and each masha into 8 ratti (96 ratti per tola)." },
      { q: "What is the difference between 24K, 22K and 21K gold?", a: "24K is 99.9% pure gold. 22K is 91.7% gold and 21K is 87.5% — most jewellery in Pakistan is 21K or 22K because pure gold is too soft." },
      { q: "Why is the selling price lower than the buying price?", a: "Jewellers do not pay back the making charges and usually deduct a percentage for polish and wastage when they buy gold from you." },
    ],
    related: ["zakat-calculator", "currency-converter", "unit-converter", "percentage-calculator"],
  },
  {
    slug: "solar-load-calculator",
    name: "Solar & UPS Load Calculator",
    headline: "Solar Panel & Inverter Load Calculator — what size system do I need?",
    title: "Solar & Inverter Load Calculator — System Size",
    category: "Calculators",
    tagline: "Inverter, panels and batteries for your home",
    description:
      "List your fans, lights, fridge and AC to see your total load, monthly units, the inverter size you need, how many solar panels to install and the batteries for your backup hours — a free planning tool for homes and shops.",
    engine: "calc",
    mode: "solar-load",
    inputs: ["Appliances", "Hours"],
    outputs: ["kVA", "Panels", "Batteries"],
    color: "#f59e0b",
    keywords: ["solar system calculator", "inverter size calculator", "ups load calculator", "how many solar panels do i need", "solar panel calculator pakistan", "home load calculator watts"],
    steps: [
      { title: "Add your appliances", body: "Pick common appliances or add your own with their watts, quantity and hours per day." },
      { title: "Set your situation", body: "Sun hours (about 5 in Pakistan), panel size, backup hours and your per-unit rate." },
      { title: "Read the system size", body: "Inverter kVA, solar kW and panel count, battery capacity and your monthly units." },
    ],
    faqs: [
      { q: "What size inverter do I need for 4 fans, lights and a fridge?", a: "Usually a 1–1.5 kVA inverter. Add your exact appliances above — the calculator adds 25% headroom over your peak load." },
      { q: "How many solar panels for a 1.5 ton inverter AC?", a: "A 1.5 ton inverter AC running 8 hours uses about 10 units a day, which needs roughly 2.5 kW of panels — around five 585 W panels — on top of the rest of your load." },
      { q: "Is this an exact quote?", a: "No — it is a planning estimate. Motors draw extra power when starting, and roofs, shading and wiring differ. Ask a qualified installer to confirm the design." },
    ],
    related: ["currency-converter", "loan-emi-calculator", "unit-converter", "percentage-calculator"],
  },
  {
    slug: "fuel-cost-calculator",
    name: "Fuel Cost Calculator",
    headline: "Fuel Cost Calculator — petrol cost of a trip & car mileage",
    title: "Fuel Cost Calculator — Trip Petrol Cost & Mileage",
    category: "Calculators",
    tagline: "Petrol cost for any trip, split between friends",
    description:
      "Find out how much petrol a trip will cost from the distance, your car's mileage and today's petrol price — one way or return, split between passengers. Also measure your car's real km per litre.",
    engine: "calc",
    mode: "fuel",
    inputs: ["Distance", "Mileage", "Price"],
    outputs: ["Cost", "Litres"],
    color: "#dc2626",
    keywords: ["fuel cost calculator", "petrol cost calculator", "trip cost calculator pakistan", "car mileage calculator", "km per litre calculator"],
    steps: [
      { title: "Enter the distance", body: "One-way kilometres; tick return trip to double it." },
      { title: "Enter mileage and price", body: "Your car's km per litre and today's petrol price." },
      { title: "See the cost", body: "Total fuel cost, litres needed and cost per person." },
    ],
    faqs: [
      { q: "How do I measure my car's real mileage?", a: "Fill the tank completely and reset the trip meter. Drive normally, fill up again, then divide the kilometres by the litres it took — or use the “My car's mileage” tab." },
      { q: "Why does my mileage change?", a: "AC use, traffic, tyre pressure, speed and load all change fuel use. Motorway driving at a steady speed is usually the most economical." },
    ],
    related: ["currency-converter", "percentage-calculator", "unit-converter", "loan-emi-calculator"],
  },
  {
    slug: "calorie-calculator",
    name: "Calorie Calculator",
    headline: "Calorie Calculator — daily calories to lose, gain or maintain weight",
    title: "Calorie Calculator — Daily Calories (BMR & TDEE)",
    category: "Calculators",
    tagline: "How many calories you need each day",
    description:
      "Calculate your daily calorie needs from your age, height, weight and activity level, with targets to lose, maintain or gain weight. Uses the Mifflin-St Jeor equation recommended by dietitians.",
    engine: "calc",
    mode: "calories",
    inputs: ["Age", "Height", "Weight", "Activity"],
    outputs: ["kcal/day"],
    color: "#16a34a",
    keywords: ["calorie calculator", "tdee calculator", "bmr calculator", "how many calories should i eat", "calories to lose weight", "daily calorie intake"],
    steps: [
      { title: "Enter your details", body: "Sex, age, weight and height in cm or feet and inches." },
      { title: "Choose your activity", body: "From little exercise to a physical job." },
      { title: "Pick a goal", body: "See calories to lose 0.25–0.5 kg a week, maintain or gain." },
    ],
    faqs: [
      { q: "What is BMR and TDEE?", a: "BMR is what your body burns at complete rest. TDEE adds your daily activity — eat about that much to keep the same weight." },
      { q: "How fast should I lose weight?", a: "About 0.25–0.5 kg a week is safe and sustainable for most adults; that is roughly 250–500 kcal below your TDEE." },
    ],
    related: ["bmi-calculator", "age-calculator", "percentage-calculator", "unit-converter"],
  },

  /* ------------------------------------ everyday & language ------------------------------------ */
  {
    slug: "urdu-keyboard",
    name: "Urdu Keyboard",
    headline: "Urdu Keyboard Online — type in Urdu with Roman letters",
    title: "Urdu Keyboard Online — Easy Urdu Typing",
    category: "Text",
    tagline: "Type Urdu with an English keyboard",
    description:
      "Type in Urdu online using your English keyboard — Roman letters turn into Urdu script as you type — or tap the on-screen Urdu keyboard on your phone. Copy the text to WhatsApp, Facebook, Word or InPage.",
    engine: "utility",
    mode: "urdu-keyboard",
    inputs: ["Keyboard"],
    outputs: ["Urdu text"],
    color: "#059669",
    keywords: ["urdu keyboard", "urdu typing online", "roman urdu to urdu", "type in urdu", "urdu likhne wala", "online urdu editor"],
    steps: [
      { title: "Start typing", body: "Type phonetically with English letters — e.g. “salam” becomes سلام." },
      { title: "Use the on-screen keys", body: "On a phone, tap the Urdu keyboard to add any letter." },
      { title: "Copy and share", body: "Copy to WhatsApp, Facebook or a document, or save it as a text file." },
    ],
    faqs: [
      { q: "How do I type letters like ٹ, ڈ, ڑ and ں?", a: "Use capital letters: T → ٹ, D → ڈ, R → ڑ, N → ں. The cheat-sheet under the editor lists every key." },
      { q: "Can I paste the text into InPage or MS Word?", a: "Yes — the text is standard Unicode Urdu, so it pastes into Word, Google Docs, WhatsApp and Facebook. Older InPage versions may need Unicode support enabled." },
    ],
    related: ["voice-typing", "image-to-text", "text-to-speech", "word-counter"],
  },
  {
    slug: "voice-typing",
    name: "Voice Typing",
    headline: "Voice Typing — speech to text in Urdu, English & more",
    title: "Voice Typing Online — Urdu & English Speech to Text",
    category: "Text",
    tagline: "Speak and watch your words appear",
    description:
      "Type with your voice in Urdu, English, Hindi, Arabic and Punjabi. Speak into your microphone and the text appears live — then edit, copy or share it. Free, no signup.",
    engine: "utility",
    mode: "voice-typing",
    inputs: ["Microphone"],
    outputs: ["Text"],
    color: "#7c3aed",
    keywords: ["voice typing", "speech to text", "urdu voice typing", "voice to text online", "bol kar likhna", "dictation online"],
    steps: [
      { title: "Pick your language", body: "Urdu, English (US, UK, India), Hindi, Arabic and more." },
      { title: "Tap the mic and speak", body: "Allow microphone access; your words appear as you talk." },
      { title: "Edit and copy", body: "Fix any words, add punctuation, then copy, save or share." },
    ],
    faqs: [
      { q: "Which browsers support voice typing?", a: "Chrome and Edge on Android, Windows and Mac work best. Safari has partial support; Firefox does not support it yet." },
      { q: "Is my voice recorded or stored?", a: "SnapGrab does not record or store anything. The browser's built-in speech service (Google in Chrome) converts your speech to text." },
    ],
    related: ["urdu-keyboard", "text-to-speech", "word-counter", "image-to-text"],
  },
  {
    slug: "text-to-speech",
    name: "Text to Speech",
    headline: "Text to Speech — read any text aloud online",
    title: "Text to Speech Online — Free Natural Voices",
    category: "Text",
    tagline: "Listen to any text in many voices",
    description:
      "Paste any text and listen to it read aloud. Choose from the voices on your device, change speed and pitch, and follow along as each word is highlighted — great for proofreading, learning and accessibility.",
    engine: "utility",
    mode: "text-to-speech",
    inputs: ["Text"],
    outputs: ["Speech"],
    color: "#0284c7",
    keywords: ["text to speech", "read aloud online", "tts free", "text to voice", "listen to text", "urdu text to speech"],
    steps: [
      { title: "Paste your text", body: "Any article, notes or message." },
      { title: "Choose a voice", body: "Pick a language and voice; adjust speed and pitch." },
      { title: "Press play", body: "Pause, resume or stop at any time; words are highlighted as they are read." },
    ],
    faqs: [
      { q: "Can I download the audio as MP3?", a: "Not with this tool — it uses your browser's built-in voices, which can play but not export audio." },
      { q: "Why are there different voices on my phone and laptop?", a: "Voices come from your operating system. Windows, Android, iOS and macOS each include their own set, and you can add more in your device's language settings." },
    ],
    related: ["voice-typing", "urdu-keyboard", "word-counter", "typing-test"],
  },
  {
    slug: "tasbeeh-counter",
    name: "Digital Tasbeeh Counter",
    headline: "Digital Tasbeeh Counter — online tasbih for dhikr",
    title: "Digital Tasbeeh Counter Online — Tasbih for Dhikr",
    category: "Everyday",
    tagline: "Tap to count your dhikr with targets",
    description:
      "A simple digital tasbeeh: tap anywhere to count SubhanAllah, Alhamdulillah, Allahu Akbar and more, with 33/99/100 targets, gentle vibration, rounds and your totals saved on your phone.",
    engine: "utility",
    mode: "tasbeeh",
    inputs: ["Tap"],
    outputs: ["Count"],
    color: "#0d9488",
    keywords: ["tasbeeh counter", "digital tasbih", "online tasbeeh", "dhikr counter", "tasbih counter app", "zikr counter"],
    steps: [
      { title: "Choose a dhikr", body: "SubhanAllah, Alhamdulillah, Allahu Akbar, Astaghfirullah, Durood and more." },
      { title: "Set a target", body: "33, 99, 100 or your own number; the phone vibrates when you reach it." },
      { title: "Tap to count", body: "Tap anywhere on the counter, or press Space on a keyboard." },
    ],
    faqs: [
      { q: "Is my count saved?", a: "Yes — totals are saved on your device, so they are still there when you come back. Nothing is sent to our server." },
      { q: "Does it work offline?", a: "Once the page has loaded it keeps counting without internet." },
    ],
    related: ["prayer-times", "qibla-direction", "ramadan-timetable", "hijri-date-converter"],
  },
  {
    slug: "online-timer",
    name: "Stopwatch & Timer",
    headline: "Online Stopwatch & Countdown Timer — with alarm and Pomodoro",
    title: "Online Stopwatch & Timer with Alarm",
    category: "Everyday",
    tagline: "Stopwatch, countdown and Pomodoro in one",
    description:
      "A free online stopwatch with laps, a countdown timer with an alarm, and a Pomodoro timer for focused study and work sessions. Big, clear digits and a full-screen mode for classrooms and workouts.",
    engine: "utility",
    mode: "timer",
    inputs: ["Time"],
    outputs: ["Alarm"],
    color: "#4f46e5",
    keywords: ["online timer", "stopwatch", "countdown timer", "timer with alarm", "pomodoro timer", "5 minute timer"],
    steps: [
      { title: "Pick a mode", body: "Stopwatch, countdown or Pomodoro." },
      { title: "Start", body: "Use presets like 1, 5, 10 or 25 minutes, or enter your own time." },
      { title: "Go full screen", body: "Show big digits for a class, workout or presentation." },
    ],
    faqs: [
      { q: "Will the alarm ring if I switch tabs?", a: "Yes — the timer keeps exact time in the background and plays the alarm, and can show a notification if you allow it." },
      { q: "What is the Pomodoro technique?", a: "Work for 25 minutes, take a 5-minute break, and repeat — a longer break after four rounds. It helps you focus without burning out." },
    ],
    related: ["typing-test", "date-calculator", "age-calculator", "spin-the-wheel"],
  },
  {
    slug: "spin-the-wheel",
    name: "Spin the Wheel",
    headline: "Spin the Wheel — random name picker and lucky draw",
    title: "Spin the Wheel — Random Name Picker",
    category: "Everyday",
    tagline: "Pick a random winner, name or number",
    description:
      "Enter names or options and spin a colourful wheel to pick a random winner — perfect for giveaways, classroom picks, lucky draws and decisions. Includes a random number generator, coin flip and dice.",
    engine: "utility",
    mode: "spin-wheel",
    inputs: ["Names"],
    outputs: ["Winner"],
    color: "#e11d48",
    keywords: ["spin the wheel", "random name picker", "wheel of names", "lucky draw online", "random winner picker", "giveaway picker"],
    steps: [
      { title: "Add names", body: "One per line or separated by commas." },
      { title: "Spin", body: "The wheel slows down and lands on a random winner." },
      { title: "Share the result", body: "Remove the winner for the next round, or share it with your group." },
    ],
    faqs: [
      { q: "Is the result really random?", a: "Yes. Each spin uses your browser's random number generator, so every entry has an equal chance." },
      { q: "Can I use it for Instagram giveaways?", a: "Yes — paste the usernames of the people who entered, spin, and screen-record the result to show it was fair." },
    ],
    related: ["online-timer", "password-generator", "qr-code-generator", "typing-test"],
  },
];

export const TOOL_MAP: Record<string, Tool> = Object.fromEntries(TOOLS.map((t) => [t.slug, t]));

export const TOOL_CATEGORIES: ToolCategory[] = ["Image", "Print", "PDF", "Calculators", "Text", "Everyday", "Generators", "Audio", "Video"];

export function toolsByCategory(category: ToolCategory) {
  return TOOLS.filter((t) => t.category === category);
}

export function relatedTools(tool: Tool) {
  return tool.related.map((s) => TOOL_MAP[s]).filter(Boolean);
}

export function toolCostTier(tool: Tool): CostTier {
  return tool.provider ? QUOTA_PROVIDERS[tool.provider].tier : "free";
}
