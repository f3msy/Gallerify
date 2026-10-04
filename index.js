"use strict";

const { Authflow } = require("prismarine-auth");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const chalk = require("chalk");
const ora = require("ora");
const sharp = require("sharp");

const imageDir = String.raw`C:\Users\Administrator\Desktop\banner-tool\images`;
const cacheDir = path.join(__dirname, ".auth");
const linkMarker = path.join(cacheDir, "linked");
const apiEndpoint = "https://persona-secondary.franchise.minecraft-services.net/api/v1.0/gallery";
const bannerSize = { width: 1920, height: 1080 };
const authOptions = { flow: "sisu", authTitle: "0000000048183522", deviceType: "Android" };

const taggings = { ok: chalk.green("[O]"), err: chalk.red("[X]"), info: chalk.cyan("[I]") };
const log = (type, text) => console.log(`  ${taggings[type]} ${text}`);
const fit = (text) => text.slice(0, (process.stdout.columns || 80) - 8);

const account = () => (fs.existsSync(linkMarker) ? fs.readFileSync(linkMarker, "utf8").trim() : null);
const logout = () => fs.rmSync(cacheDir, { recursive: true, force: true });
const listImages = () =>
    fs.existsSync(imageDir)
        ? fs.readdirSync(imageDir).filter((file) => /\.(png|jpe?g|webp|gif)$/i.test(file)).sort()
        : [];

function select(title, items) {
    return new Promise((resolve) => {
        const { stdin, stdout } = process;
        let index = 0;
        let height = 0;

        const draw = () => {
            const lines = [
                ...title,
                ...items.flatMap((item, i) => [
                    ...(item.gap ? [""] : []),
                    i === index ? chalk.cyan.bold(`  > ${fit(item.label)}`) : `    ${fit(item.label)}`
                ])
            ];
            if (height) stdout.write(`\x1b[${height}A`);
            stdout.write(lines.map((line) => `\x1b[2K${line}`).join("\n") + "\n");
            height = lines.length;
        };

        const finish = (value) => {
            stdin.off("keypress", onKey);
            stdin.setRawMode(false);
            stdin.pause();
            stdout.write(`\x1b[${height}A\x1b[J\x1b[?25h`);
            resolve(value);
        };

        const onKey = (text, key = {}) => {
            if (key.ctrl && key.name === "c") return finish({ action: "exit" });
            if (key.name === "return") return finish(items[index].value);
            if (key.name === "up") index = (index + items.length - 1) % items.length;
            else if (key.name === "down") index = (index + 1) % items.length;
            else {
                const hit = items.find((item) => item.key && item.key === text?.toLowerCase());
                if (hit) return finish(hit.value);
            }
            draw();
        };

        stdin.setRawMode(true);
        stdin.resume();
        stdin.on("keypress", onKey);
        stdout.write("\x1b[?25l");
        draw();
    });
}

async function fetchGamertag(authflow) {
    try {
        const { userXUID, userHash, XSTSToken } = await authflow.getXboxToken();
        const response = await fetch(`https://profile.xboxlive.com/users/xuid(${userXUID})/profile/settings?settings=Gamertag`, {
            signal: AbortSignal.timeout(10_000),
            headers: { Authorization: `XBL3.0 x=${userHash};${XSTSToken}`, "x-xbl-contract-version": "3" }
        });
        return (await response.json()).profileUsers[0].settings[0].value;
    } catch {
        return "";
    }
}

async function getToken(spinner) {
    const authflow = new Authflow("banner-tool", cacheDir, authOptions, ({ user_code }) => {
        spinner.stop();
        log("info", `Log in at ${chalk.cyan(`https://microsoft.com/link?otc=${user_code}`)}`);
        log("info", `Code: ${chalk.bold(user_code)}`);
        spinner.start("Waiting for login...");
    });

    const token = (await authflow.getMinecraftBedrockServicesToken({ version: "1.26.21" }))?.mcToken;
    if (!token) throw new Error("No Minecraft token received.");

    fs.mkdirSync(cacheDir, { recursive: true });
    if (!account()) fs.writeFileSync(linkMarker, await fetchGamertag(authflow));
    return token;
}

async function uploadBanner(file, spinner) {
    const image = await sharp(path.join(imageDir, file))
        .rotate()
        .resize(bannerSize.width, bannerSize.height, { fit: "cover" })
        .jpeg({ quality: 92 })
        .toBuffer();

    const token = await getToken(spinner);
    spinner.text = "Uploading...";

    const response = await fetch(apiEndpoint, {
        method: "POST",
        signal: AbortSignal.timeout(30_000),
        headers: {
            Authorization: token,
            "Content-Type": "application/octet-stream",
            "x-ms-showcased-featured": "true",
            "x-ms-showcased-timetaken": new Date().toISOString(),
            "Content-Length": String(image.length)
        },
        body: image
    });

    if (!response.ok) {
        const expired = response.status === 401 || response.status === 403;
        if (expired) logout();
        const body = (await response.text()).slice(0, 200);
        throw new Error(`Server returned ${response.status}${expired ? " (login expired, you will be asked to log in again)" : ""} ${body}`);
    }
}

async function main() {
    readline.emitKeypressEvents(process.stdin);
    console.clear();
    console.log(`\n  ${chalk.bold.cyan("GALLERIFY")}\n  ${chalk.gray("-".repeat(40))}\n`);

    while (true) {
        const images = listImages();
        const name = account();

        const choice = await select(
            [
                `  Account:   ${name !== null ? chalk.green(name || "linked") : chalk.yellow("not linked (login on first upload)")}`,
                `  Images:    ${images.length}`,
                ...(images.length ? [] : [chalk.yellow(`  ${fit(`Add images to ${imageDir}`)}`)]),
                "",
                "  Select a banner:",
                ""
            ],
            [
                ...images.map((file) => ({ label: file, value: { file } })),
                { label: "[R] Refresh list", key: "r", value: { action: "refresh" }, gap: true },
                ...(name !== null ? [{ label: "[L] Log out", key: "l", value: { action: "logout" } }] : []),
                { label: "[Q] Exit", key: "q", value: { action: "exit" } }
            ]
        );

        if (choice.action === "exit") return;

        if (choice.action === "logout") {
            logout();
            log("ok", "Logged out.");
            console.log();
        } else if (choice.file) {
            const spinner = ora({ text: "Preparing image...", spinner: "line", discardStdin: false }).start();
            try {
                await uploadBanner(choice.file, spinner);
                spinner.stopAndPersist({ symbol: `  ${taggings.ok}`, text: `Banner set to ${chalk.cyan(choice.file)}` });
            } catch (error) {
                spinner.stopAndPersist({ symbol: `  ${taggings.err}`, text: error.message });
            }
            console.log();
        }
    }
}

main().catch((error) => {
    log("err", error.message);
    process.exitCode = 1;
});
