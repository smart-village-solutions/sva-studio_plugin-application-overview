/** Context-bound loading and optimistic concurrency without automatic write retries. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  readSessionAccessSnapshot,
  subscribeSessionAccessSnapshot,
} from "@sva/plugin-sdk";
import {
  readWorkspaceConfiguration,
  type WorkspaceConfiguration,
} from "./contract.js";
const endpoint = "/api/v1/plugins/application-workspace";
export const useWorkspaceSession = () =>
  useSyncExternalStore(
    subscribeSessionAccessSnapshot,
    readSessionAccessSnapshot,
    readSessionAccessSnapshot,
  );
const saveConfiguration = async (
  configuration: WorkspaceConfiguration,
  key: string,
  current: { current: string },
): Promise<WorkspaceConfiguration> => {
  const response = await fetch(endpoint + "/settings", {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(configuration),
  });
  if (current.current !== key) throw Error("context_changed");
  if (!response.ok)
    throw Error(
      response.status === 409
        ? "conflict"
        : response.status === 400
          ? "invalid"
          : "unknown",
    );
  const payload = (await response.json()) as { data?: unknown };
  if (current.current !== key) throw Error("context_changed");
  return readWorkspaceConfiguration(payload.data);
};
export const useWorkspace = (settings: boolean) => {
  const session = useWorkspaceSession();
  const key = JSON.stringify([
    session.isResolved,
    session.subjectId,
    session.instanceId,
    session.organizationId,
    session.assignedModules,
    session.permissionActions,
  ]);
  const current = useRef(key);
  current.current = key;
  const [state, setState] = useState<{
    key: string;
    data: WorkspaceConfiguration | null;
    loading: boolean;
    error: boolean;
  }>({ key, data: null, loading: true, error: false });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (
      !session.isResolved ||
      !session.instanceId ||
      !session.assignedModules.includes("application-workspace")
    ) {
      setState({ key, data: null, loading: false, error: true });
      return;
    }
    setState({ key, data: null, loading: true, error: false });
    void fetch(endpoint + (settings ? "/settings" : ""), {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw Error("load_failed");
        const payload: unknown = await response.json();
        const data = readWorkspaceConfiguration(
          (payload as { data?: unknown }).data,
        );
        if (current.current === key && !controller.signal.aborted)
          setState({ key, data, loading: false, error: false });
      })
      .catch(() => {
        if (current.current === key && !controller.signal.aborted)
          setState({ key, data: null, loading: false, error: true });
      });
    return () => controller.abort();
  }, [key, settings, retry]);
  const save = useCallback(
    (configuration: WorkspaceConfiguration) =>
      saveConfiguration(configuration, key, current),
    [key],
  );
  const reload = () => setRetry((n) => n + 1);
  return {
    session,
    key,
    configuration: state.key === key ? state.data : null,
    loading: state.key !== key || state.loading,
    error: state.key === key && state.error,
    reload,
    save,
  };
};
