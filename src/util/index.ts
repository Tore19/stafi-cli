import { Config, TYPES_URL } from "./src/cfg";
import { download } from "./src/download";
import { log } from "./src/log";
import { whereisPj } from "./src/pj";
import chalk from "chalk";

/**
 * types
 */
interface IDoubleNodeWithMerkleProof {
    dag_nodes: string[],
    proof: string[],
}

// exports
export {
    Config,
    chalk,
    IDoubleNodeWithMerkleProof,
    download,
    log,
    TYPES_URL,
    whereisPj,
}
