import express from 'express';
import { checkSchema, param, validationResult } from 'express-validator';

import { PORT } from './constants.js';
import updateDatasets from './data.js';
import { getProfiles, initNetworks, matchGeometry } from './matcher.js';
import { getAvailableDatasets, getOSMUpdateTimestamp } from './util.js';
import initCronJobs from './schedules.js';

const app = express();

// Startup. If no datasets initialized, download datasets. Otherwise just init profiles.
if (getAvailableDatasets().length === 0) {
  updateDatasets();
} else {
  initNetworks();
}
initCronJobs(); // Auto-update datasets

app.use(express.json());

// Endpoint to check whether the service is ready to process new requests.
app.get('/', (req, res) => {
  if (getProfiles().length === 0) {
    res.status(503).send('Map matching data is not yet ready. Try again a bit later.');
    return;
  }
  const dataUpdateTimestamp = getOSMUpdateTimestamp();
  res.send({ mapDataLastUpdated: dataUpdateTimestamp });
});

// Endpoint to check whether the service is running at all. Almost like '/' but without profile check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Endpoint to get available profiles
app.get('/profiles', (req, res) => {
  const profiles = getProfiles();
  if (profiles.length === 0) {
    res.status(503).send('Map matching data is not yet ready. Try again a bit later.');
    return;
  }
  res.send(profiles);
});

// Validation middlewares for /match -endpoint
const validateProfile = param('profile').custom(async (val) => {
  if (!getProfiles().includes(val)) {
    throw new Error(`Given profile not found. Available profiles are: ${getProfiles().join(',')}`);
  }
});
const validateBody = checkSchema(
  {
    geometry: { isObject: { errorMessage: 'GeoJSON format requires "geometry" field as object' } },
    'geometry.coordinates': {
      isArray: {
        options: {
          min: 2,
        },
        errorMessage:
          'Coordinates should be an array and have at least 2 coordinate pairs (LineStrings only accepted)',
      },
    },
    'geometry.coordinates.*': {
      isArray: {
        options: {
          min: 2,
          max: 2,
        },
        errorMessage: 'Coordinates should be in [lon, lat] format',
      },
    },
    'geometry.coordinates.*.*': {
      isNumeric: { errorMessage: 'Coordinates can only contain numeric values' },
      customSanitizer: { options: (val) => Number(val) },
    },
  },
  ['body'],
);

// Map matching endpoint. Assumes geojson as input. Returns map matched geometry as geojson
app.post('/match/:profile', [validateProfile, validateBody], async (req, res, next) => {
  if (getProfiles().length === 0) {
    res.status(503).send('Map matching data is not yet ready. Try again a bit later.');
    return next();
  }

  const errResult = validationResult(req);

  if (!errResult.isEmpty()) {
    res.status(400);
    res.send({ errors: errResult.array() });
    return next();
  }
  const { profile } = req.params;

  const data = req.body;

  try {
    const fittedGeometry = await matchGeometry(profile, data.geometry, data.radius);
    return res.send(fittedGeometry);
  } catch (err) {
    // return 400 if the fit was not possible
    if (err.message === 'NoSegment') {
      return res
        .status(400)
        .send(
          'Could not find a valid matching. Check the input coordinates that they fit the area.',
        );
    }
    return next(err);
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Map-matcher is running on port ${PORT}`);
});
