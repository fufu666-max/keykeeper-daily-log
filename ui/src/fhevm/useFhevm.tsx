import { ethers } from "ethers";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FhevmInstance } from "@zama-fhe/relayer-sdk/bundle";
import { createFhevmInstance } from "./internal/fhevm";

export type FhevmGoState = "idle" | "loading" | "ready" | "error";

declare global {
  interface Window {
    relayerSDK?: {
      initSDK: (options?: any) => Promise<boolean>;
      createInstance: (config: any) => Promise<FhevmInstance>;
      SepoliaConfig?: any;
      __initialized__?: boolean;
    };
  }
}

export function useFhevm(parameters: {
  provider: string | ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  enabled?: boolean;
  initialMockChains?: Readonly<Record<number, string>>;
}): {
  instance: FhevmInstance | undefined;
  refresh: () => void;
  error: Error | undefined;
  status: FhevmGoState;
} {
  const { provider, chainId, initialMockChains, enabled = true } = parameters;

  const [instance, _setInstance] = useState<FhevmInstance | undefined>(undefined);
  const [status, _setStatus] = useState<FhevmGoState>("idle");
  const [error, _setError] = useState<Error | undefined>(undefined);
  const [_isRunning, _setIsRunning] = useState<boolean>(enabled);
  const [_providerChanged, _setProviderChanged] = useState<number>(0);
  const _abortControllerRef = useRef<AbortController | null>(null);
  const _providerRef = useRef<string | ethers.Eip1193Provider | undefined>(provider);
  const _chainIdRef = useRef<number | undefined>(chainId);
  const _mockChainsRef = useRef<Record<number, string> | undefined>(initialMockChains);

  const refresh = useCallback(() => {
    if (_abortControllerRef.current) {
      _providerRef.current = undefined;
      _chainIdRef.current = undefined;
      _abortControllerRef.current.abort();
      _abortControllerRef.current = null;
    }

    _providerRef.current = provider;
    _chainIdRef.current = chainId;
    _setInstance(undefined);
    _setError(undefined);
    _setStatus("idle");

    if (provider !== undefined) {
      _setProviderChanged((prev) => prev + 1);
    }
  }, [provider, chainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    _setIsRunning(enabled);
  }, [enabled]);

  useEffect(() => {
    if (_isRunning === false) {
      if (_abortControllerRef.current) {
        _abortControllerRef.current.abort();
        _abortControllerRef.current = null;
      }
      _setInstance(undefined);
      _setError(undefined);
      _setStatus("idle");
      return;
    }

    if (_isRunning === true) {
      if (_providerRef.current === undefined) {
        _setInstance(undefined);
        _setError(undefined);
        _setStatus("idle");
        return;
      }

      if (!_abortControllerRef.current) {
        _abortControllerRef.current = new AbortController();
      }

      if (_abortControllerRef.current.signal.aborted) {
        return;
      }

      _setStatus("loading");
      _setError(undefined);

      const thisSignal = _abortControllerRef.current.signal;
      const thisProvider = _providerRef.current;
      const thisRpcUrlsByChainId = _mockChainsRef.current;

      const createInstance = async () => {
        try {
          const inst = await createFhevmInstance({
            provider: thisProvider,
            mockChains: thisRpcUrlsByChainId,
            signal: thisSignal,
            onStatusChange: (status) => {
              if (status === "creating") {
                _setStatus("loading");
              }
            },
          });

          if (thisSignal.aborted) return;

          if (thisProvider !== _providerRef.current) {
            return;
          }

          _setInstance(inst);
          _setError(undefined);
          _setStatus("ready");
        } catch (e: any) {
          if (thisSignal.aborted) {
            return;
          }

          if (thisProvider !== _providerRef.current) {
            return;
          }

          const errorMessage = e?.message || String(e);
          if (errorMessage.includes("Failed to fetch") || errorMessage.includes("fetch")) {
            _setInstance(undefined);
            _setError(undefined);
            _setStatus("idle");
            return;
          }

          console.error(`[useFhevm] Error creating FHEVM instance:`, e);
          const enhancedError = new Error(errorMessage);
          enhancedError.name = e.name || "FHEVMInitializationError";
          if (e.stack) {
            enhancedError.stack = e.stack;
          }

          _setInstance(undefined);
          _setError(enhancedError);
          _setStatus("error");
        }
      };

      createInstance();
    }
  }, [_isRunning, _providerChanged]);

  return { instance, refresh, error, status };
}

