"use client";

import { Button } from "@fluentui/react-components";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="shell">
      <h1>Could not load the planner</h1>
      <p>
        If you are setting up a local copy, run <code>npm run setup</code> to
        create the fictional private seed. Otherwise, restore valid private
        planner data and try again. Existing seeds are never overwritten
        automatically. No account data has been changed.
      </p>
      <Button onClick={retry}>Try again</Button>
    </main>
  );
}
