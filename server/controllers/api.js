let express = require('express');
let router = express.Router();
let fs = require('fs');
let path = require('path');
let models = require('../models');

/* GET home page. */
router.get('/parse/:file', function (req, res, next) {
  let filePath = path.join(__dirname, `../../public/uploads/${req.params.file}`);
  if(!fs.existsSync(filePath)) {
    res.status(404).send('Not found');
  }
  
  res.render('datatable', {title: 'Express API'});
});

module.exports = router;
