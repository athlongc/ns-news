import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs"
import { join } from "node:path"
import { consola } from "consola"
import { projectDir } from "../shared/dir"

const publicDir = join(projectDir, "dist/output/public")
const nitroPublicDir = join(projectDir, "dist/output/server/chunks/public")

if (!existsSync(publicDir)) {
  consola.warn("Skipped Nitro public asset copy: dist/output/public does not exist")
  process.exit(0)
}

rmSync(nitroPublicDir, { force: true, recursive: true })
mkdirSync(nitroPublicDir, { recursive: true })
cpSync(publicDir, nitroPublicDir, { recursive: true })

consola.info("Copied Nitro public assets")
