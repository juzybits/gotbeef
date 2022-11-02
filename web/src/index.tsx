/*
   ___  ___ _____   ___ ___ ___ ___   ___
  / __|/ _ \_   _| | _ ) __| __| __| | __\
 | (_ | (_) || |   | _ \ _|| _|| _|    /_/
  \___|\___/ |_|   |___/___|___|_|    (_)
                   by @juzybits
*/

import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { App } from './js/App';
import { Chat } from './js/Chat';
import { Find } from './js/Find';
import { Home } from './js/Home';
import { New } from './js/New';
import { NotFound } from './js/NotFound';
import { View } from './js/View';

ReactDOM
    .createRoot( document.getElementById('app') as Element )
    .render(
        <BrowserRouter>
        <Routes>
            <Route path='/' element={<App />} >
                <Route index element={<Home />} />
                <Route path='new' element={<New />} />
                <Route path='find' element={<Find />} />
                <Route path='chat' element={<Chat />} />
                <Route path='bet/:uid' element={<View />} />
                <Route path='*' element={<NotFound />} />
            </Route>
        </Routes>
        </BrowserRouter>
    );
