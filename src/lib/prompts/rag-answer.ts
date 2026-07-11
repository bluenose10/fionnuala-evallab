import { PromptTemplate } from "llamaindex";

/**
 * Phase 6 — Grounded RAG answer prompt templates.
 *
 * These templates are deliberately strict: they force GPT-4o to stay inside
 * the retrieved evidence and to cite chunks explicitly. This citation discipline
 * is what makes the output traceable and what later allows Ragas Faithfulness
 * scoring to compare the answer against the source chunks.
 */

const SYSTEM_TEMPLATE = `\
You are a grounded research assistant for an fionnuala AI Knowledge Base.
Your job is to answer the user's question using ONLY the retrieved source chunks below.

Rules:
1. Use only the information contained in the provided chunks.
2. Cite every factual claim using bracketed chunk numbers, e.g. [1], [2].
3. If the chunks do not contain enough information, say so clearly — do not guess.
4. Do not use outside knowledge, even if you are confident the topic is common.
5. Keep the answer concise, professional, and directly responsive to the question.

The chunks are numbered in the order they were retrieved.`;

const CONTEXT_BLOCK_TEMPLATE = `\
---
Retrieved source chunks:
{context}
---`;

const USER_TEMPLATE = `\
Question: {query}

Answer the question using the retrieved source chunks above. Include citations.`;

/**
 * Build the final messages payload for OpenAI.
 *
 * @param query   The user's natural-language question.
 * @param chunks  An array of retrieved chunks. Each chunk must have a
 *                `content` string and will be numbered for citation.
 * @returns       An object with `system`, `user`, and the rendered
 *                `messages` array ready for OpenAI's chat.completions.create.
 */
export function buildRagAnswerPrompt(query: string, chunks: { content: string }[]) {
  const numberedContext = chunks
    .map((chunk, index) => `[${index + 1}] ${chunk.content}`)
    .join("\n\n");

  const systemPrompt = new PromptTemplate({ template: SYSTEM_TEMPLATE }).format({});
  const contextBlock = new PromptTemplate({ template: CONTEXT_BLOCK_TEMPLATE }).format({
    context: numberedContext,
  });
  const userPrompt = new PromptTemplate({ template: USER_TEMPLATE }).format({ query });

  const systemMessage = `${systemPrompt}\n\n${contextBlock}`;

  return {
    system: systemMessage,
    user: userPrompt,
    messages: [
      { role: "system" as const, content: systemMessage },
      { role: "user" as const, content: userPrompt },
    ],
  };
}
