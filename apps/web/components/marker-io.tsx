"use client";

import { useSession } from "next-auth/react";
import Script from "next/script";

const PROJECT_ID = process.env.NEXT_PUBLIC_MARKER_IO_PROJECT;

export function MarkerIO() {
  const { data: session } = useSession();

  if (!PROJECT_ID) return null;

  return (
    <>
      <Script id="marker-io-config" strategy="afterInteractive">
        {`
          window.markerConfig = {
            project: '${PROJECT_ID}',
            source: 'snippet',
            reporter: {
              email: '${session?.user?.email ?? ""}',
              fullName: '${session?.user?.name ?? ""}',
            },
          };
        `}
      </Script>
      <Script src="https://edge.marker.io/latest/shim.js" strategy="afterInteractive" />
    </>
  );
}
