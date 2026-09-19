'use strict';

const { createApp } = require('./app');

const PORT = Number(process.env.PORT || 3000);

const app = createApp();
app.listen(PORT, () => {
  console.log(`gold-sequence service listening on port ${PORT}`);
});
