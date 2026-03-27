import { useState, useEffect } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useConnect } from "wagmi";
import { CHAIN_ID } from "~/lib/contracts/addresses";
import { cn } from "~/lib/utils";

interface WalletModalProps {
  children: React.ReactNode;
}

export function WalletModal({ children }: WalletModalProps) {
  const [open, setOpen] = useState(false);
  const { connectors, connect, isPending, error } = useConnect({
    mutation: {
      onSuccess: () => setOpen(false),
    },
  });
  const [connectingUid, setConnectingUid] = useState<string | null>(null);

  // Reset connecting state when modal closes
  useEffect(() => {
    if (!open) setConnectingUid(null);
  }, [open]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2",
            "rounded-2xl border border-golden-beige/15 bg-deep-charcoal p-6 shadow-2xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          )}
        >
          <Dialog.Title className="font-heading text-xl text-golden-beige mb-1">
            Connect Wallet
          </Dialog.Title>
          <Dialog.Description className="text-xs text-platinum-grey/40 mb-5">
            Select a wallet to connect
          </Dialog.Description>

          <div className="space-y-2">
            {connectors.map((connector) => {
              const isConnecting = isPending && connectingUid === connector.uid;
              return (
                <button
                  key={connector.uid}
                  onClick={() => {
                    setConnectingUid(connector.uid);
                    connect({ connector, chainId: CHAIN_ID });
                  }}
                  disabled={isPending}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border border-golden-beige/10 px-4 py-3",
                    "text-left text-sm text-platinum-grey/80 transition-all",
                    "hover:border-golden-beige/30 hover:bg-golden-beige/5",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    isConnecting && "border-golden-beige/30 bg-golden-beige/5",
                  )}
                >
                  {connector.icon ? (
                    <img
                      src={connector.icon}
                      alt=""
                      className="h-8 w-8 rounded-lg"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-golden-beige/10 bg-golden-beige/5 text-xs text-golden-beige/60">
                      {connector.name.charAt(0)}
                    </div>
                  )}
                  <span className="flex-1 font-medium">{connector.name}</span>
                  {isConnecting && (
                    <span className="text-xs text-golden-beige/50">
                      Connecting...
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="mt-3 text-xs text-red-400/80">
              {error.message.length > 100
                ? `${error.message.slice(0, 100)}...`
                : error.message}
            </p>
          )}

          <Dialog.Close asChild>
            <button
              className="mt-4 w-full rounded-xl border border-golden-beige/8 py-2.5 text-xs text-platinum-grey/40 transition-colors hover:text-platinum-grey/60"
              aria-label="Close"
            >
              Cancel
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
