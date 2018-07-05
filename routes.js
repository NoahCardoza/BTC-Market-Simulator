const random = require('random-js')();
const hat = require('hat');
const net = require('net');
const path = require('path');
const logger = require('./logger');
const minPrice = 0
const maxPrice = 10000

const cRound = n => Math.round(n * 100) / 100
const rs = (n) => random.pick([1, -1]) * n // random sign
const supplyDemand = []

const squeeze = (val, [min, max]) =>
    val > max
  ? max
  : min > val
  ? min
  : val

const convertRange = (value, r1, r2) => (value - r1[0]) * (r2[1] - r2[0]) / (r1[1] - r1[0]) + r2[0]

const clamp = [-maxPrice, maxPrice]

module.exports = (app, db) => {

  const handelClient = c =>{ //'connection' listener
    console.log('Soket Client Connected');
    c.on('data', data => {
      let string = data.toString()
      if (string.startsWith('set')) {
        const [key, val] = string.slice(3).split('=').map(s => s.trim())
        db.set(key, JSON.parse(val)).write()
      }
    });
  }

  const server = net.createServer(handelClient);
  const exitGracefully = () => server.close()

  server.on('close', () => {
    process.exit()
  })

  server.listen(path.resolve('socket'), function() { //'listening' listener
    console.log('server bound');
    process.once('SIGINT', exitGracefully);
    process.once('SIGUSR2', exitGracefully);
  });

  const getPrice = n => db.get('price')
  const setPrice = n => db.update('price', p => n).write()

  setInterval(() => {
    let update = 0
    const chance = random.integer(0, 100)
    if (chance > 90) { // 10%
      update = rs(random.real(0, 200))
    } else if (chance < 5) { // 5%
      update = rs(random.real(0, 300))
    } else { // 85%
      update = rs(random.real(0, 50))
    }

    let newPrice = getPrice() + update

    while (supplyDemand.length > 0){
      const v = convertRange(squeeze(supplyDemand.pop(), clamp), clamp, [ -800, 800 ]);
      const pv = Math.abs(v)
      const change = (v / pv) * (pv ** (1 / random.real(2, 4)))
      logger.info('Market shifted by ' + change)
      newPrice += change
    }

    while (newPrice <= minPrice || newPrice >= maxPrice) { // to keep the price from getting too low
      if (newPrice <= minPrice) {
        newPrice = minPrice + random.real(1, 100)
      } else {
        newPrice = maxPrice - random.real(1, 100)
      }
    }

    setPrice(cRound(newPrice))
  }, 1500)

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
      logger.info(`${user.email} tried to buy ${amount} BTC costing ${cost} but they only have $${user.balance}.`)
      res.status(422).send({
        message: 'Invalid amount.'
      })
    } else {
      supplyDemand.push(cost)
      userDb.update('balance', n => n - cost).write()
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
      logger.info(`${user.email} tried to buy ${amount} BTC earning ${profit} but they only have ${user.btc} BTC.`)
      res.status(422).send({
        message: 'Invalid amount.'
      })
    } else {
      supplyDemand.push(-profit)
      userDb.update('balance', n => n + profit).write()
      userDb.update('btc', n => n - amount).write()
      newUser = userDb.value()
      logger.info(`${user.email} sold ${amount} BTC for ${profit}. BTC = ${newUser.btc}, balance = ${newUser.balance}`)
      res.send({
        message: amount + ' BTC sold for $' + profit + '.'
      })
    }
  })
}
