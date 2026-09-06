import type {
  AdvertSettings,
  DomainSettings,
  WorkerScraperSettings,
} from "@workspace/core/validators"
import { AdvertSection } from "./adverts-section"
import { DomainSection } from "./domain-section"
import { WorkerScraperSection } from "./worker-scraper-section"

// Add settings groups here as their editors become available.
export const SETTING_GROUPS = [
  { id: "domain", href: "/setting/domain" },
  { id: "adverts", href: "/setting/adverts" },
  { id: "seo", href: "/setting/seo" },
  { id: "homeFeed", href: "/setting/home-feed" },
  { id: "workerScraper", href: "/setting/worker-scraper" },
] as const

export function RenderSettingGroup({
  group,
  data,
}: {
  group: "domain" | "adverts" | "workerScraper"
  data:
    | DomainSettings
    | { advert_hobby: AdvertSettings }
    | WorkerScraperSettings
}) {
  switch (group) {
    case "domain":
      return <DomainSection data={data as DomainSettings} />
    case "adverts":
      return <AdvertSection data={data as { advert_hobby: AdvertSettings }} />
    case "workerScraper":
      return <WorkerScraperSection data={data as WorkerScraperSettings} />
  }
}
