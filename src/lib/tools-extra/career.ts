import type { Tool } from "../tools";

/** Cover letter generator, QR menu maker. */
export const CAREER_TOOLS: Tool[] = [
  {
    slug: "cover-letter-generator",
    name: "Cover Letter Generator",
    headline: "Free Cover Letter Generator — job application letters for Pakistan & abroad",
    title: "Free Cover Letter Generator — PDF & Email",
    category: "Generators",
    tagline: "A polished cover letter or job application in minutes",
    description:
      "Write a professional cover letter without AI or signup. Pick a tone and template — bank, teaching, government post or internship — edit the text, then download a PDF or copy a short email version.",
    engine: "career",
    mode: "cover-letter",
    inputs: ["Your details", "Job & company", "Key achievements"],
    outputs: ["PDF letter", "Email text"],
    color: "#2563eb",
    keywords: [
      "cover letter generator",
      "cover letter for job",
      "job application letter",
      "application for job in pakistan",
      "cover letter for bank job",
      "application for teaching job",
      "application for government job pakistan",
      "internship cover letter",
      "cover letter email format",
      "free cover letter maker",
    ],
    steps: [
      { title: "Choose the letter type", body: "Any job, bank, teaching, a government post or an internship — then pick a tone and Letter or Short email." },
      { title: "Fill in the details", body: "Add the job, the company, where you saw the advert and two or three achievements. The letter writes itself as you type." },
      { title: "Make it yours", body: "Tap New wording for different phrasing, or switch to Edit text and change anything by hand." },
      { title: "Download or copy", body: "Save an A4 PDF with the date and addresses, or copy the email version and attach your CV." },
    ],
    faqs: [
      {
        q: "Does this use AI?",
        a: "No. The letter is assembled in your browser from carefully written templates and sentence variations, so nothing you type is sent to a server.",
      },
      {
        q: "How is a government job application different?",
        a: "Government posts in Pakistan usually expect the traditional format: To, the officer's designation and department, a Subject line naming the post (and advertisement number), Respected Sir/Madam, your particulars, a list of attached documents such as CNIC and domicile, and Yours obediently. The Govt. post template follows that layout.",
      },
      {
        q: "How long should a cover letter be?",
        a: "Keep a cover letter to one page — roughly 250 to 400 words. When you apply by email, use the short email version in the body and attach your CV as a PDF.",
      },
      {
        q: "Can I use my CV details?",
        a: "Yes. If you built a CV with our CV Maker on the same device, your name and contact details are filled in automatically. Everything stays in your browser.",
      },
    ],
    related: ["cv-maker", "passport-photo-maker", "signature-maker", "word-counter"],
  },
  {
    slug: "qr-menu-maker",
    name: "QR Menu Maker",
    headline: "Free QR Menu Maker — digital menu for restaurants, cafés & dhabas",
    title: "Free QR Menu Maker for Restaurants — No App",
    category: "Generators",
    tagline: "A scan-to-view menu with no app, account or monthly fee",
    description:
      "Build a mobile menu with sections, prices, call and WhatsApp buttons, then get a QR code, a printable table card and a menu PDF. The menu lives inside the link itself — no account, no server, no monthly fee.",
    engine: "menu",
    mode: "qr-menu",
    inputs: ["Restaurant details", "Menu items & prices"],
    outputs: ["QR PNG", "QR SVG", "Table card PDF", "Menu PDF", "Menu link"],
    color: "#ea580c",
    keywords: [
      "qr menu maker",
      "qr code menu for restaurant",
      "free digital menu",
      "restaurant menu qr code pakistan",
      "contactless menu",
      "menu card maker",
      "cafe menu qr code",
      "online menu maker free",
      "whatsapp menu link",
    ],
    steps: [
      { title: "Add your restaurant", body: "Name, phone, WhatsApp number, address, opening hours and a colour theme." },
      { title: "Build the menu", body: "Create sections like Karahi, BBQ and Drinks, and add items with prices. Descriptions are optional." },
      { title: "Get the QR code", body: "The link and QR code update live. Keep an eye on the length meter — shorter menus scan faster." },
      { title: "Print and share", body: "Print table cards (A6, A5 or four on A4), download a full menu PDF, or share the link on WhatsApp and Instagram." },
    ],
    faqs: [
      {
        q: "Where is my menu stored?",
        a: "Inside the link itself. The menu is compressed into the part of the URL after the # sign, which browsers never send to a server — so there is no account, no database and no monthly fee, and the code keeps working as long as SnapGrab is online.",
      },
      {
        q: "How do I change prices later?",
        a: "Edit the menu here (your draft is saved in this browser) and print a new QR code. Because the menu is inside the code, an old printed code keeps showing the old menu.",
      },
      {
        q: "How many items can I add?",
        a: "Around 100–150 short items fit comfortably. Long, unique descriptions use up the space fastest; the tool warns you when the QR code gets dense and can remove descriptions in one tap.",
      },
      {
        q: "Can customers order on WhatsApp?",
        a: "Yes. Add your WhatsApp number and the menu shows a WhatsApp button that opens a chat with you. Pakistani numbers like 0300 1234567 are converted to the international format automatically.",
      },
      {
        q: "What size should I print the QR code?",
        a: "At least 4 cm wide for a short menu and 6 cm or more for a long one. The A6 table card prints the code about 6 cm wide; on a home printer choose “4 cards on A4” and cut them out.",
      },
    ],
    related: ["qr-code-generator", "whatsapp-link-generator", "invoice-generator", "wifi-qr-code-generator"],
  },
];
