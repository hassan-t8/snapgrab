import type { Tool } from "../tools";
import { FORMS_TOOLS } from "./forms";
import { ISLAMIC_TOOLS } from "./islamic";
import { CARDS_TOOLS } from "./cards";
import { VIDEO_TOOLS } from "./video";
import { CAREER_TOOLS } from "./career";
import { LOCAL_TOOLS } from "./local";

/** Every tool registered outside src/lib/tools.ts, in display order. */
export const EXTRA_TOOLS: Tool[] = [...LOCAL_TOOLS, ...FORMS_TOOLS, ...ISLAMIC_TOOLS, ...CARDS_TOOLS, ...VIDEO_TOOLS, ...CAREER_TOOLS];
