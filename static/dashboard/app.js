const prop = key => obj => obj[key]
const path = keys => obj => keys.reduce((o, key) => o[key], obj, keys)

const api = axios.create()

const pathToValue = path(['data', 'value'])

const getBtcPrice = () =>
  api.get('/price')
    .then(pathToValue)

const getBalance = () =>
  api.get('/balance')
    .then(pathToValue)

const getMyBtc = () =>
  api.get('/btc')
    .then(pathToValue)

const ui = {
  btcPrice: document.querySelector('#btc-price'),
  token: document.querySelector('#token'),
  saveToken: $('#save-token'),
  tokenModel: $('#token-model'),
  tokenError: $('#token-error'),
  app: $('#app'),
  amount: $('#amount'),
  buy: $('#buy'),
  sell: $('#sell'),
  balance: document.querySelector('#balance'),
  btc: document.querySelector('#btc'),
  log: document.querySelector('#log'),
}

function updateUi(){
  Promise.all([getBalance(), getMyBtc()]).then(([balance, btc]) => {
    ui.balance.innerText = balance
    ui.btc.innerText = btc
  })
}

$(window).on('load',function(){
  ui.tokenModel.modal('show');
});

 setInterval(function () {
   getBtcPrice().then(price => {
     ui.btcPrice.innerText = price
   })
}, 1000);

ui.saveToken.on('click', () => {
  api.defaults.headers.common.Authorization = "Bearer " + ui.token.value
  api.get('/balance')
    .then(({ data }) => {
      ui.tokenModel.modal('hide');
      ui.app.removeClass('d-none')
      updateUi()
    })
    .catch((e) => {
      console.error(e)
      ui.tokenError.removeClass('d-none')
    })
})


function appendToLog(text) {
  const div = document.createElement('div')
  div.innerText = text
  ui.log.appendChild(div)
}

const pathToMessage = path(['data', 'message'])
const errorPathToMessage = path(['response', 'data', 'message'])

ui.buy.on('click', () => {
  const amount = ui.amount.val()
  api.get(`/buy?amount=${ amount }`)
    .then(pathToMessage)
    .catch(errorPathToMessage)
    .then(appendToLog)
    .then(updateUi)
})

ui.sell.on('click', () => {
  const amount = ui.amount.val()
  api.get(`/sell?amount=${ amount }`)
    .then(pathToMessage)
    .catch(errorPathToMessage)
    .then(appendToLog)
    .then(updateUi)

})
