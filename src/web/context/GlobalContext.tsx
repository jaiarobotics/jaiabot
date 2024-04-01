import { createContext } from 'react';
import { defaultGlobalContext } from '../default-states/global-context';

export const globalContext = createContext(defaultGlobalContext)