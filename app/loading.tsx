"use client";

import { Spinner } from "@fluentui/react-components";

export default function Loading() {
  return (
    <main className="shell">
      <Spinner label="Loading live YNAB balances..." />
    </main>
  );
}
