import React from "react";

type UnsubscribeFooterLinkProps = {
  href: string;
};

export function UnsubscribeFooterLink({ href }: UnsubscribeFooterLinkProps) {
  return (
    <a
      href={href}
      className="text-xs text-green-600 underline transition hover:text-green-800"
    >
      Unsubscribe from The AI Green Wire
    </a>
  );
}
