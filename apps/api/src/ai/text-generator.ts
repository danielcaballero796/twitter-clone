/**
 * Provider seam (design D-AI): AiService depends on this token, never on a
 * concrete vendor. Swapping Gemini for another provider — or a test fake —
 * means binding a different class to TEXT_GENERATOR in one module.
 */
export const TEXT_GENERATOR = 'TEXT_GENERATOR';

export interface TextGenerator {
  generate(prompt: string): Promise<string>;
}
