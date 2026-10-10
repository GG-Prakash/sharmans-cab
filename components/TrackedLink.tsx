import type { AnchorHTMLAttributes, ReactNode } from "react";
import type { TrackEvent } from "@/lib/track";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  event: TrackEvent;
  location: string;
  children: ReactNode;
};

// Server-renderable link; the click is pushed to dataLayer by <ClickTracker />.
export default function TrackedLink({ event, location, children, ...rest }: Props) {
  const external = rest.href.startsWith("http");
  return (
    <a
      {...rest}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      data-track={event}
      data-cta={location}
    >
      {children}
    </a>
  );
}
