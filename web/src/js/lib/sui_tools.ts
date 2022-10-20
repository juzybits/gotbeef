/// Helpers to interact with the Sui network and with the Sui browser wallet

import { JsonRpcProvider } from '@mysten/sui.js';
import { SuiWalletAdapter } from '@mysten/wallet-adapter-sui-wallet';
import { isProd } from './common';

const GOTBEEF_PACKAGE = isProd ? '0xba934d0fcdc164d2bd3a26ac6c21b119926b9e53' : '0x34bf43798814a94b5c59c583924fe9ae92f75a82';
const GAS_BUDGET = 2000;
const rpc = new JsonRpcProvider('https://fullnode.devnet.sui.io:443');
const wallet = new SuiWalletAdapter();

/* Wallet functions */

export async function connect(): Promise<void> {
    return wallet.connect();
}

export async function disconnect(): Promise<void> {
    return wallet.disconnect();
}

export function isConnected(): bool {
    return wallet.connected;
}

/// Get the addresses from the current wallet
export async function getAddresses(): Promise<string[]> {
    return wallet.getAccounts().then(accounts => {
        if (!accounts) {
            throw 'No accounts found'; // should never happen
        }
        return accounts;
    });
}

/* RPC functions */

/// Represents a `gotbeef::bet::Bet<T>` Sui object.
export type Bet = {
    id: string, // The Sui object UID
    collatType: string, // The type of collateral, i.e. the `T` in `Bet<T>`
    title: string,
    description: string,
    quorum: number,
    size: number,
    players: string[],
    judges: string[],
    phase: string,
    funds: object,
    votesByJudge: object,
    votesByPlayer: object,
    winner?: string,
};

/// Fetch and parse a `gotbeef::bet::Bet<T>` Sui object into our custom Bet type
export async function getBet(objId: string): Promise<Bet|null> {
    console.debug('[getBet] Looking up:', objId);

    const getPhaseName = (phaseCode: number): string => {
        return ['funding', 'voting', 'settled', 'canceled', 'stalemate'][phaseCode];
    };

    const getCollateralType = (betType: string): string => {
        const match = betType.match(/<(.+)>$/);
        return match ? match[1] : 'ERROR_TYPE_NOT_FOUND';
    };

    const betTypeRegex = new RegExp(`^${GOTBEEF_PACKAGE}::bet::Bet<0x.+::.+::.+>$`);
    return rpc.getObject(objId)
        .then(obj => {
            if (obj.status != 'Exists') {
                console.warn('[getBet] Object does not exist. Status:', obj.status);
                return null;
            } else
            if (!obj.details.data.type.match(betTypeRegex)) {
                // TODO: '0x0ab' is returned as '0xab' by the RPC
                console.warn('[getBet] Found wrong object type:', obj.details.data.type);
                return null;
            } else {
                console.debug('[getBet] Found bet object:', obj);

                const fields = obj.details.data.fields;

                // Parse `Bet.funds: VecMap<address, Coin<T>>`
                let funds = fields.funds.fields.contents || [];
                let fundsByPlayer = new Map(funds.map(obj =>
                    [obj.fields.key, obj.fields.value.fields.balance]
                ));

                // Parse `Bet.votes: VecMap<address, address>`
                let votes = fields.votes.fields.contents || [];
                let votesByJudge = new Map();
                let votesByPlayer = new Map();
                votes.forEach(obj => {
                    let judgeAddr = obj.fields.key;
                    let playerAddr = obj.fields.value;
                    votesByJudge.set(judgeAddr, playerAddr);
                    votesByPlayer.set(playerAddr, 1 + (votesByPlayer.get(playerAddr) || 0) );
                });

                const bet: Bet = {
                    id: fields.id.id,
                    collatType: getCollateralType(obj.details.data.type),
                    title: fields.title,
                    description: fields.description,
                    quorum: fields.quorum,
                    size: fields.size,
                    players: fields.players,
                    judges: fields.judges,
                    phase: getPhaseName(fields.phase),
                    funds: fundsByPlayer,
                    votesByJudge: votesByJudge,
                    votesByPlayer: votesByPlayer,
                    winner: typeof fields.winner === 'object' ? '' : fields.winner,
                };
                return bet;
            }
        })
        .catch(error => {
            console.warn('[getBet] RPC error:', error.message);
            return null;
        });
}

