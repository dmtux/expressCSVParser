"use strict";

let express = require('express');
let router = express.Router();
let fs = require('fs');
let path = require('path');
let models = require('../models');
let fastCsv = require('fast-csv');

router.get('/parse/:file', function (req, res, next) {
  let userObjects = [];
  let filePath = path.join(__dirname, `../../public/uploads/${req.params.file}`);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Not found');
  }
  var fileStream = fs.createReadStream(filePath),
    parser = fastCsv();

  fileStream
    .on("readable", function () {
      var data;
      while ((data = fileStream.read()) !== null) {
        parser.write(data);
      }
    })
    .on("end", function () {
      parser.end();
    });

  let lineCounter = 0;
  parser
    .on("readable", function () {
      var data;
      while ((data = parser.read()) !== null) {
        let userObject = models.clients.build({
          firstname: data[0],
          lastname: data[1],
          email: data[2],
          source: req.params.file
        });
        userObjects.push(userObject.save());
      }
    })
    .on("end", function () {
      Promise.all(userObjects)
        .then(() => {
          res.redirect(`/api/datatable/${req.params.file}`);
        });
    });
});
router.get('/datatable/:file', function (req, res, next) {
  res.render('datatable', {title: 'Datable', source: req.params.file});
});

router.post('/users/:file', function (req, res) {
  let Model = models.clients,
    datatablesQuery = require('datatables-query'),
    params = req.body,
    query = datatablesQuery(Model);
  console.log(params);
  query.run(params).then(function (data) {
    res.json(data);
  }, function (err) {
    res.status(500).json(err);
  });
});

module.exports = router;
