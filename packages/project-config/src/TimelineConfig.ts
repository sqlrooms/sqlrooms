import { z } from "zod";

export const TimelineMode = z.enum(['sliding', 'incremental']);
export type TimelineMode = z.infer<typeof TimelineMode>;
