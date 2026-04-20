import test from "node:test";
import assert from "node:assert/strict";
import { renderCardHTML, type RenderableCard } from "@/lib/card-renderer";

const baseCard: RenderableCard = {
  issueNumber: 3,
  language: "hi",
  cardNumber: 1,
  tag: "Policy <cite index=\"1\"></cite>",
  headline: "Headline <cite index=\"2\"></cite>",
  summary: "Summary text &lt;cite index=\"3\"&gt;&lt;/cite&gt;",
  actionText: "Action <cite index=\"4\"></cite> now",
  sourceUrl: null,
  sourceName: "Desk <cite index=\"5\"></cite>",
};

test("renderCardHTML strips citation markup from all visible card text", () => {
  const html = renderCardHTML(baseCard);

  assert.doesNotMatch(html, /<cite/i);
  assert.doesNotMatch(html, /&lt;\s*\/?\s*cite/i);
  assert.doesNotMatch(html, /index=/i);
  assert.match(html, /Headline/);
  assert.match(html, /Summary text/);
  assert.match(html, /Action now/);
});

test("renderCardHTML does not render read-more anchor when source URL is missing", () => {
  const html = renderCardHTML(baseCard);

  assert.doesNotMatch(html, /<a href="https:\/\/aigreenwire\.com\/issues"/);
  assert.doesNotMatch(html, /और पढ़ें/);
});

test("renderCardHTML renders read-more anchor for valid source URL", () => {
  const html = renderCardHTML({
    ...baseCard,
    sourceUrl: "https://example.com/source",
  });

  assert.match(
    html,
    /<a href="https:\/\/example\.com\/source" target="_blank" rel="noopener noreferrer"/
  );
  assert.match(html, /और पढ़ें/);
});

test("renderCardHTML ignores invalid source URL protocols", () => {
  const html = renderCardHTML({
    ...baseCard,
    sourceUrl: "javascript:alert(1)",
  });

  assert.doesNotMatch(html, /<a href="javascript:alert\(1\)"/);
  assert.doesNotMatch(html, /और पढ़ें/);
});