/// Get all `Coin<T>` objects owned by the current address
export async function getCoinObjects(type: string): Promise<any[]> {
    console.debug('[getCoinObjects] Looking for Coin objects of type:', type);
    const addresses = await getAddresses();
    return rpc.getObjectsOwnedByAddress(addresses[0])
        .then(objectsInfo => {
            const expectedType = `0x2::coin::Coin<${type}>`;
            let objectIds = objectsInfo.reduce((selected, obj) => {
                if (obj.type == expectedType)
                    selected.push(obj.objectId);
                return selected;
            }, []);
            return rpc.getObjectBatch(objectIds)
                .then(objectsData => { return objectsData })
                .catch(error => []);
        })
        .catch(error => []);
}

/* Functions to call the `public entry` functions in the `gotbeef::bet` Sui package */

export async function createBet(
    currency: string, // e.g. '0x2::sui::SUI'
    title: string,
    description: string,
    quorum: number,
    size: number,
    players: string[],
    judges: string[],
): Promise<SuiTransactionResponse>
{
    console.debug(`[createBet] Calling bet::create on package: ${GOTBEEF_PACKAGE}`);
    return wallet.executeMoveCall({
        packageObjectId: GOTBEEF_PACKAGE,
        module: 'bet',
        function: 'create',
        typeArguments: [ currency ],
        arguments: [
            title,
            description,
            quorum,
            size,
            players,
            judges,
        ],
        gasBudget: GAS_BUDGET,
    });
}

export async function fundBet(bet: Bet, coin: string): Promise<SuiTransactionResponse>
{
    console.debug(`[fundBet] Calling bet::fund on package: ${GOTBEEF_PACKAGE}`);
    return wallet.executeMoveCall({
        packageObjectId: GOTBEEF_PACKAGE,
        module: 'bet',
        function: 'fund',
        typeArguments: [ bet.collatType ],
        arguments: [
            bet.id,
            coin,
        ],
        gasBudget: GAS_BUDGET,
    });
}

export async function castVote(bet: Bet, player_addr: string): Promise<SuiTransactionResponse>
{
    console.debug(`[castVote] Calling bet::vote on package: ${GOTBEEF_PACKAGE}`);
    return wallet.executeMoveCall({
        packageObjectId: GOTBEEF_PACKAGE,
        module: 'bet',
        function: 'vote',
        typeArguments: [ bet.collatType ],
        arguments: [
            bet.id,
            player_addr,
        ],
        gasBudget: GAS_BUDGET,
    });
}


export async function cancelBet(bet: Bet): Promise<SuiTransactionResponse>
{
    console.debug(`[cancelBet] Calling bet::cancel on package: ${GOTBEEF_PACKAGE}`);
    return wallet.executeMoveCall({
        packageObjectId: GOTBEEF_PACKAGE,
        module: 'bet',
        function: 'cancel',
        typeArguments: [ bet.collatType ],
        arguments: [
            bet.id,
        ],
        gasBudget: GAS_BUDGET,
    });
}

/* Other helpers */

export function getErrorName(error: string): string {
    const ERROR_NAMES = { // from bet.move
        // create()
        '0': 'E_JUDGES_CANT_BE_PLAYERS',
        '2': 'E_INVALID_NUMBER_OF_PLAYERS',
        '3': 'E_INVALID_NUMBER_OF_JUDGES',
        '4': 'E_DUPLICATE_PLAYERS',
        '5': 'E_DUPLICATE_JUDGES',
        '6': 'E_INVALID_QUORUM',
        '7': 'E_INVALID_BET_SIZE',
        // fund()
        '100': 'E_ONLY_PLAYERS_CAN_FUND',
        '101': 'E_ALREADY_FUNDED',
        '102': 'E_FUNDS_BELOW_BET_SIZE',
        '103': 'E_NOT_IN_FUNDING_PHASE',
        // vote()
        '200': 'E_NOT_IN_VOTING_PHASE',
        '201': 'E_ONLY_JUDGES_CAN_VOTE',
        '202': 'E_ALREADY_VOTED',
        '203': 'E_PLAYER_NOT_FOUND',
        // cancel()
        '300': 'E_CANCEL_BET_HAS_FUNDS',
        '301': 'E_CANCEL_NOT_AUTHORIZED',
    };

    const match = error.match(/^MoveAbort.+, (\d+)\)$/)
    if (!error.match(/^MoveAbort/)) {
        return error;
    }
    const errCode = match[1];
    return ERROR_NAMES[errCode] || error;
}
