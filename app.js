const app = require('express')();
const database = require('./database');

const bodyParser = require('body-parser')
const morgan = require('morgan')

app.use(morgan('dev'))
app.use(bodyParser.json())

database.start().then(db => {
  require('./routes')(app, db)
  app.listen(3000)
})
