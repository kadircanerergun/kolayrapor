import { z } from 'zod';

export const NavigateInputSchema = z.object({
  url: z.string().url()
});

export const LoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1)
});

export const SearchPrescriptionInputSchema = z.object({
  prescriptionNumber: z.string().min(1)
});

export const NavigationResultSchema = z.object({
  success: z.boolean(),
  currentUrl: z.string().optional(),
  redirectedToLogin: z.boolean().optional(),
  error: z.string().optional(),
  prescriptionData: z.any().optional()
});

export type NavigateInput = z.infer<typeof NavigateInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type SearchPrescriptionInput = z.infer<typeof SearchPrescriptionInputSchema>;
export type NavigationResult = z.infer<typeof NavigationResultSchema>;