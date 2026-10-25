/**
 * How-to guides that bring search traffic to the tools. Added by prisma/seed-guides.ts on every
 * deploy, create-only: a guide edited (or deleted and recreated) in the admin panel is never overwritten.
 */
export const GUIDES = [
  {
    slug: "how-to-print-cnic-front-and-back-on-one-page",
    title: "How to Print CNIC Front and Back on One Page (A4, Exact Size)",
    excerpt:
      "Forms, banks and offices ask for a copy of both sides of your CNIC on one sheet. Here is how to print it at home at the real card size — no photocopy shop needed.",
    tags: "cnic,print,guide",
    content: `## What you need

- A clear photo or scan of the **front** and **back** of your CNIC
- Any printer and plain A4 paper
- The free [ID Card Print tool](/tools/id-card-print)

## Step by step

1. **Take two photos.** Put the card on a dark, plain surface, hold your phone straight above it and make sure there is no glare on the hologram.
2. Open the [ID Card Print tool](/tools/id-card-print) and add the **front** and **back** photos.
3. Drag and zoom each photo so the card fills the card-shaped frame exactly. Use **Rotate** if a photo is sideways.
4. Choose **Both sides on one page**. This puts the front and back next to each other — the layout offices expect.
5. Pick **A4** and how many copies you want on the sheet.
6. Press **Print**. In the print dialog choose **Scale: 100%** (or *Actual size*) and **Margins: None**.

The card prints at its real size: **85.6 × 54 mm**, the same as the original CNIC.

## Why is my printed card too small or too big?

Almost always the print dialog is set to *Fit to page*. Change it to **100%**. If your printer software keeps resizing it, use **Download PDF** instead and print the PDF — or take the PDF to any print shop.

## Is it safe?

The tool runs entirely in your browser. Your CNIC photos are **not uploaded** anywhere, which matters for a document this sensitive. Still, only share copies of your CNIC with organisations that really need them, and write the purpose on the copy (for example *"For bank account opening only"*).

## Related tools

- Need passport photos for the same form? Use the [Passport Photo Maker](/tools/passport-photo-maker).
- Have a scanned PDF to send instead? Try [PDF to JPG](/tools/pdf-to-jpg) or [Image to PDF](/tools/image-to-pdf).`,
  },
  {
    slug: "how-to-print-back-side-of-id-card-on-single-sided-printer",
    title: "How to Print the Back Side of an ID Card Exactly Behind the Front (Any Printer)",
    excerpt:
      "No double-sided printer? You can still print an ID card front and back on one sheet that lines up perfectly. The trick is knowing how your printer feeds paper.",
    tags: "print,id card,guide",
    content: `## Two ways to print on both sides

**Double-sided (duplex) printers** turn the paper over by themselves. In the [ID Card Print tool](/tools/id-card-print) choose **Double-sided printer**, then in the print dialog pick **Print on both sides → Flip on long edge**.

**Single-sided printers** — most home inkjets such as the Epson L-series and Canon G-series, and many small laser printers — print one side only. You print the front, put the same sheet back in, then print the back. The tool mirrors the position of the back side so each back lands exactly behind its front.

## Step by step on a single-sided printer

1. Open the [ID Card Print tool](/tools/id-card-print), add both sides and choose **Single-sided printer**.
2. **Step 1 – Print the front.** Before you take the sheet out, make a small pen mark at the **top edge**.
3. **Step 2 – Put the sheet back.** Turn it over like turning the page of a book (left ↔ right). Keep the marked top edge pointing the same way it went in the first time.
4. **Step 3 – Print the back.**

## Which way up does the paper go back in?

This depends on the paper path of your printer:

- **Rear or top-feed inkjets** (paper stands upright at the back): the side that gets printed is usually the one **facing you**. So load the printed front **facing away** from you.
- **Front or bottom trays** (most lasers): the printer usually prints on the side **facing down**, so load the printed front **facing up**.

Not sure? Use **Test my printer** in the tool. It prints a page with an arrow on each side and asks what you see. The tool then remembers the right direction for your printer, and you can nudge the back side by half-millimetre steps if it is slightly off.

## Tips for a perfect match

- Print at **100% scale** with **no margins** both times.
- Use the same paper size in the printer settings and in the tool.
- Let ink dry for a minute before putting the sheet back in an inkjet.
- Thick card stock may need the rear/manual feed slot.`,
  },
  {
    slug: "passport-size-photo-size-pakistan",
    title: "Passport Size Photo Size in Pakistan (35×45 mm) — Make and Print at Home",
    excerpt:
      "The exact passport and CNIC photo size used in Pakistan, the background and pose rules, and how to print 8 or 12 photos on one sheet at home.",
    tags: "passport photo,pakistan,guide",
    content: `## The size

Pakistani passport and NADRA CNIC applications use a **35 × 45 mm** photo (about 1.4 × 1.8 inches). The face should take up most of the height — roughly **32–36 mm from chin to the top of the head**.

## The rules most offices follow

- **White or light background**, no shadows
- Face the camera, **neutral expression**, eyes open
- No sunglasses or tinted glasses; avoid glare on normal glasses
- Head coverings for religious reasons are fine as long as the face is clearly visible
- Recent photo (taken in the last 6 months)

> NADRA and the Passport office usually take your photo at the counter. You mostly need printed photos for visa forms, admission forms, job applications and attestation.

## Make the photo at home

1. Stand in front of a plain light wall, facing a window for soft, even light.
2. Ask someone to take the photo from about 1.5 m away at eye level.
3. Open the free [Passport Photo Maker](/tools/passport-photo-maker), choose **Pakistan passport & CNIC — 35 × 45 mm**, and fit your face inside the guide.
4. If the background is not plain, use the [Background Remover](/tools/remove-background) first and pick **white**.

## Print 8, 12 or more on one sheet

In the Passport Photo Maker choose the paper and how many photos you want:

- **4×6 in photo paper:** 8 photos of 35×45 mm
- **A4:** 25–30 photos, depending on margins

Turn on **cut lines**, press **Print**, and set **Scale: 100%** in the print dialog. Photo paper gives the best result; a print shop can print the PDF for a few rupees.

## Other common sizes

- **UK and Schengen visa:** 35 × 45 mm
- **US visa and passport:** 2 × 2 in (51 × 51 mm)
- **Canada passport:** 50 × 70 mm

All of these are presets in the [Passport Photo Maker](/tools/passport-photo-maker).`,
  },
  {
    slug: "ramadan-2027-sehri-iftar-timetable-pakistan",
    title: "Ramadan 2027 Sehri & Iftar Timetable for Pakistan — Karachi, Lahore, Islamabad",
    excerpt:
      "When Ramadan 1448 is expected to start in Pakistan, and how to get an accurate 30-day Sehri and Iftar timetable for your city that you can print or share on WhatsApp.",
    tags: "ramadan,islamic,pakistan",
    content: `## When does Ramadan 2027 start?

Ramadan 1448 AH is expected to begin around **8 February 2027** in Saudi Arabia. In Pakistan it usually starts **one day later**, depending on the moon sighting announced by the Ruet-e-Hilal committee. Eid ul-Fitr is expected around **9–10 March 2027**.

## Get your city's timetable

Open the free [Ramadan Timetable](/tools/ramadan-timetable) and choose your city. You get all 30 days with:

- **Sehri ends** — the start of Fajr
- **Iftar** — Maghrib (sunset)

Pakistan uses the **University of Islamic Sciences, Karachi** method and **Hanafi** Asr by default. You can:

- add a **caution margin** so Sehri ends 5–10 minutes before Fajr, like many printed calendars do;
- move the **first roza** a day earlier or later once the moon sighting is announced;
- **print** the table or **share** it with family on WhatsApp.

## Daily prayer times and Qibla

For all five prayers with a live countdown, use [Prayer Times](/tools/prayer-times). Travelling or in a new place? The [Qibla Direction Finder](/tools/qibla-direction) shows the exact bearing and has a live compass on phones.

## Zakat before Ramadan

Many families calculate Zakat in Ramadan. The [Zakat Calculator](/tools/zakat-calculator) works it out from cash, gold, silver and savings using the current nisab.`,
  },
  {
    slug: "how-to-make-white-background-photo-free",
    title: "How to Make a White Background Photo for Free (Passport, CV, Profile)",
    excerpt:
      "Remove the background from any portrait and replace it with white or blue in a few seconds — on your phone, free, and without uploading your photo.",
    tags: "photo,background,guide",
    content: `## When you need a white background

- Passport, visa and admission photos
- CV and LinkedIn profile pictures
- Office ID cards and online forms

## Step by step

1. Take a well-lit photo facing a window. A plain wall helps but is not required.
2. Open the free [Background Remover](/tools/remove-background) and add the photo.
3. Wait a few seconds — the first time, the AI model downloads once and then runs on your device.
4. Choose **White** (or light blue / grey for some visa forms).
5. Download the photo, or tap **Share** to send it straight to WhatsApp.

## Make it passport size

Open the result in the [Passport Photo Maker](/tools/passport-photo-maker), choose your country's size and print 8 photos on 4×6 paper or many more on A4.

## Tips for a clean cut-out

- Avoid hair blending into a similar-coloured background.
- Keep the whole head and shoulders in the frame.
- Use a sharp photo; blurry edges are harder to separate.

## Privacy

The background is removed inside your browser. Your photo is **never uploaded**, so it is safe to use with personal photos.`,
  },
];
