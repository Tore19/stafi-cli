#!/usr/bin/env node
import yargs from "yargs";
import cmdBot from "./src/bot";
import { whereisPj } from "./src/util";

// main
(async () => {
    const pj = whereisPj();

    // enable logger
    if (process.env.LOGGER === undefined) {
        process.env.LOGGER = "INFO";
    }

    // parser
    const _ = yargs
        .usage("stacli <technical@stafi.io>")
        .help("help").alias("help", "h")
        .version("version", pj.version).alias("version", "V")
        .command(cmdBot)
        .argv;

    // show help if no input
    if (process.argv.length < 3) {
        yargs.showHelp();
    }
})();
