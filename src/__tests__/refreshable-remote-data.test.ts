import {
  failure,
  getShow,
  initial,
  pending,
  RemoteData,
  success,
} from "@devexperts/remote-data-ts";
import {
  fromRemoteData,
  isRefreshing,
  refresh,
  RefreshableRemoteData,
  refreshRequest,
  staleIfError,
  staleWhileRevalidate,
} from "../refreshable-remote-data";
import { getStructShow, showString } from "fp-ts/Show";
import { either } from "fp-ts";

const { show } = getStructShow({
  current: getShow(showString, showString),
  request: getShow(showString, showString),
});

function formatTestName(current: TestRD, request: TestRD, expected: TestRRD) {
  return `${show({ current, request })} -> ${show(expected)}`;
}

type TestRD = RemoteData<string, string>;
type TestRRD = RefreshableRemoteData<string, string>;
type TestMatrix = Array<[TestRD, TestRD, TestRRD]>;

describe("API", () => {
  it("fromRemoteData", () => {
    const rrd: TestRRD = fromRemoteData(initial);
    expect(rrd).toStrictEqual<TestRRD>({ current: initial, request: initial });
  });

  it("isRefreshing", () => {
    expect(isRefreshing({ current: initial, request: initial })).toBe(false);
    expect(isRefreshing({ current: initial, request: pending })).toBe(true);
    expect(isRefreshing({ current: initial, request: failure(0) })).toBe(false);
    expect(isRefreshing({ current: initial, request: success(0) })).toBe(false);
  });

  it("refresh", () => {
    const rrd: TestRRD = fromRemoteData(initial);
    expect(refresh(rrd)(pending)).toStrictEqual<TestRRD>({ current: pending, request: pending });
  });

  it("refreshRequest (success)", () => {
    const rrd: TestRRD = fromRemoteData(initial);
    const [curr, next] = refreshRequest(rrd)(() => Promise.resolve(either.right("OK")));
    expect(curr).toStrictEqual<TestRRD>({ current: pending, request: pending });
    expect(next).resolves.toStrictEqual<TestRRD>({ current: success("OK"), request: initial });
  });

  it("refreshRequest (failure)", () => {
    const rrd: TestRRD = fromRemoteData(initial);
    const [curr, next] = refreshRequest(rrd)(() => Promise.resolve(either.left("FAIL")));
    expect(curr).toStrictEqual<TestRRD>({ current: pending, request: pending });
    expect(next).resolves.toStrictEqual<TestRRD>({ current: failure("FAIL"), request: initial });
  });

  it("refreshRequest (failure, reject)", () => {
    const rrd: TestRRD = fromRemoteData(initial);
    const [curr, next] = refreshRequest(rrd)(() => Promise.reject("FAIL"));
    expect(curr).toStrictEqual<TestRRD>({ current: pending, request: pending });
    expect(next).resolves.toStrictEqual<TestRRD>({ current: failure("FAIL"), request: initial });
  });
});

describe("Strategy", () => {
  const failcur = failure("Result failure");
  const failnxt = failure("Future failure");
  const succcur = success("Result success");
  const succnxt = success("Future success");

  describe("staleWhileRevalidate", () => {
    const matrix: TestMatrix = [
      [initial, initial, { current: initial, request: initial }],
      [initial, pending, { current: pending, request: pending }],
      [initial, failnxt, { current: failnxt, request: initial }],
      [initial, succnxt, { current: succnxt, request: initial }],

      [pending, initial, { current: pending, request: initial }],
      [pending, pending, { current: pending, request: pending }],
      [pending, failnxt, { current: failnxt, request: initial }],
      [pending, succnxt, { current: succnxt, request: initial }],

      [failcur, initial, { current: failcur, request: initial }],
      [failcur, pending, { current: failcur, request: pending }],
      [failcur, failnxt, { current: failnxt, request: initial }],
      [failcur, succnxt, { current: succnxt, request: initial }],

      [succcur, initial, { current: succcur, request: initial }],
      [succcur, pending, { current: succcur, request: pending }],
      [succcur, failnxt, { current: failnxt, request: initial }],
      [succcur, succnxt, { current: succnxt, request: initial }],
    ];

    matrix.forEach(([current, request, expected]) => {
      it(formatTestName(current, request, expected), () => {
        expect(staleWhileRevalidate(current)(request)).toStrictEqual(expected);
      });
    });
  });

  describe("staleIfError", () => {
    const matrix: TestMatrix = [
      [initial, initial, { current: initial, request: initial }],
      [initial, pending, { current: pending, request: pending }],
      [initial, failnxt, { current: failnxt, request: initial }],
      [initial, succnxt, { current: succnxt, request: initial }],

      [pending, initial, { current: pending, request: initial }],
      [pending, pending, { current: pending, request: pending }],
      [pending, failnxt, { current: failnxt, request: initial }],
      [pending, succnxt, { current: succnxt, request: initial }],

      [failcur, initial, { current: failcur, request: initial }],
      [failcur, pending, { current: pending, request: pending }],
      [failcur, failnxt, { current: failnxt, request: initial }],
      [failcur, succnxt, { current: succnxt, request: initial }],

      [succcur, initial, { current: succcur, request: initial }],
      [succcur, pending, { current: succcur, request: pending }],
      [succcur, failnxt, { current: succcur, request: initial }],
      [succcur, succnxt, { current: succnxt, request: initial }],
    ];

    matrix.forEach(([current, request, expected]) => {
      it(formatTestName(current, request, expected), () => {
        expect(staleIfError(current)(request)).toStrictEqual(expected);
      });
    });
  });
});
