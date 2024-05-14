import * as fs from "fs/promises";
import * as path from "path";
import { promisify } from "util";
import { exec as cbExec } from "child_process";
const exec = promisify(cbExec);

const writeSummary = (text) => fs.appendFile(process.env.GITHUB_STEP_SUMMARY, text);
await writeSummary("# Update plugin(s) notice\n");

/** @type URL[] */
const [pl, rest] = process.env.PLUGINS.split(" ").map((pl) => new URL(pl.replace(/\/*$/, "/")));

pl.pathname = pl.pathname.replace(/\/+/g, "/");
if (rest) throw new Error("Only update plugin notice once at a time!");

console.log(`> ${pl}`);

try {
    const source = pl.host + pl.pathname;

    const manifest = JSON.parse(await fs.readFile(path.join(source, "manifest.json"), "utf8"));
    manifest.bunny ??= {};

    if (process.env.NOTICE) {
        manifest.bunny.issueNotice = process.env.NOTICE;
    } else {
        delete manifest.bunny.issueNotice;
    }

    await fs.writeFile(path.join(source, "manifest.json"), JSON.stringify(manifest));

    /** @type any[] */
    let plugins = JSON.parse(await fs.readFile("plugins-full.json", "utf8"));
    const index = plugins.findIndex((p) => p.vendetta.original === source);
    if (index === -1) plugins.push(manifest);
    else plugins[index] = manifest;

    await fs.writeFile("plugins.json", JSON.stringify(plugins.map((p) => p.vendetta.original)));
    await fs.writeFile("plugins-full.json", JSON.stringify(plugins));

    const add = await exec("git add --all");
    if (add.stderr) throw add.stderr;

    const commit = await exec(`git commit --allow-empty -m "[CI] Updated notice ${pl}"`);
    if (commit.stderr) throw commit.stderr;

    console.log("Successfully updated notice");

    const now = await exec(`git rev-list HEAD -1`);
    if (!now.stderr)
        await writeSummary(`- https://bunny-mod.github.io/plugins-proxy/${source}  \nhttps://github.com/vd-plugins/proxy/commit/${now.stdout.trim()}\n\n`);
} catch (e) {
    console.error(e);
}