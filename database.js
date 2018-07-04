const low = require('lowdb')
const FileAsync = require('lowdb/adapters/FileAsync')
const random = require('random-js')();

module.exports = {
  start: (app, routes) => {
    return low(new FileAsync('db.json')).then(db => {
      db.defaults({
        users: [],
        price: 0 // random.integer(5000, 7000)
      }).write()
      return db
    })
  }
}
