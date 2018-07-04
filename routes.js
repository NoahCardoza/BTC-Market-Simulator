const random = require('random-js')();
const hat = require('hat');
const logger = require('./logger');
const minPrice = 0

const cRound = n => Math.round(n * 100) / 100
const rs = (n) => random.pick([1, -1]) * n // random sign
const supplyDemand = []

module.exports = (app, db) => {
  const getPrice = n => db.get('price')
  const setPrice = n => db.update('price', p => n).write()

  setInterval(() => {
    let update = 0
    const chance = random.integer(0, 50)
    if (chance > 90) { // 10%
      update = rs(random.real(0, 200))
    } else if (chance < 5) { // 5%
      update = rs(random.real(0, 500))
    } else { // 85%
      update = rs(random.real(0, 100))
    }

    let newPrice = getPrice() + update

    while (supplyDemand.length > 0){
      const v = supplyDemand.pop();
      const pv = Math.abs(v)
      const change = v/pv * (pv**(1/random.real(2, 4)))
      newPrice += change
    }

    while (newPrice <= minPrice) { // to keep the price from getting too low
      newPrice = minPrice + random.real(0, 100)
    }

    setPrice(cRound(newPrice))
  }, 1000)

  const authorize = (req, res, next) => {
    const { authorization } = req.headers
    if (authorization) {
      const token = authorization.split(' ')[1];
      const userDb = db.get('users').find({ token })
      const user = userDb.value()

      if (user){
        req.userDb = userDb
        req.user = user
        return next()
      }
    }
    // ELSE
    res.status(403).send({
      message: 'You do not have access to this page.'
    })
  }

  app.post('/signup', (req, res) => {
    console.log(req.body);
    if (!req.body.email || !req.body.password) {
      res.status(413).send({
        message: 'Invalid body data.'
      })
    } else if (!db.get('users').find({ email: req.body.email }).value()) {
      const token = hat()
      db.get('users').push({
        ...req.body,
        balance: 5000,
        btc: 1,
        token
      }).write()

      res.send({ token })
    } else {
      res.status(409).send({
        message: 'A user with this email alredy exists.'
      })
    }
  })

  app.post('/token', (req, res) => {
    const token = db.get('users').find({
      email: req.body.email,
      password: req.body.password
    }).get('token').value()

    if (token) {
      res.send({ value: token })
    } else {
      res.status(404).send({
        message: 'This user does not exist.'
      })
    }
  })

  app.get('/price', (req, res) => { res.send({
    value: getPrice()
  }) })

  app.get('/btc', authorize, (req, res) => {
    res.send({ value: req.user.btc })
  })

  app.get('/balance', authorize, (req, res) => {
    res.send({ value: req.user.balance })
  })

  app.get('/buy', authorize, (req, res) => {
    const { user, userDb } = req
    const amount = parseFloat(req.query.amount)
    const price = getPrice()
    const cost = amount * price
    if (req.query.amount == undefined) {
      res.status(422).send({
        message: 'Must specify parameter: amount.'
      })
    } else if (amount <= 0 || cost > user.balance) {
      res.status(422).send({
        message: 'Invalid amount.'
      })
    } else {
      supplyDemand.push(cost)
      userDb.update('balance', n => cRound(n - cost)).write()
      userDb.update('btc', n => n + amount).write()
      newUser = userDb.value()
      logger.info(`${user.email} bought ${amount} BTC for ${cost}. BTC = ${newUser.btc}, balance = ${newUser.balance}`)
      res.send({
        message: amount + ' BTC bought for $' + cost + '.'
      })
    }
  })

  app.get('/sell', authorize, (req, res) => {
    const { user, userDb } = req
    const amount = parseFloat(req.query.amount)
    const price = getPrice()
    const profit = amount * price
    if (req.query.amount == undefined) {
      res.status(422).send({
        message: 'Must specify parameter: amount.'
      })
    } else if (amount <= 0 || amount > user.btc) {
      res.status(422).send({
        message: 'Invalid amount.'
      })
    } else {
      supplyDemand.push(-profit)
      userDb.update('balance', n => cRound(n + profit)).write()
      userDb.update('btc', n => n - amount).write()
      newUser = userDb.value()
      logger.info(`${user.email} sold ${amount} BTC for ${profit}. BTC = ${newUser.btc}, balance = ${newUser.balance}`)
      res.send({
        message: amount + ' BTC sold for $' + profit + '.'
      })
    }
  })
}
