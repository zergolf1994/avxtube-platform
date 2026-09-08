import { createElement, type ComponentProps } from "react"
import { createNavigation } from "next-intl/navigation"

import { routing } from "./routing"

const navigation = createNavigation(routing)

export const { redirect, usePathname, useRouter, getPathname } = navigation

type LinkProps = ComponentProps<typeof navigation.Link>

// Next prefetches every visible Link in production. Most viewer destinations
// are dynamic data pages, so a grid used to fan one navigation out into dozens
// of Watch and Channel database queries. Keep navigation on demand by default;
// an individual low-cost link can still opt in with prefetch={true}.
export function Link(props: LinkProps) {
  return createElement(navigation.Link, { prefetch: false, ...props })
}
