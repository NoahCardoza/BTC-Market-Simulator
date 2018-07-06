const express = require('express');
const path = require('path');
const database = require('./database');

const bodyParser = require('body-parser')
const morgan = require('morgan')

const app = express();

app.use(morgan('dev'))
app.use(bodyParser.json())
app.use('/', express.static(path.resolve(__dirname, 'static')))

app.use((req, res, next) => {
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
    res.setHeader('Access-Control-Allow-Headers', 'Authorization')
  }
  next()
})

database.start().then(db => {
  require('./routes')(app, db)
  app.listen(3000)
})
