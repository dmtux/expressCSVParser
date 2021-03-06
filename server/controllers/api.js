"use strict";

let express = require('express');
let router = express.Router();
let fs = require('fs');
let path = require('path');
let models = require('../models');
let fastCsv = require('fast-csv');
let datatable = require(`sequelize-datatables`);

router.get('/parse/:file', function (req, res, next) {
  let userObjects = [];
  let filePath = path.join(__dirname, `../../public/uploads/${req.params.file}`);
  if (!fs.existsSync(filePath)) {
    res.status(404).send('Not found');
  }
  // TODO: Add file validation
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

  // TODO: Should be refactored to raw sql and chunks
  let lineCounter = 0;
  parser
    .on("readable", function () {
      var data;
      while ((data = parser.read()) !== null) {
        // TODO: Add email validation
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
  datatable(models.clients, req.body, {
    where: {source: req.params.file}
  })
    .then((result) => {
      // result is response for datatables
      res.json(result);
    });
});

module.exports = router;
