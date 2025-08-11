"use client";

import ClienteCard from "@/components/shared/clientcard";
import type { Locale } from "@/lib/i18n";

type ClienteActivo = {
  uid: string;
  email: string;
  name?: string;
  planName?: string;
  createdAt?: number;
  lang?: Locale; // <-- NUEVO
};

type Props = {
  clientes: ClienteActivo[];
};

export default function ClienteList({ clientes }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {clientes.map((client) => (
        <ClienteCard
          key={client.uid}
          uid={client.uid}
          email={client.email}
          name={client.name}
          planName={client.planName}
          createdAt={client.createdAt}
          lang={client.lang}   // <-- PASAMOS LANG
        />
      ))}
    </div>
  );
}
