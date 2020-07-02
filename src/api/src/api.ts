/* tslint:disable:variable-name */
import { log } from "../../util";
import { ApiPromise, SubmittableResult, WsProvider } from "@polkadot/api";
import { SubmittableExtrinsic } from "@polkadot/api/types";
import Keyring from "@polkadot/keyring";
import { KeyringPair } from "@polkadot/keyring/types";
import { DispatchError, EventRecord } from "@polkadot/types/interfaces/types";
import { cryptoWaitReady } from "@polkadot/util-crypto";
import { SignedBlock } from "@polkadot/types/interfaces";
import * as Subscan from "./subscan";
import { Extrinsic } from "./types/extrinsic";

export interface IErrorDoc {
    name: string;
    section: string;
    documentation: string[];
}

export interface IReceipt {
    index: string;
    proof: string;
    header_hash: string;
}

/**
 * Extrinsic Result
 *
 * @property {String} isOk - If extrinsic is ok
 * @property {String} isErr - If extrinsic is error
 * @property {String} blockHash - the hash of the block which contains our extrinsic
 * @property {String} exHash - Extrinsic hash
 * @property {IErrorDoc | undefined} docs - Extrinsic error doc
 */
export class ExResult {
    public isOk: boolean;
    public isErr: boolean;
    public exHash: string;
    public blockHash: string;
    public docs?: IErrorDoc;

    /**
     * Extrinsic Result
     *
     * @param {String} isOk - if extrinsic is ok
     * @param {String} blockHash - the hash of the block which contains our extrinsic
     * @param {String} exHash - Extrinsic hash
     * @param {IErrorDoc | undefined} docs - Extrinsic error doc
     */
    constructor(isOk: boolean, blockHash: string, exHash: string, docs?: IErrorDoc) {
        this.isOk = isOk;
        this.isErr = !isOk;
        this.blockHash = blockHash;
        this.exHash = exHash;
        this.docs = docs;
    }

    public toString(): string {
        if (this.docs) {
            return [
                `${this.docs.name}.${this.docs.section} `,
                `- ${this.docs.documentation.join(" ").slice(1)}`,
            ].join("");
        } else {
            return this.exHash;
        }
    }
}

/**
 * @class API - stafi api
 *
 * @method getBalance - get account balance
 * @method reset - reset eth relay header
 * @method relay - relay eth relay header
 * @method redeem - redeem ring
 * @method transfer - transfer ring
 *
 * @property {KeyringPair} account - stafi account
 * @property {ApiPromise} ap - raw polkadot api
 */
export class API {
    /**
     * new stafi account from seed
     *
     * @param {String} seed - seed of stafi account
     */
    public static async seed(seed: string) {
        await cryptoWaitReady();
        return new Keyring({ type: "sr25519" }).addFromUri(seed);
    }

    /**
     * new stafi account from mnemonic
     *
     * @param {String} mnemonic - mnemonic of stafi account
     */
    public static async memrics(mnemonic: string) {
        await cryptoWaitReady();
        return new Keyring({ type: "sr25519" }).addFromMnemonic(mnemonic);
    }

    /**
     * init stafi api async
     *
     * @param {KeyringPair} account - stafi account
     * @param {Record<string, any>} types - types of stafi
     * @param {String} node - the ws address of stafi
     *
     * @example
     * ```js
     * const cfg = new Config();
     * const seed = await API.seed(cfg.seed);
     * const api = await API.new(seed, cfg.node, cfg.types);
     * ```
     */
    public static async new(
        seed: string,
        node: string,
        types: Record<string, any>,
    ): Promise<API> {
        const api = await ApiPromise.create({
            provider: new WsProvider(node),
            types,
        });

        const account = await API.seed(seed);
        log.trace("init api succeed");
        return new API(account, (api as ApiPromise), types);
    }

    public account: KeyringPair;
    public types: Record<string, any>;
    public _: ApiPromise;

    /**
     * init stafi api
     *
     * @description please use `API.new` instead
     *
     * @param {KeyringPair} account - stafi account
     * @param {ApiPromise} ap - raw polkadot api
     */
    constructor(account: KeyringPair, ap: ApiPromise, types: Record<string, any>) {
        this.account = account;
        this.types = types;
        this._ = ap;
    }

    /**
     * get the specify extrinsic
     *
     * @param {string} hash - hash of extrinsic
     */
    public static async getExtrinsic(hash: string): Promise<Extrinsic> {
        return await Subscan.getExtrinsic(hash);
    }

    /**
     * get ring balance by stafi account address
     *
     * @param {string} addr - account address of stafi
     */
    public async getBalance(addr: string): Promise<string> {
        const account = await this._.query.system.account(addr);
        return account.data.free.toString();
    }

    /**
     * get the specify block
     *
     * @param {string|number} block - hash or number of the block
     */
    public async getBlock(block: string | number): Promise<SignedBlock> {
        let hash: string = "";
        if (typeof block === "number") {
            const h = await this._.rpc.chain.getBlockHash(block);
            hash = h.toHex();
        }

        return await this._.rpc.chain.getBlock(hash);
    }

    /**
     * transfer ring to address
     *
     * @param {String} address - the address of receiver
     * @param {Number} amount - transfer amount
     */
    public async transfer(addr: string, amount: number): Promise<ExResult> {
        const ex = this._.tx.balances.transfer(addr, amount);
        return await this.blockFinalized(ex);
    }

    /**
     * block requests till block finalized
     *
     * @param {SubmittableExtrinsic<"promise">} ex - extrinsic
     * @param {Boolean} inBlock - if resolve when inBlock
     */
    private blockFinalized(
        ex: SubmittableExtrinsic<"promise">,
        inFinialize?: boolean,
    ): Promise<ExResult> {
        const res = new ExResult(
            false,
            "", // blockHash
            "", // exHash
        );

        return new Promise((resolve, reject) => {
            ex.signAndSend(this.account, {}, (sr: SubmittableResult) => {
                const status = sr.status;
                const events = sr.events;

                log(`Transaction status: ${status.type}`);
                log(status.toString());

                if (status.isInBlock) {
                    res.blockHash = status.asInBlock.toHex().toString();
                    res.exHash = ex.hash.toHex().toString();
                    if (!inFinialize) {
                        res.isOk = true;
                        resolve(res);
                    }

                    if (events) {
                        events.forEach((value: EventRecord): void => {
                            log(
                                "\t" +
                                value.phase.toString() +
                                `: ${value.event.section}.${value.event.method}` +
                                value.event.data.toString(),
                            );

                            if (value.event.method.indexOf("Failed") > -1) {
                                res.isOk = false;
                                res.isErr = true;
                                reject(res);
                            }

                            if ((value.event.data[0] as DispatchError).isModule) {
                                res.docs = this._.registry.findMetaError(
                                    (value.event.data[0] as DispatchError).asModule.toU8a(),
                                );

                                reject(res);
                            }
                        });
                    }
                } else if (status.isInvalid) {
                    log.warn("Invalid Extrinsic");
                    reject(res);
                } else if (status.isRetracted) {
                    log.warn("Extrinsic Retracted");
                    reject(res);
                } else if (status.isUsurped) {
                    log.warn("Extrinsic Usupred");
                    reject(res);
                } else if (status.isFinalized) {
                    res.isOk = true;
                    log(`Finalized block hash: ${res.blockHash}`);
                    resolve(res);
                }
            });
        });
    }
}
