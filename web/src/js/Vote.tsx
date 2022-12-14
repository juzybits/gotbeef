import React, { useState, SyntheticEvent } from 'react';
import { SuiTransactionResponse } from '@mysten/sui.js';
import { useWallet } from "@mysten/wallet-adapter-react";

import { GOTBEEF_PACKAGE, Bet, getErrorName } from './lib/sui_tools';
import { showConfetti } from './lib/confetti';

export function Vote(props: any) {

    const [error, setError] = useState('');

    const { signAndExecuteTransaction } = useWallet();
    const castVote = (bet: Bet, player_addr: string): Promise<SuiTransactionResponse> =>
    {
        console.debug(`[castVote] Calling bet::vote on package: ${GOTBEEF_PACKAGE}`);
        return signAndExecuteTransaction({
            kind: 'moveCall',
            data: {
                packageObjectId: GOTBEEF_PACKAGE,
                module: 'bet',
                function: 'vote',
                typeArguments: [ bet.collatType ],
                arguments: [
                    bet.id,
                    player_addr,
                ],
                gasBudget: 10000,
            }
        });
    };

    const onClickVote = (e: SyntheticEvent) => {
        const player_addr = (e.target as HTMLButtonElement).value;
        castVote(props.bet, player_addr)
        .then(resp => {
            const effects = resp.effects || resp.EffectsCert?.effects?.effects; // Sui/Ethos || Suiet
            if (effects.status.status == 'success') {
                showConfetti();
                setError('');
                props.reloadBet();
                props.setModal('');
                console.debug('[onClickVote] Success:', resp);
            } else {
                setError( getErrorName(effects.status.error) );
            }
        })
        .catch(error => {
            setError( getErrorName(error.message) );
        });
    };

    const onClickBack = () => {
        props.setModal('');
    };

    return <section className='bet-modal'>
        <h2>Vote</h2>
        Click the address of the winner:
        <br/>
        {
            props.bet.players.map((player: string) =>
                <div key={player} className='player-box'>
                    <button type='button' className='nes-btn is-primary' style={{overflowWrap: 'anywhere'}}
                        value={player} onClick={onClickVote}>{player}
                    </button>
                    <span className='player-box-answer'>
                        <b>ANSWER:</b> {props.bet.answers.get(player) || '-'}
                    </span>
                </div>
            )
        }
        <br/>
        <button type='button' className='nes-btn' onClick={onClickBack}>
            BACK
        </button>
        <br/>

        {error &&
        <React.Fragment>
            <br/>
            ERROR:
            <br/>
            {error}
            <br/>
        </React.Fragment>}
        <br/>
        <hr/>
    </section>;
}
