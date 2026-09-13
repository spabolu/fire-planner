"use client";

import {
  createDOMRenderer,
  FluentProvider,
  RendererProvider,
  renderToStyleElements,
  SSRProvider,
  webLightTheme,
} from "@fluentui/react-components";
import { useServerInsertedHTML } from "next/navigation";
import { type ReactNode, useState } from "react";

export function Providers({ children }: { children: ReactNode }) {
  const [renderer] = useState(() => createDOMRenderer());
  useServerInsertedHTML(() => <>{renderToStyleElements(renderer)}</>);
  return (
    <RendererProvider renderer={renderer}>
      <SSRProvider>
        <FluentProvider theme={webLightTheme}>{children}</FluentProvider>
      </SSRProvider>
    </RendererProvider>
  );
}
