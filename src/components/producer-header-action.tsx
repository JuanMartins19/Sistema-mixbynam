'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

type Action = { logout: () => Promise<void> } | null;
const ActionContext = createContext<Action>(null);
const RegisterContext = createContext<Dispatch<SetStateAction<Action>>>(() => {});

export function ProducerHeaderProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<Action>(null);
  return <RegisterContext.Provider value={setAction}><ActionContext.Provider value={action}>{children}</ActionContext.Provider></RegisterContext.Provider>;
}

export const useProducerHeaderAction = () => useContext(RegisterContext);

export default function ProducerHeaderAction() {
  const action = useContext(ActionContext);
  const pathname = usePathname();
  if (pathname === '/produtor' && action) {
    return <button className="producer-link text-button" onClick={() => void action.logout()}>Sair</button>;
  }
  return <Link className="producer-link" href="/produtor">Área do produtor <span aria-hidden>↗</span></Link>;
}
