module.exports = {
  networks: {
   development: {
     host: "127.0.0.1",
     port: 7545,
     network_id: "*"
   },
   test: {
     host: "127.0.0.1",
     port: 7545,
     network_id: "*"
   }
  },
  compilers: {
    solc: {
      version: "0.6.12"
    }
  },
  mocha: {
    reporter: 'eth-gas-reporter',
    reporterOptions : {
      currency: 'USD',
      coinmarketcap: '793664cd-7f8f-470f-867b-9de05f7d411d'
    }
  }
};
