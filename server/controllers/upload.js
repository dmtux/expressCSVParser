let express = require('express');
let router = express.Router();
let path = require('path');
let fs = require('fs');
let resumable = require('./vendor/resumable-node.js')(path.join(__dirname, '../../public/uploads/'));

// Handle uploads through Resumable.js
router.post('/upload', function (req, res) {
  resumable.post(req, function (status, filename, original_filename, identifier) {
    let response = function () {
      status.length > 0 ? res.send(status) : res.send('Done');
    };
    let cleanUp = function () {
      resumable.clean(identifier, {onDone: response});
    };

    if (status == 'done') {
      let filePath = path.join(__dirname, `../../public/uploads/${identifier}`);
      let fileExists = fs.existsSync(filePath);
      if (!fileExists) {
        let stream = fs.createWriteStream(filePath);
        resumable.write(identifier, stream, {onDone: cleanUp});
      } else {
        response(status);
      }
    } else {
      response(status);
    }
  });
});

// Handle status checks on chunks through Resumable.js
router.get('/upload', function (req, res) {
  resumable.get(req, function (status, filename, original_filename, identifier) {
    console.log('GET', status);
    res.send((status == 'found' ? 200 : 404), status);
  });
});

module.exports = router;