import fs from "fs/promises";
import { $ } from "bun";
import { Logger } from "@rabbit-company/logger";

await fs.rm("./module", { recursive: true, force: true });
await fs.rm("./dist", { recursive: true, force: true });

const logger = new Logger();

logger.info("Start bulding module...");
let moduleBuild = await Bun.build({
	entrypoints: ["./src/qrcode.ts", "./src/payload.ts"],
	outdir: "./module",
	target: "browser",
	format: "esm",
});

if (moduleBuild.success) {
	logger.info("Bulding module complete");
} else {
	logger.error("Bulding module failed");
}

logger.info("Start building types...");
const types = await $`tsc -p tsconfig.build.json`.nothrow();

if (types.exitCode === 0) {
	logger.info("Building types complete");
} else {
	logger.error("Building types failed");
	logger.error(types.stderr.toString() || types.stdout.toString());
}

fs.cp("./src/index.html", "./dist/index.html", { recursive: true, force: true });

logger.info("Start bundling dist...");
let distBuild = await Bun.build({
	entrypoints: ["./src/index.ts"],
	outdir: "./dist",
	target: "browser",
	format: "esm",
	minify: true,
	sourcemap: "none",
	plugins: [],
});

if (distBuild.success) {
	logger.info("Bundling dist complete");
} else {
	logger.error("Bundling dist failed");
}
