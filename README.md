# Refreshable RemoteData

## Description

When fetching data asynchronously, is is useful to keep track of the progress to communicate the current state of the system. The [RemoteData](https://github.com/devexperts/remote-data-ts) type can be used to express this in a concise way.

_Refreshable RemoteData_ extends this concept. When we need to refresh the network resource, we can avoid falling back to a loading state: If we have data available from a previous fetch, we can keep it around while we load new data in the background.

The following refresh strategies are available:

1. **Stale-while-revalidate:** Keep returning data that was already fetched until new data is available.
2. **Stale-if-error:** Same as above, but if the next value is an error, discard it and return existing stale data instead (if we already have it).

This library builds on:

- [@devexperts/remote-data-ts](https://github.com/devexperts/remote-data-ts)
- [fp-ts](https://github.com/gcanti/fp-ts)

## Installation

```shell
npm install --save fp-ts @devexperts/remote-data-ts
npm install --save refresh-remote-data-ts
```
