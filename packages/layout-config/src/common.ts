import z from 'zod';

export const LayoutDirection = z.enum(['row', 'column']);
export type LayoutDirection = z.infer<typeof LayoutDirection>;
