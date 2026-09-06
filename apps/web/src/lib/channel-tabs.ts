import { CHANNEL_TAB_IDS, type ChannelTabId } from "@workspace/core/types"

type VisibleChannelTabId = Exclude<ChannelTabId, "live">

function isVisibleChannelTab(tab: ChannelTabId): tab is VisibleChannelTabId {
  return tab !== "live"
}

export const channelTabIds = CHANNEL_TAB_IDS.filter(isVisibleChannelTab)
export type { ChannelTabId }

export function parseChannelTab(
  value: string | undefined,
  enabledTabs: ChannelTabId[],
  defaultTab: ChannelTabId
): ChannelTabId {
  const visibleTabs = enabledTabs.filter(isVisibleChannelTab)
  const fallback: VisibleChannelTabId =
    isVisibleChannelTab(defaultTab) && visibleTabs.includes(defaultTab)
      ? defaultTab
      : (visibleTabs[0] ?? "home")
  const candidate = value as ChannelTabId | undefined
  return candidate &&
    isVisibleChannelTab(candidate) &&
    visibleTabs.includes(candidate)
    ? candidate
    : fallback
}
