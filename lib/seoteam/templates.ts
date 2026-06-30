/**
 * SEO post templates (§3) — the starting points the team picks from. Each
 * pre-fills the editor with a sensible heading structure and inline placeholder
 * guidance (italic prompts the writer replaces). Pure & client-safe.
 */
import { BLOG_TEMPLATE_KEYS, type BlogTemplateKey } from "@/lib/enums";

export interface BlogTemplate {
  key: BlogTemplateKey;
  name: string;
  description: string;
  /** Suggested excerpt/meta-description prompt shown as a placeholder. */
  excerptHint: string;
  /** Initial editor HTML. */
  body: string;
}

const g = (s: string) => `<p><em>${s}</em></p>`;

export const BLOG_TEMPLATES: Record<BlogTemplateKey, BlogTemplate> = {
  "how-to": {
    key: "how-to",
    name: "How-To / Tutorial",
    description: "Step-by-step guide that answers a 'how do I…' query.",
    excerptHint:
      "Summarize what the reader will be able to do after this guide (150–160 chars).",
    body: [
      g("Open with the outcome: what will the reader achieve, and why it matters?"),
      "<h2>What you'll need</h2>",
      "<ul><li>Prerequisite or tool one</li><li>Prerequisite or tool two</li></ul>",
      "<h2>Step 1: First action</h2>",
      g("Describe the first step clearly. Keep each step to a single action."),
      "<h2>Step 2: Next action</h2>",
      g("Continue the steps. Add screenshots or images where helpful."),
      "<h2>Common mistakes to avoid</h2>",
      "<ul><li>Mistake one</li><li>Mistake two</li></ul>",
      "<h2>Conclusion</h2>",
      g("Recap the result and suggest a logical next step or related guide."),
    ].join(""),
  },
  listicle: {
    key: "listicle",
    name: "Listicle (Top N …)",
    description: "Ranked or grouped list — 'Top 10…', 'Best… for…'.",
    excerptHint: "Tease the list and who it's for (150–160 chars).",
    body: [
      g("Set up the list: what it covers and how you chose the items."),
      "<h2>1. First item</h2>",
      g("Explain the item, its standout benefit, and who it suits best."),
      "<h2>2. Second item</h2>",
      g("Keep each entry consistent: what it is, pros, and a takeaway."),
      "<h2>3. Third item</h2>",
      g("Repeat for each item in the list."),
      "<h2>How to choose</h2>",
      g("Help the reader decide between the options."),
      "<h2>Final thoughts</h2>",
      g("Wrap up with your top pick and a call to action."),
    ].join(""),
  },
  comparison: {
    key: "comparison",
    name: 'Comparison / "X vs Y"',
    description: "Head-to-head comparison helping the reader pick one.",
    excerptHint: "Name both options and the verdict angle (150–160 chars).",
    body: [
      g("Introduce the two options and what the reader is trying to decide."),
      "<h2>Quick verdict</h2>",
      g("Give the short answer up front, then justify it below."),
      "<h2>Option X overview</h2>",
      g("Strengths, weaknesses, and ideal use case for X."),
      "<h2>Option Y overview</h2>",
      g("Strengths, weaknesses, and ideal use case for Y."),
      "<h2>Side-by-side: key differences</h2>",
      "<ul><li>Difference one</li><li>Difference two</li><li>Difference three</li></ul>",
      "<h2>Which should you choose?</h2>",
      g("Recommend based on reader scenarios (budget, goals, experience)."),
    ].join(""),
  },
  review: {
    key: "review",
    name: "Product / Service Review",
    description: "First-hand assessment with pros, cons, and a verdict.",
    excerptHint: "State what you reviewed and the bottom line (150–160 chars).",
    body: [
      g("Introduce what you're reviewing and your experience with it."),
      "<h2>What it is</h2>",
      g("Describe the product/service and who it's for."),
      "<h2>Pros</h2>",
      "<ul><li>Strength one</li><li>Strength two</li></ul>",
      "<h2>Cons</h2>",
      "<ul><li>Drawback one</li><li>Drawback two</li></ul>",
      "<h2>Pricing &amp; value</h2>",
      g("Cover cost and whether it's worth it."),
      "<h2>Verdict</h2>",
      "<blockquote>One-line verdict the reader can quote.</blockquote>",
      g("Explain who should buy it and who should skip it."),
    ].join(""),
  },
  news: {
    key: "news",
    name: "News / Update",
    description: "Timely announcement or update with the key facts first.",
    excerptHint: "Summarize the news in one sentence (150–160 chars).",
    body: [
      g("Lead with the news: who, what, when — the most important fact first."),
      "<h2>What happened</h2>",
      g("Give the essential details and context."),
      "<h2>Why it matters</h2>",
      g("Explain the impact for your readers."),
      "<h2>What's next</h2>",
      g("Outline expected next steps or what to watch for."),
    ].join(""),
  },
  generic: {
    key: "generic",
    name: "Generic Article",
    description: "Flexible structure for any topic.",
    excerptHint: "Summarize the article in 150–160 characters.",
    body: [
      g("Open with a hook and tell the reader what they'll get from this article."),
      "<h2>Section heading</h2>",
      g("Write your first section. Use H2 headings for main sections."),
      "<h2>Another section</h2>",
      g("Add as many sections as you need. Use H3 for sub-points."),
      "<h2>Conclusion</h2>",
      g("Summarize the key points and end with a call to action."),
    ].join(""),
  },
};

export const BLOG_TEMPLATE_LIST: BlogTemplate[] = BLOG_TEMPLATE_KEYS.map(
  (k) => BLOG_TEMPLATES[k],
);

export function getTemplate(key: string): BlogTemplate {
  return BLOG_TEMPLATES[key as BlogTemplateKey] ?? BLOG_TEMPLATES.generic;
}
