import { Router, type NextFunction, type Request, type Response } from "express"
import {
  hasGithubCredentials,
  hasGoogleCredentials,
} from "@workspace/auth/social-provider"
import { DEFAULT_AUTH_SETTING } from "@workspace/core/config"
import {
  getSetting,
  getSettingsByNames,
  type Settings,
} from "../services/settings/get-setting.service"
import { normalizeHomeFeedSettings } from "../services/settings/home-feed-setting.service"

const router: Router = Router()

// Only values needed before authentication belong here. Never expose credentials.
const PUBLIC_SETTING_NAMES = new Set([
  "auth_setting",
  "advert_hobby",
  "seo_setting",
  "home_feed_setting",
])

function getPublicAuthSetting(value: unknown): typeof DEFAULT_AUTH_SETTING {
  const setting =
    value && typeof value === "object"
      ? (value as Partial<typeof DEFAULT_AUTH_SETTING>)
      : {}
  const login = setting.login ?? DEFAULT_AUTH_SETTING.login
  const register = setting.register ?? DEFAULT_AUTH_SETTING.register

  return {
    ...DEFAULT_AUTH_SETTING,
    ...setting,
    login: {
      ...DEFAULT_AUTH_SETTING.login,
      ...login,
      social: {
        google: Boolean(login.social?.google && hasGoogleCredentials),
        github: Boolean(login.social?.github && hasGithubCredentials),
      },
    },
    register: {
      ...DEFAULT_AUTH_SETTING.register,
      ...register,
      social: {
        google: Boolean(register.social?.google && hasGoogleCredentials),
        github: Boolean(register.social?.github && hasGithubCredentials),
      },
    },
  }
}

function sanitizePublicSettings(
  settings: Settings,
  requestedNames: string[]
): Settings {
  return {
    ...settings,
    ...(requestedNames.includes("auth_setting")
      ? { auth_setting: getPublicAuthSetting(settings.auth_setting) }
      : {}),
    ...(requestedNames.includes("home_feed_setting")
      ? {
          home_feed_setting: normalizeHomeFeedSettings(
            settings.home_feed_setting
          ),
        }
      : {}),
  }
}

function parseRequestedNames(value: unknown): string[] | null {
  if (value === undefined) return [...PUBLIC_SETTING_NAMES]

  const values = Array.isArray(value) ? value : [value]
  const names = values
    .flatMap((item) => (typeof item === "string" ? item.split(",") : []))
    .map((name) => name.trim())
    .filter(Boolean)

  const uniqueNames = [...new Set(names)]

  if (
    uniqueNames.length === 0 ||
    uniqueNames.length > PUBLIC_SETTING_NAMES.size
  ) {
    return null
  }

  return uniqueNames.every((name) => PUBLIC_SETTING_NAMES.has(name))
    ? uniqueNames
    : null
}

router.get("/", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const names = parseRequestedNames(req.query.names)

    if (!names) {
      res.status(400).json({ error: "Invalid or non-public setting names" })
      return
    }

    const settings = sanitizePublicSettings(
      await getSettingsByNames(names),
      names
    )
    res.status(200).json({ settings })
  } catch (error) {
    next(error)
  }
})

router.get(
  "/:name",
  async (req: Request<{ name: string }>, res: Response, next: NextFunction) => {
    try {
      const name = req.params.name.trim()

      if (!PUBLIC_SETTING_NAMES.has(name)) {
        res.status(404).json({ error: "Setting not found" })
        return
      }

      const setting = await getSetting(name)

      if (name === "auth_setting") {
        res.status(200).json({ setting: getPublicAuthSetting(setting) })
        return
      }

      if (setting === null || setting === undefined) {
        res.status(404).json({ error: "Setting not found" })
        return
      }

      res.status(200).json({ setting })
    } catch (error) {
      next(error)
    }
  }
)

export default router
