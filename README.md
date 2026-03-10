# hsl-map-matcher

This is a map matching service to fit routes to OSM map data. The service is based on [OSRM](https://project-osrm.org/).

Routes coming from Jore are not fitted correctly to the OSM, which is not nice looking on printed maps. During jore-import process (https://github.com/HSLdevcom/jore-graphql-import), this service will be called to fit the route to OSM data so that it follows the way precisely.

Map matcher supports currently 3 profiles:
- bus (fitting allowed to highways, including bus-specific roads)
- tram (fitting allowed to railways tagged as tram or light_rail)
- trambus (combination of bus and tram, used for X-lines)

Profiles can be found on [`osrm-profiles/`](osrm-profiles/). They are copied to installed OSRM repository. Refer to OSRM documentation when making changes to them.

## Usage

The app has three endpoints:

- GET /

  Check if the service is up and running. Returns 200 with data update timestamp if everything is ready, 503 if data is not yet fetched (or update process is still running). For startup probes.

  Update timestamp is osm.pbf modifitacion time, so it doesn't tell the actual OSM data extraction time.
  Example return value:
  ```
  {"mapDataLastUpdated":"2023-08-04T00:08:44.000Z"}
  ```

- GET /health

  Check if the service is up and running without checking profiles. For liveness probes.

- GET /profiles

  Check the available profiles that can be used in `/match` -endpoint. Usually `[bus,tram,trambus]`.

- POST /match/:profile

  Matcher endpoint. Expects data to be a linestring geometry in GeoJSON format. Returns fitted geometry in GeoJSON format with confidence level.

  Example request:

  By default, the matcher uses a radius of 15 meters for each input coordinate.
  ```
  curl -X POST -H "Content-Type: application/json" localhost:3000/match/tram -d '{"geometry":{"coordinates":[[24.9316332,60.153836],[24.9341208,60.1548169],[24.9351178,60.1553279],[24.933561,60.1576866]]}}'
  ```
  You can also provide a custom `radius` value in the request body.
  ```
  curl -X POST -H "Content-Type: application/json" localhost:3000/match/tram -d '{"geometry":{"coordinates":[[24.9316332,60.153836],[24.9341208,60.1548169],[24.9351178,60.1553279],[24.933561,60.1576866]]},"radius":30}'
  ```
  Returns
  ```
  {"confidence":0.434171662730074,"geometry":{"coordinates":[[24.931649,60.153831],[24.931674,60.153853],[24.931703,60.153893],[24.93172,60.153933],[24.931725,60.153968],[24.931721,60.154],[24.9317,60.154055],[24.931672,60.154118],[24.931612,60.154206],[24.931589,60.154245],[24.931577,60.154275],[24.931573,60.154304],[24.931575,60.154328],[24.931585,60.154354],[24.931597,60.154376],[24.93162,60.1544],[24.931647,60.154421],[24.931681,60.154442],[24.931716,60.154458],[24.931757,60.154474],[24.931815,60.154489],[24.93188,60.154502],[24.934098,60.154854],[24.934674,60.154945],[24.934744,60.154958],[24.934822,60.154976],[24.934894,60.155002],[24.93493,60.155018],[24.934975,60.155042],[24.935012,60.155069],[24.935046,60.155098],[24.935071,60.15513],[24.935089,60.155165],[24.935098,60.15521],[24.935093,60.155259],[24.935077,60.155295],[24.935062,60.155319],[24.934386,60.156369],[24.93408,60.156843],[24.93398,60.157002],[24.933611,60.157569],[24.933538,60.157683]],"type":"LineString"}}
  ```

## Running locally
```
yarn
yarn start
```

The app downloads all needed data on startup. After startup, the app is running on port 3000 (by default).
First, if old data is not available, the app downloads OSM data and calculates the profiles. If the data already exists, and you want to update it, remove the content of `data/`-directory before startup.

Custom env variables are not needed, but it's possible to set them up by creating `.env`. Check the constants affected by env on [`src/constants.js`](src/constants.js).

# Running on Docker:

```
docker build . -t hsl-map-matcher
docker run -d -p 3000:3000 --name hsl-map-matcher hsl-map-matcher
```