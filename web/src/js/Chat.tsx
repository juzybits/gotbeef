import React, { useEffect, useState } from 'react';

import { GetObjectDataResponse } from '@mysten/sui.js';
import { useWallet } from '@mysten/wallet-adapter-react';

import { ButtonConnect } from './components/ButtonConnect';
import { shorten } from './lib/common';
import { rpc } from './lib/sui_tools';

export function Chat(props: any)
{
    const POLYMEDIA_PACKAGE = '0x361124fc4279aa6e4dd2663c41d02dd17dbb9416';
    const CHAT_ID = '0x761841fd553a9326d9b4369638d0fd8393f49734';

    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState([]);

    const { connected, signAndExecuteTransaction } = useWallet();

    /* Effects */

    useEffect(() => {
        document.title = 'Got Beef? - Chat';
        reloadChat();
    }, []);

    useEffect(() => {
        scrollToEndOfChat();
    }, [messages]);

    /* Helpers */

    const reloadChat = async (): void =>
    {
        console.debug('[reloadChat] Fetching object:', CHAT_ID);
        rpc.getObject(CHAT_ID)
        .then((obj: GetObjectDataResponse) => {
            if (obj.status != 'Exists') {
                setError(`[reloadChat] Object does not exist. Status: ${obj.status}`);
            } else {
                setError('');
                const messages = obj.details.data.fields.messages;
                if (messages) {
                    setMessages( messages.map(msg => msg.fields) );
                }
            }
        })
        .catch(err => {
            setError(`[reloadChat] RPC error: ${err.message}`)
        });
    };

    const scrollToEndOfChat = async (): void => {
        var div = document.getElementById('messageList');
        div.scrollTop = div.scrollHeight;
    };

    /* Handlers */

    const onSubmitAddMessage = (e: any) => {
        e.preventDefault();
        setError('');
        console.debug(`[onSubmitAddMessage] Calling chat::add_message on package: ${POLYMEDIA_PACKAGE}`);
        signAndExecuteTransaction({
            kind: 'moveCall',
            data: {
                packageObjectId: POLYMEDIA_PACKAGE,
                module: 'chat',
                function: 'add_message',
                typeArguments: [],
                arguments: [
                    CHAT_ID,
                    Array.from( (new TextEncoder()).encode(message) ),
                ],
                gasBudget: 10000,
            }
        })
        .then((resp: any) => {
            if (resp.effects.status.status == 'success') {
                reloadChat();
                setMessage('');
            } else {
                setError(resp.effects.status.error);
            }
        })
        .catch(error => {
            setError(error.message);
        });
    };

    const onClickCreateChat = () => { // DEV_ONLY
        console.debug(`[onClickCreateChat] Calling item::create on package: ${POLYMEDIA_PACKAGE}`);
        signAndExecuteTransaction({
            kind: 'moveCall',
            data: {
                packageObjectId: POLYMEDIA_PACKAGE,
                module: 'chat',
                function: 'create',
                typeArguments: [],
                arguments: [
                    100, // max_size
                ],
                gasBudget: 10000,
            }
        })
        .then((resp: any) => {
            if (resp.effects.status.status == 'success') {
                console.debug('[onClickCreateChat] Success:', resp);
                const newObjId = resp.effects.created[0].reference.objectId;
                console.log(`https://explorer.devnet.sui.io/objects/${newObjId}`);
                console.log(newObjId);
            } else {
                setError(resp.effects.status.error);
            }
        })
        .catch(error => {
            setError(error.message);
        });
    };

    /* Render */

    const cssMessageList = {
        background: '#37393f',
        color: 'rgb(224, 224, 224)',
        fontSize: '0.9em',
        border: '4px solid black',
        borderRadius: '1em',
        maxHeight: '35em',
        overflowY: 'scroll',
    };
    const cssMessage = {
        padding: '0.8em 1em',
    };

    const cssAuthor = (author_address?: string) => {
        let red = parseInt( author_address.slice(2, 4), 16 );
        let green = parseInt( author_address.slice(4, 6), 16 );
        let blue = parseInt( author_address.slice(6, 8), 16 );
        let min_val = 127;
        if (red < min_val)   { red   = 255 - red; }
        if (green < min_val) { green = 255 - green; }
        if (blue < min_val)  { blue  = 255 - blue; }
        return {
            color: `rgb(${red}, ${green}, ${blue})`,
        };
    };

    return <div id='page'>

        <h2>CHAT</h2>
        <p>A message board to find other players.</p>

        <div id='messageList' style={cssMessageList}>{messages.map((msg, idx) =>
            <div key={idx} style={cssMessage}>
                <span style={cssAuthor(msg.author)}>{shorten(msg.author.slice(2), 3, 3, '..')}</span>: {msg.text}
            </div>
        )}
        </div>
        <br/>

        <form onSubmit={onSubmitAddMessage} className='button-container'>
            {connected && <>
                <input type='text' className='nes-input'
                    spellCheck='false' autoCorrect='off' autoComplete='off'
                    value={message} onChange={e => setMessage(e.target.value)} />
                <button type='submit' className='nes-btn is-primary'>SEND MESSAGE</button>
            </>}
            <ButtonConnect />
        </form>

        {error}

        {/*<br/> <br/> <hr/> <br/>
        <button onClick={onClickCreateChat}>CREATE NEW CHAT</button>
        <br/> <br/>*/}

    </div>;
}
