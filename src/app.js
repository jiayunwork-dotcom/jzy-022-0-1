'use strict';

const path = require('path');
const express = require('express');
const { loadProfiles } = require('./profiles');
const { buildRouter, errorHandler } = require('./routes');

const PROFILES_FILE = process.env.PROFILES_FILE || path.join(__dirname, '..', 'config', 'profiles.json');

function createApp(profilesFile = PROFILES_FILE) {
  const profiles = loadProfiles(profilesFile); // startup load, read-only afterwards

  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/gold', buildRouter(profiles));

  app.use((req, res) => {
    res.status(404).json({ error: { type: 'NOT_FOUND', message: `no route for ${req.method} ${req.path}` } });
  });
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
