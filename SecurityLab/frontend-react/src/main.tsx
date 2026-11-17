import React from 'react';
import {createRoot} from 'react-dom/client';
import {SecurityLab} from './SecurityLab.js';
import './workstation.css';
import {loadSavedLocale} from '../../src/i18n/index.js';
loadSavedLocale();
const root=document.getElementById('root');
if(!root) throw new Error('Missing React mount element');
createRoot(root).render(<SecurityLab/>);
