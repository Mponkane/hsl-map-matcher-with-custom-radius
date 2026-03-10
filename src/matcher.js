import OSRM from '@project-osrm/osrm';

import { getDataDir, getAvailableDatasets } from './util.js';

// Store for osrm network datasets
const networks = {};

// Helper function to get available profiles
const getProfiles = () => Object.keys(networks);

// Helper function to clear profiles
const clearProfiles = () => Object.getOwnPropertyNames(networks).forEach((k) => delete networks[k]);

const initNetworks = () => {
  // Clear current profiles
  clearProfiles();

  // Get all available routing dataset names
  const dataDir = getDataDir();
  const profiles = getAvailableDatasets();

  profiles.forEach((profile) => {
    networks[profile] = new OSRM(`${dataDir}/${profile}/map-data.osrm`);
  });
};

// Matcher function. Takes geojson as input and returns geojson with map matching confidence level-
// User is now allowed to control the radius by adding it as a parameter to the call
const matchGeometry = async (profile, geometry, radius = 15.0) => {
  if (!getProfiles().includes(profile)) {
    throw Error(`Invalid profile: ${profile}`);
  }

  const osrm = networks[profile];

  const radiusNum = Number(radius);

  if (!Number.isFinite(radiusNum) || radiusNum <= 0) {
    throw Error(`Invalid radius: ${radius}`);
  }

  return new Promise((resolve, reject) => {
    osrm.match(
      {
        coordinates: geometry.coordinates,
        overview: 'full',
        geometries: 'geojson',
        tidy: true,
        gaps: 'ignore',
        radiuses: geometry.coordinates.map(() => radiusNum),
      },
      (err, response) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          confidence:
            response.matchings.reduce((prev, curr) => prev + curr.confidence, 0) /
            response.matchings.length,
          geometry: {
            coordinates: response.matchings.reduce(
              (prev, curr) => prev.concat(curr.geometry.coordinates),
              [],
            ),
            type: 'LineString',
          },
        });
      },
    );
  });
};

export { initNetworks, clearProfiles, getProfiles, matchGeometry };
