import type { Tool } from "../tools";

const VIDEO_INPUTS = ["MP4", "MOV", "WEBM", "MKV", "3GP", "AVI"];

const VIDEO_PRIVACY_FAQ = {
  q: "Is my video uploaded to your server?",
  a: "No. The video engine (FFmpeg compiled to WebAssembly) downloads to your browser once and then processes the file on your own phone or computer. Your video never leaves your device.",
};

const VIDEO_SIZE_FAQ = {
  q: "Is there a file size limit?",
  a: "Nothing is uploaded, so there is no server limit, but all the work happens on your device. It works best under about 500 MB; long or 4K videos can be slow on phones, and files over 2 GB are too big for the in-browser engine.",
};

/** In-browser video tools (ffmpeg.wasm). */
export const VIDEO_TOOLS: Tool[] = [
  {
    slug: "trim-video",
    name: "Video Trimmer",
    headline: "Trim Video Online — cut MP4 clips free, no upload",
    title: "Trim Video Online — Cut MP4 Free, No Upload",
    category: "Video",
    tagline: "Cut the start and end off any clip",
    description:
      "Cut the part you need out of any video. Drag the start and end handles, preview the clip and download it — instant lossless cutting or frame-accurate cutting, right in your browser.",
    engine: "video",
    mode: "video-trim",
    accept: "video/*",
    inputs: VIDEO_INPUTS,
    outputs: ["MP4", "Same as original"],
    color: "#f97316",
    keywords: [
      "trim video",
      "cut video online",
      "video cutter",
      "trim mp4",
      "cut video for whatsapp status",
      "video trimmer online free",
      "cut part of video",
      "shorten video",
    ],
    steps: [
      { title: "Add a video", body: "Pick a clip from your gallery or drop a file — MP4, MOV and WEBM all work." },
      { title: "Mark start and end", body: "Drag the handles, or play to the right moment and tap Set start / Set end." },
      { title: "Choose fast or precise", body: "Fast cut copies the video untouched; precise cut re-encodes for frame-exact edges." },
      { title: "Download or share", body: "Save the trimmed clip or send it straight to WhatsApp." },
    ],
    faqs: [
      {
        q: "What is the difference between fast and precise cut?",
        a: "Fast cut copies the original video without re-encoding, so it is quick and loses no quality, but it can only start on a keyframe — the clip may begin a second or two early. Precise cut re-encodes to MP4 so it starts exactly where you chose; it takes longer.",
      },
      {
        q: "Can I cut a video for WhatsApp status?",
        a: "Yes. Trim it to 60 seconds or less, then tap Share on your phone to send the clip directly to WhatsApp.",
      },
      VIDEO_PRIVACY_FAQ,
      VIDEO_SIZE_FAQ,
    ],
    related: ["compress-video", "video-to-gif", "mute-video", "extract-audio-from-video"],
  },
  {
    slug: "compress-video",
    name: "Video Compressor",
    headline: "Compress Video Online — reduce MP4 size free",
    title: "Compress Video — Reduce MP4 Size Free",
    category: "Video",
    tagline: "Make videos small enough to send",
    description:
      "Shrink large videos for WhatsApp, email and uploads. Pick Small, Balanced or High quality and a resolution, see the estimated size and get a compatible MP4 — made on your device, never uploaded.",
    engine: "video",
    mode: "video-compress",
    accept: "video/*",
    inputs: VIDEO_INPUTS,
    outputs: ["MP4 (H.264 + AAC)"],
    color: "#0ea5e9",
    keywords: [
      "compress video",
      "reduce video size",
      "video compressor online free",
      "compress mp4",
      "compress video for whatsapp",
      "compress video for email",
      "make video smaller",
      "video size reducer",
    ],
    steps: [
      { title: "Add a video", body: "Choose a clip from your phone or computer." },
      { title: "Pick a quality", body: "Small for sharing, Balanced for most uses, High to keep detail. Change the resolution if you like." },
      { title: "Compress", body: "The video is re-encoded to H.264 MP4 on your device, with live progress." },
      { title: "Download or share", body: "Compare the new size with the original, then save or share it." },
    ],
    faqs: [
      {
        q: "How much smaller will my video get?",
        a: "Phone videos often shrink by 50–90%, depending on the original. The tool shows a rough estimate before you start and the real size when it finishes. Videos that are already heavily compressed may not get much smaller.",
      },
      {
        q: "Which setting should I use for WhatsApp?",
        a: "Small (480p) gives the lightest file for chats; Balanced (720p) looks better on status and still sends quickly.",
      },
      {
        q: "Why is it slow on my phone?",
        a: "Compressing means re-encoding every frame, and here your own device does the work. A one-minute clip is usually fine; long videos are much faster on a laptop or desktop.",
      },
      VIDEO_PRIVACY_FAQ,
      VIDEO_SIZE_FAQ,
    ],
    related: ["trim-video", "mute-video", "video-to-gif", "image-compressor"],
  },
  {
    slug: "video-to-gif",
    name: "Video to GIF",
    headline: "Video to GIF Converter — make GIFs from MP4 free",
    title: "Video to GIF Converter — MP4 to GIF Free",
    category: "Video",
    tagline: "Turn a moment of video into a GIF",
    description:
      "Turn any part of a video into a looping GIF. Choose the start, length, frame rate and width, and get a sharp GIF with an optimised colour palette — made in your browser, no watermark, no upload.",
    engine: "video",
    mode: "video-to-gif",
    accept: "video/*",
    inputs: VIDEO_INPUTS,
    outputs: ["GIF"],
    color: "#a855f7",
    keywords: [
      "video to gif",
      "mp4 to gif",
      "gif maker",
      "convert video to gif",
      "make gif from video",
      "gif converter online",
      "mov to gif",
    ],
    steps: [
      { title: "Add a video", body: "Drop an MP4, MOV or WEBM clip." },
      { title: "Pick the moment", body: "Set the start time and a length of up to 15 seconds." },
      { title: "Tune size and smoothness", body: "Choose a width and frame rate — smaller and slower means a lighter GIF." },
      { title: "Create and download", body: "The GIF is built with a custom colour palette for clean results." },
    ],
    faqs: [
      {
        q: "How long can the GIF be?",
        a: "Up to 15 seconds. GIF is an old format with weak compression, so longer clips quickly grow to tens of megabytes — for longer clips, trim the video to MP4 instead.",
      },
      {
        q: "How do I make the GIF smaller?",
        a: "Lower the width (320 or 480 px), use 10–12 frames per second, or shorten the clip. Halving the width cuts the file to roughly a quarter.",
      },
      { q: "Is there a watermark?", a: "No. The GIF is yours, with no watermark or branding." },
      VIDEO_PRIVACY_FAQ,
    ],
    related: ["trim-video", "compress-video", "image-converter", "crop-image"],
  },
  {
    slug: "mute-video",
    name: "Mute Video",
    headline: "Remove Audio from Video — mute MP4 online free",
    title: "Remove Audio from Video — Mute MP4 Free",
    category: "Video",
    tagline: "Strip the sound, keep the picture",
    description:
      "Remove the sound from any video in seconds. The picture is copied untouched — no re-encoding, no quality loss — and you get a silent MP4, MOV or WEBM to download or share. Runs on your device.",
    engine: "video",
    mode: "mute-video",
    accept: "video/*",
    inputs: VIDEO_INPUTS,
    outputs: ["Same as original (no audio)"],
    color: "#64748b",
    keywords: [
      "remove audio from video",
      "mute video",
      "remove sound from video",
      "silent video maker",
      "delete audio from mp4",
      "video without sound",
    ],
    steps: [
      { title: "Add a video", body: "Choose the clip you want to silence." },
      { title: "Remove the audio", body: "The sound track is dropped and the video stream is copied as-is." },
      { title: "Check the preview", body: "Play the silent result right on the page." },
      { title: "Download or share", body: "Save it or send it to WhatsApp." },
    ],
    faqs: [
      {
        q: "Does muting reduce the video quality?",
        a: "No. The video stream is copied bit for bit; only the audio track is removed, so it is fast and lossless. The file also gets a little smaller.",
      },
      {
        q: "Can I keep the audio instead?",
        a: "Yes — use Extract Audio from Video to save the sound as an MP3 or M4A file.",
      },
      VIDEO_PRIVACY_FAQ,
      VIDEO_SIZE_FAQ,
    ],
    related: ["extract-audio-from-video", "trim-video", "compress-video"],
  },
  {
    slug: "extract-audio-from-video",
    name: "Extract Audio from Video",
    headline: "Extract Audio from Video — MP4 to MP3 on your device",
    title: "Extract Audio from Video — MP4 to MP3 Free",
    category: "Audio",
    tagline: "Save the sound of a video file as MP3",
    description:
      "Pull the soundtrack out of a video file on your phone or computer and save it as MP3 or M4A. M4A keeps the original AAC audio untouched when possible — no upload, no signup, no watermark.",
    engine: "video",
    mode: "extract-audio",
    accept: "video/*",
    inputs: VIDEO_INPUTS,
    outputs: ["MP3", "M4A"],
    color: "#10b981",
    keywords: [
      "extract audio from video",
      "mp4 to mp3",
      "convert video to mp3",
      "video to audio converter",
      "mov to mp3",
      "get audio from video",
      "video to mp3 offline",
    ],
    steps: [
      { title: "Add a video file", body: "Pick a video from your gallery or computer — not a link." },
      { title: "Choose MP3 or M4A", body: "MP3 plays everywhere; M4A keeps the original AAC sound without re-encoding." },
      { title: "Extract", body: "The audio track is read out of the video on your device." },
      { title: "Download or share", body: "Save the audio file or share it to WhatsApp." },
    ],
    faqs: [
      {
        q: "MP3 or M4A — which should I pick?",
        a: "M4A copies the original AAC audio found in most phone videos, so it is quick and lossless. MP3 is re-encoded at the bitrate you choose and plays on every device and car stereo.",
      },
      {
        q: "Can I extract audio from a YouTube or Facebook link?",
        a: "This tool works with video files on your device. For links, use the Video to MP3 downloader instead.",
      },
      VIDEO_PRIVACY_FAQ,
      VIDEO_SIZE_FAQ,
    ],
    related: ["video-to-mp3", "mute-video", "trim-video", "audio-downloader"],
  },
];
