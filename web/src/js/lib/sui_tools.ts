/// Helpers to interact with the Sui network

import { JsonRpcProvider, SuiTransactionResponse, GetObjectDataResponse, SuiObjectInfo} from '@mysten/sui.js';

export const GOTBEEF_PACKAGE = '0xa102ca70abc8c8747bc57da21197d38c6ddc6f0c';
export const rpc = new JsonRpcProvider('https://fullnode.devnet.sui.io:443');

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

    // Handle leading zeros ('0x00ab::bet::Bet' is returned as '0xab::bet::Bet' by the RPC)
    const packageName = GOTBEEF_PACKAGE.replace(/0x0+/, '0x0*'); // handle leading zeros
    const betTypeRegex = new RegExp(`^${packageName}::bet::Bet<0x.+::.+::.+>$`);
    return rpc.getObject(objId)
        .then((obj: GetObjectDataResponse) => {
            if (obj.status != 'Exists') {
                console.warn('[getBet] Object does not exist. Status:', obj.status);
                return null;
            }

            const details = obj.details as any;
            if (!details.data.type.match(betTypeRegex)) {
                console.warn('[getBet] Found wrong object type:', details.data.type);
                return null;
            } else {
                console.debug('[getBet] Found bet object:', obj);

                const fields = details.data.fields;

                // Parse `Bet.funds: VecMap<address, Coin<T>>`
                let funds = fields.funds.fields.contents || [];
                let fundsByPlayer = new Map(funds.map((obj: any) =>
                    [obj.fields.key, obj.fields.value.fields.balance]
                ));

                // Parse `Bet.votes: VecMap<address, address>`
                let votes = fields.votes.fields.contents || [];
                let votesByJudge = new Map();
                let votesByPlayer = new Map();
                votes.forEach((obj: any) => {
                    let judgeAddr = obj.fields.key;
                    let playerAddr = obj.fields.value;
                    votesByJudge.set(judgeAddr, playerAddr);
                    votesByPlayer.set(playerAddr, 1 + (votesByPlayer.get(playerAddr) || 0) );
                });

                const bet: Bet = {
                    id: fields.id.id,
                    collatType: getCollateralType(details.data.type),
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
export async function getCoinObjects(address: string, type: string): Promise<any[]> {
    console.debug('[getCoinObjects] Looking for Coin objects of type:', type);
    return rpc.getObjectsOwnedByAddress(address)
        .then((objectsInfo: SuiObjectInfo[]) => {
            const expectedType = `0x2::coin::Coin<${type}>`;
            let objectIds = objectsInfo.reduce((selected: string[], obj: SuiObjectInfo) => {
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

/// Get recent bet transactions
export async function getRecentTxns(limit: number): Promise<SuiTransactionResponse[]> {
    const errorCatcher = (error: any) => {
        console.warn('[getRecentTxns] RPC error:', error.message);
        return [];
    };

    // @ts-ignore
    const transactions = await rpc.client.batchRequest([{
        method: 'sui_getTransactions',
        args: [{ InputObject: GOTBEEF_PACKAGE }, null, limit, 'Descending'],
    }])
    .then(response => response[0].result.data)
    .catch(errorCatcher);

    return rpc.getTransactionWithEffectsBatch(transactions).catch(errorCatcher);
}

export function getErrorName(error?: string): string {
    if (!error) {
        return 'unknown error';
    }

    const noBalanceTxt = 'Unable to select a gas object with balance greater than or equal to';
    if (error.includes(noBalanceTxt)) {
        return 'Your wallet doesn\'t have enough balance to pay for the transaction';
    }

    const match = error.match(/^MoveAbort.+, (\d+)\)$/)
    if (!match) {
        return error;
    }
    const errCode = match[1];
    const errorNames: Record<string, string> = { // from bet.move
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
    return errorNames[errCode] || error;
}
