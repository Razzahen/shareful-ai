"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { markdownComponents } from "@/components/markdown-components";

const LANGUAGE_CLASS_RE = /^language-./;
const HLJS_CLASS_RE = /^hljs-./;

const sanitizeSchema = {
  ...defaultSchema,
  attributes: {
    ...defaultSchema.attributes,
    code: [
      ...(defaultSchema.attributes?.code ?? []),
      ["className", LANGUAGE_CLASS_RE],
    ],
    span: [
      ...(defaultSchema.attributes?.span ?? []),
      ["className", HLJS_CLASS_RE],
    ],
  },
};

export function MarkdownRenderer({ content }: { content: string }) {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-none">
      <ReactMarkdown
        components={markdownComponents}
        rehypePlugins={[rehypeHighlight, [rehypeSanitize, sanitizeSchema]]}
        remarkPlugins={[remarkGfm]}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
