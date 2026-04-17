import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnsubscribeFooterLink } from "./unsubscribe-footer-link";

test("UnsubscribeFooterLink renders a standard anchor for mutating unsubscribe route", () => {
  const href = "/api/unsubscribe?token=11111111-1111-4111-8111-111111111111";
  const html = renderToStaticMarkup(<UnsubscribeFooterLink href={href} />);

  assert.match(html, /^<a /);
  assert.match(html, new RegExp(`href="${href.replace(/\?/g, "\\?")}"`));
  assert.match(html, /Unsubscribe from The AI Green Wire/);
});
