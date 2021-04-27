import {
  failure,
  fold,
  fromEither,
  initial,
  isFailure,
  isInitial,
  isPending,
  isSuccess,
  pending,
  RemoteData,
  success,
} from "@devexperts/remote-data-ts";
import { flow, FunctionN, tuple } from "fp-ts/function";
import { TaskEither } from "fp-ts/TaskEither";

/**
 * The {@link RefreshableRemoteData} type represents a value that can be refreshed without losing
 * the existing state. It does so using a pair of {@link RemoteData} values where one always
 * represents the "current" value, while the other is used to keep track of network requests in the
 * background. Depending on the update strategy, the "current" value will eventually be replaced
 * by the "request" value.
 */
export type RefreshableRemoteData<E, A> = {
  /* The `current` value represents the cached (stale) value that represents the latest loaded data */
  current: RemoteData<E, A>;
  /* The `request` value represents the background request that will be used to refresh the cache */
  request: RemoteData<E, A>;
};

/**
 * Create a {@link RefreshableRemoteData} value from a {@link RemoteData} value
 */
export const fromRemoteData = <E, A>(current: RemoteData<E, A>): RefreshableRemoteData<E, A> => ({
  current,
  request: initial,
});

/**
 * If a request is pending, the {@link RefreshableRemoteData} is in a "refreshing" state and no
 * further network requests should be sent.
 */
export const isRefreshing = <E, A>({ request }: RefreshableRemoteData<E, A>): boolean =>
  isPending(request);

/**
 * Given a {@link RefreshableRemoteData}, the stale-while-revalidate refresh strategy will
 *
 * - return an initial or pending value as long as no data has been fetched
 * - keep returning the current value until it is replaced by another success or failure value
 * - keep returning a failure value only as long as it is not being refreshed, in which case
 *   it will fall back to a pending value
 *
 * @see {@link staleIfError}
 */
export const staleWhileRevalidate = <E, A>(
  current: RemoteData<E, A>
): FunctionN<[RemoteData<E, A>], RefreshableRemoteData<E, A>> =>
  fold(
    () => ({ current, request: initial }),
    () => ({ current: isInitial(current) ? pending : current, request: pending }),
    (e) => ({ current: failure(e), request: initial }),
    (x) => ({ current: success(x), request: initial })
  );

/**
 * Given a {@link RefreshableRemoteData}, the stale-if-error refresh strategy will
 *
 * - return an initial or pending value as long as no data has been fetched
 * - return a failure only if no data has been previously fetched; newer failures replace older ones
 * - keep returning the cached success value indefinitely unless it is replaced by another success value
 *
 * @see {@link staleWhileRevalidate}
 */
export const staleIfError = <E, A>(
  current: RemoteData<E, A>
): FunctionN<[RemoteData<E, A>], RefreshableRemoteData<E, A>> =>
  fold(
    () => ({ current, request: initial }),
    () => ({
      current: isInitial(current) || isFailure(current) ? pending : current,
      request: pending,
    }),
    (e) => ({ current: isSuccess(current) ? current : failure(e), request: initial }),
    (x) => ({ current: success(x), request: initial })
  );

/**
 * Build a function to update a {@link RefreshableRemoteData} with a new {@link RemoteData} value
 * using the given strategy.
 */
export const refreshWithStrategy = (strategy = staleWhileRevalidate) => <E, A>(
  rrd: RefreshableRemoteData<E, A>
): FunctionN<[RemoteData<E, A>], RefreshableRemoteData<E, A>> => strategy(rrd.current);

/**
 * Transition a {@link RefreshableRemoteData} value to the next state using the
 * {@link staleWhileRevalidate} strategy.
 */
export const refreshSWR = refreshWithStrategy(staleWhileRevalidate);

/**
 * Transition a {@link RefreshableRemoteData} value to the next state using the
 * {@link staleIfError} strategy.
 */
export const refreshSIE = refreshWithStrategy(staleIfError);

/**
 * Transition a {@link RefreshableRemoteData} value to the next state.
 * @see {@link refreshSWR}
 */
export const refresh = refreshSWR;

/**
 * Transition a {@link RefreshableRemoteData} value to the next state using a network request. The
 * first value of the returned tuple represents the intermediary request state. The second value is
 * a promise that will resolve to the final value.
 */
export const refreshRequest = <E, A>(rrd: RefreshableRemoteData<E, A>) => (
  run: TaskEither<E, A>
): [RefreshableRemoteData<E, A>, Promise<RefreshableRemoteData<E, A>>] => {
  if (isRefreshing(rrd)) return tuple(rrd, Promise.resolve(rrd));

  const next = refresh(rrd)(pending);
  const refreshNext = refresh(next);
  return tuple(next, run().then(flow(fromEither, refreshNext)).catch(flow(failure, refreshNext)));
};
