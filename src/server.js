const app = require('./app');
const config = require('./config');

const port = config.port;
app.listen(port, () => {
  console.log(`Government asset lifecycle backend running on port ${port}`);
});
