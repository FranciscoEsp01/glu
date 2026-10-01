import { createContext, useContext } from 'react';
export const AccountContext = createContext({ email: '', active: false });
export const useAccount = () => useContext(AccountContext);
